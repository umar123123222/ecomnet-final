import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface OrderItem {
  item_name: string;
  quantity: number;
  price: number;
}

interface ReturnExportData {
  id: string;
  tracking_id: string | null;
  courier: string | null;
  status: string | null;
  worth: number | null;
  reason: string | null;
  condition: string | null;
  notes: string | null;
  created_at: string | null;
  received_at: string | null;
  orders?: {
    order_number: string;
    customer_name: string;
    customer_phone: string | null;
    customer_email: string | null;
    customer_address: string | null;
    city: string | null;
    total_amount: number | null;
    created_at: string | null;
    booked_at: string | null;
    dispatched_at: string | null;
    delivered_at: string | null;
    tags: string[] | null;
    notes: string | null;
    shipping_charges: number | null;
    order_items?: OrderItem[];
  } | null;
  received_by_profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

function formatOrderItems(items?: OrderItem[]): string {
  if (!items || items.length === 0) return '';
  return items.map(item => `${item.item_name} x${item.quantity} @${item.price}`).join(' | ');
}

function formatTags(tags: string[] | null): string {
  if (!tags || tags.length === 0) return '';
  return tags.join(', ');
}

function formatDateSafe(date: string | null): string {
  if (!date) return '';
  try {
    return format(new Date(date), 'dd/MM/yyyy HH:mm');
  } catch {
    return '';
  }
}

export function exportReturnsToExcel(returns: ReturnExportData[], filename?: string) {
  const excelData = returns.map((returnItem, index) => ({
    'S.No': index + 1,
    'Tracking ID': returnItem.tracking_id || '',
    'Order Number': returnItem.orders?.order_number || '',
    'Courier': returnItem.courier?.toUpperCase() || '',
    'Return Status': returnItem.status?.toUpperCase() || '',
    'Customer Name': returnItem.orders?.customer_name || '',
    'Phone': returnItem.orders?.customer_phone || '',
    'Email': returnItem.orders?.customer_email || '',
    'Address': returnItem.orders?.customer_address || '',
    'City': returnItem.orders?.city || '',
    'Order Total': returnItem.orders?.total_amount || 0,
    'Return Worth': returnItem.worth || 0,
    'Shipping Charges': returnItem.orders?.shipping_charges || 0,
    'Order Items': formatOrderItems(returnItem.orders?.order_items),
    'Tags': formatTags(returnItem.orders?.tags),
    'Return Reason': returnItem.reason || '',
    'Condition': returnItem.condition || '',
    'Order Created': formatDateSafe(returnItem.orders?.created_at),
    'Booked At': formatDateSafe(returnItem.orders?.booked_at),
    'Dispatched At': formatDateSafe(returnItem.orders?.dispatched_at),
    'Delivered At': formatDateSafe(returnItem.orders?.delivered_at),
    'Return Created': formatDateSafe(returnItem.created_at),
    'Received At': formatDateSafe(returnItem.received_at),
    'Received By': returnItem.received_by_profile?.full_name || '',
    'Order Notes': returnItem.orders?.notes || '',
    'Return Notes': returnItem.notes || '',
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  const columnWidths = [
    { wch: 6 },   // S.No
    { wch: 18 },  // Tracking ID
    { wch: 15 },  // Order Number
    { wch: 12 },  // Courier
    { wch: 12 },  // Return Status
    { wch: 25 },  // Customer Name
    { wch: 15 },  // Phone
    { wch: 25 },  // Email
    { wch: 40 },  // Address
    { wch: 15 },  // City
    { wch: 12 },  // Order Total
    { wch: 12 },  // Return Worth
    { wch: 12 },  // Shipping Charges
    { wch: 50 },  // Order Items
    { wch: 25 },  // Tags
    { wch: 20 },  // Return Reason
    { wch: 15 },  // Condition
    { wch: 18 },  // Order Created
    { wch: 18 },  // Booked At
    { wch: 18 },  // Dispatched At
    { wch: 18 },  // Delivered At
    { wch: 18 },  // Return Created
    { wch: 18 },  // Received At
    { wch: 20 },  // Received By
    { wch: 30 },  // Order Notes
    { wch: 30 },  // Return Notes
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Returns');

  const exportFilename = filename || `returns-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}`;
  XLSX.writeFile(workbook, `${exportFilename}.xlsx`);

  return returns.length;
}
