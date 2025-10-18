export interface BillOfMaterial {
  id: string;
  finished_product_id: string;
  raw_material_id?: string;
  packaging_item_id?: string;
  quantity_required: number;
  unit: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  raw_material?: {
    id: string;
    name: string;
    sku: string;
    product_type: string;
  };
  packaging_item?: {
    id: string;
    name: string;
    sku: string;
    type: string;
  };
  finished_product?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface ProductionBatch {
  id: string;
  batch_number: string;
  finished_product_id: string;
  outlet_id: string;
  quantity_produced: number;
  production_date: string;
  expiry_date?: string;
  produced_by?: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // Joined data
  finished_product?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
  };
  outlet?: {
    id: string;
    name: string;
  };
  producer?: {
    id: string;
    full_name: string;
  };
}

export interface ProductionMaterialUsage {
  id: string;
  production_batch_id: string;
  raw_material_id?: string;
  packaging_item_id?: string;
  quantity_used: number;
  created_at: string;
  // Joined data
  raw_material?: {
    id: string;
    name: string;
    sku: string;
  };
  packaging_item?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface LabelPrintLog {
  id: string;
  label_type: 'raw_material' | 'finished_product' | 'packaging';
  product_id?: string;
  packaging_item_id?: string;
  production_batch_id?: string;
  quantity_printed: number;
  label_data: LabelData;
  printed_by?: string;
  printed_at: string;
  print_format: string;
  notes?: string;
}

export interface LabelData {
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
}

export interface ProductionBatchFormData {
  finished_product_id: string;
  outlet_id: string;
  quantity_produced: number;
  production_date: string;
  expiry_date?: string;
  notes?: string;
}

export interface BOMFormData {
  finished_product_id: string;
  raw_material_id?: string;
  packaging_item_id?: string;
  quantity_required: number;
  unit: string;
  notes?: string;
}

export interface LabelPrintRequest {
  label_type: 'raw_material' | 'finished_product' | 'packaging';
  product_id?: string;
  packaging_item_id?: string;
  production_batch_id?: string;
  quantity: number;
  label_data: LabelData;
}
