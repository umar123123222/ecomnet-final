import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Checking for stuck orders...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Get orders dispatched more than 10 days ago but not delivered
    const { data: stuckOrders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        dispatched_at,
        dispatches!inner (
          courier,
          tracking_id,
          last_tracking_update
        )
      `)
      .eq('status', 'dispatched')
      .lt('dispatched_at', tenDaysAgo.toISOString());

    if (error) throw error;

    let alertsCreated = 0;

    for (const order of stuckOrders || []) {
      const dispatchedAt = new Date(order.dispatched_at);
      const daysStuck = Math.floor((Date.now() - dispatchedAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from('automated_alerts')
        .select('id')
        .eq('entity_id', order.id)
        .eq('alert_type', 'stuck_order')
        .eq('status', 'active')
        .maybeSingle();

      if (!existingAlert) {
        // Create new alert
        await supabase.from('automated_alerts').insert({
          alert_type: 'stuck_order',
          entity_type: 'order',
          entity_id: order.id,
          severity: daysStuck > 15 ? 'high' : 'medium',
          title: `Order Stuck in Transit: ${order.order_number}`,
          message: `Order has been in transit for ${daysStuck} days without delivery. Please follow up with ${order.dispatches.courier}.`,
          metadata: {
            order_number: order.order_number,
            days_in_transit: daysStuck,
            courier: order.dispatches.courier,
            tracking_id: order.dispatches.tracking_id,
            dispatched_at: order.dispatched_at
          }
        });

        alertsCreated++;

        // Create notification for dispatch manager
        const { data: managers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'dispatch_manager')
          .eq('is_active', true);

        if (managers) {
          for (const manager of managers) {
            await supabase.from('notifications').insert({
              user_id: manager.user_id,
              type: 'alert',
              priority: 'high',
              title: `Order Stuck: ${order.order_number}`,
              message: `In transit for ${daysStuck} days. Contact ${order.dispatches.courier} for update.`,
              action_url: `/orders`,
              metadata: {
                order_id: order.id,
                alert_type: 'stuck_order'
              }
            });
          }
        }
      }
    }

    console.log(`✅ Created ${alertsCreated} stuck order alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_created: alertsCreated,
        total_stuck: stuckOrders?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error checking stuck orders:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
