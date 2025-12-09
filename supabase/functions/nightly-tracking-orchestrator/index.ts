import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000; // 2 seconds between batches
const MAX_RUNTIME_MS = 50 * 60 * 1000; // 50 minutes max runtime
const STALE_JOB_HOURS = 2; // Mark jobs as failed if stuck for 2+ hours

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const trigger = body.trigger || 'scheduled';
    const forceNewJob = body.forceNew || false;
    
    console.log(`🚀 Nightly tracking orchestrator started (trigger: ${trigger})`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Step 1: Clean up stale jobs (stuck for 2+ hours)
    const staleThreshold = new Date(Date.now() - STALE_JOB_HOURS * 60 * 60 * 1000).toISOString();
    await supabase
      .from('tracking_update_jobs')
      .update({ 
        status: 'failed', 
        error_message: 'Job timed out after 2 hours',
        completed_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .lt('started_at', staleThreshold);

    // Step 2: Check for incomplete job from today (resume capability)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    let job: any = null;
    let resuming = false;
    
    if (!forceNewJob) {
      const { data: incompleteJob } = await supabase
        .from('tracking_update_jobs')
        .select('*')
        .eq('status', 'running')
        .gte('started_at', todayStart.toISOString())
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      if (incompleteJob) {
        job = incompleteJob;
        resuming = true;
        console.log(`📂 Resuming job ${job.id} from offset ${job.last_processed_offset}`);
      }
    }

    // Step 3: Get total count of orders needing tracking
    const { count: totalOrders, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'dispatched')
      .not('tracking_id', 'is', null)
      .neq('tracking_id', '');

    if (countError) {
      throw new Error(`Failed to count orders: ${countError.message}`);
    }

    console.log(`📊 Total orders needing tracking: ${totalOrders}`);

    if (!totalOrders || totalOrders === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No orders need tracking updates',
          total_orders: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Create new job if not resuming
    if (!job) {
      const { data: newJob, error: createError } = await supabase
        .from('tracking_update_jobs')
        .insert({
          status: 'running',
          total_orders: totalOrders,
          last_processed_offset: 0,
          trigger_type: trigger
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create job: ${createError.message}`);
      }
      
      job = newJob;
      console.log(`📝 Created new job ${job.id}`);
    } else {
      // Update total orders count in case it changed
      await supabase
        .from('tracking_update_jobs')
        .update({ total_orders: totalOrders })
        .eq('id', job.id);
    }

    // Step 5: Process batches until done or timeout
    let offset = job.last_processed_offset || 0;
    let deliveredCount = job.delivered_count || 0;
    let returnedCount = job.returned_count || 0;
    let failedCount = job.failed_count || 0;
    let noChangeCount = job.no_change_count || 0;
    let hasMore = true;
    let batchesProcessed = 0;

    while (hasMore) {
      // Check if we're approaching timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_RUNTIME_MS) {
        console.log(`⏰ Approaching timeout after ${Math.round(elapsed / 1000)}s, saving progress...`);
        
        await supabase
          .from('tracking_update_jobs')
          .update({
            last_processed_offset: offset,
            delivered_count: deliveredCount,
            returned_count: returnedCount,
            failed_count: failedCount,
            no_change_count: noChangeCount,
            error_message: `Paused at offset ${offset} due to timeout, will resume next run`
          })
          .eq('id', job.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Job paused due to timeout, will resume next run',
            job_id: job.id,
            progress: {
              offset,
              total_orders: totalOrders,
              delivered: deliveredCount,
              returned: returnedCount,
              failed: failedCount,
              no_change: noChangeCount,
              batches_processed: batchesProcessed
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`📦 Processing batch at offset ${offset}...`);

      try {
        // Call nightly-tracking-update function
        const { data: batchResult, error: batchError } = await supabase.functions.invoke(
          'nightly-tracking-update',
          {
            body: {
              trigger: 'orchestrator',
              offset: offset,
              limit: BATCH_SIZE
            }
          }
        );

        if (batchError) {
          console.error(`Batch error at offset ${offset}:`, batchError);
          failedCount += BATCH_SIZE; // Assume all failed in this batch
          offset += BATCH_SIZE;
          continue; // Don't stop, continue with next batch
        }

        if (batchResult?.success && batchResult?.results) {
          const results = batchResult.results;
          deliveredCount += results.delivered || 0;
          returnedCount += results.returned || 0;
          failedCount += results.failed || 0;
          noChangeCount += results.noChange || 0;
          
          hasMore = batchResult.hasMore === true;
          offset += BATCH_SIZE;
          batchesProcessed++;

          console.log(`✅ Batch complete: delivered=${results.delivered}, returned=${results.returned}, failed=${results.failed}, hasMore=${hasMore}`);

          // Update progress in database every batch
          await supabase
            .from('tracking_update_jobs')
            .update({
              last_processed_offset: offset,
              delivered_count: deliveredCount,
              returned_count: returnedCount,
              failed_count: failedCount,
              no_change_count: noChangeCount
            })
            .eq('id', job.id);
        } else {
          // No valid result, but don't stop
          console.warn(`Invalid batch result at offset ${offset}:`, batchResult);
          offset += BATCH_SIZE;
          hasMore = offset < totalOrders;
        }

      } catch (error: any) {
        console.error(`Error processing batch at offset ${offset}:`, error);
        failedCount += BATCH_SIZE;
        offset += BATCH_SIZE;
        hasMore = offset < totalOrders;
        // Continue with next batch, don't stop
      }

      // Delay between batches to avoid rate limits
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Step 6: Mark job as complete
    await supabase
      .from('tracking_update_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_processed_offset: offset,
        delivered_count: deliveredCount,
        returned_count: returnedCount,
        failed_count: failedCount,
        no_change_count: noChangeCount,
        error_message: null
      })
      .eq('id', job.id);

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`🎉 Job completed in ${totalTime}s: delivered=${deliveredCount}, returned=${returnedCount}, failed=${failedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tracking update completed',
        job_id: job.id,
        resumed: resuming,
        results: {
          total_orders: totalOrders,
          delivered: deliveredCount,
          returned: returnedCount,
          failed: failedCount,
          no_change: noChangeCount,
          batches_processed: batchesProcessed,
          duration_seconds: totalTime
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Orchestrator error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
