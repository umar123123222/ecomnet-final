import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FraudAssessmentRequest {
  order_id: string;
  customer_ip?: string;
  gps_latitude?: number;
  gps_longitude?: number;
}

interface FraudIndicators {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  patterns: string[];
  autoActions: string[];
  shouldBlock: boolean;
  shouldFlag: boolean;
}

/**
 * Calculate fraud risk score for an order (0-100)
 */
const calculateOrderFraudRisk = (
  order: any,
  customerOrders: any[] = [],
  allOrders: any[] = []
): FraudIndicators => {
  const flags: string[] = [];
  const patterns: string[] = [];
  const autoActions: string[] = [];
  let riskScore = 0;

  // 1. High-value order (>50,000 PKR)
  if (order.total_amount > 50000) {
    flags.push('High Value Order');
    riskScore += 20;
  }

  // 2. Multiple orders from same phone in short time
  const samePhoneOrders = allOrders.filter((o: any) => 
    o.customer_phone === order.customer_phone && 
    o.id !== order.id &&
    (new Date(order.created_at).getTime() - new Date(o.created_at).getTime()) < 24 * 60 * 60 * 1000
  );
  if (samePhoneOrders.length >= 3) {
    flags.push(`${samePhoneOrders.length + 1} Orders in 24hrs`);
    patterns.push('Rapid Order Velocity');
    riskScore += 25;
  }

  // 3. Address changed from previous order
  const previousOrder = customerOrders
    .filter((o: any) => o.id !== order.id && new Date(o.created_at) < new Date(order.created_at))
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  
  if (previousOrder && order.customer_address !== previousOrder.customer_address) {
    flags.push('Address Changed');
    riskScore += 15;
  }

  // 4. Multiple addresses for same phone
  const uniqueAddresses = new Set(
    customerOrders
      .filter((o: any) => o.customer_phone === order.customer_phone)
      .map((o: any) => o.customer_address?.toLowerCase().trim())
  );
  if (uniqueAddresses.size >= 4) {
    flags.push(`${uniqueAddresses.size} Different Addresses`);
    patterns.push('Address Hopping Pattern');
    riskScore += 20;
  }

  // 5. First-time customer with high-value order
  if (customerOrders.length <= 1 && order.total_amount > 30000) {
    flags.push('New Customer - High Value');
    riskScore += 20;
  }

  // 6. High return rate for customer
  const returnOrders = customerOrders.filter((o: any) => o.status === 'cancelled' || o.status === 'returned');
  const returnRate = customerOrders.length > 0 ? (returnOrders.length / customerOrders.length) * 100 : 0;
  if (returnRate > 50 && customerOrders.length >= 3) {
    flags.push(`${returnRate.toFixed(0)}% Return Rate`);
    patterns.push('High Return Pattern');
    riskScore += 30;
  }

  // 7. Order verification status
  if (order.verification_status === 'disapproved') {
    flags.push('Address Disapproved');
    riskScore += 25;
  }

  // 8. Suspicious city/area patterns
  const suspiciousCities = ['test', 'fake', 'dummy'];
  if (suspiciousCities.some((city: string) => order.city?.toLowerCase().includes(city))) {
    flags.push('Suspicious Location');
    patterns.push('Test/Fake Address Pattern');
    riskScore += 35;
  }

  // 9. Phone number patterns
  if (order.customer_phone?.includes('0000') || order.customer_phone?.includes('1111')) {
    flags.push('Suspicious Phone Pattern');
    riskScore += 25;
  }

  // 10. Multiple failed delivery attempts
  const failedDeliveries = customerOrders.filter((o: any) => 
    o.status === 'cancelled' && 
    o.notes?.toLowerCase().includes('delivery failed')
  );
  if (failedDeliveries.length >= 2) {
    flags.push(`${failedDeliveries.length} Failed Deliveries`);
    patterns.push('Repeated Delivery Failures');
    riskScore += 20;
  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (riskScore >= 80) riskLevel = 'critical';
  else if (riskScore >= 60) riskLevel = 'high';
  else if (riskScore >= 40) riskLevel = 'medium';

  // Determine automated actions
  if (riskScore >= 80) {
    autoActions.push('AUTO-BLOCK: Order requires manual approval');
    autoActions.push('ALERT: Notify fraud team immediately');
  } else if (riskScore >= 60) {
    autoActions.push('FLAG: Mark order for review');
    autoActions.push('VERIFY: Require additional verification');
  } else if (riskScore >= 40) {
    autoActions.push('MONITOR: Track order closely');
  }

  return {
    riskScore: Math.min(riskScore, 100),
    riskLevel,
    flags,
    patterns,
    autoActions,
    shouldBlock: riskScore >= 80,
    shouldFlag: riskScore >= 60
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: FraudAssessmentRequest = await req.json();
    const { order_id, customer_ip, gps_latitude, gps_longitude } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Assessing fraud risk for order: ${order_id}`);

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found', details: orderError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all orders for context
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (allOrdersError) {
      console.error('Error fetching all orders:', allOrdersError);
    }

    // Fetch customer's order history
    const { data: customerOrders, error: customerOrdersError } = await supabase
      .from('orders')
      .select('*')
      .or(`customer_phone.eq.${order.customer_phone},customer_email.eq.${order.customer_email}`)
      .order('created_at', { ascending: false });

    if (customerOrdersError) {
      console.error('Error fetching customer orders:', customerOrdersError);
    }

    // Calculate fraud risk
    const fraudIndicators = calculateOrderFraudRisk(
      order,
      customerOrders || [],
      allOrders || []
    );

    console.log(`Risk assessment complete:`, {
      order_id,
      risk_score: fraudIndicators.riskScore,
      risk_level: fraudIndicators.riskLevel,
      should_block: fraudIndicators.shouldBlock
    });

    // Prepare update data
    const updateData: any = {
      risk_score: fraudIndicators.riskScore,
      risk_level: fraudIndicators.riskLevel,
      fraud_flags: JSON.stringify({
        flags: fraudIndicators.flags,
        patterns: fraudIndicators.patterns,
        actions: fraudIndicators.autoActions
      })
    };

    // Add IP and GPS data if provided
    if (customer_ip) updateData.customer_ip = customer_ip;
    if (gps_latitude) updateData.gps_latitude = gps_latitude;
    if (gps_longitude) updateData.gps_longitude = gps_longitude;

    // Auto-block if critical risk
    if (fraudIndicators.shouldBlock) {
      updateData.auto_blocked = true;
      updateData.auto_block_reason = fraudIndicators.autoActions.join('; ');
      updateData.status = 'pending'; // Keep pending for manual review
      
      console.log(`Order ${order_id} AUTO-BLOCKED due to critical fraud risk`);
    }

    // Update order with fraud assessment
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order_id);

    if (updateError) {
      console.error('Error updating order with fraud assessment:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update order', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notification for high-risk orders
    if (fraudIndicators.riskLevel === 'high' || fraudIndicators.riskLevel === 'critical') {
      // Fetch super admins and managers
      const { data: adminUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['super_admin', 'super_manager'])
        .eq('is_active', true);

      if (adminUsers && adminUsers.length > 0) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.user_id,
          type: 'fraud_alert',
          priority: fraudIndicators.riskLevel === 'critical' ? 'urgent' : 'high',
          title: `${fraudIndicators.riskLevel.toUpperCase()} Risk Order Detected`,
          message: `Order ${order.order_number} has been flagged with ${fraudIndicators.riskLevel} fraud risk (score: ${fraudIndicators.riskScore})`,
          action_url: `/orders`,
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            risk_score: fraudIndicators.riskScore,
            risk_level: fraudIndicators.riskLevel,
            flags: fraudIndicators.flags
          }
        }));

        await supabase.from('notifications').insert(notifications);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id,
        fraud_assessment: {
          risk_score: fraudIndicators.riskScore,
          risk_level: fraudIndicators.riskLevel,
          flags: fraudIndicators.flags,
          patterns: fraudIndicators.patterns,
          auto_blocked: fraudIndicators.shouldBlock,
          requires_review: fraudIndicators.shouldFlag
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in assess-order-fraud-risk:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
