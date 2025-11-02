-- Insert inventory records for all products across both outlets
-- available_quantity will be auto-calculated by the trigger

-- Main Warehouse inventory (higher quantities)
INSERT INTO inventory (product_id, outlet_id, quantity, reserved_quantity) VALUES
('0b79b1b1-e7ee-4c94-8174-c4256c22e608', 'eb53b071-d914-43f9-bd3d-94a6b70b6faa', 45, 5),   -- Wild Essence: Good stock (40 available)
('d61e0215-6f65-4f6e-a492-d6bd1337168f', 'eb53b071-d914-43f9-bd3d-94a6b70b6faa', 8, 2),    -- Royal Oud: LOW STOCK (6 available)
('2277e138-7b4a-4700-97fc-90bc60746cd3', 'eb53b071-d914-43f9-bd3d-94a6b70b6faa', 67, 10),  -- Deep Calm: Good stock (57 available)
('30a4c5ac-1be1-42d4-8313-25da281d3ff7', 'eb53b071-d914-43f9-bd3d-94a6b70b6faa', 5, 0),    -- Flora Fantasy: LOW STOCK (5 available)
('dd5f487a-f31f-4d7b-a0f7-26ac6cd85eac', 'eb53b071-d914-43f9-bd3d-94a6b70b6faa', 32, 3);   -- Rosy Blossom: OK stock (29 available)

-- Retail Store inventory (lower quantities)
INSERT INTO inventory (product_id, outlet_id, quantity, reserved_quantity) VALUES
('0b79b1b1-e7ee-4c94-8174-c4256c22e608', 'aad69748-0a76-44bf-b805-991fe2a055d0', 15, 2),   -- Wild Essence: OK stock (13 available)
('d61e0215-6f65-4f6e-a492-d6bd1337168f', 'aad69748-0a76-44bf-b805-991fe2a055d0', 22, 4),   -- Royal Oud: Good stock (18 available)
('2277e138-7b4a-4700-97fc-90bc60746cd3', 'aad69748-0a76-44bf-b805-991fe2a055d0', 7, 1),    -- Deep Calm: LOW STOCK (6 available)
('30a4c5ac-1be1-42d4-8313-25da281d3ff7', 'aad69748-0a76-44bf-b805-991fe2a055d0', 19, 3),   -- Flora Fantasy: OK stock (16 available)
('dd5f487a-f31f-4d7b-a0f7-26ac6cd85eac', 'aad69748-0a76-44bf-b805-991fe2a055d0', 4, 0);    -- Rosy Blossom: LOW STOCK (4 available)

-- Add recent stock movements for "Recent Activity" widget
INSERT INTO stock_movements (product_id, outlet_id, movement_type, quantity, created_by, notes) VALUES
('0b79b1b1-e7ee-4c94-8174-c4256c22e608', 'eb53b071-d914-43f9-bd3d-94a6b70b6faa', 'purchase', 20, '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Restocked from supplier'),
('d61e0215-6f65-4f6e-a492-d6bd1337168f', 'aad69748-0a76-44bf-b805-991fe2a055d0', 'sale', -3, '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'POS sale'),
('2277e138-7b4a-4700-97fc-90bc60746cd3', 'eb53b071-d914-43f9-bd3d-94a6b70b6faa', 'adjustment', 5, '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Physical count adjustment'),
('30a4c5ac-1be1-42d4-8313-25da281d3ff7', 'aad69748-0a76-44bf-b805-991fe2a055d0', 'transfer_in', 10, '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Transfer from warehouse'),
('dd5f487a-f31f-4d7b-a0f7-26ac6cd85eac', 'eb53b071-d914-43f9-bd3d-94a6b70b6faa', 'sale', -8, '606a8f0b-9bb8-487b-91f9-f7bb89d3de9f', 'Bulk order fulfillment');

-- Update products with cost data for accurate value calculations
UPDATE products SET cost = 950.00 WHERE id IN (
  '0b79b1b1-e7ee-4c94-8174-c4256c22e608',
  'd61e0215-6f65-4f6e-a492-d6bd1337168f',
  '2277e138-7b4a-4700-97fc-90bc60746cd3',
  '30a4c5ac-1be1-42d4-8313-25da281d3ff7',
  'dd5f487a-f31f-4d7b-a0f7-26ac6cd85eac'
);