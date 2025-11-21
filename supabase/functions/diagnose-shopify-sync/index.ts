import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiagnosticResult {
  success: boolean;
  failedSyncs: any[];
  mismatchedOrders: any[];
  statistics: {
    totalPending: number;
    totalFailed: number;
    highPriority: number;
    criticalPriority: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, order_id } = await req.json();

    // Handle manual retry request
    if (action === 'retry' && order_id) {
      console.log(`Manual retry requested for order: ${order_id}`);
      
      // Reset the sync queue item for this order
      const { data: resetData, error: resetError } = await supabase
        .from('sync_queue')
        .update({
          status: 'pending',
          retry_count: 0,
          error_message: null,
        })
        .eq('entity_id', order_id)
        .eq('entity_type', 'order')
        .select();

      if (resetError) {
        throw resetError;
      }

      // Trigger sync queue processing
      const syncResult = await supabase.functions.invoke('process-sync-queue');

      return new Response(
        JSON.stringify({
          success: true,
          message: `Retry initiated for order ${order_id}`,
          reset: resetData,
          syncResult: syncResult.data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: Run diagnostics
    console.log('Running Shopify sync diagnostics...');

    // Get failed sync queue items
    const { data: failedSyncs, error: failedError } = await supabase
      .from('sync_queue')
      .select('*')
      .in('status', ['failed', 'processing'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (failedError) {
      throw failedError;
    }

    // Get statistics
    const { data: statsData, error: statsError } = await supabase
      .from('sync_queue')
      .select('status, priority')
      .eq('status', 'pending');

    if (statsError) {
      throw statsError;
    }

    const statistics = {
      totalPending: statsData?.length || 0,
      totalFailed: failedSyncs?.length || 0,
      highPriority: statsData?.filter(s => s.priority === 'high').length || 0,
      criticalPriority: statsData?.filter(s => s.priority === 'critical').length || 0,
    };

    // Check for mismatched orders (ERP status vs Shopify tags)
    const { data: ordersWithShopifyId, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, shopify_order_id, status, tags')
      .not('shopify_order_id', 'is', null)
      .in('status', ['dispatched', 'delivered', 'returned', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (ordersError) {
      throw ordersError;
    }

    const { getEcomnetStatusTag } = await import('../_shared/ecomnetStatusTags.ts');

    const mismatchedOrders = ordersWithShopifyId?.filter(order => {
      const expectedTag = getEcomnetStatusTag(order.status);
      const hasMismatch = !order.tags || !order.tags.includes(expectedTag);
      return hasMismatch;
    }) || [];

    const result: DiagnosticResult = {
      success: true,
      failedSyncs: failedSyncs || [],
      mismatchedOrders: mismatchedOrders.map(o => ({
        order_id: o.id,
        order_number: o.order_number,
        shopify_order_id: o.shopify_order_id,
        status: o.status,
        expected_tag: getEcomnetStatusTag(o.status),
        current_tags: o.tags,
      })),
      statistics,
    };

    console.log('Diagnostic results:', {
      failedSyncs: result.failedSyncs.length,
      mismatchedOrders: result.mismatchedOrders.length,
      statistics: result.statistics,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in diagnose-shopify-sync:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
