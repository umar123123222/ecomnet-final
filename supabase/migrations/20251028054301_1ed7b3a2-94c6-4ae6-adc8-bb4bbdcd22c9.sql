-- Add fraud prevention and GPS tracking fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_block_reason TEXT,
ADD COLUMN IF NOT EXISTS customer_ip TEXT,
ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC(11, 8),
ADD COLUMN IF NOT EXISTS gps_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gps_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gps_distance_from_address NUMERIC;

-- Add index for risk queries
CREATE INDEX IF NOT EXISTS idx_orders_risk_level ON public.orders(risk_level) WHERE risk_level IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_orders_auto_blocked ON public.orders(auto_blocked) WHERE auto_blocked = true;

-- Add GPS fields to address_verifications table
ALTER TABLE public.address_verifications
ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC(11, 8),
ADD COLUMN IF NOT EXISTS gps_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gps_distance_from_address NUMERIC,
ADD COLUMN IF NOT EXISTS gps_verification_notes TEXT;

COMMENT ON COLUMN public.orders.risk_score IS 'Fraud risk score from 0-100';
COMMENT ON COLUMN public.orders.risk_level IS 'Risk level: low, medium, high, critical';
COMMENT ON COLUMN public.orders.fraud_flags IS 'Array of fraud detection flags and patterns';
COMMENT ON COLUMN public.orders.auto_blocked IS 'Whether order was automatically blocked due to high fraud risk';
COMMENT ON COLUMN public.orders.gps_latitude IS 'GPS latitude coordinate from customer';
COMMENT ON COLUMN public.orders.gps_longitude IS 'GPS longitude coordinate from customer';
COMMENT ON COLUMN public.orders.gps_distance_from_address IS 'Distance in km between GPS coords and stated address';