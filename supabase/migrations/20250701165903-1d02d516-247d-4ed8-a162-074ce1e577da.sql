
-- Drop existing tables to start clean
DROP TABLE IF EXISTS public.user_performance CASCADE;
DROP TABLE IF EXISTS public.returns CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop existing enums
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.courier_type CASCADE;
DROP TYPE IF EXISTS public.order_status CASCADE;
DROP TYPE IF EXISTS public.return_status CASCADE;

-- Create enums
CREATE TYPE public.user_role AS ENUM ('owner', 'store_manager', 'dispatch_manager', 'returns_manager', 'staff');
CREATE TYPE public.courier_type AS ENUM ('postex', 'leopard', 'tcs', 'other');
CREATE TYPE public.order_status AS ENUM ('pending', 'booked', 'dispatched', 'delivered', 'cancelled', 'returned');
CREATE TYPE public.return_status AS ENUM ('in_transit', 'received', 'processed', 'completed');
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'disapproved');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  total_orders INTEGER DEFAULT 0,
  return_count INTEGER DEFAULT 0,
  is_suspicious BOOLEAN DEFAULT false,
  suspicious_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  city TEXT NOT NULL,
  status order_status DEFAULT 'pending',
  courier courier_type NOT NULL,
  tracking_id TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  items JSONB NOT NULL,
  tags TEXT[],
  notes TEXT,
  gpt_score INTEGER,
  assigned_to UUID REFERENCES profiles(id),
  verification_status verification_status DEFAULT 'pending',
  verification_notes TEXT,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dispatched_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Returns table
CREATE TABLE public.returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL,
  reason TEXT,
  return_status return_status DEFAULT 'in_transit',
  worth DECIMAL(10,2),
  tags TEXT[],
  notes TEXT,
  received_by UUID REFERENCES profiles(id),
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User performance tracking
CREATE TABLE public.user_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  orders_processed INTEGER DEFAULT 0,
  returns_handled INTEGER DEFAULT 0,
  addresses_verified INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create indexes for performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_is_suspicious ON customers(is_suspicious);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_courier ON orders(courier);
CREATE INDEX idx_orders_tracking_id ON orders(tracking_id);
CREATE INDEX idx_orders_verification_status ON orders(verification_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_returns_order_id ON returns(order_id);
CREATE INDEX idx_returns_tracking_id ON returns(tracking_id);
CREATE INDEX idx_returns_status ON returns(return_status);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_user_performance_user_id ON user_performance(user_id);
CREATE INDEX idx_user_performance_date ON user_performance(date);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Owners can manage all profiles" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

-- RLS Policies for customers (authenticated users can manage)
CREATE POLICY "Authenticated users can manage customers" ON customers FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for orders (authenticated users can manage)
CREATE POLICY "Authenticated users can manage orders" ON orders FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for returns (authenticated users can manage)
CREATE POLICY "Authenticated users can manage returns" ON returns FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for activity logs
CREATE POLICY "Users can view activity logs" ON activity_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can create activity logs" ON activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user performance
CREATE POLICY "Users can view their own performance" ON user_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own performance" ON user_performance FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Owners can view all performance" ON user_performance FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User'),
    'staff'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO public.customers (name, email, phone, address, city, total_orders, return_count, is_suspicious) VALUES
('John Doe', 'john@example.com', '+92-300-1234567', 'House 123, Street 45, Block F, Gulberg', 'Lahore', 5, 1, false),
('Jane Smith', 'jane@example.com', '+92-301-9876543', 'Flat 7, Building 12, Main Road', 'Karachi', 3, 2, true),
('Ali Khan', 'ali@example.com', '+92-302-5556789', 'Plot 456, Sector G-9', 'Islamabad', 8, 0, false),
('Sara Ahmed', 'sara@example.com', '+92-303-7778888', 'House 789, Model Town', 'Lahore', 2, 1, false);

-- Insert sample orders
INSERT INTO public.orders (order_number, customer_id, customer_name, customer_phone, customer_address, city, status, courier, total_amount, items, gpt_score, verification_status) 
SELECT 
  'ORD-' || LPAD((ROW_NUMBER() OVER())::TEXT, 6, '0'),
  c.id,
  c.name,
  c.phone,
  c.address,
  c.city,
  CASE (RANDOM() * 4)::INT 
    WHEN 0 THEN 'pending'::order_status
    WHEN 1 THEN 'booked'::order_status
    WHEN 2 THEN 'dispatched'::order_status
    WHEN 3 THEN 'delivered'::order_status
    ELSE 'cancelled'::order_status
  END,
  CASE (RANDOM() * 3)::INT
    WHEN 0 THEN 'postex'::courier_type
    WHEN 1 THEN 'leopard'::courier_type
    ELSE 'tcs'::courier_type
  END,
  (RANDOM() * 5000 + 500)::DECIMAL(10,2),
  '[{"id": "1", "name": "Product A", "quantity": 2, "price": 1500}]'::JSONB,
  (RANDOM() * 100)::INT,
  CASE (RANDOM() * 2)::INT
    WHEN 0 THEN 'pending'::verification_status
    WHEN 1 THEN 'approved'::verification_status
    ELSE 'disapproved'::verification_status
  END
FROM customers c;
