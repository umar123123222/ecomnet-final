import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client at module level (reused across warm invocations)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simplified barcode parser - optimized for direct tracking IDs
const parseBarcode = (entry: string): string => {
  if (!entry || typeof entry !== 'string') return entry;
  
  // Clean and return the first valid alphanumeric part
  const cleaned = entry.trim().replace(/['"]/g, '');
  
  // If contains spaces/delimiters, take first alphanumeric part
  const match = cleaned.match(/[A-Za-z0-9\-#]+/);
  return match ? match[0] : cleaned;
};

// Validation helper
const validateEntry = (entry: string): { valid: boolean; error?: string; errorCode?: string } => {
  if (!entry || entry.length < 5) {
    return { 
      valid: false, 
      error: 'Entry too short (minimum 5 characters)', 
      errorCode: 'INVALID_FORMAT'
    };
  }
  
  // Check for Excel scientific notation
  if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(entry)) {
    return { 
      valid: false, 
      error: 'Invalid format - Excel scientific notation detected', 
      errorCode: 'INVALID_FORMAT'
    };
  }
  
  return { valid: true };
};

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entry, courierId, courierName, courierCode, userId } = await req.json();

    if (!entry || !userId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing fields',
          errorCode: 'MISSING_FIELDS'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate entry
    const validation = validateEntry(entry);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: validation.error,
          errorCode: validation.errorCode,
          processingTime: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and clean entry
    const cleanedEntry = parseBarcode(entry);

    // Call atomic database function - single RPC handles everything
    const { data: result, error: rpcError } = await supabase.rpc('rapid_dispatch_order', {
      p_entry: cleanedEntry,
      p_user_id: userId,
      p_courier_id: courierId || null,
      p_courier_name: courierName || null,
      p_courier_code: courierCode || null
    });

    if (rpcError) {
      console.error('[Rapid Dispatch] RPC Error:', rpcError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'DB error',
          errorCode: 'DB_ERROR',
          processingTime: Date.now() - startTime
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add processing time to result
    const response = {
      ...result,
      processingTime: Date.now() - startTime
    };

    // Log activity if successful (non-blocking - don't fail dispatch if logging fails)
    if (result?.success && result?.order_id) {
      // Verify user exists before logging
      const { data: userExists } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      if (userExists) {
        supabase
          .from('activity_logs')
          .insert({
            action: 'order_dispatched',
            entity_type: 'order',
            entity_id: result.order_id,
            details: {
              order_number: result.order_number,
              customer_name: result.customer_name,
              courier: result.courier || courierCode || courierName,
              match_type: result.match_type,
              scanned_entry: cleanedEntry,
              processing_time_ms: Date.now() - startTime,
            },
            user_id: userId,
          })
          .then(({ error: logError }) => {
            if (logError) console.error('Activity log error:', logError);
          });
      }
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Rapid Dispatch] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error',
        errorCode: 'UNKNOWN_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
