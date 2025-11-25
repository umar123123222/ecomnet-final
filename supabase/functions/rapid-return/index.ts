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

    const { entry, userId } = await req.json();

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

    // OPTIMIZED: Single query to find return by tracking_id OR order_number
    let returnRecord: any = null;
    let orderData: any = null;
    let matchType: 'tracking_id' | 'order_number' = 'tracking_id';

    // Try tracking ID first
    const { data: returnByTracking } = await supabase
      .from('returns')
      .select('*, orders!returns_order_id_fkey(id, order_number, customer_name)')
      .eq('tracking_id', entry)
      .maybeSingle();

    if (returnByTracking) {
      returnRecord = returnByTracking;
      orderData = returnByTracking.orders;
      matchType = 'tracking_id';
    } else {
      // Try order number with OR query
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, customer_name')
        .or(`order_number.eq.${entry},order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
        .limit(1)
        .maybeSingle();

      if (order) {
        const { data: returnByOrder } = await supabase
          .from('returns')
          .select('*')
          .eq('order_id', order.id)
          .maybeSingle();

        if (returnByOrder) {
          returnRecord = returnByOrder;
          orderData = order;
          matchType = 'order_number';
        }
      }
    }

    if (!returnRecord) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Return not found in database',
          errorCode: 'NOT_FOUND',
          searchedEntry: entry,
          suggestion: 'Verify the tracking ID or order number. Check if return exists.',
          processingTime: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already received
    if (returnRecord.return_status === 'received') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Return already received',
          errorCode: 'ALREADY_RECEIVED',
          order: { order_number: orderData?.order_number || 'Unknown', customer_name: orderData?.customer_name },
          suggestion: 'This return was already marked as received.',
          processingTime: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    // ATOMIC: Update return status
    const { error: updateReturnError } = await supabase
      .from('returns')
      .update({
        return_status: 'received',
        received_at: now,
        received_by: userId
      })
      .eq('id', returnRecord.id);

    if (updateReturnError) {
      console.error('Return update error:', updateReturnError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Database error: ${updateReturnError.message}`,
          errorCode: 'DATABASE_ERROR',
          processingTime: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order status
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ status: 'returned' })
      .eq('id', returnRecord.order_id);

    if (orderUpdateError) {
      console.error('Order update error:', orderUpdateError);
    }

    const processingTime = Date.now() - startTime;

    // Return success with minimal data
    return new Response(
      JSON.stringify({
        success: true,
        order: {
          order_number: orderData?.order_number || 'Unknown',
          customer_name: orderData?.customer_name || 'Unknown'
        },
        tracking_id: returnRecord.tracking_id,
        matchType,
        processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Rapid return error:', error);
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
