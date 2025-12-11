import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Optimized settings for faster processing
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 200;
const MAX_BATCHES_PER_INVOCATION = 15; // Process 750 orders per call
const MAX_RUNTIME_MS = 55 * 1000; // 55 seconds max runtime
const STALE_JOB_HOURS = 1; // Reduced from 2 hours

// Self-continuation function
async function continueProcessing(supabaseUrl: string, anonKey: string) {
  try {
    console.log('🔄 Self-continuing to process more orders...');
    const response = await fetch(`${supabaseUrl}/functions/v1/nightly-tracking-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ trigger: 'self-continuation' }),
    });
    console.log(`✅ Self-continuation triggered, status: ${response.status}`);
  } catch (error) {
    console.error('❌ Self-continuation failed:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const trigger = body.trigger || 'scheduled';
    const forceNewJob = body.forceNew || false;
    
    console.log(`🚀 Nightly tracking orchestrator started (trigger: ${trigger}, batch_size: ${BATCH_SIZE}, max_batches: ${MAX_BATCHES_PER_INVOCATION})`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Clean up stale jobs (stuck for 1+ hour)
    const staleThreshold = new Date(Date.now() - STALE_JOB_HOURS * 60 * 60 * 1000).toISOString();
    await supabase
      .from('tracking_update_jobs')
      .update({ 
        status: 'failed', 
        error_message: 'Job timed out',
        completed_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .lt('started_at', staleThreshold);

    // Step 2: Check for incomplete job (resume capability)
    let job: any = null;
    let resuming = false;
    
    if (!forceNewJob) {
      const { data: incompleteJob } = await supabase
        .from('tracking_update_jobs')
        .select('*')
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
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
      // Update total orders count
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

    while (hasMore && batchesProcessed < MAX_BATCHES_PER_INVOCATION) {
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
            no_change_count: noChangeCount
          })
          .eq('id', job.id);

        // Self-continue in background
        if (trigger === 'scheduled' || trigger === 'self-continuation') {
          // @ts-ignore
          EdgeRuntime.waitUntil(continueProcessing(supabaseUrl, supabaseAnonKey));
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Processed ${batchesProcessed} batches, self-continuing...`,
            job_id: job.id,
            totalOrders,
            hasMore: true,
            results: {
              totalProcessed: offset,
              delivered: deliveredCount,
              returned: returnedCount,
              failed: failedCount,
              noChange: noChangeCount,
              batchesProcessed
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`📦 Processing batch ${batchesProcessed + 1}/${MAX_BATCHES_PER_INVOCATION} at offset ${offset}...`);

      try {
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
          failedCount += BATCH_SIZE;
          offset += BATCH_SIZE;
          batchesProcessed++;
          continue;
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

          console.log(`✅ Batch complete: delivered=${results.delivered}, returned=${results.returned}, dispatchesCreated=${results.dispatchesCreated || 0}`);

          // Update progress every batch
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
          console.warn(`Invalid batch result at offset ${offset}`);
          offset += BATCH_SIZE;
          hasMore = offset < totalOrders;
          batchesProcessed++;
        }

      } catch (error: any) {
        console.error(`Error processing batch at offset ${offset}:`, error);
        failedCount += BATCH_SIZE;
        offset += BATCH_SIZE;
        hasMore = offset < totalOrders;
        batchesProcessed++;
      }

      // Short delay between batches
      if (hasMore && batchesProcessed < MAX_BATCHES_PER_INVOCATION) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Save progress
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

    // Check if more to process
    if (hasMore) {
      console.log(`📤 Batch limit reached at offset ${offset}, ${totalOrders - offset} orders remaining...`);
      
      if (trigger === 'scheduled' || trigger === 'self-continuation') {
        // @ts-ignore
        EdgeRuntime.waitUntil(continueProcessing(supabaseUrl, supabaseAnonKey));
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${batchesProcessed} batches (${offset} orders), self-continuing...`,
          job_id: job.id,
          totalOrders,
          hasMore: true,
          results: {
            totalProcessed: offset,
            delivered: deliveredCount,
            returned: returnedCount,
            failed: failedCount,
            noChange: noChangeCount,
            batchesProcessed
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark job complete
    await supabase
      .from('tracking_update_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', job.id);

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`🎉 Job completed in ${totalTime}s: delivered=${deliveredCount}, returned=${returnedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tracking update completed',
        job_id: job.id,
        resumed: resuming,
        totalOrders,
        hasMore: false,
        results: {
          totalProcessed: offset,
          delivered: deliveredCount,
          returned: returnedCount,
          failed: failedCount,
          noChange: noChangeCount,
          batchesProcessed,
          durationSeconds: totalTime
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
