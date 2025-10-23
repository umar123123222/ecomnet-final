export const ORDER_TEMPLATE_COLUMNS = [
  'order_number',
  'customer_name',
  'customer_phone',
  'customer_email',
  'customer_address',
  'city',
  'total_amount',
  'items',
  'courier',
  'order_type',
  'notes',
  'tags',
];

export const ORDER_TEMPLATE_DESCRIPTIONS = {
  order_number: 'Leave empty to auto-generate (format: ORD-YYYYMMDD-XXXX)',
  customer_name: 'Required. Customer full name',
  customer_phone: 'Required. Format: 03001234567 (11 digits)',
  customer_email: 'Optional. Customer email address',
  customer_address: 'Required. Full delivery address',
  city: 'Required. City name (e.g., Karachi, Lahore, Islamabad)',
  total_amount: 'Required. Total order amount (numeric, e.g., 1500)',
  items: 'Required. JSON format: [{"item_name":"Product A","quantity":2,"price":500}]',
  courier: 'Optional. One of: leopard, postex, tcs, other',
  order_type: 'Optional. One of: standard, cod, prepaid (default: standard)',
  notes: 'Optional. Internal notes or special instructions',
  tags: 'Optional. Comma-separated tags (e.g., urgent,vip)',
};

export const ORDER_TEMPLATE_SAMPLE_ROW = {
  order_number: '',
  customer_name: 'John Doe',
  customer_phone: '03001234567',
  customer_email: 'john@example.com',
  customer_address: 'House 123, Street XYZ, Block A',
  city: 'Karachi',
  total_amount: '1500',
  items: '[{"item_name":"Product A","quantity":2,"price":500},{"item_name":"Product B","quantity":1,"price":500}]',
  courier: 'leopard',
  order_type: 'cod',
  notes: 'Rush order',
  tags: 'urgent,vip',
};

export const generateOrderTemplate = (): void => {
  // Create CSV content
  const headers = ORDER_TEMPLATE_COLUMNS.join(',');
  const descriptions = ORDER_TEMPLATE_COLUMNS.map(col => ORDER_TEMPLATE_DESCRIPTIONS[col as keyof typeof ORDER_TEMPLATE_DESCRIPTIONS]).join(',');
  const sampleRow = ORDER_TEMPLATE_COLUMNS.map(col => {
    const value = ORDER_TEMPLATE_SAMPLE_ROW[col as keyof typeof ORDER_TEMPLATE_SAMPLE_ROW];
    // Escape values containing commas or quotes
    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }).join(',');

  const csvContent = [
    headers,
    `# ${descriptions}`,
    sampleRow,
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `order_import_template_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

export const exportErrorsToCSV = (errors: Array<{ row: number; field?: string; message: string; data?: any }>): void => {
  const headers = ['Row', 'Field', 'Error Message', 'Original Data'];
  const rows = errors.map(error => [
    error.row.toString(),
    error.field || 'N/A',
    error.message,
    error.data ? JSON.stringify(error.data) : 'N/A',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `order_import_errors_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};
