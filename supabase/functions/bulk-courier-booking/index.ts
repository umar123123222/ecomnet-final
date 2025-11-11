import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkBookingRequest {
  orderIds: string[];
  courierId: string;
}

interface BookingResult {
  orderId: string;
  orderNumber: string;
  success: boolean;
  trackingId?: string;
  labelUrl?: string;
  labelData?: string;
  labelFormat?: string;
  error?: string;
  errorCode?: string;
}

interface BulkBookingResponse {
  success: boolean;
  total: number;
  successCount: number;
  failedCount: number;
  results: BookingResult[];
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

    const bulkRequest: BulkBookingRequest = await req.json();
    const { orderIds, courierId } = bulkRequest;

    console.log(`[BULK BOOKING] Starting bulk booking for ${orderIds.length} orders with courier ${courierId}`);

    // Get courier details
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('*')
      .eq('id', courierId)
      .single();

    if (courierError || !courier) {
      throw new Error('Courier not found');
    }

    // Get pickup address settings
    const { data: settings } = await supabase
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'PICKUP_ADDRESS_NAME',
        'PICKUP_ADDRESS_PHONE',
        'PICKUP_ADDRESS_ADDRESS',
        'PICKUP_ADDRESS_CITY'
      ]);

    const getSettingValue = (key: string) => 
      settings?.find(s => s.setting_key === key)?.setting_value || '';

    const pickupAddress = {
      name: getSettingValue('PICKUP_ADDRESS_NAME'),
      phone: getSettingValue('PICKUP_ADDRESS_PHONE'),
      address: getSettingValue('PICKUP_ADDRESS_ADDRESS'),
      city: getSettingValue('PICKUP_ADDRESS_CITY')
    };

    if (!pickupAddress.address || !pickupAddress.city) {
      throw new Error('Pickup address not configured. Please configure in Settings > Business Settings.');
    }

    const results: BookingResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    // Process each order
    for (const orderId of orderIds) {
      try {
        console.log(`[BULK BOOKING] Processing order ${orderId}`);

        // Fetch order details
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          results.push({
            orderId,
            orderNumber: 'N/A',
            success: false,
            error: 'Order not found'
          });
          failedCount++;
          continue;
        }

        // Calculate weight and pieces
        const totalPieces = order.order_items?.reduce((sum: number, item: any) => 
          sum + (item.quantity || 0), 0) || 1;
        const estimatedWeight = totalPieces * 1; // 1kg per item

        // Prepare items array
        const items = order.order_items?.map((item: any) => ({
          name: item.item_name || 'Product',
          quantity: item.quantity || 1,
          price: parseFloat(item.price || 0)
        })) || [];

        // Call courier-booking edge function for this order
        const { data: bookingData, error: bookingError } = await supabase.functions.invoke('courier-booking', {
          body: {
            orderId: order.id,
            orderNumber: order.order_number, // Pass order number for courier reference
            courierId: courierId,
            pickupAddress,
            deliveryAddress: {
              name: order.customer_name,
              phone: order.customer_phone,
              address: order.customer_address,
              city: order.city
            },
            weight: estimatedWeight,
            pieces: totalPieces,
            codAmount: order.total_amount || 0,
            specialInstructions: order.notes || '',
            items
          }
        });

        if (bookingError || !bookingData?.success) {
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: bookingData?.error || bookingError?.message || 'Booking failed',
            errorCode: bookingData?.errorCode
          });
          failedCount++;
          console.error(`[BULK BOOKING] Failed for order ${order.order_number}:`, bookingData?.error);
        } else {
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: true,
            trackingId: bookingData.trackingId,
            labelUrl: bookingData.labelUrl,
            labelData: bookingData.labelData,
            labelFormat: bookingData.labelFormat || 'pdf'
          });
          successCount++;
          console.log(`[BULK BOOKING] Success for order ${order.order_number}, tracking: ${bookingData.trackingId}`);
        }
      } catch (error: any) {
        console.error(`[BULK BOOKING] Exception for order ${orderId}:`, error.message);
        results.push({
          orderId,
          orderNumber: 'N/A',
          success: false,
          error: error.message
        });
        failedCount++;
      }
    }

    const response: BulkBookingResponse = {
      success: successCount > 0,
      total: orderIds.length,
      successCount,
      failedCount,
      results
    };

    console.log(`[BULK BOOKING] Completed: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[BULK BOOKING] Error:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        total: 0,
        successCount: 0,
        failedCount: 0,
        results: [],
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
