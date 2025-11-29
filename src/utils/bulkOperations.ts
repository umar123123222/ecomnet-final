import { supabase } from '@/integrations/supabase/client';
import { BulkOperationResult } from '@/hooks/useBulkOperations';

// Batch size for processing bulk operations
const BATCH_SIZE = 50;

/**
 * Process items in batches to avoid overwhelming the database
 */
export async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);
  }
}

/**
 * Bulk update order statuses
 * WARNING: This only updates the database status. 
 * To properly unassign couriers, use bulkUnassignCouriers instead.
 */
export async function bulkUpdateOrderStatus(
  orderIds: string[],
  status: 'pending' | 'booked' | 'dispatched' | 'delivered' | 'cancelled' | 'returned'
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(orderIds, BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', batch)
      .select('id');

    if (error) {
      failed += batch.length;
      errors.push(error.message);
    } else {
      success += data?.length || 0;
      failed += batch.length - (data?.length || 0);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk unassign couriers from orders
 * Properly cancels orders on courier portals before clearing local data
 */
export async function bulkUnassignCouriers(
  orderIds: string[]
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process one order at a time to properly call cancellation API for each
  for (const orderId of orderIds) {
    try {
      // Get order details
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, tracking_id, courier')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        failed++;
        errors.push(`Order ${orderId}: Failed to fetch`);
        continue;
      }

      // Skip if no courier assigned
      if (!order.courier || !order.tracking_id) {
        // Just update to pending
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'pending',
            courier: null,
            tracking_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (updateError) {
          failed++;
          errors.push(`Order ${orderId}: ${updateError.message}`);
        } else {
          success++;
        }
        continue;
      }

      // Call courier cancellation API
      const { error: cancelError } = await supabase.functions.invoke('courier-cancellation', {
        body: {
          orderId: order.id,
          trackingId: order.tracking_id,
          reason: 'Bulk unassign by user'
        }
      });

      if (cancelError) {
        failed++;
        errors.push(`Order ${orderId}: ${cancelError.message}`);
      } else {
        success++;
      }
    } catch (error: any) {
      failed++;
      errors.push(`Order ${orderId}: ${error.message || 'Unknown error'}`);
    }
  }

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk assign orders to a staff member
 */
export async function bulkAssignOrders(
  orderIds: string[],
  userId: string
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(orderIds, BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ assigned_to: userId, updated_at: new Date().toISOString() })
      .in('id', batch)
      .select('id');

    if (error) {
      failed += batch.length;
      errors.push(error.message);
    } else {
      success += data?.length || 0;
      failed += batch.length - (data?.length || 0);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk update order courier
 */
export async function bulkUpdateOrderCourier(
  orderIds: string[],
  courier: 'leopard' | 'postex' | 'tcs' | 'other'
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(orderIds, BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ courier, updated_at: new Date().toISOString() })
      .in('id', batch)
      .select('id');

    if (error) {
      failed += batch.length;
      errors.push(error.message);
    } else {
      success += data?.length || 0;
      failed += batch.length - (data?.length || 0);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk update return statuses
 */
export async function bulkUpdateReturnStatus(
  returnIds: string[],
  status: 'in_transit' | 'received' | 'processed' | 'completed'
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(returnIds, BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from('returns')
      .update({ return_status: status, updated_at: new Date().toISOString() })
      .in('id', batch)
      .select('id');

    if (error) {
      failed += batch.length;
      errors.push(error.message);
    } else {
      success += data?.length || 0;
      failed += batch.length - (data?.length || 0);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk receive returns
 */
export async function bulkReceiveReturns(
  returnIds: string[],
  userId: string
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(returnIds, BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from('returns')
      .update({
        return_status: 'received',
        received_at: new Date().toISOString(),
        received_by: userId,
        updated_at: new Date().toISOString(),
      })
      .in('id', batch)
      .select('id');

    if (error) {
      failed += batch.length;
      errors.push(error.message);
    } else {
      success += data?.length || 0;
      failed += batch.length - (data?.length || 0);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk activate/deactivate products
 */
export async function bulkToggleProducts(
  productIds: string[],
  isActive: boolean
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(productIds, BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .in('id', batch)
      .select('id');

    if (error) {
      failed += batch.length;
      errors.push(error.message);
    } else {
      success += data?.length || 0;
      failed += batch.length - (data?.length || 0);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk update product category
 */
export async function bulkUpdateProductCategory(
  productIds: string[],
  category: string
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(productIds, BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from('products')
      .update({ category, updated_at: new Date().toISOString() })
      .in('id', batch)
      .select('id');

    if (error) {
      failed += batch.length;
      errors.push(error.message);
    } else {
      success += data?.length || 0;
      failed += batch.length - (data?.length || 0);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk delete products
 */
export async function bulkDeleteProducts(
  productIds: string[]
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(productIds, BATCH_SIZE, async (batch) => {
    try {
      // Delete related records in order to avoid foreign key constraint violations
      
      // 1. Delete inventory records
      await supabase
        .from('inventory')
        .delete()
        .in('product_id', batch);

      // 2. Delete product variants
      await supabase
        .from('product_variants')
        .delete()
        .in('product_id', batch);

      // 3. Delete bill of materials entries (both as finished product and raw material)
      await supabase
        .from('bill_of_materials')
        .delete()
        .in('finished_product_id', batch);
      
      await supabase
        .from('bill_of_materials')
        .delete()
        .in('raw_material_id', batch);

      // 4. Finally delete the products
      const { data, error } = await supabase
        .from('products')
        .delete()
        .in('id', batch)
        .select('id');

      if (error) {
        console.error('Product deletion error:', error);
        failed += batch.length;
        errors.push(`Failed to delete products: ${error.message}`);
      } else {
        const deletedCount = data?.length || 0;
        success += deletedCount;
        failed += batch.length - deletedCount;
        
        if (deletedCount < batch.length) {
          errors.push(`Some products could not be deleted. They may be referenced by orders, GRNs, or stock counts.`);
        }
      }
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      failed += batch.length;
      errors.push(`Unexpected error: ${error.message}`);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Bulk delete packaging items
 */
export async function bulkDeletePackagingItems(
  itemIds: string[]
): Promise<BulkOperationResult> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  await processBatch(itemIds, BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from('packaging_items')
      .delete()
      .in('id', batch)
      .select('id');

    if (error) {
      console.error('Packaging item deletion error:', error);
      failed += batch.length;
      errors.push(`Failed to delete packaging items: ${error.message}`);
    } else {
      success += data?.length || 0;
      failed += batch.length - (data?.length || 0);
    }
  });

  return { success, failed, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Export data to CSV
 */
export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) return;

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
