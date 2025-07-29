-- Insert demo customers (without Type column)
INSERT INTO public.customers (id, name, phone, email, address, city, total_orders, delivered_count, return_count, is_suspicious, suspicious_reason, phone_last_5_chr) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Ahmed Hassan', '+92-300-1234567', 'ahmed.hassan@email.com', 'House 123, Block A, DHA Phase 5', 'Karachi', 15, 12, 1, false, null, '34567'),
('550e8400-e29b-41d4-a716-446655440002', 'Fatima Khan', '+92-321-9876543', 'fatima.khan@email.com', 'Flat 45B, Gulshan-e-Iqbal', 'Karachi', 8, 7, 0, false, null, '76543'),
('550e8400-e29b-41d4-a716-446655440003', 'Muhammad Ali', '+92-333-5555555', 'ali.muhammad@email.com', 'Shop 12, Main Market, Johar Town', 'Lahore', 25, 20, 3, true, 'Multiple failed deliveries', '55555'),
('550e8400-e29b-41d4-a716-446655440004', 'Sarah Ahmed', '+92-345-1111111', 'sarah.ahmed@email.com', 'Villa 67, F-7/1', 'Islamabad', 5, 5, 0, false, null, '11111'),
('550e8400-e29b-41d4-a716-446655440005', 'Hassan Malik', '+92-312-9999999', 'hassan.malik@email.com', 'House 89, Model Town', 'Lahore', 12, 8, 2, true, 'Suspicious payment patterns', '99999'),
('550e8400-e29b-41d4-a716-446655440006', 'Aisha Rehman', '+92-334-7777777', 'aisha.rehman@email.com', 'Apartment 34C, Clifton', 'Karachi', 18, 16, 1, false, null, '77777'),
('550e8400-e29b-41d4-a716-446655440007', 'Omar Sheikh', '+92-300-2222222', 'omar.sheikh@email.com', 'House 156, Cantt Area', 'Rawalpindi', 3, 2, 1, false, null, '22222'),
('550e8400-e29b-41d4-a716-446655440008', 'Zara Butt', '+92-321-8888888', 'zara.butt@email.com', 'Plot 45, Bahria Town', 'Lahore', 22, 18, 2, true, 'Frequent address changes', '88888'),
('550e8400-e29b-41d4-a716-446655440009', 'Imran Khan', '+92-345-4444444', 'imran.khan@email.com', 'House 78, F-11/2', 'Islamabad', 7, 7, 0, false, null, '44444'),
('550e8400-e29b-41d4-a716-446655440010', 'Nadia Qureshi', '+92-333-6666666', 'nadia.qureshi@email.com', 'Flat 23A, Nazimabad', 'Karachi', 14, 11, 1, false, null, '66666');

-- Insert demo orders
INSERT INTO public.orders (id, customer_id, order_number, customer_name, customer_phone, customer_address, city, status, courier, total_amount, items, gpt_score, tracking_id, tags, notes, verification_status, order_type, customer_phone_last_5_chr, total_items, delivery_notes, customer_email, created_at) VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'ORD-2024-001', 'Ahmed Hassan', '+92-300-1234567', 'House 123, Block A, DHA Phase 5', 'Karachi', 'delivered', 'TCS', 155000.00, '[{"name": "iPhone 14 Pro", "quantity": 1, "price": 155000}]', 85, 'TCS123456789', '["electronics", "verified"]', 'Customer requested express delivery', 'verified', 'standard', '34567', '1', 'Leave at gate if not home', 'ahmed.hassan@email.com', '2024-01-15 10:30:00'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'ORD-2024-002', 'Fatima Khan', '+92-321-9876543', 'Flat 45B, Gulshan-e-Iqbal', 'Karachi', 'in_transit', 'Leopards', 85000.00, '[{"name": "Samsung Galaxy S23", "quantity": 1, "price": 85000}]', 92, 'LEO987654321', '["electronics"]', 'Premium customer - priority handling', 'verified', 'express', '76543', '1', 'Call before delivery', 'fatima.khan@email.com', '2024-01-16 14:20:00'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'ORD-2024-003', 'Muhammad Ali', '+92-333-5555555', 'Shop 12, Main Market, Johar Town', 'Lahore', 'failed_delivery', 'PostEx', 220000.00, '[{"name": "MacBook Air", "quantity": 1, "price": 220000}]', 45, 'POX456789123', '["electronics", "problematic"]', 'Multiple delivery attempts failed', 'pending', 'standard', '55555', '1', 'Business address - deliver 9-5 only', 'ali.muhammad@email.com', '2024-01-17 09:15:00'),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'ORD-2024-004', 'Sarah Ahmed', '+92-345-1111111', 'Villa 67, F-7/1', 'Islamabad', 'delivered', 'TCS', 45000.00, '[{"name": "AirPods Pro", "quantity": 1, "price": 45000}]', 88, 'TCS789123456', '["electronics", "vip"]', 'VIP customer in Islamabad', 'verified', 'express', '11111', '1', 'Ring doorbell twice', 'sarah.ahmed@email.com', '2024-01-18 16:45:00'),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'ORD-2024-005', 'Hassan Malik', '+92-312-9999999', 'House 89, Model Town', 'Lahore', 'returned', 'Leopards', 135000.00, '[{"name": "iPad Air", "quantity": 1, "price": 135000}]', 65, 'LEO321654987', '["electronics", "returned"]', 'Customer requested return - defective item', 'verified', 'standard', '99999', '1', 'Check item before delivery', 'hassan.malik@email.com', '2024-01-19 11:30:00'),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440006', 'ORD-2024-006', 'Aisha Rehman', '+92-334-7777777', 'Apartment 34C, Clifton', 'Karachi', 'dispatched', 'TCS', 180000.00, '[{"name": "Gaming Laptop", "quantity": 1, "price": 180000}]', 90, 'TCS654321789', '["electronics", "gaming"]', 'High-value item - signature required', 'verified', 'premium', '77777', '1', 'Apartment delivery - use intercom', 'aisha.rehman@email.com', '2024-01-20 13:20:00'),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440007', 'ORD-2024-007', 'Omar Sheikh', '+92-300-2222222', 'House 156, Cantt Area', 'Rawalpindi', 'pending_verification', 'PostEx', 75000.00, '[{"name": "Smart Watch", "quantity": 1, "price": 75000}]', 55, null, '["electronics", "pending"]', 'Address verification required', 'pending', 'standard', '22222', '1', 'Military area - ID required', 'omar.sheikh@email.com', '2024-01-21 08:45:00'),
('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440008', 'ORD-2024-008', 'Zara Butt', '+92-321-8888888', 'Plot 45, Bahria Town', 'Lahore', 'out_for_delivery', 'Leopards', 185000.00, '[{"name": "iPhone 15 Pro Max", "quantity": 1, "price": 185000}]', 78, 'LEO852963741', '["electronics", "high-value"]', 'Bulk customer - handle with care', 'verified', 'bulk', '88888', '1', 'Gated community - call for access', 'zara.butt@email.com', '2024-01-22 15:10:00'),
('660e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440009', 'ORD-2024-009', 'Imran Khan', '+92-345-4444444', 'House 78, F-11/2', 'Islamabad', 'delivered', 'TCS', 52000.00, '[{"name": "Wireless Headphones", "quantity": 1, "price": 52000}]', 87, 'TCS159753486', '["electronics"]', 'Regular customer - reliable', 'verified', 'standard', '44444', '1', 'Leave with security if not home', 'imran.khan@email.com', '2024-01-23 12:00:00'),
('660e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440010', 'ORD-2024-010', 'Nadia Qureshi', '+92-333-6666666', 'Flat 23A, Nazimabad', 'Karachi', 'processing', 'TCS', 125000.00, '[{"name": "Tablet Pro", "quantity": 1, "price": 125000}]', 91, null, '["electronics", "premium"]', 'Premium customer - expedite processing', 'verified', 'premium', '66666', '1', 'Apartment 23A - 3rd floor', 'nadia.qureshi@email.com', '2024-01-24 09:30:00'),
('660e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'ORD-2024-011', 'Ahmed Hassan', '+92-300-1234567', 'House 123, Block A, DHA Phase 5', 'Karachi', 'cancelled', 'TCS', 95000.00, '[{"name": "Smart TV", "quantity": 1, "price": 95000}]', 75, null, '["electronics", "cancelled"]', 'Customer cancelled order', 'verified', 'standard', '34567', '1', null, 'ahmed.hassan@email.com', '2024-01-25 10:30:00'),
('660e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440003', 'ORD-2024-012', 'Muhammad Ali', '+92-333-5555555', 'Shop 12, Main Market, Johar Town', 'Lahore', 'rto', 'PostEx', 115000.00, '[{"name": "PlayStation 5", "quantity": 1, "price": 115000}]', 35, 'POX789456123', '["electronics", "rto"]', 'Return to origin - multiple failed attempts', 'pending', 'standard', '55555', '1', 'RTO due to customer unavailability', 'ali.muhammad@email.com', '2024-01-26 09:15:00');

-- Insert demo dispatches
INSERT INTO public.dispatches (id, order_id, courier, tracking_id, status, dispatch_date, notes, created_at) VALUES
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'TCS', 'TCS123456789', 'delivered', '2024-01-15 12:00:00', 'Standard delivery completed successfully', '2024-01-15 12:00:00'),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'Leopards', 'LEO987654321', 'in_transit', '2024-01-16 16:30:00', 'Express delivery in progress', '2024-01-16 16:30:00'),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', 'PostEx', 'POX456789123', 'failed', '2024-01-17 10:00:00', 'Customer not available, multiple attempts made', '2024-01-17 10:00:00'),
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440004', 'TCS', 'TCS789123456', 'delivered', '2024-01-18 18:00:00', 'Express delivery to Islamabad completed', '2024-01-18 18:00:00'),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440005', 'Leopards', 'LEO321654987', 'returned', '2024-01-19 14:00:00', 'Item returned due to defect', '2024-01-19 14:00:00'),
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440006', 'TCS', 'TCS654321789', 'dispatched', '2024-01-20 15:00:00', 'High-value gaming laptop dispatched with insurance', '2024-01-20 15:00:00'),
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440008', 'Leopards', 'LEO852963741', 'out_for_delivery', '2024-01-22 17:00:00', 'Out for delivery to Bahria Town', '2024-01-22 17:00:00'),
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440009', 'TCS', 'TCS159753486', 'delivered', '2024-01-23 14:00:00', 'Delivered to Islamabad successfully', '2024-01-23 14:00:00'),
('770e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440012', 'PostEx', 'POX789456123', 'rto', '2024-01-26 10:00:00', 'Return to origin initiated', '2024-01-26 10:00:00');

-- Insert demo returns
INSERT INTO public.returns (id, order_id, tracking_id, return_status, worth, reason, tags, notes, created_at) VALUES
('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440005', 'RET-LEO321654987', 'received', 135000.00, 'Defective screen', '["defective", "electronics"]', 'Customer reported screen flickering issue - refund processed', '2024-01-20 10:00:00'),
('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'RET-TCS123456789', 'in_transit', 155000.00, 'Changed mind', '["change_of_mind"]', 'Customer no longer needs the item - return approved', '2024-01-25 14:30:00'),
('880e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440007', 'RET-POX222222', 'marked_returned', 75000.00, 'Wrong item delivered', '["wrong_item"]', 'Smart watch instead of fitness tracker - exchange requested', '2024-01-24 09:15:00'),
('880e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440012', 'RET-POX789456123', 'marked_returned', 115000.00, 'RTO - Customer unavailable', '["rto", "unavailable"]', 'Multiple delivery attempts failed - returning to warehouse', '2024-01-26 11:00:00');

-- Insert demo address verifications
INSERT INTO public.address_verifications (id, order_id, gpt_score, verified, flagged_reason, verification_notes, created_at) VALUES
('990e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', 45, false, 'Incomplete address format', 'Missing apartment/floor details for business address in Johar Town', '2024-01-17 09:30:00'),
('990e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440007', 55, false, 'Military cantonment area verification needed', 'Requires ID verification for cantonment delivery in Rawalpindi', '2024-01-21 09:00:00'),
('990e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440008', 78, true, null, 'Bahria Town address verified with security - gated community confirmed', '2024-01-22 16:30:00'),
('990e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', 92, true, null, 'Gulshan-e-Iqbal address confirmed via phone call with customer', '2024-01-16 15:00:00'),
('990e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440012', 35, false, 'Suspicious address pattern', 'Same address used for multiple failed deliveries', '2024-01-26 09:30:00');

-- Insert demo suspicious customers
INSERT INTO public.suspicious_customers (id, customer_id, risk_score, flag_reason, is_verified, message_log, last_contacted_at, created_at) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'high', 'Multiple failed deliveries and payment disputes', false, '[{"date": "2024-01-17", "message": "Customer unreachable for delivery", "type": "delivery_issue"}, {"date": "2024-01-18", "message": "Payment chargeback initiated", "type": "payment_issue"}, {"date": "2024-01-26", "message": "Another failed delivery - RTO initiated", "type": "delivery_failure"}]', '2024-01-26 10:30:00', '2024-01-17 10:00:00'),
('aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', 'medium', 'Suspicious payment patterns detected', false, '[{"date": "2024-01-19", "message": "Multiple payment methods used", "type": "payment_pattern"}, {"date": "2024-01-20", "message": "Requested refund immediately after delivery", "type": "refund_request"}]', '2024-01-20 11:45:00', '2024-01-19 12:00:00'),
('aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440008', 'low', 'Frequent address changes and bulk orders', true, '[{"date": "2024-01-22", "message": "Address verified with new location", "type": "verification"}, {"date": "2024-01-23", "message": "Customer explained business relocation", "type": "explanation"}]', '2024-01-23 14:20:00', '2024-01-22 16:00:00');

-- Insert demo conversations
INSERT INTO public.conversations (id, order_id, customer_id, message_content, message_type, sender_name, created_at) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'Assalam o Alaikum, when will my order be delivered?', 'incoming', 'Muhammad Ali', '2024-01-17 11:00:00'),
('bb0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'Walaikum Assalam! Your order is with our courier. We will update you once its out for delivery.', 'outgoing', 'Customer Service', '2024-01-17 11:15:00'),
('bb0e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'The iPad screen is flickering. I want to return it.', 'incoming', 'Hassan Malik', '2024-01-19 15:30:00'),
('bb0e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'We are sorry for the inconvenience. We have initiated the return process. Our courier will collect it tomorrow.', 'outgoing', 'Customer Service', '2024-01-19 15:45:00'),
('bb0e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440008', 'My address has changed. New address: Plot 45, Bahria Town Phase 8, Lahore', 'incoming', 'Zara Butt', '2024-01-22 16:00:00'),
('bb0e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440008', 'Thank you for updating. We have noted your new address and will deliver accordingly.', 'outgoing', 'Customer Service', '2024-01-22 16:10:00'),
('bb0e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440003', 'Main ghar par nahi tha delivery ke waqt. Kya aap dobara bhej sakte hain?', 'incoming', 'Muhammad Ali', '2024-01-26 09:30:00'),
('bb0e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440003', 'Multiple attempts have been made. The order is being returned to our warehouse. You can reorder if needed.', 'outgoing', 'Customer Service', '2024-01-26 10:00:00');

-- Clear existing products and insert realistic Pakistani e-commerce products
DELETE FROM public.product;
INSERT INTO public.product (id, shopify_id, name, type, price, compared_price) VALUES
(1, 7891234567890, 'iPhone 15 Pro Max 256GB', 'Electronics', '485000', '520000'),
(2, 7891234567891, 'Samsung Galaxy S24 Ultra 512GB', 'Electronics', '420000', '450000'),
(3, 7891234567892, 'MacBook Air M2 13" 256GB', 'Electronics', '380000', '410000'),
(4, 7891234567893, 'iPad Pro 11" M4 128GB', 'Electronics', '295000', '320000'),
(5, 7891234567894, 'AirPods Pro 3rd Gen', 'Electronics', '75000', '82000'),
(6, 7891234567895, 'Apple Watch Series 9 45mm', 'Electronics', '145000', '165000'),
(7, 7891234567896, 'Sony WH-1000XM5 Headphones', 'Electronics', '95000', '105000'),
(8, 7891234567897, 'Dell XPS 13 Laptop i7 16GB', 'Electronics', '350000', '385000'),
(9, 7891234567898, 'Nintendo Switch OLED Console', 'Gaming', '125000', '140000'),
(10, 7891234567899, 'Google Pixel 8 Pro 256GB', 'Electronics', '225000', '250000'),
(11, 7891234567800, 'Samsung 55" 4K Neo QLED TV', 'Electronics', '285000', '320000'),
(12, 7891234567801, 'PlayStation 5 Console Slim', 'Gaming', '195000', '220000'),
(13, 7891234567802, 'Dyson V15 Detect Vacuum', 'Home Appliances', '165000', '185000'),
(14, 7891234567803, 'Instant Pot Duo 7-in-1 6Qt', 'Kitchen', '35000', '42000'),
(15, 7891234567804, 'Fitbit Charge 6 Fitness Tracker', 'Fitness', '48000', '55000'),
(16, 7891234567805, 'Canon EOS R6 Mark II Camera', 'Photography', '685000', '720000'),
(17, 7891234567806, 'Bose QuietComfort 45 Headphones', 'Electronics', '85000', '95000'),
(18, 7891234567807, 'Microsoft Surface Pro 9', 'Electronics', '275000', '295000'),
(19, 7891234567808, 'Xiaomi 13 Pro 256GB', 'Electronics', '185000', '205000'),
(20, 7891234567809, 'OnePlus 11 5G 128GB', 'Electronics', '155000', '175000');

-- Insert demo activity logs
INSERT INTO public.activity_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES
('cc0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'order_verified', 'order', '660e8400-e29b-41d4-a716-446655440001', '{"gpt_score": 85, "verification_status": "verified", "order_number": "ORD-2024-001"}', '2024-01-15 11:00:00'),
('cc0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'address_flagged', 'address_verification', '990e8400-e29b-41d4-a716-446655440001', '{"reason": "Incomplete address format", "gpt_score": 45, "order_number": "ORD-2024-003"}', '2024-01-17 09:30:00'),
('cc0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'return_processed', 'return', '880e8400-e29b-41d4-a716-446655440001', '{"reason": "Defective screen", "worth": 135000, "order_number": "ORD-2024-005"}', '2024-01-20 10:00:00'),
('cc0e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'customer_flagged', 'suspicious_customer', 'aa0e8400-e29b-41d4-a716-446655440001', '{"risk_score": "high", "reason": "Multiple failed deliveries", "customer_name": "Muhammad Ali"}', '2024-01-17 10:00:00'),
('cc0e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'dispatch_created', 'dispatch', '770e8400-e29b-41d4-a716-446655440006', '{"courier": "TCS", "tracking_id": "TCS654321789", "order_number": "ORD-2024-006"}', '2024-01-20 15:00:00'),
('cc0e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440006', 'order_cancelled', 'order', '660e8400-e29b-41d4-a716-446655440011', '{"reason": "Customer request", "order_number": "ORD-2024-011", "refund_amount": 95000}', '2024-01-25 11:00:00'),
('cc0e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440007', 'rto_initiated', 'order', '660e8400-e29b-41d4-a716-446655440012', '{"reason": "Customer unavailable", "order_number": "ORD-2024-012", "attempts": 3}', '2024-01-26 10:00:00');