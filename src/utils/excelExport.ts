import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface OrderExportData {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  city?: string;
  total: number;
  shippingCharges?: number;
  courier?: string;
  tracking_id?: string;
  tags?: string[];
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
  confirmedAt?: string | null;
  bookedAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  cancellationReason?: string | null;
  notes?: string | null;
}

export function exportOrdersToExcel(orders: OrderExportData[], filename?: string) {
  // Format orders for Excel
  const excelData = orders.map((order, index) => {
    // Format items as a readable string
    const itemsList = order.items?.map(item => 
      `${item.name} (x${item.quantity}) @ ${item.price}`
    ).join('; ') || '';

    return {
      'S.No': index + 1,
      'Order Number': order.orderNumber,
      'Status': order.status?.toUpperCase() || '',
      'Customer Name': order.customerName || '',
      'Phone': order.customerPhone || '',
      'Email': order.customerEmail || '',
      'Address': order.customerAddress || '',
      'City': order.city || '',
      'Order Total': order.total || 0,
      'Shipping Charges': order.shippingCharges || 0,
      'Courier': order.courier?.toUpperCase() || '',
      'Tracking ID': order.tracking_id || '',
      'Items': itemsList,
      'Item Count': order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      'Tags': order.tags?.join(', ') || '',
      'Order Date': order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm') : '',
      'Confirmed At': order.confirmedAt ? format(new Date(order.confirmedAt), 'dd/MM/yyyy HH:mm') : '',
      'Booked At': order.bookedAt ? format(new Date(order.bookedAt), 'dd/MM/yyyy HH:mm') : '',
      'Dispatched At': order.dispatchedAt ? format(new Date(order.dispatchedAt), 'dd/MM/yyyy HH:mm') : '',
      'Delivered At': order.deliveredAt ? format(new Date(order.deliveredAt), 'dd/MM/yyyy HH:mm') : '',
      'Cancellation Reason': order.cancellationReason || '',
      'Notes': order.notes || '',
    };
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const columnWidths = [
    { wch: 6 },   // S.No
    { wch: 15 },  // Order Number
    { wch: 12 },  // Status
    { wch: 25 },  // Customer Name
    { wch: 15 },  // Phone
    { wch: 25 },  // Email
    { wch: 40 },  // Address
    { wch: 15 },  // City
    { wch: 12 },  // Order Total
    { wch: 12 },  // Shipping
    { wch: 12 },  // Courier
    { wch: 18 },  // Tracking ID
    { wch: 50 },  // Items
    { wch: 10 },  // Item Count
    { wch: 30 },  // Tags
    { wch: 18 },  // Order Date
    { wch: 18 },  // Confirmed At
    { wch: 18 },  // Booked At
    { wch: 18 },  // Dispatched At
    { wch: 18 },  // Delivered At
    { wch: 30 },  // Cancellation Reason
    { wch: 40 },  // Notes
  ];
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

  // Generate filename
  const exportFilename = filename || `orders-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}`;

  // Export
  XLSX.writeFile(workbook, `${exportFilename}.xlsx`);

  return orders.length;
}
