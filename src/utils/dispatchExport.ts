import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface OrderItem {
  item_name: string;
  quantity: number;
  price: number;
}

interface DispatchExportData {
  id: string;
  tracking_id: string | null;
  courier: string;
  dispatch_date: string | null;
  notes: string | null;
  orders?: {
    order_number: string;
    customer_name: string;
    customer_phone: string | null;
    customer_address: string | null;
    city: string | null;
    total_amount: number;
    status: string;
    created_at: string | null;
    booked_at: string | null;
    dispatched_at: string | null;
    delivered_at: string | null;
    tags: string[] | null;
    notes: string | null;
    customer_email: string | null;
    shipping_charges: number | null;
    order_items?: OrderItem[];
  } | null;
  dispatched_by_user?: {
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

export function exportDispatchesToExcel(dispatches: DispatchExportData[], filename?: string) {
  const excelData = dispatches.map((dispatch, index) => ({
    'S.No': index + 1,
    'Tracking ID': dispatch.tracking_id || '',
    'Order Number': dispatch.orders?.order_number || '',
    'Courier': dispatch.courier?.toUpperCase() || '',
    'Status': dispatch.orders?.status?.toUpperCase() || '',
    'Customer Name': dispatch.orders?.customer_name || '',
    'Phone': dispatch.orders?.customer_phone || '',
    'Email': dispatch.orders?.customer_email || '',
    'Address': dispatch.orders?.customer_address || '',
    'City': dispatch.orders?.city || '',
    'Order Total': dispatch.orders?.total_amount || 0,
    'Shipping Charges': dispatch.orders?.shipping_charges || 0,
    'Order Items': formatOrderItems(dispatch.orders?.order_items),
    'Tags': formatTags(dispatch.orders?.tags),
    'Order Created': formatDateSafe(dispatch.orders?.created_at),
    'Booked At': formatDateSafe(dispatch.orders?.booked_at),
    'Dispatched At': formatDateSafe(dispatch.orders?.dispatched_at),
    'Delivered At': formatDateSafe(dispatch.orders?.delivered_at),
    'Dispatch Date': formatDateSafe(dispatch.dispatch_date),
    'Dispatched By': dispatch.dispatched_by_user?.full_name || '',
    'Order Notes': dispatch.orders?.notes || '',
    'Dispatch Notes': dispatch.notes || '',
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  const columnWidths = [
    { wch: 6 },   // S.No
    { wch: 18 },  // Tracking ID
    { wch: 15 },  // Order Number
    { wch: 12 },  // Courier
    { wch: 12 },  // Status
    { wch: 25 },  // Customer Name
    { wch: 15 },  // Phone
    { wch: 25 },  // Email
    { wch: 40 },  // Address
    { wch: 15 },  // City
    { wch: 12 },  // Order Total
    { wch: 12 },  // Shipping Charges
    { wch: 50 },  // Order Items
    { wch: 25 },  // Tags
    { wch: 18 },  // Order Created
    { wch: 18 },  // Booked At
    { wch: 18 },  // Dispatched At
    { wch: 18 },  // Delivered At
    { wch: 18 },  // Dispatch Date
    { wch: 20 },  // Dispatched By
    { wch: 30 },  // Order Notes
    { wch: 30 },  // Dispatch Notes
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dispatches');

  const exportFilename = filename || `dispatches-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}`;
  XLSX.writeFile(workbook, `${exportFilename}.xlsx`);

  return dispatches.length;
}
