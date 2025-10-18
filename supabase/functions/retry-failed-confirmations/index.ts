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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting retry process for failed confirmations...');

    // Get failed confirmations that are ready to retry (max 3 retries)
    const { data: confirmations, error: fetchError } = await supabase
      .from('order_confirmations')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', 3)
      .lte('retry_scheduled_at', new Date().toISOString())
      .order('retry_scheduled_at', { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    if (!confirmations || confirmations.length === 0) {
      console.log('No confirmations to retry');
      return new Response(
        JSON.stringify({ message: 'No confirmations to retry', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${confirmations.length} confirmations to retry`);

    let successCount = 0;
    let failureCount = 0;

    // Process each confirmation
    for (const confirmation of confirmations) {
      try {
        // Call send-order-confirmation function
        const response = await supabase.functions.invoke('send-order-confirmation', {
          body: {
            confirmation_id: confirmation.id,
            force: true,
          },
        });

        if (response.error) {
          console.error(`Failed to retry confirmation ${confirmation.id}:`, response.error);
          failureCount++;
        } else {
          console.log(`Successfully retried confirmation ${confirmation.id}`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error retrying confirmation ${confirmation.id}:`, error);
        failureCount++;
      }

      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Mark expired confirmations
    const { data: expiredCount } = await supabase.rpc('mark_expired_confirmations');

    console.log('Retry process completed:', {
      total: confirmations.length,
      success: successCount,
      failed: failureCount,
      expired: expiredCount,
    });

    // Send alert for confirmations that failed all retries
    const { data: maxRetriesReached } = await supabase
      .from('order_confirmations')
      .select('*, order:orders(order_number)')
      .eq('status', 'failed')
      .gte('retry_count', 3);

    if (maxRetriesReached && maxRetriesReached.length > 0) {
      console.log(`Alert: ${maxRetriesReached.length} confirmations reached max retries`);
      
      // Create notifications for managers
      const notifications = maxRetriesReached.map(conf => ({
        user_id: null, // Will be sent to all managers
        type: 'alert',
        priority: 'high',
        title: 'Order Confirmation Failed',
        message: `Order #${conf.order.order_number} failed confirmation after 3 attempts. Manual intervention required.`,
        action_url: `/orders?order_id=${conf.order_id}`,
        metadata: {
          order_id: conf.order_id,
          confirmation_id: conf.id,
        },
      }));

      // Get all manager user IDs
      const { data: managers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['super_admin', 'super_manager', 'store_manager'])
        .eq('is_active', true);

      if (managers) {
        const managerNotifications = managers.flatMap(manager =>
          notifications.map(notif => ({ ...notif, user_id: manager.user_id }))
        );

        await supabase.from('notifications').insert(managerNotifications);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: confirmations.length,
        succeeded: successCount,
        failed: failureCount,
        expired: expiredCount || 0,
        max_retries_reached: maxRetriesReached?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in retry process:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
