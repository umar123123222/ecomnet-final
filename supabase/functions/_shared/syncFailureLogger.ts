import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

/**
 * Log a sync failure to the sync_failures table.
 * Safe to call from any edge function — silently catches its own errors.
 */
export async function logSyncFailure(
  supabase: SupabaseClient,
  params: {
    source: string;           // e.g. 'shopify_webhook', 'sync_missing_orders', 'nightly_tracking'
    order_identifier: string; // order number, shopify ID, or other identifier
    error_message: string;
    payload?: Record<string, any>;
  }
): Promise<void> {
  try {
    await supabase.from('sync_failures').insert({
      source: params.source,
      order_identifier: params.order_identifier,
      error_message: params.error_message.substring(0, 2000), // truncate
      payload: params.payload || null,
      retry_count: 0,
      resolved: false,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never let failure-logging break the caller
    console.error('Failed to log sync failure:', err);
  }
}
