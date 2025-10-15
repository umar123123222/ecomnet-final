import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { getAPISetting } from "../_shared/apiSettings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingRequest {
  orderId: string;
  courierId: string;
  pickupAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  deliveryAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  weight: number;
  pieces: number;
  codAmount?: number;
  specialInstructions?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const bookingRequest: BookingRequest = await req.json();
    console.log('Booking request:', bookingRequest);

    // Get courier details
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('*')
      .eq('id', bookingRequest.courierId)
      .single();

    if (courierError || !courier) {
      throw new Error('Courier not found');
    }

    console.log('Courier:', courier.name);

    let bookingResponse;
    let trackingId;

    switch (courier.code) {
      case 'TCS':
        bookingResponse = await bookTCS(bookingRequest);
        trackingId = bookingResponse.tracking_number;
        break;
      
      case 'LEOPARD':
        bookingResponse = await bookLeopard(bookingRequest);
        trackingId = bookingResponse.track_number;
        break;
      
      case 'POSTEX':
        bookingResponse = await bookPostEx(bookingRequest);
        trackingId = bookingResponse.tracking_number;
        break;
      
      default:
        throw new Error(`Unsupported courier: ${courier.code}`);
    }

    // Update order with tracking information
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        tracking_id: trackingId,
        status: 'booked',
        courier: courier.code.toLowerCase()
      })
      .eq('id', bookingRequest.orderId);

    if (orderError) {
      console.error('Error updating order:', orderError);
    }

    // Create dispatch record
    const { error: dispatchError } = await supabase
      .from('dispatches')
      .insert({
        order_id: bookingRequest.orderId,
        courier_id: bookingRequest.courierId,
        courier: courier.code,
        tracking_id: trackingId,
        status: 'booked',
        courier_booking_id: bookingResponse.booking_id || trackingId,
        courier_response: bookingResponse
      });

    if (dispatchError) {
      console.error('Error creating dispatch:', dispatchError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        trackingId,
        courierId: bookingRequest.courierId,
        bookingResponse
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in courier-booking:', error);
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

async function bookTCS(request: BookingRequest) {
  const apiKey = getAPISetting('TCS_API_KEY');
  
  const response = await fetch('https://api.tcs.com.pk/api/v1/bookings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consignee_name: request.deliveryAddress.name,
      consignee_phone: request.deliveryAddress.phone,
      consignee_address: request.deliveryAddress.address,
      consignee_city: request.deliveryAddress.city,
      origin_city: request.pickupAddress.city,
      weight: request.weight,
      pieces: request.pieces,
      cod_amount: request.codAmount || 0,
      service_type: request.codAmount ? 'COD' : 'overnight',
      special_instructions: request.specialInstructions
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TCS booking failed: ${error}`);
  }

  return await response.json();
}

async function bookLeopard(request: BookingRequest) {
  const apiKey = getAPISetting('LEOPARD_API_KEY');
  
  const response = await fetch('https://api.leopardscourier.com/api/bookings/store', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consignee_name: request.deliveryAddress.name,
      consignee_phone_number_1: request.deliveryAddress.phone,
      consignee_address: request.deliveryAddress.address,
      destination_city: request.deliveryAddress.city,
      origin_city: request.pickupAddress.city,
      weight: request.weight,
      pieces: request.pieces,
      amount: request.codAmount || 0,
      service_type_id: request.codAmount ? 2 : 1,
      special_instructions: request.specialInstructions
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Leopard booking failed: ${error}`);
  }

  return await response.json();
}

async function bookPostEx(request: BookingRequest) {
  const apiKey = getAPISetting('POSTEX_API_KEY');
  
  const response = await fetch('https://api.postex.pk/services/integration/api/order/v1/create-order', {
    method: 'POST',
    headers: {
      'token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerName: request.deliveryAddress.name,
      customerPhone: request.deliveryAddress.phone,
      deliveryAddress: request.deliveryAddress.address,
      cityName: request.deliveryAddress.city,
      pickupCityName: request.pickupAddress.city,
      transactionNotes: request.specialInstructions,
      orderRefNumber: request.orderId,
      invoicePayment: request.codAmount || 0,
      orderDetail: [{
        name: 'Order Items',
        quantity: request.pieces,
        price: request.codAmount || 0
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PostEx booking failed: ${error}`);
  }

  return await response.json();
}
