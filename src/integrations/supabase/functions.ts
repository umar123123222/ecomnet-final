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

  if (error) throw error;
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
