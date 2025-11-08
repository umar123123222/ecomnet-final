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
    const requestStartTime = Date.now();
    
    console.log('[BOOKING] Starting request for order:', bookingRequest.orderId);
    
    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    const userId = authHeader ? (await supabase.auth.getUser(authHeader.replace('Bearer ', ''))).data.user?.id : null;

    // Get courier details
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('*')
      .eq('id', bookingRequest.courierId)
      .single();

    if (courierError || !courier) {
      console.error('[BOOKING] Courier not found:', courierError);
      throw new Error('Courier not found');
    }

    console.log('[BOOKING] Using courier:', courier.name, courier.code);

    // Check for mock mode
    const mockMode = courier.api_endpoint === 'mock' || Deno.env.get('COURIER_BOOKING_MODE') === 'mock';
    
    let bookingResponse;
    let trackingId;
    let labelUrl = null;
    let labelData = null;
    let labelFormat = courier.label_format || 'pdf';

    if (mockMode) {
      console.log('MOCK MODE: Generating fake tracking ID');
      trackingId = `${courier.code.toUpperCase()}-MOCK-${Date.now().toString().slice(-8)}`;
      const mockLabel = btoa('Mock Label PDF Content');
      labelData = mockLabel;
      bookingResponse = {
        mock: true,
        tracking_number: trackingId,
        track_number: trackingId,
        booking_id: `MOCK-${Date.now()}`,
        status: 'booked',
        message: 'Mock booking successful',
        label_data: mockLabel
      };
    } else {
      // Use custom booking endpoint if configured
      if (courier.booking_endpoint) {
        bookingResponse = await bookWithCustomEndpoint(bookingRequest, courier, supabase);
        
        // Extract label from response
        if (bookingResponse.label_url) {
          labelUrl = bookingResponse.label_url;
        } else if (bookingResponse.label_data || bookingResponse.labelData) {
          labelData = bookingResponse.label_data || bookingResponse.labelData;
        }
      } else {
        // Fallback to hardcoded implementations
        switch (courier.code.toUpperCase()) {
          case 'TCS':
            bookingResponse = await bookTCS(bookingRequest, supabase);
            break;
          
          case 'LEOPARD':
            bookingResponse = await bookLeopard(bookingRequest, supabase);
            break;
          
          case 'POSTEX':
            bookingResponse = await bookPostEx(bookingRequest, supabase);
            break;
          
          default:
            throw new Error(`Unsupported courier: ${courier.code}`);
        }
        
        // Extract label from standard response
        labelUrl = bookingResponse.label_url || bookingResponse.labelUrl;
        labelData = bookingResponse.label_data || bookingResponse.labelData;
      }
      
      // Extract tracking ID based on courier response structure
      if (courierCode === 'POSTEX') {
        // Postex returns tracking in 'dist' -> 'cn' field or 'trackingNumber'
        trackingId = bookingResponse.dist?.cn || bookingResponse.trackingNumber || bookingResponse.cn;
      } else {
        trackingId = bookingResponse.tracking_number || bookingResponse.track_number || bookingResponse.trackingNumber;
      }
    }

    console.log('[BOOKING] Extracted tracking ID:', trackingId);
    console.log('[BOOKING] Full booking response:', JSON.stringify(bookingResponse));

    if (!trackingId) {
      throw new Error('No tracking ID received from courier');
    }

    // Update order with tracking information
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        tracking_id: trackingId,
        status: 'dispatched',
        dispatched_at: new Date().toISOString(),
        courier: courier.code.toLowerCase()
      })
      .eq('id', bookingRequest.orderId);

    if (orderError) {
      console.error('Error updating order:', orderError);
    }

    // Create dispatch record with label information
    const { error: dispatchError } = await supabase
      .from('dispatches')
      .insert({
        order_id: bookingRequest.orderId,
        courier_id: bookingRequest.courierId,
        courier: courier.code,
        tracking_id: trackingId,
        status: 'booked',
        courier_booking_id: bookingResponse.booking_id || trackingId,
        courier_response: bookingResponse,
        label_url: labelUrl,
        label_data: labelData,
        label_format: labelFormat
      });

    if (dispatchError) {
      console.error('[BOOKING] Error creating dispatch:', dispatchError);
    }

    // Log successful booking attempt
    const processingTime = Date.now() - requestStartTime;
    await supabase.from('courier_booking_attempts').insert({
      order_id: bookingRequest.orderId,
      courier_id: bookingRequest.courierId,
      courier_code: courier.code,
      booking_request: bookingRequest,
      booking_response: bookingResponse,
      status: 'success',
      tracking_id: trackingId,
      label_url: labelUrl,
      user_id: userId,
      attempt_number: 1
    }).catch(err => console.error('[BOOKING] Failed to log attempt:', err));

    console.log(`[BOOKING] Success in ${processingTime}ms - Tracking: ${trackingId}`);

    return new Response(
      JSON.stringify({
        success: true,
        trackingId,
        courierId: bookingRequest.courierId,
        bookingResponse,
        labelUrl,
        labelData,
        labelFormat,
        autoDownload: courier.auto_download_label
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[BOOKING] Error:', error.message);
    
    // Detect and categorize errors
    let errorCode = error.code || 'UNKNOWN_ERROR';
    let errorDetail = error.message;
    let isRetryable = true;
    
    if (error.message?.includes('DNS') || error.message?.includes('getaddrinfo')) {
      errorCode = 'NETWORK_DNS_ERROR';
      errorDetail = 'Cannot reach courier API (DNS resolution failed)';
    } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
      errorCode = 'NETWORK_ERROR';
      errorDetail = 'Network connectivity issue with courier API';
    } else if (error.message?.includes('INVALID ORDER TYPE')) {
      errorCode = 'INVALID_ORDER_TYPE';
      errorDetail = 'Courier rejected order type. Check courier configuration.';
      isRetryable = false;
    } else if (error.message?.includes('Missing request header')) {
      errorCode = 'AUTH_HEADER_DROPPED';
      errorDetail = 'Authentication issue with courier API. Contact support.';
      isRetryable = false;
    } else if (error.message?.includes('booking failed')) {
      errorCode = error.code || 'BOOKING_API_ERROR';
    } else if (error.message?.includes('Courier not found')) {
      errorCode = 'COURIER_NOT_FOUND';
      isRetryable = false;
    } else if (error.message?.includes('Configuration Required')) {
      errorCode = 'CONFIGURATION_REQUIRED';
      isRetryable = false;
    }
    
    // Extract orderId and courierId from the request for logging
    let orderId: string | null = null;
    let courierId: string | null = null;
    let userId: string | null = null;
    
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        userId = (await supabase.auth.getUser(authHeader.replace('Bearer ', ''))).data.user?.id || null;
      }
      
      const body = await req.clone().json();
      orderId = body.orderId;
      courierId = body.courierId;
      
      if (orderId && courierId) {
        // Log failed attempt
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const { data: courier } = await supabase
          .from('couriers')
          .select('code')
          .eq('id', courierId)
          .single();
        
        await supabase.from('courier_booking_attempts').insert({
          order_id: orderId,
          courier_id: courierId,
          courier_code: courier?.code || 'unknown',
          booking_request: body,
          booking_response: null,
          status: 'failed',
          error_code: errorCode,
          error_message: errorDetail,
          user_id: userId,
          attempt_number: 1
        }).catch(err => console.error('[BOOKING] Failed to log error:', err));
        
        // Add to retry queue if retryable
        if (isRetryable) {
          const nextRetry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          await supabase.from('courier_booking_queue').insert({
            order_id: orderId,
            courier_id: courierId,
            retry_count: 0,
            max_retries: 5,
            next_retry_at: nextRetry.toISOString(),
            last_error_code: errorCode,
            last_error_message: errorDetail,
            status: 'pending'
          }).catch(err => console.error('[BOOKING] Failed to queue retry:', err));
          
          console.log(`[BOOKING] Added to retry queue, next attempt at ${nextRetry.toISOString()}`);
        }
      }
    } catch (logError) {
      console.error('[BOOKING] Failed to log error details:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorDetail,
        errorCode: errorCode,
        originalError: error.message,
        isRetryable: isRetryable
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to handle redirects manually (preserves headers)
async function fetchWithManualRedirect(url: string, options: RequestInit, maxRedirects = 5): Promise<Response> {
  let redirectCount = 0;
  let currentUrl = url;

  while (redirectCount < maxRedirects) {
    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual'
    });

    // Check if it's a redirect
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location');
      if (!location) {
        throw new Error('Redirect without Location header');
      }
      
      // Resolve relative URLs
      currentUrl = new URL(location, currentUrl).toString();
      console.log(`Following redirect to: ${currentUrl}`);
      redirectCount++;
      continue;
    }

    // Not a redirect, return the response
    return response;
  }

  throw new Error(`Too many redirects (${maxRedirects})`);
}

async function bookWithCustomEndpoint(request: BookingRequest, courier: any, supabaseClient: any) {
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
  } else if (courier.auth_type === 'token_header') {
    // For couriers like Postex that use a 'token' header
    headers['token'] = apiKey || '';
  }

  // Add custom headers if configured
  if (courier.auth_config?.custom_headers) {
    Object.assign(headers, courier.auth_config.custom_headers);
  }

  // Fallback for Postex: ensure 'token' header is present even if auth_type wasn't set
  const courierCode = (courier.code || '').toString().toUpperCase();
  if (courierCode === 'POSTEX' && !headers['token']) {
    headers['token'] = apiKey || '';
  }

  // Log header presence without exposing secrets
  console.log(`Custom booking headers for ${courierCode}:`, {
    hasAuthorization: Boolean(headers['Authorization']),
    hasToken: Boolean(headers['token']),
    otherHeaderKeys: Object.keys(headers).filter(k => !['Authorization','token','Content-Type'].includes(k))
  });

  // Build request body - Postex-specific or generic
  let body;
  
  if (courierCode === 'POSTEX') {
    // Postex v3 API requires specific structure
    // Get pickup address code from courier-specific setting
    const pickupAddressCode = await getAPISetting(`${courierCode}_PICKUP_ADDRESS_CODE`, supabaseClient);
    
    if (!pickupAddressCode) {
      const error: any = new Error('Postex requires a Pickup Address Code. Please configure it in the courier settings under Business Settings > Couriers.');
      error.code = 'CONFIGURATION_REQUIRED';
      throw error;
    }
    
    body = {
      customerName: request.deliveryAddress.name,
      customerPhone: request.deliveryAddress.phone,
      deliveryAddress: request.deliveryAddress.address,
      cityName: request.deliveryAddress.city,
      pickupCityName: request.pickupAddress.city,
      transactionNotes: request.specialInstructions || '',
      orderRefNumber: request.orderId,
      invoicePayment: request.codAmount || 0,
      orderType: 'Normal', // Valid values: Normal, Reversed, Replacement
      orderDetail: `Order Items x${request.pieces} | Amount: ${request.codAmount || 0}`,
      pickupAddressCode: pickupAddressCode
    };
    
    // Defensive logging for Postex payload
    console.log('POSTEX payload check:', {
      hasOrderDetail: 'orderDetail' in body,
      hasPickupAddressCode: !!pickupAddressCode,
      orderDetailType: typeof body.orderDetail,
      orderDetailValue: body.orderDetail
    });
  } else {
    // Generic structure for other couriers
    body = courier.auth_config?.request_body_template || {
      consignee_name: request.deliveryAddress.name,
      consignee_phone: request.deliveryAddress.phone,
      consignee_address: request.deliveryAddress.address,
      destination_city: request.deliveryAddress.city,
      origin_city: request.pickupAddress.city,
      weight: request.weight,
      pieces: request.pieces,
      cod_amount: request.codAmount || 0
    };
  }

  console.log(`Sending ${courierCode} booking request to: ${courier.booking_endpoint}`);

  // Use manual redirect handling to preserve headers
  const response = await fetchWithManualRedirect(courier.booking_endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  console.log(`${courierCode} response status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    const contentType = response.headers.get('content-type');
    console.error(`${courierCode} booking error response:`, {
      status: response.status,
      contentType,
      body: errorText
    });
    
    // Check if error is due to missing token header (despite us sending it)
    let errorCode = 'BOOKING_API_ERROR';
    if (errorText.includes('Missing request header \'token\'')) {
      errorCode = 'AUTH_HEADER_DROPPED_ON_REDIRECT';
    }
    
    const error: any = new Error(`${courier.name} booking failed: ${errorText}`);
    error.code = errorCode;
    throw error;
  }

  const responseData = await response.json();
  console.log(`${courierCode} booking response:`, JSON.stringify(responseData));
  return responseData;
}

async function bookTCS(request: BookingRequest, supabaseClient: any) {
  const apiKey = await getAPISetting('TCS_API_KEY', supabaseClient);
  
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

async function bookLeopard(request: BookingRequest, supabaseClient: any) {
  const apiKey = await getAPISetting('LEOPARD_API_KEY', supabaseClient);
  
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

async function bookPostEx(request: BookingRequest, supabaseClient: any) {
  const apiKey = await getAPISetting('POSTEX_API_KEY', supabaseClient);
  
  if (!apiKey) {
    throw new Error('Postex API key not configured. Please add POSTEX_API_KEY in Settings > Business Settings > API Configuration.');
  }
  
  // Get pickup address code (required by Postex)
  const pickupAddressCode = await getAPISetting('POSTEX_PICKUP_ADDRESS_CODE', supabaseClient);
  
  if (!pickupAddressCode) {
    const error: any = new Error('Postex requires a Pickup Address Code. Please configure it in the courier settings under Business Settings > Couriers.');
    error.code = 'CONFIGURATION_REQUIRED';
    throw error;
  }
  
  console.log('Postex API Key present:', !!apiKey);
  console.log('Postex Pickup Address Code present:', !!pickupAddressCode);
  
  const body = {
    customerName: request.deliveryAddress.name,
    customerPhone: request.deliveryAddress.phone,
    deliveryAddress: request.deliveryAddress.address,
    cityName: request.deliveryAddress.city,
    pickupCityName: request.pickupAddress.city,
    transactionNotes: request.specialInstructions || '',
    orderRefNumber: request.orderId,
    invoicePayment: request.codAmount || 0,
    orderType: 'Normal', // Valid values: Normal, Reversed, Replacement
    orderDetail: `Order Items x${request.pieces} | Amount: ${request.codAmount || 0}`,
    pickupAddressCode: pickupAddressCode
  };
  
  // Defensive logging for Postex payload
  console.log('POSTEX payload check:', {
    hasOrderDetail: 'orderDetail' in body,
    hasPickupAddressCode: !!pickupAddressCode,
    orderDetailType: typeof body.orderDetail,
    orderDetailValue: body.orderDetail
  });

  // Use manual redirect to preserve token header
  const response = await fetchWithManualRedirect('https://api.postex.pk/services/integration/api/order/v3/create-order', {
    method: 'POST',
    headers: {
      'token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const contentType = response.headers.get('content-type');
    console.error('Postex booking error:', {
      status: response.status,
      contentType,
      body: errorText
    });
    throw new Error(`PostEx booking failed: ${errorText}`);
  }

  return await response.json();
}
