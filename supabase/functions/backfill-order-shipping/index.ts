import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyOrderResponse {
  order: {
    id: number;
    order_number: number;
    total_shipping_price_set?: {
      shop_money: { amount: string; currency_code: string; };
    };
    shipping_lines?: Array<{ price: string; title: string; }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Shopify credentials from api_settings
    const { data: settings, error: settingsError } = await supabase
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_API_TOKEN', 'SHOPIFY_API_VERSION']);
    
    if (settingsError || !settings || settings.length < 3) {
      throw new Error('Shopify credentials not found in api_settings');
    }
    
    const storeUrl = settings.find((s: any) => s.setting_key === 'SHOPIFY_STORE_URL')?.setting_value;
    const accessToken = settings.find((s: any) => s.setting_key === 'SHOPIFY_ADMIN_API_TOKEN')?.setting_value;
    const apiVersion = settings.find((s: any) => s.setting_key === 'SHOPIFY_API_VERSION')?.setting_value || '2024-01';
    
    if (!storeUrl || !accessToken) {
      throw new Error('Incomplete Shopify credentials');
    }

    // Get orders with shopify_order_id but no shipping_charges
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, shopify_order_id, order_number')
      .not('shopify_order_id', 'is', null)
      .or('shipping_charges.is.null,shipping_charges.eq.0')
      .limit(100); // Process in batches of 100

    if (ordersError) {
      throw ordersError;
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No orders to backfill',
        processed: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Backfilling shipping charges for ${orders.length} orders`);

    let processed = 0;
    let errors = 0;

    // Process each order
    for (const order of orders) {
      try {
        // Fetch order from Shopify API
        const response = await fetch(`${storeUrl}/admin/api/${apiVersion}/orders/${order.shopify_order_id}.json`, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`Failed to fetch Shopify order ${order.shopify_order_id}: ${response.status}`);
          errors++;
          continue;
        }

        const data: ShopifyOrderResponse = await response.json();
        
        // Extract shipping charges
        const shippingCharges = parseFloat(
          data.order.total_shipping_price_set?.shop_money?.amount || 
          data.order.shipping_lines?.reduce((sum, line) => sum + parseFloat(line.price || '0'), 0).toString() || 
          '0'
        );

        // Update order with shipping charges
        const { error: updateError } = await supabase
          .from('orders')
          .update({ shipping_charges: shippingCharges })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Failed to update order ${order.order_number}:`, updateError);
          errors++;
        } else {
          console.log(`✓ Updated order ${order.order_number} with shipping: ${shippingCharges}`);
          processed++;
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing order ${order.order_number}:`, error);
        errors++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Backfill complete`,
      processed,
      errors,
      total: orders.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backfill shipping charges error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
