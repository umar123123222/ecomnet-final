import * as XLSX from 'xlsx';
import { format } from 'date-fns';

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
  } | null;
  dispatched_by_user?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export function exportDispatchesToExcel(dispatches: DispatchExportData[], filename?: string) {
  const excelData = dispatches.map((dispatch, index) => ({
    'S.No': index + 1,
    'Tracking ID': dispatch.tracking_id || '',
    'Order Number': dispatch.orders?.order_number || '',
    'Courier': dispatch.courier?.toUpperCase() || '',
    'Customer Name': dispatch.orders?.customer_name || '',
    'Phone': dispatch.orders?.customer_phone || '',
    'Address': dispatch.orders?.customer_address || '',
    'City': dispatch.orders?.city || '',
    'Order Total': dispatch.orders?.total_amount || 0,
    'Order Status': dispatch.orders?.status?.toUpperCase() || '',
    'Dispatch Date': dispatch.dispatch_date ? format(new Date(dispatch.dispatch_date), 'dd/MM/yyyy HH:mm') : '',
    'Dispatched By': dispatch.dispatched_by_user?.full_name || '',
    'Notes': dispatch.notes || '',
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  const columnWidths = [
    { wch: 6 },   // S.No
    { wch: 18 },  // Tracking ID
    { wch: 15 },  // Order Number
    { wch: 12 },  // Courier
    { wch: 25 },  // Customer Name
    { wch: 15 },  // Phone
    { wch: 40 },  // Address
    { wch: 15 },  // City
    { wch: 12 },  // Order Total
    { wch: 12 },  // Order Status
    { wch: 18 },  // Dispatch Date
    { wch: 20 },  // Dispatched By
    { wch: 30 },  // Notes
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dispatches');

  const exportFilename = filename || `dispatches-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}`;
  XLSX.writeFile(workbook, `${exportFilename}.xlsx`);

  return dispatches.length;
}
