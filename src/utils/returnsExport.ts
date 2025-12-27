import * as XLSX from 'xlsx';
import { format } from 'date-fns';

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
  } | null;
  received_by_profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export function exportReturnsToExcel(returns: ReturnExportData[], filename?: string) {
  const excelData = returns.map((returnItem, index) => ({
    'S.No': index + 1,
    'Tracking ID': returnItem.tracking_id || '',
    'Order Number': returnItem.orders?.order_number || '',
    'Courier': returnItem.courier?.toUpperCase() || '',
    'Status': returnItem.status?.toUpperCase() || '',
    'Customer Name': returnItem.orders?.customer_name || '',
    'Phone': returnItem.orders?.customer_phone || '',
    'Email': returnItem.orders?.customer_email || '',
    'Worth': returnItem.worth || 0,
    'Reason': returnItem.reason || '',
    'Condition': returnItem.condition || '',
    'Created At': returnItem.created_at ? format(new Date(returnItem.created_at), 'dd/MM/yyyy HH:mm') : '',
    'Received At': returnItem.received_at ? format(new Date(returnItem.received_at), 'dd/MM/yyyy HH:mm') : '',
    'Received By': returnItem.received_by_profile?.full_name || '',
    'Notes': returnItem.notes || '',
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
    { wch: 12 },  // Worth
    { wch: 20 },  // Reason
    { wch: 15 },  // Condition
    { wch: 18 },  // Created At
    { wch: 18 },  // Received At
    { wch: 20 },  // Received By
    { wch: 30 },  // Notes
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Returns');

  const exportFilename = filename || `returns-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}`;
  XLSX.writeFile(workbook, `${exportFilename}.xlsx`);

  return returns.length;
}
