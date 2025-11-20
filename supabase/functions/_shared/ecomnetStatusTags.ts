/**
 * Shared utility for generating Ecomnet status tags
 * Used by webhook handlers and sync functions
 */

export function getEcomnetStatusTag(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Ecomnet - Pending',
    'confirmed': 'Ecomnet - Confirmed',
    'booked': 'Ecomnet - Booked',
    'dispatched': 'Ecomnet - Dispatched',
    'delivered': 'Ecomnet - Delivered',
    'returned': 'Ecomnet - Returned',
    'cancelled': 'Ecomnet - Cancelled',
    'on_hold': 'Ecomnet - On Hold',
    'processing': 'Ecomnet - Processing',
  };
  
  return statusMap[status] || `Ecomnet - ${status.charAt(0).toUpperCase() + status.slice(1)}`;
}

export function updateEcomnetStatusTag(existingTags: string[], newStatus: string): string[] {
  // Remove old Ecomnet - [Status] tags
  const nonStatusTags = existingTags.filter(tag => !tag.startsWith('Ecomnet - '));
  
  // Add new status tag
  const newTag = getEcomnetStatusTag(newStatus);
  
  return [...nonStatusTags, newTag];
}
