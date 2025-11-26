import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation helper
const validateEntry = (entry: string): { valid: boolean; error?: string; errorCode?: string; suggestion?: string } => {
  // Too short (less than 5 characters)
  if (entry.length < 5) {
    return { 
      valid: false, 
      error: 'Entry too short', 
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Enter complete tracking ID or order number (minimum 5 characters)' 
    };
  }
  
  // Scientific notation from Excel (e.g., "2.11295E+13")
  if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(entry)) {
    return { 
      valid: false, 
      error: 'Invalid format - Excel scientific notation detected', 
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Format the Excel column as Text before copying' 
    };
  }
  
  // Courier name entered instead of tracking ID
  const courierNames = ['postex', 'leopard', 'tcs', 'callcourier', 'call courier', 'dhl', 'fedex', 'm&p', 'swyft', 'trax'];
  if (courierNames.includes(entry.toLowerCase())) {
    return { 
      valid: false, 
      error: 'Courier name entered instead of tracking ID', 
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Enter tracking ID or order number, not courier name' 
    };
  }
  
  return { valid: true };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { entry, courierId, courierName, courierCode, userId } = await req.json();

    if (!entry || !userId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields',
          errorCode: 'MISSING_FIELDS'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate entry format
    const validation = validateEntry(entry);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: validation.error!,
          errorCode: validation.errorCode!,
          suggestion: validation.suggestion,
          searchedEntry: entry
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    
    console.log(`[Rapid Dispatch] Searching for entry: "${entry}"`);

    // OPTIMIZATION 1 & 2: Combined query - order + dispatch check (removed broken courier join)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, tracking_id, order_number, customer_name, total_amount, courier, status,
        dispatches!left(id)
      `)
      .or(`tracking_id.eq.${entry},order_number.eq.${entry},order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
      .limit(1)
      .maybeSingle();

    if (orderError) {
      console.error('[Rapid Dispatch] Order query error:', orderError);
    }

    // OPTIMIZATION 4: Bug fix - only search for similar and return NOT_FOUND if order not found
    if (!order) {
      console.log(`[Rapid Dispatch] Order not found for entry: "${entry}"`);
      
      const { data: similar } = await supabase
        .from('orders')
        .select('tracking_id, order_number')
        .ilike('tracking_id', `${entry.slice(0, -2)}%`)
        .limit(3);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not found in database',
          errorCode: 'NOT_FOUND',
          searchedEntry: entry,
          suggestion: similar?.length 
            ? `Did you mean: ${similar.map(s => s.tracking_id || s.order_number).filter(Boolean).join(', ')}?`
            : 'Verify the tracking ID or order number. May need to sync from Shopify.',
          processingTime: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Rapid Dispatch] Order found: ${order.order_number}, Status: ${order.status}, Courier: ${order.courier || 'none'}`);

    // Check if already dispatched (from joined data)
    if (order.dispatches && order.dispatches.length > 0) {
      console.log(`[Rapid Dispatch] Order already dispatched: ${order.order_number}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order already dispatched',
          errorCode: 'ALREADY_DISPATCHED',
          order: { order_number: order.order_number, customer_name: order.customer_name },
          suggestion: 'This order was already dispatched. Check dispatch records.',
          processingTime: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine match type
    const matchType = order.tracking_id === entry ? 'tracking_id' : 'order_number';

    // Determine courier - fetch courier details if order has a courier enum value
    let finalCourierId = courierId;
    let finalCourierName = courierName;
    let finalCourierCode = courierCode;

    if (order.courier) {
      // Fetch courier details separately based on the enum value
      const { data: courierDetails, error: courierError } = await supabase
        .from('couriers')
        .select('id, name, code')
        .eq('code', order.courier)
        .maybeSingle();
      
      if (courierError) {
        console.error('[Rapid Dispatch] Courier lookup error:', courierError);
      }
      
      if (courierDetails) {
        finalCourierId = courierDetails.id;
        finalCourierName = courierDetails.name;
        finalCourierCode = courierDetails.code;
        console.log(`[Rapid Dispatch] Courier resolved: ${finalCourierName} (${finalCourierCode})`);
      } else {
        // Fallback to enum value
        finalCourierName = order.courier;
        finalCourierCode = order.courier;
        console.log(`[Rapid Dispatch] Courier fallback to enum: ${order.courier}`);
      }
    }

    if (!finalCourierName) {
      console.log(`[Rapid Dispatch] No courier assigned to order: ${order.order_number}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No courier assigned to this order',
          errorCode: 'NO_COURIER',
          order: { order_number: order.order_number, customer_name: order.customer_name },
          suggestion: 'Select a courier before dispatching or assign one to the order first.',
          processingTime: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trackingId = matchType === 'tracking_id' ? entry : order.tracking_id;
    const now = new Date().toISOString();

    // Update tracking ID if needed
    if (matchType === 'tracking_id' && entry !== order.tracking_id) {
      await supabase
        .from('orders')
        .update({ tracking_id: entry })
        .eq('id', order.id);
    }

    // Prepare order update
    const orderUpdate: any = {
      status: 'dispatched',
      dispatched_at: now
    };

    if (!order.courier && finalCourierCode) {
      orderUpdate.courier = finalCourierCode;
    }

    // OPTIMIZATION 3: Run dispatch insert and order update in parallel
    const [dispatchResult, orderUpdateResult] = await Promise.all([
      supabase
        .from('dispatches')
        .insert({
          order_id: order.id,
          tracking_id: trackingId,
          courier: finalCourierName,
          courier_id: finalCourierId,
          dispatch_date: now,
          dispatched_by: userId
        }),
      supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', order.id)
    ]);

    if (dispatchResult.error) {
      console.error('Dispatch insert error:', dispatchResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Database error: ${dispatchResult.error.message}`,
          errorCode: 'DATABASE_ERROR',
          processingTime: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (orderUpdateResult.error) {
      console.error('Order update error:', orderUpdateResult.error);
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`[Rapid Dispatch] Successfully dispatched order ${order.order_number} in ${processingTime}ms`);

    // Return success with minimal data
    return new Response(
      JSON.stringify({
        success: true,
        order: {
          order_number: order.order_number,
          customer_name: order.customer_name,
          total_amount: order.total_amount
        },
        courier: finalCourierName,
        tracking_id: trackingId,
        matchType,
        processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Rapid dispatch error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred',
        errorCode: 'UNKNOWN_ERROR'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
