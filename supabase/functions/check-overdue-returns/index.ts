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
    console.log('🔍 Checking for overdue returns...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Get orders marked as returned but not received
    const { data: overdueReturns, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        total_amount,
        updated_at,
        dispatches!inner (
          courier,
          tracking_id,
          last_tracking_update
        )
      `)
      .eq('status', 'returned')
      .lt('updated_at', sevenDaysAgo.toISOString());

    if (error) throw error;

    let alertsCreated = 0;
    let criticalAlerts = 0;

    for (const order of overdueReturns || []) {
      const updatedAt = new Date(order.updated_at);
      const daysOverdue = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      const isCritical = updatedAt < fourteenDaysAgo;
      const severity = isCritical ? 'critical' : 'high';

      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from('automated_alerts')
        .select('id')
        .eq('entity_id', order.id)
        .eq('alert_type', 'overdue_return')
        .eq('status', 'active')
        .maybeSingle();

      if (!existingAlert) {
        // Create new alert
        await supabase.from('automated_alerts').insert({
          alert_type: 'overdue_return',
          entity_type: 'order',
          entity_id: order.id,
          severity,
          title: `Return Overdue: ${order.order_number}`,
          message: `Order marked as returned ${daysOverdue} days ago but not received at warehouse. ${isCritical ? 'CRITICAL: Consider filing courier claim.' : 'Please follow up with courier.'}`,
          metadata: {
            order_number: order.order_number,
            customer_name: order.customer_name,
            days_overdue: daysOverdue,
            courier: order.dispatches.courier,
            tracking_id: order.dispatches.tracking_id,
            order_value: order.total_amount
          }
        });

        alertsCreated++;
        if (isCritical) criticalAlerts++;

        // Create notification for warehouse manager
        const { data: managers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'warehouse_manager')
          .eq('is_active', true);

        if (managers) {
          for (const manager of managers) {
            await supabase.from('notifications').insert({
              user_id: manager.user_id,
              type: 'alert',
              priority: severity === 'critical' ? 'urgent' : 'high',
              title: `Overdue Return: ${order.order_number}`,
              message: `Return not received for ${daysOverdue} days. Value: ₨${order.total_amount.toLocaleString()}`,
              action_url: `/returns-not-received`,
              metadata: {
                order_id: order.id,
                alert_type: 'overdue_return'
              }
            });
          }
        }
      }
    }

    console.log(`✅ Created ${alertsCreated} alerts (${criticalAlerts} critical)`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_created: alertsCreated,
        critical_alerts: criticalAlerts,
        total_overdue: overdueReturns?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error checking overdue returns:', error);
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
