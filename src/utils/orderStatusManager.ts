import { supabase } from "@/integrations/supabase/client";

export interface StatusUpdateParams {
  orderId: string;
  newStatus: 'pending' | 'booked' | 'dispatched' | 'delivered' | 'returned' | 'cancelled';
  userId?: string;
  courier?: string;
  trackingId?: string;
  notes?: string;
  sendNotification?: boolean;
}

/**
 * Unified Status Management System
 * Centralizes all order status updates to ensure consistency across the system
 */
export async function updateOrderStatus(params: StatusUpdateParams) {
  const {
    orderId,
    newStatus,
    userId,
    courier,
    trackingId,
    notes,
    sendNotification = false
  } = params;

  try {
    // 1. FIRST fetch the current order to get old status BEFORE updating
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status, order_number')
      .eq('id', orderId)
      .single();

    if (fetchError) throw fetchError;

    const oldStatus = currentOrder?.status;

    // 2. Update order status in database
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Add status-specific timestamps and user tracking
    if (newStatus === 'booked') {
      updateData.booked_at = new Date().toISOString();
      updateData.booked_by = userId;
      if (courier) updateData.courier = courier;
      if (trackingId) updateData.tracking_id = trackingId;
    } else if (newStatus === 'dispatched') {
      updateData.dispatched_at = new Date().toISOString();
    } else if (newStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    if (notes) {
      updateData.notes = notes;
    }

    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Log activity to activity_logs (note: DB trigger also logs this, but we add more context here)
    const activityDetails: any = {
      old_status: oldStatus,
      new_status: newStatus,
      order_number: currentOrder?.order_number,
      timestamp: new Date().toISOString()
    };

    if (courier) activityDetails.courier = courier;
    if (trackingId) activityDetails.tracking_id = trackingId;
    if (notes) activityDetails.notes = notes;

    await supabase.from('activity_logs').insert({
      user_id: userId || '00000000-0000-0000-0000-000000000000',
      entity_type: 'order',
      entity_id: orderId,
      action: 'status_changed',
      details: activityDetails
    });

    // 3. Shopify sync is automatically triggered by database trigger
    // No manual queue insertion needed

    // 4. Send notifications if requested
    if (sendNotification && userId) {
      const notificationMessages: Record<string, string> = {
        booked: `Order booked with ${courier || 'courier'}`,
        dispatched: 'Order has been dispatched',
        delivered: 'Order successfully delivered',
        returned: 'Order has been returned',
        cancelled: 'Order has been cancelled'
      };

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'order_status',
        title: `Order #${order?.order_number} ${newStatus}`,
        message: notificationMessages[newStatus] || `Order status updated to ${newStatus}`,
        priority: newStatus === 'delivered' ? 'high' : 'normal',
        metadata: {
          order_id: orderId,
          order_number: order?.order_number,
          status: newStatus
        }
      });
    }

    // 5. Update related records based on status
    if (newStatus === 'dispatched' && courier) {
      // Check if dispatch record exists, if not create it
      const { data: existingDispatch } = await supabase
        .from('dispatches')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!existingDispatch) {
        await supabase.from('dispatches').insert({
          order_id: orderId,
          courier: courier,
          tracking_id: trackingId,
          status: 'pending',
          dispatch_date: new Date().toISOString()
        });
      }
    }

    return { success: true, data: order };

  } catch (error: any) {
    console.error('Error updating order status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update tracking ID for an order (independent of status change)
 * Syncs to Shopify via database trigger
 */
export async function updateOrderTracking(params: {
  orderId: string;
  trackingId: string;
  courier?: string;
  userId?: string;
}) {
  const { orderId, trackingId, courier, userId } = params;

  try {
    // Fetch current order data
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('order_number, tracking_id, courier, status')
      .eq('id', orderId)
      .single();

    if (fetchError) throw fetchError;

    const oldTrackingId = currentOrder?.tracking_id;

    // Update order with new tracking
    const updateData: any = {
      tracking_id: trackingId,
      updated_at: new Date().toISOString()
    };

    // Also update courier if provided
    if (courier) {
      updateData.courier = courier;
    }

    // If order is pending, also update to booked
    if (currentOrder?.status === 'pending') {
      updateData.status = 'booked';
      updateData.booked_at = new Date().toISOString();
      if (userId) updateData.booked_by = userId;
    }

    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Also update dispatch record if exists
    const { data: dispatch } = await supabase
      .from('dispatches')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (dispatch) {
      await supabase
        .from('dispatches')
        .update({
          tracking_id: trackingId,
          courier: courier || currentOrder?.courier,
          updated_at: new Date().toISOString()
        })
        .eq('id', dispatch.id);
    }

    // Log the tracking update
    await supabase.from('activity_logs').insert({
      user_id: userId || '00000000-0000-0000-0000-000000000000',
      entity_type: 'order',
      entity_id: orderId,
      action: 'tracking_updated',
      details: {
        old_tracking_id: oldTrackingId,
        new_tracking_id: trackingId,
        order_number: currentOrder?.order_number,
        courier: courier || currentOrder?.courier,
        timestamp: new Date().toISOString()
      }
    });

    return { success: true, data: order };

  } catch (error: any) {
    console.error('Error updating tracking:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk status update for multiple orders
 */
export async function bulkUpdateStatus(
  orderIds: string[],
  newStatus: StatusUpdateParams['newStatus'],
  userId?: string
) {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const orderId of orderIds) {
    const result = await updateOrderStatus({
      orderId,
      newStatus,
      userId
    });

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push(`Order ${orderId}: ${result.error}`);
    }
  }

  return results;
}
