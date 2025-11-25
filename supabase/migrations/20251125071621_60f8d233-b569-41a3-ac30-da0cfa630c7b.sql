-- Phase 1: Add new endpoint columns to couriers table
ALTER TABLE public.couriers
ADD COLUMN IF NOT EXISTS bulk_booking_endpoint TEXT,
ADD COLUMN IF NOT EXISTS bulk_tracking_endpoint TEXT,
ADD COLUMN IF NOT EXISTS load_sheet_endpoint TEXT,
ADD COLUMN IF NOT EXISTS awb_endpoint TEXT,
ADD COLUMN IF NOT EXISTS shipper_advice_list_endpoint TEXT,
ADD COLUMN IF NOT EXISTS shipper_advice_save_endpoint TEXT,
ADD COLUMN IF NOT EXISTS tariff_endpoint TEXT;

-- Update check constraint to validate all endpoints
ALTER TABLE public.couriers DROP CONSTRAINT IF EXISTS couriers_endpoint_format_check;
ALTER TABLE public.couriers ADD CONSTRAINT couriers_endpoint_format_check CHECK (
  (api_endpoint LIKE 'http://%' OR api_endpoint LIKE 'https://%') AND
  (booking_endpoint IS NULL OR booking_endpoint LIKE 'http://%' OR booking_endpoint LIKE 'https://%') AND
  (tracking_endpoint IS NULL OR tracking_endpoint LIKE 'http://%' OR tracking_endpoint LIKE 'https://%') AND
  (cancellation_endpoint IS NULL OR cancellation_endpoint LIKE 'http://%' OR cancellation_endpoint LIKE 'https://%') AND
  (label_endpoint IS NULL OR label_endpoint LIKE 'http://%' OR label_endpoint LIKE 'https://%') AND
  (rates_endpoint IS NULL OR rates_endpoint LIKE 'http://%' OR rates_endpoint LIKE 'https://%') AND
  (update_endpoint IS NULL OR update_endpoint LIKE 'http://%' OR update_endpoint LIKE 'https://%') AND
  (bulk_booking_endpoint IS NULL OR bulk_booking_endpoint LIKE 'http://%' OR bulk_booking_endpoint LIKE 'https://%') AND
  (bulk_tracking_endpoint IS NULL OR bulk_tracking_endpoint LIKE 'http://%' OR bulk_tracking_endpoint LIKE 'https://%') AND
  (load_sheet_endpoint IS NULL OR load_sheet_endpoint LIKE 'http://%' OR load_sheet_endpoint LIKE 'https://%') AND
  (awb_endpoint IS NULL OR awb_endpoint LIKE 'http://%' OR awb_endpoint LIKE 'https://%') AND
  (shipper_advice_list_endpoint IS NULL OR shipper_advice_list_endpoint LIKE 'http://%' OR shipper_advice_list_endpoint LIKE 'https://%') AND
  (shipper_advice_save_endpoint IS NULL OR shipper_advice_save_endpoint LIKE 'http://%' OR shipper_advice_save_endpoint LIKE 'https://%') AND
  (tariff_endpoint IS NULL OR tariff_endpoint LIKE 'http://%' OR tariff_endpoint LIKE 'https://%')
);

-- Phase 2: Create courier_load_sheets table
CREATE TABLE IF NOT EXISTS public.courier_load_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES public.profiles(id),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  tracking_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  order_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  load_sheet_url TEXT,
  load_sheet_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_courier_load_sheets_courier_id ON public.courier_load_sheets(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_load_sheets_generated_at ON public.courier_load_sheets(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_courier_load_sheets_status ON public.courier_load_sheets(status);

-- Enable RLS
ALTER TABLE public.courier_load_sheets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courier_load_sheets
CREATE POLICY "Users can view load sheets" ON public.courier_load_sheets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create load sheets" ON public.courier_load_sheets
  FOR INSERT WITH CHECK (auth.uid() = generated_by);

-- Phase 3: Create shipper_advice_logs table
CREATE TABLE IF NOT EXISTS public.shipper_advice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL,
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  advice_type TEXT NOT NULL CHECK (advice_type IN ('reattempt', 'return', 'reschedule')),
  remarks TEXT,
  requested_by UUID REFERENCES public.profiles(id),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  courier_response JSONB DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipper_advice_logs_order_id ON public.shipper_advice_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_shipper_advice_logs_tracking_id ON public.shipper_advice_logs(tracking_id);
CREATE INDEX IF NOT EXISTS idx_shipper_advice_logs_courier_id ON public.shipper_advice_logs(courier_id);
CREATE INDEX IF NOT EXISTS idx_shipper_advice_logs_requested_at ON public.shipper_advice_logs(requested_at DESC);

-- Enable RLS
ALTER TABLE public.shipper_advice_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipper_advice_logs
CREATE POLICY "Users can view shipper advice logs" ON public.shipper_advice_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create shipper advice logs" ON public.shipper_advice_logs
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can update shipper advice logs" ON public.shipper_advice_logs
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Phase 4: Populate endpoints for existing couriers
-- Update Leopard courier with all endpoints
UPDATE public.couriers
SET 
  bulk_booking_endpoint = 'https://merchantapi.leopardscourier.com/api/batchBookPacket/format/json/',
  load_sheet_endpoint = 'https://merchantapi.leopardscourier.com/api/generateLoadSheet/format/json/',
  awb_endpoint = 'https://merchantapi.leopardscourier.com/api/downloadLoadSheet/format/json/',
  shipper_advice_list_endpoint = 'https://merchantapi.leopardscourier.com/api/shipperAdviceList/format/json/',
  shipper_advice_save_endpoint = 'https://merchantapi.leopardscourier.com/api/addShipperAdvices/format/json/',
  tariff_endpoint = 'https://merchantapi.leopardscourier.com/api/getTariffDetails/format/json/'
WHERE code = 'leopard';

-- Update Postex courier with all endpoints
UPDATE public.couriers
SET 
  bulk_tracking_endpoint = 'https://api.postex.pk/services/integration/api/order/v1/track-bulk-order',
  load_sheet_endpoint = 'https://api.postex.pk/services/integration/api/order/v2/generate-load-sheet',
  awb_endpoint = 'https://api.postex.pk/services/integration/api/order/v1/get-invoice',
  shipper_advice_list_endpoint = 'https://api.postex.pk/services/integration/api/order/v1/get-shipper-advice',
  shipper_advice_save_endpoint = 'https://api.postex.pk/services/integration/api/order/v2/save-shipper-advice',
  tariff_endpoint = 'https://api.postex.pk/services/integration/api/shipment/v1/calculate-charges'
WHERE code = 'postex';