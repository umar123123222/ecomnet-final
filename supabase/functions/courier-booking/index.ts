import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { getAPISetting } from "../_shared/apiSettings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to retry critical order updates
async function updateOrderWithRetry(
  supabase: any,
  orderId: string,
  updateData: any,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: any }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[BOOKING] Order update attempt ${attempt}/${maxRetries}`, {
      orderId,
      updateData
    });
    
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (!error) {
      console.log(`[BOOKING] Order updated successfully on attempt ${attempt}`);
      return { success: true };
    }

    console.error(`[BOOKING] Order update failed on attempt ${attempt}:`, {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
      errorHint: error.hint
    });

    if (attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`[BOOKING] Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { 
    success: false, 
    error: `Max retries (${maxRetries}) exceeded for order update`
  };
}

interface BookingRequest {
  orderId: string;
  orderNumber?: string; // Human-readable order number for courier reference
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
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
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

    // Fetch order number if not provided (for use as reference in courier portal)
  let orderNumber = bookingRequest.orderNumber;
  if (!orderNumber) {
    const { data: orderData, error: orderFetchError } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', bookingRequest.orderId)
      .single();
    
    if (!orderFetchError && orderData) {
      orderNumber = orderData.order_number;
      console.log('[BOOKING] Fetched order number:', orderNumber);
    } else {
      console.warn('[BOOKING] Could not fetch order number, using order ID as fallback');
      orderNumber = bookingRequest.orderId;
    }
  }

  // Strip prefix for courier reference (e.g., "SHOP-321274" -> "321274")
  const orderRefNumber = orderNumber.replace(/^[A-Z]+-/i, '');
  console.log('[BOOKING] Order reference for courier:', orderRefNumber);

    // Define courierCode for use throughout the function
    const courierCode = (courier.code || '').toString().toUpperCase();

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
        bookingResponse = await bookWithCustomEndpoint(bookingRequest, courier, supabase, orderRefNumber);
        
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
            bookingResponse = await bookPostEx(bookingRequest, supabase, orderRefNumber);
            break;
          
          default:
            throw new Error(`Unsupported courier: ${courier.code}`);
        }
        
        // Extract label from standard response (check multiple possible fields)
        labelUrl = bookingResponse.label_url || 
                   bookingResponse.labelUrl || 
                   bookingResponse.dist?.label_url ||
                   bookingResponse.dist?.labelUrl ||
                   bookingResponse.dist?.pdfUrl ||
                   bookingResponse.data?.label_url ||
                   bookingResponse.data?.labelUrl;
                   
        labelData = bookingResponse.label_data || 
                    bookingResponse.labelData ||
                    bookingResponse.dist?.pdfData ||
                    bookingResponse.dist?.label_data ||
                    bookingResponse.dist?.labelData ||
                    bookingResponse.data?.label_data ||
                    bookingResponse.data?.labelData;
        
        // Log what we found for debugging
        console.log('[BOOKING] Label extraction:', {
          hasLabelUrl: !!labelUrl,
          hasLabelData: !!labelData,
          labelFormat,
          checkedFields: ['label_url', 'labelUrl', 'dist.pdfUrl', 'dist.pdfData', 'dist.label_url', 'dist.labelData']
        });
      }
      
      // Log response structure for debugging
      console.log('[BOOKING] Response keys:', Object.keys(bookingResponse || {}));
      if (bookingResponse?.dist) {
        console.log('[BOOKING] Response.dist keys:', Object.keys(bookingResponse.dist));
      }
      if (bookingResponse?.data) {
        console.log('[BOOKING] Response.data keys:', Object.keys(bookingResponse.data));
      }
      
      // Extract tracking ID based on courier response structure
      if (courierCode === 'POSTEX') {
        // Postex returns tracking in 'dist' -> 'trackingNumber' or 'cn' field
        trackingId = bookingResponse.dist?.trackingNumber || bookingResponse.dist?.cn || bookingResponse.trackingNumber || bookingResponse.cn;
      } else {
        trackingId =
          bookingResponse.tracking_number ||
          bookingResponse.track_number ||
          bookingResponse.trackingNumber ||
          bookingResponse.cn ||
          bookingResponse.consignment_number ||
          bookingResponse.consignmentNumber ||
          bookingResponse?.data?.tracking_number ||
          bookingResponse?.data?.trackingNumber ||
          bookingResponse?.data?.cn ||
          bookingResponse?.result?.tracking_number ||
          bookingResponse?.result?.track_number ||
          bookingResponse?.shipment?.tracking_number ||
          bookingResponse?.dist?.trackingNumber ||
          bookingResponse?.dist?.cn;
      }
    }

    console.log('[BOOKING] Extracted tracking ID:', trackingId);
    console.log('[BOOKING] Extracted label:', { hasLabelUrl: !!labelUrl, hasLabelData: !!labelData });
    console.log('[BOOKING] Full booking response:', JSON.stringify(bookingResponse));

    if (!trackingId) {
      const error: any = new Error('No tracking ID received from courier');
      error.code = 'BOOKING_MISSING_TRACKING_ID';
      throw error;
    }

    // If label not available yet, return 200 with informative payload (do not update order)
    if (!labelUrl && !labelData) {
      console.warn('[BOOKING] No airway bill returned; returning partial success without updating order');

      // Log attempt as partial for auditing
      const processingTime = Date.now() - requestStartTime;
      await supabase.from('courier_booking_attempts').insert({
        order_id: bookingRequest.orderId,
        courier_id: bookingRequest.courierId,
        courier_code: courier.code,
        booking_request: bookingRequest,
        booking_response: bookingResponse,
        status: 'partial',
        tracking_id: trackingId,
        user_id: userId,
        attempt_number: 1
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Airway bill not available from courier yet',
          errorCode: 'BOOKING_NO_LABEL',
          trackingId,
          courierId: bookingRequest.courierId,
          labelAvailable: false,
          bookingResponse
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing order to fetch current tags and shopify_order_id
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('tags, shopify_order_id')
      .eq('id', bookingRequest.orderId)
      .single();

    // Create "Ecomnet - Assigned to [Courier]" tag
    const courierName = courier.name;
    const ecomnetCourierTag = `Ecomnet - Assigned to ${courierName}`;
    
    // Remove any old "Ecomnet - Assigned to" tags and add the new one
    const existingTags = existingOrder?.tags || [];
    const filteredTags = existingTags.filter(tag => !tag.startsWith('Ecomnet - Assigned to'));
    const updatedTags = [...filteredTags, ecomnetCourierTag];

    console.log('[BOOKING] Updating order tags:', {
      old_tags: existingTags,
      new_tags: updatedTags,
      courier_tag: ecomnetCourierTag
    });

    // Update order with tracking information and tags (only if label is available)
    // Use retry logic for critical order update
    const orderUpdateResult = await updateOrderWithRetry(
      supabase,
      bookingRequest.orderId,
      {
        tracking_id: trackingId,
        status: 'booked',
        courier: courier.code.toLowerCase(),
        tags: updatedTags,
        booked_at: new Date().toISOString(),
        booked_by: userId
      },
      3 // max retries
    );

    if (!orderUpdateResult.success) {
      const errorMsg = `Failed to update order after courier booking: ${orderUpdateResult.error}`;
      console.error('[BOOKING] CRITICAL:', errorMsg);
      
      // Log the failure for monitoring
      await supabase.from('order_update_failures').insert({
        order_id: bookingRequest.orderId,
        attempted_update: {
          tracking_id: trackingId,
          status: 'booked',
          courier: courier.code.toLowerCase(),
          tags: updatedTags
        },
        error_message: errorMsg,
        error_code: 'ORDER_UPDATE_FAILED'
      }).catch(logErr => console.error('[BOOKING] Failed to log update failure:', logErr));
      
      throw new Error(errorMsg);
    }
    
    console.log('[BOOKING] Order updated successfully');

    // If order has shopify_order_id, queue sync to Shopify
    if (existingOrder?.shopify_order_id) {
      console.log('[BOOKING] Queueing Shopify sync for tracking and courier tag');
      
      const { error: syncError } = await supabase
        .from('sync_queue')
        .insert({
          entity_type: 'order',
          entity_id: bookingRequest.orderId,
          action: 'update',
          direction: 'to_shopify',
          payload: {
            order_id: bookingRequest.orderId,
            changes: {
              tracking_id: trackingId,
              courier: courier.code.toLowerCase(),
              tracking_company: courierName,
              tags: updatedTags
            }
          },
          status: 'pending'
        });

      if (syncError) {
        console.error('[BOOKING] Failed to queue Shopify sync:', syncError);
      } else {
        console.log('[BOOKING] Successfully queued Shopify sync');
      }
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
    const { error: attemptErr } = await supabase.from('courier_booking_attempts').insert({
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
    });
    
    if (attemptErr) {
      console.error('[BOOKING] Failed to log attempt:', attemptErr);
    }

    console.log(`[BOOKING] Success in ${processingTime}ms - Tracking: ${trackingId}`);

    // Log dispatch activity
    try {
      await supabase.from('activity_logs').insert({
        user_id: userId || '00000000-0000-0000-0000-000000000000',
        entity_type: 'order',
        entity_id: bookingRequest.orderId,
        action: 'order_dispatched',
        details: {
          courier: courier.name,
          tracking_id: trackingId,
          courier_code: courier.code
        }
      });
    } catch (logError) {
      console.error('[BOOKING] Failed to log activity:', logError);
    }

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
    let isRetryable = false; // Default to non-retryable, only retry network errors
    
    // Only retry transient network errors
    if (error.message?.includes('DNS') || error.message?.includes('getaddrinfo')) {
      errorCode = 'NETWORK_DNS_ERROR';
      errorDetail = 'Cannot reach courier API (DNS resolution failed)';
      isRetryable = true;
    } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
      errorCode = 'NETWORK_ERROR';
      errorDetail = 'Network connectivity issue with courier API';
      isRetryable = true;
    } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      errorCode = 'NETWORK_TIMEOUT';
      errorDetail = 'Request to courier API timed out';
      isRetryable = true;
    } else if (error.message?.includes('Too many redirects')) {
      errorCode = 'TOO_MANY_REDIRECTS';
      errorDetail = 'Too many redirects when contacting courier API';
      isRetryable = true;
    } else if (error.message?.includes('No tracking ID received')) {
      errorCode = error.code || 'BOOKING_MISSING_TRACKING_ID';
      errorDetail = 'Courier booking succeeded but no tracking ID was found in response';
      isRetryable = false;
    } else if (error.message?.includes('no airway bill received') || error.code === 'BOOKING_NO_LABEL') {
      errorCode = 'BOOKING_NO_LABEL';
      errorDetail = 'Courier booking succeeded but no airway bill was provided. Order status not updated.';
      isRetryable = false;
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
      isRetryable = false;
    } else if (error.message?.includes('Courier not found')) {
      errorCode = 'COURIER_NOT_FOUND';
      errorDetail = 'Courier not found in system';
      isRetryable = false;
    } else if (error.message?.includes('Configuration Required')) {
      errorCode = 'CONFIGURATION_REQUIRED';
      isRetryable = false;
    } else if (error.message?.includes('violates check constraint') || error.code === '23514') {
      errorCode = 'DATA_CONSTRAINT_VIOLATION';
      errorDetail = 'Database constraint violation. Check dispatch status values.';
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
      
      let body: any = null;
      try {
        if (!req.bodyUsed) {
          body = await req.clone().json();
        }
      } catch (_) {
        body = null;
      }
      orderId = body?.orderId || null;
      courierId = body?.courierId || null;
      
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
        
        const { error: logErr } = await supabase.from('courier_booking_attempts').insert({
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
        });
        
        if (logErr) {
          console.error('[BOOKING] Failed to log error:', logErr);
        }
        
        // Add to retry queue if retryable
        if (isRetryable) {
          const nextRetry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          const { error: queueErr } = await supabase.from('courier_booking_queue').insert({
            order_id: orderId,
            courier_id: courierId,
            retry_count: 0,
            max_retries: 5,
            next_retry_at: nextRetry.toISOString(),
            last_error_code: errorCode,
            last_error_message: errorDetail,
            status: 'pending'
          });
          
          if (queueErr) {
            console.error('[BOOKING] Failed to queue retry:', queueErr);
          }
          
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

async function bookWithCustomEndpoint(request: BookingRequest, courier: any, supabaseClient: any, orderNumber: string) {
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
    
    // Format detailed product information for order detail
    let orderDetail = '';
    if (request.items && request.items.length > 0) {
      const itemsList = request.items
        .map(item => `${item.name} (x${item.quantity})`)
        .join(', ');
      orderDetail = itemsList; // Send just the product list
      console.log('[POSTEX] Formatted order detail with items:', orderDetail);
    } else {
      orderDetail = `${request.pieces} items`;
      console.log('[POSTEX] Using fallback order detail (no items provided)');
    }
    
    // Calculate total item count for Postex (they expect a number, not an array)
    const totalItemCount = request.items && request.items.length > 0
      ? request.items.reduce((sum, item) => sum + item.quantity, 0)
      : request.pieces;
    
    body = {
      customerName: request.deliveryAddress.name,
      customerPhone: request.deliveryAddress.phone,
      deliveryAddress: request.deliveryAddress.address,
      cityName: request.deliveryAddress.city,
      pickupCityName: request.pickupAddress.city,
      transactionNotes: request.specialInstructions || '',
      orderRefNumber: orderNumber, // Use human-readable order number
      invoicePayment: request.codAmount || 0,
      orderType: 'Normal', // Valid values: Normal, Reversed, Replacement
      orderDetail: orderDetail,
      pickupAddressCode: pickupAddressCode,
      items: totalItemCount // Postex expects a number (count), not an array
    };
    
    // Defensive logging for Postex payload
    console.log('[POSTEX] Booking payload:', {
      hasOrderDetail: 'orderDetail' in body,
      itemsCount: totalItemCount,
      hasPickupAddressCode: !!pickupAddressCode,
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
  
  // Fetch label for Postex after successful booking with retry logic
  if (courierCode === 'POSTEX') {
    const trackingNumber = responseData.dist?.trackingNumber;
    if (trackingNumber) {
      console.log('[POSTEX] Fetching label for tracking:', trackingNumber);
      
      // Retry up to 3 times with delays (labels take a few seconds to generate)
      let labelFetched = false;
      const maxRetries = 3;
      const retryDelays = [2000, 3000, 4000]; // 2s, 3s, 4s delays
      
      for (let attempt = 0; attempt < maxRetries && !labelFetched; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`[POSTEX] Waiting ${retryDelays[attempt - 1]}ms before retry ${attempt}...`);
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt - 1]));
          }
          
          console.log(`[POSTEX] Label fetch attempt ${attempt + 1}/${maxRetries}`);
          // Use correct GET /get-invoice endpoint per API documentation
          const labelResponse = await fetch(`https://api.postex.pk/services/integration/api/order/v1/get-invoice?trackingNumbers=${trackingNumber}`, {
            method: 'GET',
            headers: {
              'token': apiKey,
            },
          });
          
          if (labelResponse.ok) {
            const contentType = labelResponse.headers.get('content-type');
            console.log('[POSTEX] Label fetch response content-type:', contentType);
            
            // API returns PDF binary directly
            if (contentType?.includes('application/pdf')) {
              const pdfBuffer = await labelResponse.arrayBuffer();
              
              // Convert ArrayBuffer to base64
              const base64 = btoa(
                new Uint8Array(pdfBuffer)
                  .reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              
              responseData.label_data = base64;
              responseData.label_format = 'pdf';
              console.log('[POSTEX] PDF label converted to base64 successfully');
              labelFetched = true;
            } else {
              console.warn(`[POSTEX] Unexpected content-type: ${contentType} (attempt ${attempt + 1})`);
            }
          } else {
            const errorText = await labelResponse.text();
            console.warn(`[POSTEX] Label fetch failed (attempt ${attempt + 1}):`, labelResponse.status, errorText);
          }
        } catch (labelError) {
          console.warn(`[POSTEX] Label fetch error (attempt ${attempt + 1}):`, labelError);
        }
      }
      
      if (!labelFetched) {
        console.error('[POSTEX] Failed to fetch label after all retry attempts');
      }
    }
  }
  
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

async function bookPostEx(request: BookingRequest, supabaseClient: any, orderNumber: string) {
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
  console.log('Postex items count:', request.items?.length || 0);
  
  // Format detailed product information
  let orderDetail = '';
  if (request.items && request.items.length > 0) {
    const itemsList = request.items
      .map(item => `${item.name} (x${item.quantity})`)
      .join(', ');
    orderDetail = itemsList;
    console.log('Postex order detail with items:', orderDetail);
  } else {
    orderDetail = `${request.pieces} items`;
    console.log('Postex using fallback order detail');
  }
  
  // Calculate total item count (Postex expects a number, not an array)
  const totalItemCount = request.items && request.items.length > 0
    ? request.items.reduce((sum, item) => sum + item.quantity, 0)
    : request.pieces;
  
  const body = {
    customerName: request.deliveryAddress.name,
    customerPhone: request.deliveryAddress.phone,
    deliveryAddress: request.deliveryAddress.address,
    cityName: request.deliveryAddress.city,
    pickupCityName: request.pickupAddress.city,
    transactionNotes: request.specialInstructions || '',
    orderRefNumber: orderNumber, // Use human-readable order number
    invoicePayment: request.codAmount || 0,
    orderType: 'Normal',
    orderDetail: orderDetail,
    pickupAddressCode: pickupAddressCode,
    items: totalItemCount // Postex expects item count as a number
  };
  
  console.log('POSTEX booking payload:', JSON.stringify(body, null, 2));

  // Create order first
  const createResponse = await fetchWithManualRedirect('https://api.postex.pk/services/integration/api/order/v3/create-order', {
    method: 'POST',
    headers: {
      'token': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('Postex booking error:', {
      status: createResponse.status,
      body: errorText
    });
    throw new Error(`PostEx booking failed: ${errorText}`);
  }

  const bookingData = await createResponse.json();
  console.log('Postex booking response:', JSON.stringify(bookingData));
  
  // Now fetch the label with retry logic (labels take a few seconds to generate)
  const trackingNumber = bookingData.dist?.trackingNumber;
  if (trackingNumber) {
    console.log('[POSTEX bookPostEx] Fetching label for tracking:', trackingNumber);
    
    let labelFetched = false;
    const maxRetries = 3;
    const retryDelays = [2000, 3000, 4000]; // 2s, 3s, 4s delays
    
      for (let attempt = 0; attempt < maxRetries && !labelFetched; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`[POSTEX bookPostEx] Waiting ${retryDelays[attempt - 1]}ms before retry ${attempt}...`);
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt - 1]));
          }
          
          console.log(`[POSTEX bookPostEx] Label fetch attempt ${attempt + 1}/${maxRetries}`);
          // Use correct GET /get-invoice endpoint per API documentation
          const labelResponse = await fetch(`https://api.postex.pk/services/integration/api/order/v1/get-invoice?trackingNumbers=${trackingNumber}`, {
            method: 'GET',
            headers: {
              'token': apiKey,
            },
          });
          
          if (labelResponse.ok) {
            const contentType = labelResponse.headers.get('content-type');
            console.log('[POSTEX bookPostEx] Label fetch response content-type:', contentType);
            
            // API returns PDF binary directly
            if (contentType?.includes('application/pdf')) {
              const pdfBuffer = await labelResponse.arrayBuffer();
              
              // Convert ArrayBuffer to base64
              const base64 = btoa(
                new Uint8Array(pdfBuffer)
                  .reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              
              bookingData.label_data = base64;
              bookingData.label_format = 'pdf';
              console.log('[POSTEX bookPostEx] PDF label converted to base64 successfully');
              labelFetched = true;
            } else {
              console.warn(`[POSTEX bookPostEx] Unexpected content-type: ${contentType} (attempt ${attempt + 1})`);
            }
          } else {
            const errorText = await labelResponse.text();
            console.warn(`[POSTEX bookPostEx] Label fetch failed (attempt ${attempt + 1}):`, labelResponse.status, errorText);
          }
        } catch (labelError) {
          console.warn(`[POSTEX bookPostEx] Label fetch error (attempt ${attempt + 1}):`, labelError);
        }
      }
    
    if (!labelFetched) {
      console.error('[POSTEX bookPostEx] Failed to fetch label after all retry attempts');
    }
  }

  return bookingData;
}
