import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { getAPISetting } from "../_shared/apiSettings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RateRequest {
  originCity: string;
  destinationCity: string;
  weight: number;
  codAmount?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const rateRequest: RateRequest = await req.json();
    console.log('Rate request:', rateRequest);

    // Get all active couriers
    const { data: couriers, error: couriersError } = await supabase
      .from('couriers')
      .select('*')
      .eq('is_active', true);

    if (couriersError) {
      throw couriersError;
    }

    // Calculate rates from rate cards
    const { data: rateCards, error: rateCardsError } = await supabase
      .from('courier_rate_cards')
      .select('*, courier:couriers(*)')
      .eq('is_active', true)
      .ilike('origin_city', rateRequest.originCity)
      .ilike('destination_city', rateRequest.destinationCity)
      .lte('weight_from', rateRequest.weight)
      .gte('weight_to', rateRequest.weight);

    if (rateCardsError) {
      throw rateCardsError;
    }

    const rates = [];

    // Add rates from rate cards
    for (const card of rateCards || []) {
      rates.push({
        courierId: card.courier_id,
        courierName: card.courier.name,
        courierCode: card.courier.code,
        rate: parseFloat(card.rate),
        estimatedDays: card.estimated_days,
        source: 'rate_card'
      });
    }

    // If no rate cards found, try API calls for real-time rates
    if (rates.length === 0 && couriers) {
      for (const courier of couriers) {
        try {
          let apiRate;
          
          // Use configured rates_endpoint if available
          if (courier.rates_endpoint) {
            apiRate = await getRateWithCustomEndpoint(rateRequest, courier, supabase);
          } else {
            // Log warning - courier should have rates_endpoint configured
            console.warn(`Courier ${courier.code} has no rates_endpoint configured. Please add it in Business Settings > Couriers.`);
            continue;
          }
          
          if (apiRate) {
            rates.push({
              courierId: courier.id,
              courierName: courier.name,
              courierCode: courier.code,
              ...apiRate,
              source: 'api'
            });
          }
        } catch (error) {
          console.error(`Error getting rate from ${courier.name}:`, error);
        }
      }
    }

    // Sort by rate (lowest first)
    rates.sort((a, b) => a.rate - b.rate);

    return new Response(
      JSON.stringify({
        success: true,
        rates,
        cheapest: rates[0] || null,
        fastest: rates.sort((a, b) => (a.estimatedDays || 999) - (b.estimatedDays || 999))[0] || null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in courier-rates:', error);
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

async function getRateWithCustomEndpoint(request: RateRequest, courier: any, supabaseClient: any) {
  const apiKey = await getAPISetting(`${courier.code.toUpperCase()}_API_KEY`, supabaseClient);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Apply authentication based on auth_type
  if (courier.auth_type === 'bearer_token') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (courier.auth_type === 'api_key_header') {
    const headerName = courier.auth_config?.header_name || 'X-API-Key';
    headers[headerName] = apiKey || '';
  } else if (courier.auth_type === 'basic_auth') {
    const username = courier.auth_config?.username || '';
    const encoded = btoa(`${username}:${apiKey}`);
    headers['Authorization'] = `Basic ${encoded}`;
  }

  // Add custom headers if configured
  if (courier.auth_config?.custom_headers) {
    Object.assign(headers, courier.auth_config.custom_headers);
  }

  try {
    const response = await fetch(courier.rates_endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        origin_city: request.originCity,
        destination_city: request.destinationCity,
        weight: request.weight,
        cod_amount: request.codAmount || 0
      })
    });

    if (response.ok) {
      const data = await response.json();
      
      // Try to extract rate and estimated days from common field names
      const rate = data.rate || data.charges || data.total_charges || data.operationalCharges || data.amount;
      const estimatedDays = data.estimated_days || data.estimatedDays || data.estimated_delivery_days || data.eta || 3;
      
      return {
        rate: parseFloat(rate),
        estimatedDays: parseInt(estimatedDays)
      };
    }
  } catch (error) {
    console.error(`${courier.name} rate error:`, error);
  }
  
  return null;
}

// Legacy hardcoded rate functions removed - all couriers must now use configured rates_endpoint
// Configure courier endpoints in Business Settings > Couriers section
