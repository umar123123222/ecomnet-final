-- Phase 3.4: Attach Conversations Cleanup Trigger
CREATE TRIGGER cleanup_old_conversations_trigger
AFTER INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_old_conversations();

-- Phase 4.1: Add Foreign Key Constraints for Data Integrity
-- Orders to customers
ALTER TABLE public.orders 
ADD CONSTRAINT fk_orders_customer 
FOREIGN KEY (customer_id) 
REFERENCES public.customers(id) 
ON DELETE SET NULL;

-- Returns to orders
ALTER TABLE public.returns 
ADD CONSTRAINT fk_returns_order 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- Dispatches to orders
ALTER TABLE public.dispatches 
ADD CONSTRAINT fk_dispatches_order 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- Activity logs to profiles
ALTER TABLE public.activity_logs 
ADD CONSTRAINT fk_activity_logs_user 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- User performance to profiles
ALTER TABLE public.user_performance 
ADD CONSTRAINT fk_user_performance_user 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Conversations to orders and customers
ALTER TABLE public.conversations 
ADD CONSTRAINT fk_conversations_order 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

ALTER TABLE public.conversations 
ADD CONSTRAINT fk_conversations_customer 
FOREIGN KEY (customer_id) 
REFERENCES public.customers(id) 
ON DELETE CASCADE;

-- Suspicious customers to customers
ALTER TABLE public.suspicious_customers 
ADD CONSTRAINT fk_suspicious_customers_customer 
FOREIGN KEY (customer_id) 
REFERENCES public.customers(id) 
ON DELETE CASCADE;

-- Address verifications to orders
ALTER TABLE public.address_verifications 
ADD CONSTRAINT fk_address_verifications_order 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;