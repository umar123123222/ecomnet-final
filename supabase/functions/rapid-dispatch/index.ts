import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse complex barcode formats (e.g., "PostEx,21129530173989,327738,5211")
const parseBarcode = (entry: string): string[] => {
  const courierNames = ['postex', 'leopard', 'tcs', 'callcourier', 'call courier', 'dhl', 'fedex', 'm&p', 'swyft', 'trax'];
  
  // Split by comma, semicolon, pipe, or multiple spaces
  const parts = entry.split(/[,;|\s]{2,}|\s*[,;|]\s*/).map(p => p.trim()).filter(p => p.length > 0);
  
  // Filter out courier names and keep only potential tracking IDs/order numbers
  const candidates = parts.filter(part => {
    const lowerPart = part.toLowerCase();
    // Skip if it's a courier name
    if (courierNames.includes(lowerPart)) return false;
    // Skip if it's too short (less than 4 characters)
    if (part.length < 4) return false;
    // Skip if it looks like Excel scientific notation
    if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(part)) return false;
    return true;
  });
  
  // If no candidates found after filtering, return original entry
  return candidates.length > 0 ? candidates : [entry];
};

// Validation helper
const validateEntry = (entry: string): { valid: boolean; error?: string; errorCode?: string; suggestion?: string } => {
  // Too short (less than 5 characters)
  if (entry.length < 5) {
    return { 
      valid: false, 
      error: 'Entry too short', 
      errorCode: 'INVALID_FORMAT',
      suggestion: 'Scan barcode or enter tracking ID/order number (minimum 5 characters)' 
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
    
    console.log(`[Rapid Dispatch] Raw entry received: "${entry}"`);
    
    // Parse barcode to extract potential tracking IDs and order numbers
    const searchCandidates = parseBarcode(entry);
    console.log(`[Rapid Dispatch] Parsed ${searchCandidates.length} candidate(s)`);

    // Try to find order using all candidates in a single optimized query
    let order = null;
    let matchedEntry = '';
    
    // Build exact-match OR conditions (no ILIKE for speed - uses indexes)
    const orConditions = searchCandidates.map(candidate => 
      `tracking_id.eq.${candidate},order_number.eq.${candidate},order_number.eq.SHOP-${candidate},shopify_order_number.eq.${candidate},shopify_order_number.eq.#${candidate}`
    ).join(',');
    
    const { data: foundOrder, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, tracking_id, order_number, customer_name, total_amount, courier, status,
        dispatches!left(id)
      `)
      .or(orConditions)
      .limit(1)
      .maybeSingle();

    if (orderError) {
      console.error('[Rapid Dispatch] Query error:', orderError);
    }
    
    if (foundOrder) {
      order = foundOrder;
      // Determine which candidate matched
      for (const candidate of searchCandidates) {
        if (foundOrder.tracking_id === candidate || 
            foundOrder.tracking_id?.includes(candidate) ||
            foundOrder.order_number === candidate ||
            foundOrder.order_number === `SHOP-${candidate}` ||
            foundOrder.shopify_order_number === candidate) {
          matchedEntry = candidate;
          break;
        }
      }
      matchedEntry = matchedEntry || searchCandidates[0];
    }

    // If still not found, return error immediately (no similar search for speed)
    if (!order) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not found',
          errorCode: 'NOT_FOUND',
          searchedEntry: entry,
          suggestion: 'Verify the tracking ID or order number. It may need to be synced from Shopify.',
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

    // Determine match type based on what was actually matched
    const matchType = order.tracking_id && (order.tracking_id === matchedEntry || order.tracking_id.includes(matchedEntry)) 
      ? 'tracking_id' 
      : 'order_number';

    // Use order courier directly (no DB lookup for speed)
    const finalCourierId = courierId;
    const finalCourierName = courierName || order.courier || 'Unknown';
    const finalCourierCode = courierCode || order.courier || 'unknown';

    if (!finalCourierName) {
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

    // Use the matched entry as tracking ID if it was matched by tracking_id
    const trackingId = matchType === 'tracking_id' ? matchedEntry : order.tracking_id;
    const now = new Date().toISOString();

    // Prepare all operations to run in parallel
    const operations = [];

    // Update tracking ID if matched by tracking ID and it's different from stored value
    if (matchType === 'tracking_id' && matchedEntry !== order.tracking_id) {
      operations.push(
        supabase
          .from('orders')
          .update({ tracking_id: matchedEntry })
          .eq('id', order.id)
      );
    }

    // Prepare order update
    const orderUpdate: any = {
      status: 'dispatched',
      dispatched_at: now
    };

    if (!order.courier && finalCourierCode) {
      orderUpdate.courier = finalCourierCode;
    }

    // Add dispatch insert and order update to operations
    operations.push(
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
    );

    // Run all operations in parallel
    const results = await Promise.all(operations);

    // Check for errors in parallel operations
    const dispatchResult = operations.length === 3 ? results[1] : results[0];
    const orderUpdateResult = operations.length === 3 ? results[2] : results[1];

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

    const processingTime = Date.now() - startTime;

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
