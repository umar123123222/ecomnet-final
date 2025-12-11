import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting scheduled database cleanup...');

    const results = {
      sync_queue_deleted: 0,
      tracking_history_deduplicated: 0,
      old_notifications_deleted: 0,
      errors: [] as string[],
    };

    // 1. Clean up sync_queue - delete old failed/completed entries
    try {
      const { data: syncCleanup, error: syncError } = await supabase.rpc('cleanup_sync_queue');
      if (syncError) {
        console.error('Sync queue cleanup error:', syncError);
        results.errors.push(`sync_queue: ${syncError.message}`);
      } else {
        results.sync_queue_deleted = syncCleanup || 0;
        console.log(`Cleaned ${results.sync_queue_deleted} sync_queue entries`);
      }
    } catch (e: any) {
      results.errors.push(`sync_queue: ${e.message}`);
    }

    // 2. Clean up old notifications (older than 30 days and read)
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count, error: notifError } = await supabase
        .from('notifications')
        .delete()
        .eq('read', true)
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select('*', { count: 'exact', head: true });

      if (notifError) {
        console.error('Notifications cleanup error:', notifError);
        results.errors.push(`notifications: ${notifError.message}`);
      } else {
        results.old_notifications_deleted = count || 0;
        console.log(`Cleaned ${results.old_notifications_deleted} old notifications`);
      }
    } catch (e: any) {
      results.errors.push(`notifications: ${e.message}`);
    }

    // 3. Clean up stuck processing items in sync_queue (older than 1 hour)
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { error: stuckError } = await supabase
        .from('sync_queue')
        .update({ status: 'failed', error_message: 'Stuck in processing - auto-failed by cleanup job' })
        .eq('status', 'processing')
        .lt('updated_at', oneHourAgo.toISOString());

      if (stuckError) {
        console.error('Stuck items cleanup error:', stuckError);
        results.errors.push(`stuck_items: ${stuckError.message}`);
      } else {
        console.log('Reset stuck processing items');
      }
    } catch (e: any) {
      results.errors.push(`stuck_items: ${e.message}`);
    }

    // 4. Clean up old activity logs (older than 90 days)
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { error: activityError } = await supabase
        .from('activity_logs')
        .delete()
        .lt('created_at', ninetyDaysAgo.toISOString());

      if (activityError) {
        console.error('Activity logs cleanup error:', activityError);
        results.errors.push(`activity_logs: ${activityError.message}`);
      } else {
        console.log('Cleaned old activity logs');
      }
    } catch (e: any) {
      results.errors.push(`activity_logs: ${e.message}`);
    }

    console.log('Database cleanup completed:', results);

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Cleanup job failed:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
