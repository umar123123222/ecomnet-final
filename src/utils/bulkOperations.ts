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
 */
export async function bulkUpdateOrderStatus(
  orderIds: string[],
  status: 'pending' | 'booked' | 'dispatched' | 'delivered' | 'cancelled' | 'returned' | 'address clear' | 'unclear address'
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
