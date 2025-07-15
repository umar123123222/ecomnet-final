-- Create conversations table to store message history
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  message_content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('incoming', 'outgoing')),
  sender_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to manage conversations
CREATE POLICY "Authenticated users can manage conversations" 
ON public.conversations 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_conversations_order_customer ON public.conversations(order_id, customer_id, created_at DESC);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

-- Create function to keep only last 10 messages per order/customer
CREATE OR REPLACE FUNCTION public.cleanup_old_conversations()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete messages older than the 10 most recent for this order/customer combination
  DELETE FROM public.conversations 
  WHERE order_id = NEW.order_id 
    AND customer_id = NEW.customer_id 
    AND id NOT IN (
      SELECT id 
      FROM public.conversations 
      WHERE order_id = NEW.order_id 
        AND customer_id = NEW.customer_id 
      ORDER BY created_at DESC 
      LIMIT 10
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically cleanup old messages
CREATE TRIGGER cleanup_conversations_trigger
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_old_conversations();