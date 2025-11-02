-- Insert sample packaging items with varied stock levels
INSERT INTO packaging_items (name, sku, type, size, material, cost, reorder_level, current_stock, is_active) VALUES
('Premium Glass Bottle 100ml', 'PKG-BTL-100', 'bottle', '100ml', 'Glass', 45.00, 100, 35, true),  -- LOW STOCK
('Premium Glass Bottle 50ml', 'PKG-BTL-050', 'bottle', '50ml', 'Glass', 35.00, 80, 150, true),   -- Good stock
('Luxury Gift Box Large', 'PKG-BOX-LRG', 'box', '20x15x10cm', 'Cardboard', 25.00, 200, 45, true), -- CRITICAL LOW
('Luxury Gift Box Small', 'PKG-BOX-SML', 'box', '15x10x8cm', 'Cardboard', 18.00, 150, 220, true), -- Good stock
('Gold Foil Label', 'PKG-LBL-GLD', 'label', '8x5cm', 'Paper', 2.50, 500, 180, true),              -- CRITICAL LOW
('Silver Foil Label', 'PKG-LBL-SLV', 'label', '8x5cm', 'Paper', 2.50, 500, 850, true),            -- Good stock
('Spray Pump Cap', 'PKG-CAP-SPR', 'cap', 'Standard', 'Plastic', 8.00, 200, 90, true),             -- LOW STOCK
('Screw Cap Gold', 'PKG-CAP-GLD', 'cap', 'Standard', 'Metal', 12.00, 150, 300, true),             -- Good stock
('Bubble Wrap Roll', 'PKG-WRP-BBL', 'wrapper', '50m', 'Plastic', 120.00, 20, 8, true),            -- CRITICAL LOW
('Tissue Paper White', 'PKG-WRP-TSU', 'wrapper', '100 sheets', 'Paper', 15.00, 50, 65, true);     -- Good stock

-- Add packaging stock movements for activity tracking (using valid movement types)
INSERT INTO packaging_stock_movements (packaging_item_id, quantity, previous_stock, new_stock, movement_type, performed_by, notes) VALUES
((SELECT id FROM packaging_items WHERE sku = 'PKG-BTL-100'), -50, 85, 35, 'adjustment', '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Used in production batch'),
((SELECT id FROM packaging_items WHERE sku = 'PKG-BTL-050'), -100, 250, 150, 'adjustment', '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Used in production batch'),
((SELECT id FROM packaging_items WHERE sku = 'PKG-BOX-LRG'), -200, 245, 45, 'adjustment', '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Used for order fulfillment'),
((SELECT id FROM packaging_items WHERE sku = 'PKG-LBL-GLD'), -500, 680, 180, 'adjustment', '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Applied to bottles'),
((SELECT id FROM packaging_items WHERE sku = 'PKG-WRP-BBL'), -5, 13, 8, 'adjustment', '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Physical count adjustment');