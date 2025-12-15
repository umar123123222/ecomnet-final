-- Add claim tracking columns to returns table
ALTER TABLE public.returns 
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS claim_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS claim_reference TEXT,
ADD COLUMN IF NOT EXISTS claim_notes TEXT;

-- Add check constraint for claim_status
ALTER TABLE public.returns 
ADD CONSTRAINT returns_claim_status_check 
CHECK (claim_status IN ('pending', 'approved', 'rejected', 'settled') OR claim_status IS NULL);

-- Create index for efficient claim queries
CREATE INDEX IF NOT EXISTS idx_returns_claimed_at ON public.returns(claimed_at) WHERE claimed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_returns_claim_status ON public.returns(claim_status) WHERE claim_status IS NOT NULL;