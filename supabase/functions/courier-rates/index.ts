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
          switch (courier.code) {
            case 'TCS':
              apiRate = await getTCSRate(rateRequest);
              break;
            case 'LEOPARD':
              apiRate = await getLeopardRate(rateRequest);
              break;
            case 'POSTEX':
              apiRate = await getPostExRate(rateRequest);
              break;
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

async function getTCSRate(request: RateRequest) {
  const apiKey = getAPISetting('TCS_API_KEY');
  
  try {
    const response = await fetch('https://api.tcs.com.pk/api/v1/rates/calculate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin_city: request.originCity,
        destination_city: request.destinationCity,
        weight: request.weight,
        service_type: request.codAmount ? 'COD' : 'overnight'
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        rate: data.total_charges,
        estimatedDays: data.estimated_delivery_days
      };
    }
  } catch (error) {
    console.error('TCS rate error:', error);
  }
  
  return null;
}

async function getLeopardRate(request: RateRequest) {
  const apiKey = getAPISetting('LEOPARD_API_KEY');
  
  try {
    const response = await fetch('https://api.leopardscourier.com/api/rate/calculate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin_city: request.originCity,
        destination_city: request.destinationCity,
        weight: request.weight,
        amount: request.codAmount || 0
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        rate: data.charges,
        estimatedDays: data.estimated_days
      };
    }
  } catch (error) {
    console.error('Leopard rate error:', error);
  }
  
  return null;
}

async function getPostExRate(request: RateRequest) {
  const apiKey = getAPISetting('POSTEX_API_KEY');
  
  try {
    const response = await fetch('https://api.postex.pk/services/integration/api/shipment/v1/calculate-charges', {
      method: 'POST',
      headers: {
        'token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickupCityName: request.originCity,
        cityName: request.destinationCity,
        invoicePayment: request.codAmount || 0
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        rate: data.operationalCharges,
        estimatedDays: 3 // PostEx doesn't provide ETA
      };
    }
  } catch (error) {
    console.error('PostEx rate error:', error);
  }
  
  return null;
}
