/**
 * Calculate the correct order total from line items
 * Handles adjusted orders where items have current_quantity = 0 (removed)
 * Includes shipping charges in the total
 */
export function calculateOrderTotal(lineItems: any[], shopifyTotalPrice: string, shippingCharges: number = 0): number {
  if (!lineItems || lineItems.length === 0) {
    return parseFloat(shopifyTotalPrice || '0');
  }

  // Check if any item has current_quantity (indicates order was adjusted)
  const hasAdjustments = lineItems.some(item => 'current_quantity' in item);

  if (hasAdjustments) {
    // Calculate total from active items only, then add shipping
    const activeTotal = lineItems.reduce((sum, item) => {
      const qty = item.current_quantity ?? item.quantity ?? 0;
      if (qty > 0) {
        const price = parseFloat(item.price || '0');
        return sum + (price * qty);
      }
      return sum;
    }, 0);

    const totalWithShipping = activeTotal + shippingCharges;
    console.log(`Adjusted order total calculated: ${activeTotal} + shipping ${shippingCharges} = ${totalWithShipping} (Shopify reported: ${shopifyTotalPrice})`);
    return totalWithShipping;
  }

  // New order - use Shopify's total (which already includes shipping)
  return parseFloat(shopifyTotalPrice || '0');
}

/**
 * Filter line items to only include active items (quantity > 0)
 * Normalizes quantity to use current_quantity when available
 */
export function filterActiveLineItems(lineItems: any[]): any[] {
  if (!lineItems) return [];
  
  return lineItems
    .filter(item => {
      const qty = item.current_quantity ?? item.quantity ?? 0;
      return qty > 0;
    })
    .map(item => ({
      ...item,
      // Use current_quantity if available, otherwise quantity
      quantity: item.current_quantity ?? item.quantity,
    }));
}
