export type BarcodeType = 'raw' | 'finished' | 'distribution';

export type BarcodeStatus = 'active' | 'inactive' | 'used';

export interface ProductBarcode {
  id: string;
  product_id: string;
  barcode_type: BarcodeType;
  barcode_value: string;
  barcode_format: string;
  status: BarcodeStatus;
  generated_at: string;
  generated_by: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProductLifecycle {
  product_id: string;
  product_name: string;
  product_sku: string;
  barcode_type: BarcodeType;
  barcode_value: string;
  barcode_format: string;
  status: BarcodeStatus;
  generated_at: string;
  generated_by_name: string | null;
}

export interface GenerateBarcodeRequest {
  product_id: string;
  barcode_type: BarcodeType;
  barcode_format?: string;
  metadata?: Record<string, any>;
}
