import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is super admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) {
      throw new Error('Only super admins can perform system-wide updates');
    }

    console.log('Starting system-wide order status update to pending...');

    // Get count of orders that will be updated
    const { count: totalCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: nonPendingCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'pending');

    console.log(`Total orders: ${totalCount}, Orders to update: ${nonPendingCount}`);

    // Update all orders to pending
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'pending' })
      .neq('status', 'pending');

    if (updateError) {
      throw updateError;
    }

    console.log(`Successfully updated ${nonPendingCount} orders to pending status`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'All orders updated to pending status',
        totalOrders: totalCount,
        ordersUpdated: nonPendingCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating orders:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
