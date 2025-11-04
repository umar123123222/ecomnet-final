import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

// This function runs on a schedule (every 5 minutes) to process the sync queue
Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting scheduled sync queue processing...');

    // Call the process-sync-queue function
    const { data, error } = await supabase.functions.invoke('process-sync-queue');

    if (error) {
      console.error('Error processing sync queue:', error);
      throw error;
    }

    const result = data || { processed: 0, failed: 0 };
    
    console.log(`Sync queue processed: ${result.processed} items completed, ${result.failed} failed`);

    // If there are failed items, check if they need attention
    if (result.failed > 0) {
      // Get failed items count
      const { data: failedItems, error: failedError } = await supabase
        .from('sync_queue')
        .select('id, retry_count, error_message')
        .eq('status', 'failed')
        .gte('retry_count', 3);

      if (!failedError && failedItems && failedItems.length > 0) {
        console.warn(`⚠️ ${failedItems.length} items have failed 3+ times and need attention`);
        
        // Create notification for super_admins
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin')
          .eq('is_active', true);

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            await supabase.from('notifications').insert({
              user_id: admin.user_id,
              type: 'warning',
              title: 'Shopify Sync Failures',
              message: `${failedItems.length} sync operations have failed multiple times. Please check the sync queue.`,
              priority: 'high',
              action_url: '/business-settings',
              metadata: { failed_count: failedItems.length },
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: result.processed,
        failed: result.failed,
        message: 'Scheduled sync processing completed',
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Scheduled sync processor error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});