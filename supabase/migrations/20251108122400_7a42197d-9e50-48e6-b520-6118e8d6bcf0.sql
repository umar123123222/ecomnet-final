-- Create courier_booking_attempts table for audit trail
CREATE TABLE public.courier_booking_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  courier_code TEXT NOT NULL,
  booking_request JSONB NOT NULL DEFAULT '{}'::jsonb,
  booking_response JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  error_code TEXT,
  error_message TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  tracking_id TEXT,
  label_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_courier_booking_attempts_order_id ON public.courier_booking_attempts(order_id);
CREATE INDEX idx_courier_booking_attempts_status ON public.courier_booking_attempts(status);
CREATE INDEX idx_courier_booking_attempts_created_at ON public.courier_booking_attempts(created_at DESC);
CREATE INDEX idx_courier_booking_attempts_courier_id ON public.courier_booking_attempts(courier_id);

-- Enable RLS
ALTER TABLE public.courier_booking_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view booking attempts"
  ON public.courier_booking_attempts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert booking attempts"
  ON public.courier_booking_attempts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create courier_booking_queue table for retry mechanism
CREATE TABLE public.courier_booking_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_error_code TEXT,
  last_error_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'success', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_courier_booking_queue_next_retry ON public.courier_booking_queue(next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_courier_booking_queue_order_id ON public.courier_booking_queue(order_id);
CREATE INDEX idx_courier_booking_queue_status ON public.courier_booking_queue(status);

-- Enable RLS
ALTER TABLE public.courier_booking_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view booking queue"
  ON public.courier_booking_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage booking queue"
  ON public.courier_booking_queue FOR ALL
  USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_courier_booking_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_courier_booking_queue_updated_at
  BEFORE UPDATE ON public.courier_booking_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_courier_booking_queue_updated_at();