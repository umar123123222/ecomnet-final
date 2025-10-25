import { supabase } from './client';

// ============================================
// USER MANAGEMENT
// ============================================

export interface ManageUserRequest {
  action: 'create' | 'update' | 'delete';
  userData: {
    userId?: string;
    email: string;
    full_name?: string;
    password?: string;
    roles: string[];
    outlet_id?: string;
  };
}

export const manageUser = async (request: ManageUserRequest) => {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: request,
  });

  if (error) {
    // Extract server error message if available
    let errorMessage = 'Failed to manage user';
    
    if (error.context?.json) {
      try {
        const errorJson = await error.context.json();
        errorMessage = errorJson.error || errorMessage;
        
        if (errorJson.details) {
          errorMessage += `: ${errorJson.details}`;
        }
      } catch (e) {
        // Failed to parse error JSON, use default message
        console.error('Failed to parse error JSON:', e);
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
  
  return data;
};

// ============================================
// STOCK MANAGEMENT
// ============================================

export interface StockOperationRequest {
  operation: 'checkAvailability' | 'reserveStock' | 'releaseStock' | 'recordSale' | 
             'processReturn' | 'adjustStock' | 'transferStock';
  data: {
    productId: string;
    outletId?: string;
    fromOutletId?: string;
    toOutletId?: string;
    quantity: number;
    orderId?: string;
    returnId?: string;
    reason?: string;
    notes?: string;
  };
}

export const manageStock = async (request: StockOperationRequest) => {
  const { data, error } = await supabase.functions.invoke('manage-stock', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// STOCK TRANSFER REQUESTS
// ============================================

export interface StockTransferRequest {
  action: 'create' | 'approve' | 'reject' | 'complete' | 'cancel';
  data: {
    requestId?: string;
    productId?: string;
    fromOutletId?: string;
    toOutletId?: string;
    quantity?: number;
    quantityApproved?: number;
    notes?: string;
    reason?: string;
  };
}

export const stockTransferRequest = async (request: StockTransferRequest) => {
  const { data, error } = await supabase.functions.invoke('stock-transfer-request', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// INVENTORY REPORTS
// ============================================

export interface InventoryReportRequest {
  reportType: 'stockLevels' | 'lowStock' | 'stockMovements' | 
              'transferHistory' | 'stockValuation' | 'productPerformance';
  filters?: {
    outletId?: string;
    startDate?: string;
    endDate?: string;
    movementType?: string;
    status?: string;
  };
}

export const getInventoryReport = async (request: InventoryReportRequest) => {
  const { data, error } = await supabase.functions.invoke('inventory-reports', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// LOW STOCK ALERTS
// ============================================

export interface LowStockAlertsRequest {
  action: 'checkLowStock' | 'getRestockSuggestions' | 'getStockAlerts';
  filters?: {
    outletId?: string;
  };
}

export const getLowStockAlerts = async (request: LowStockAlertsRequest) => {
  const { data, error } = await supabase.functions.invoke('low-stock-alerts', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// PURCHASE ORDERS
// ============================================

export interface PurchaseOrderRequest {
  action: 'create' | 'approve' | 'cancel';
  data: {
    po_id?: string;
    supplier_id?: string;
    outlet_id?: string;
    items?: Array<{
      product_id: string;
      quantity_ordered: number;
      unit_price: number;
      tax_rate?: number;
      discount_rate?: number;
      notes?: string;
    }>;
    expected_delivery_date?: string;
    notes?: string;
    terms_conditions?: string;
    tax_amount?: number;
    discount_amount?: number;
    shipping_cost?: number;
  };
}

export const managePurchaseOrder = async (request: PurchaseOrderRequest) => {
  const { data, error } = await supabase.functions.invoke('manage-purchase-order', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// GOODS RECEIVING
// ============================================

export interface GRNRequest {
  action: 'create' | 'accept' | 'reject';
  data: {
    grn_id?: string;
    po_id?: string;
    items?: Array<{
      po_item_id: string;
      product_id: string;
      quantity_expected: number;
      quantity_received: number;
      unit_cost: number;
      batch_number?: string;
      expiry_date?: string;
      notes?: string;
    }>;
    notes?: string;
    rejection_reason?: string;
  };
}

export const processGRN = async (request: GRNRequest) => {
  const { data, error } = await supabase.functions.invoke('process-grn', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// ORDER FULFILLMENT
// ============================================

export interface OrderFulfillmentRequest {
  action: 'dispatch' | 'cancel';
  data: {
    order_id: string;
    outlet_id: string;
  };
}

export const processOrderFulfillment = async (request: OrderFulfillmentRequest) => {
  const { data, error } = await supabase.functions.invoke('process-order-fulfillment', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// RETURN RESTOCKING
// ============================================

export interface ReturnRestockRequest {
  action: 'receive';
  data: {
    return_id: string;
    outlet_id: string;
  };
}

export const processReturnRestock = async (request: ReturnRestockRequest) => {
  const { data, error } = await supabase.functions.invoke('process-return-restock', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// PRODUCTION BATCHES
// ============================================

export interface ProductionBatchRequest {
  action: 'create' | 'complete' | 'cancel';
  data: {
    batch_id?: string;
    batch_number?: string;
    finished_product_id?: string;
    outlet_id?: string;
    quantity_produced?: number;
    production_date?: string;
    expiry_date?: string;
    notes?: string;
    reason?: string;
  };
}

export const processProductionBatch = async (request: ProductionBatchRequest) => {
  const { data, error } = await supabase.functions.invoke('process-production-batch', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// LABEL GENERATION
// ============================================

export interface LabelGenerationRequest {
  label_type: 'raw_material' | 'finished_product' | 'packaging';
  product_id?: string;
  packaging_item_id?: string;
  production_batch_id?: string;
  quantity: number;
  label_data: {
    productName: string;
    sku: string;
    barcode: string;
    barcodeFormat: string;
    packagingDetails?: string;
    batchNumber?: string;
    productionDate?: string;
    expiryDate?: string;
    price?: number;
    includePrice: boolean;
    includeBarcode: boolean;
    includeBatchInfo: boolean;
    includeExpiryDate: boolean;
  };
}

export const generateBarcodeLabels = async (request: LabelGenerationRequest) => {
  const { data, error } = await supabase.functions.invoke('generate-barcode-labels', {
    body: request,
  });

  if (error) throw error;
  return data;
};

// ============================================
// Product Barcode Management
// ============================================

/**
 * Generate product barcode for 3-level lifecycle tracking
 */
export const generateProductBarcode = async (request: {
  product_id: string;
  barcode_type: 'raw' | 'finished' | 'distribution';
  barcode_format?: string;
  metadata?: Record<string, any>;
}) => {
  const { data, error } = await supabase.functions.invoke('generate-product-barcode', {
    body: request,
  });

  if (error) throw error;
  return data;
};

