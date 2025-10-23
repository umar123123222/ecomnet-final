import { supabase } from '@/integrations/supabase/client';
import { orderInputSchema, sanitizeInput } from './inputValidation';
import type { BulkOperationResult } from '@/hooks/useBulkOperations';

export interface OrderValidationError {
  row: number;
  field?: string;
  message: string;
  data?: any;
}

export interface ValidatedOrder {
  rowNumber: number;
  data: any;
  isValid: boolean;
  errors: string[];
}

export interface ImportResult {
  validOrders: ValidatedOrder[];
  invalidOrders: ValidatedOrder[];
  totalRows: number;
}

const VALID_COURIERS = ['leopard', 'postex', 'tcs', 'other'];
const VALID_ORDER_TYPES = ['standard', 'cod', 'prepaid'];

export const generateOrderNumber = async (): Promise<string> => {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  
  // Get count of orders created today
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(date.setHours(0, 0, 0, 0)).toISOString());
  
  const sequence = String((count || 0) + 1).padStart(4, '0');
  return `ORD-${dateStr}-${sequence}`;
};

export const validateOrderRow = (row: any, rowNumber: number): ValidatedOrder => {
  const errors: string[] = [];
  const validatedData: any = {};

  try {
    // Required fields check
    if (!row.customer_name || row.customer_name.trim() === '') {
      errors.push('Customer name is required');
    } else {
      validatedData.customer_name = sanitizeInput(row.customer_name);
    }

    if (!row.customer_phone || row.customer_phone.trim() === '') {
      errors.push('Customer phone is required');
    } else {
      const phone = row.customer_phone.replace(/\s+/g, '');
      if (!/^03\d{9}$/.test(phone)) {
        errors.push('Phone must be 11 digits starting with 03');
      } else {
        validatedData.customer_phone = phone;
        validatedData.customer_phone_last_5_chr = phone.slice(-5);
      }
    }

    if (!row.customer_address || row.customer_address.trim() === '') {
      errors.push('Customer address is required');
    } else {
      validatedData.customer_address = sanitizeInput(row.customer_address);
    }

    if (!row.city || row.city.trim() === '') {
      errors.push('City is required');
    } else {
      validatedData.city = sanitizeInput(row.city);
    }

    if (!row.total_amount || isNaN(parseFloat(row.total_amount))) {
      errors.push('Total amount must be a valid number');
    } else {
      const amount = parseFloat(row.total_amount);
      if (amount < 0) {
        errors.push('Total amount cannot be negative');
      } else {
        validatedData.total_amount = amount;
      }
    }

    // Items validation
    if (!row.items || row.items.trim() === '') {
      errors.push('Items are required');
    } else {
      try {
        const items = JSON.parse(row.items);
        if (!Array.isArray(items) || items.length === 0) {
          errors.push('Items must be a non-empty array');
        } else {
          // Validate each item
          items.forEach((item, idx) => {
            if (!item.item_name) errors.push(`Item ${idx + 1}: item_name is required`);
            if (!item.quantity || item.quantity < 1) errors.push(`Item ${idx + 1}: quantity must be at least 1`);
            if (!item.price || item.price < 0) errors.push(`Item ${idx + 1}: price must be non-negative`);
          });
          validatedData.items = items;
          validatedData.total_items = items.reduce((sum, item) => sum + (item.quantity || 0), 0).toString();
        }
      } catch (e) {
        errors.push('Items must be valid JSON format');
      }
    }

    // Optional fields
    if (row.customer_email && row.customer_email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.customer_email)) {
        errors.push('Invalid email format');
      } else {
        validatedData.customer_email = sanitizeInput(row.customer_email);
      }
    }

    if (row.courier && row.courier.trim() !== '') {
      const courier = row.courier.toLowerCase().trim();
      if (!VALID_COURIERS.includes(courier)) {
        errors.push(`Courier must be one of: ${VALID_COURIERS.join(', ')}`);
      } else {
        validatedData.courier = courier;
      }
    }

    if (row.order_type && row.order_type.trim() !== '') {
      const orderType = row.order_type.toLowerCase().trim();
      if (!VALID_ORDER_TYPES.includes(orderType)) {
        errors.push(`Order type must be one of: ${VALID_ORDER_TYPES.join(', ')}`);
      } else {
        validatedData.order_type = orderType;
      }
    } else {
      validatedData.order_type = 'standard';
    }

    if (row.notes && row.notes.trim() !== '') {
      validatedData.notes = sanitizeInput(row.notes);
    }

    if (row.tags && row.tags.trim() !== '') {
      validatedData.tags = row.tags.split(',').map((tag: string) => sanitizeInput(tag.trim())).filter(Boolean);
    }

    // Order number handling
    if (row.order_number && row.order_number.trim() !== '') {
      validatedData.order_number = sanitizeInput(row.order_number);
    }

    // Set defaults
    validatedData.status = 'pending';
    validatedData.verification_status = 'pending';
    validatedData.confirmation_required = true;

  } catch (error) {
    errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    rowNumber,
    data: validatedData,
    isValid: errors.length === 0,
    errors,
  };
};

export const processOrdersForImport = async (rows: any[]): Promise<ImportResult> => {
  const validOrders: ValidatedOrder[] = [];
  const invalidOrders: ValidatedOrder[] = [];

  for (let i = 0; i < rows.length; i++) {
    const validated = validateOrderRow(rows[i], i + 2); // +2 because row 1 is headers
    
    if (validated.isValid) {
      validOrders.push(validated);
    } else {
      invalidOrders.push(validated);
    }
  }

  return {
    validOrders,
    invalidOrders,
    totalRows: rows.length,
  };
};

export const bulkCreateOrders = async (validatedOrders: ValidatedOrder[]): Promise<BulkOperationResult> => {
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < validatedOrders.length; i += batchSize) {
    const batch = validatedOrders.slice(i, i + batchSize);
    
    try {
      // Generate order numbers for orders without them
      const ordersWithNumbers = await Promise.all(
        batch.map(async (validated) => {
          const orderData = { ...validated.data };
          
          if (!orderData.order_number) {
            orderData.order_number = await generateOrderNumber();
          }
          
          return orderData;
        })
      );

      // Insert batch
      const { data, error } = await supabase
        .from('orders')
        .insert(ordersWithNumbers)
        .select();

      if (error) {
        failedCount += batch.length;
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        successCount += data?.length || 0;
        failedCount += batch.length - (data?.length || 0);
      }
    } catch (error) {
      failedCount += batch.length;
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
};
