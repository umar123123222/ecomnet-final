import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { calculateOrderTotal, filterActiveLineItems } from '../_shared/orderTotalCalculator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Starting fix for adjusted order totals...');

    // Get all orders that have items with current_quantity property
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, items, total_amount')
      .not('items', 'is', null);

    if (ordersError) throw ordersError;

    let fixed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const order of orders || []) {
      try {
        const items = order.items as any[];
        if (!items || items.length === 0) {
          skipped++;
          continue;
        }

        // Check if any item has current_quantity (indicates adjustments)
        const hasAdjustments = items.some(item => 'current_quantity' in item);
        
        if (!hasAdjustments) {
          skipped++;
          continue;
        }

        // Check if any item was removed (current_quantity = 0)
        const hasRemovedItems = items.some(item => {
          const qty = item.current_quantity ?? item.quantity ?? 0;
          return qty === 0;
        });

        if (!hasRemovedItems) {
          skipped++;
          continue;
        }

        // Recalculate total and filter items
        const activeLineItems = filterActiveLineItems(items);
        
        // Calculate new total from active items
        const newTotal = activeLineItems.reduce((sum, item) => {
          const qty = item.quantity ?? 0;
          const price = parseFloat(item.price || '0');
          return sum + (price * qty);
        }, 0);

        // Update order
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            items: activeLineItems,
            total_amount: newTotal,
          })
          .eq('id', order.id);

        if (updateError) {
          errors.push(`Order ${order.order_number}: ${updateError.message}`);
          continue;
        }

        console.log(`Fixed order ${order.order_number}: ${order.total_amount} → ${newTotal}`);
        fixed++;

      } catch (err: any) {
        errors.push(`Order ${order.order_number}: ${err.message}`);
      }
    }

    console.log(`Fix completed: ${fixed} fixed, ${skipped} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        fixed,
        skipped,
        errors,
        message: `Fixed ${fixed} orders with adjusted totals`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error fixing adjusted order totals:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
