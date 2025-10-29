# First Steps for Super Admin
**Role:** System Administrator / Business Owner  
**Access Level:** Full system access across all outlets and features

---

## Overview
As a Super Admin, you're responsible for the initial system setup and ongoing configuration. This guide will walk you through implementing the system from scratch over approximately 21 days.

---

## Phase 1: System Setup (Days 1-3)

### Day 1: Business Configuration
**Estimated Time:** 2-3 hours

1. **Access Business Settings**
   - Navigate to Settings → Business Settings
   - This is where all core business configuration lives

2. **Configure Company Information**
   - Company Name
   - Primary Currency (this affects all financial displays)
   - Time Zone (for accurate timestamps)
   - Business Address
   - Contact Information

3. **Set Up Email Configuration (SMTP)**
   - Configure SMTP server details
   - Test email delivery
   - ⚠️ **CRITICAL:** This is required for sending user credentials to new staff

4. **Save and Verify**
   - Save settings
   - ✅ All super managers will see these changes in real-time

### Day 2-3: Locations Setup
**Estimated Time:** 3-4 hours

1. **Create Outlets/Warehouses**
   - Navigate to Locations → Location Management
   - Click "Add Outlet"
   - For each location, enter:
     - Outlet Name
     - Outlet Type (Warehouse, Retail Store, Distribution Center)
     - Address
     - Contact Person
     - Phone Number
   - Create all physical locations where you store inventory

2. **Set Up Service Locations**
   - Navigate to Address Verification
   - Add delivery service areas
   - Define coverage zones for each outlet

**✅ Milestone:** All physical locations configured

---

## Phase 2: User Management (Days 3-5)

### Day 3-4: Create Management Team
**Estimated Time:** 2-3 hours

1. **Navigate to User Management**
   - Settings → User Management
   - Click "Add User"

2. **Create Super Manager Accounts**
   - Role: Super Manager
   - Full Name
   - Email (must be unique)
   - Assign to multiple outlets if needed
   - ✅ **AUTOMATIC:** System generates password and emails credentials
   - Super Managers can:
     - Manage purchase orders
     - Approve stock transfers
     - Access all analytics
     - Manage returns across outlets

3. **Create Store Managers**
   - Role: Store Manager
   - Assign to specific outlet (single outlet access)
   - Store Managers can:
     - Manage their outlet's inventory
     - Process POS sales
     - Create orders
     - Handle local returns

4. **Create Warehouse Managers**
   - Role: Warehouse Manager
   - Assign to warehouse location
   - Warehouse Managers can:
     - Process goods receiving (GRN)
     - Fulfill stock transfers
     - Conduct stock audits

### Day 5: Create Operational Staff
**Estimated Time:** 1-2 hours

1. **Create Dispatch Managers**
   - Role: Dispatch Manager
   - Focus on order fulfillment and shipping

2. **Create Returns Managers**
   - Role: Returns Manager
   - Focus on customer returns processing

3. **Create Staff Accounts**
   - Role: Staff
   - For POS operators, pickers, packers
   - Limited permissions

4. **Verify Email Delivery**
   - Confirm all users received their credentials
   - Ask users to log in and change passwords

**✅ Milestone:** All user accounts created and verified

---

## Phase 3: Supplier & Product Setup (Days 5-10)

### Day 5-6: Supplier Management
**Estimated Time:** 2-3 hours

1. **Navigate to Suppliers → Supplier Management**
   - Click "Add Supplier"

2. **For Each Supplier, Enter:**
   - Supplier Name
   - Contact Person
   - Email
   - Phone Number
   - Address
   - Payment Terms
   - Lead Time (days from order to delivery)

3. **Supplier Portal Access (Optional)**
   - Enable portal access for suppliers to view:
     - Assigned products
     - Purchase orders
     - Low stock notifications
     - Performance metrics

### Day 6-9: Product Setup
**Estimated Time:** 6-8 hours

1. **Navigate to Products → Product Management**
   - Click "Add Product"

2. **For Each Product, Enter:**
   - Product Name
   - SKU (unique identifier)
   - Barcode (if exists, or system can generate)
   - Category
   - Unit of Measure (pcs, kg, box, etc.)
   - Selling Price
   - Cost Price
   - Product Image
   - Description

3. **Assign Products to Suppliers**
   - Navigate to Suppliers → Supplier Management
   - Select supplier → "Manage Products"
   - Assign relevant products to each supplier

4. **Set Smart Reorder Levels**
   - For each product, configure:
     - Minimum Stock Level (triggers reorder alert)
     - Maximum Stock Level (reorder up to this level)
     - Reorder Quantity
     - Lead Time (supplier-specific)
   - Navigate to Inventory → Smart Reorder Settings

### Day 10: Bill of Materials (BOM) - For Manufacturers Only
**Estimated Time:** 2-4 hours

1. **Navigate to Production → BOM Management**
   - Skip this if you don't manufacture products

2. **For Each Finished Product:**
   - Create BOM entry
   - List all raw materials/components needed
   - Specify quantities required
   - ✅ **AUTOMATIC:** System deducts components when production batch is completed

**✅ Milestone:** All suppliers and products configured with smart reorder settings

---

## Phase 4: Integration Configuration (Days 10-14)

### Day 10-11: Courier Integration
**Estimated Time:** 2-3 hours

1. **Navigate to Settings → API Settings**
   - Configure courier APIs

2. **For Each Courier Service:**
   - **Postex:**
     - API Token
     - Pickup Address ID
     - Test connection
   
   - **Leopard Courier:**
     - API Key
     - Shipper ID
     - Test connection
   
   - **TCS:**
     - API Key
     - Account Number
     - Test connection

3. **Test Courier Booking**
   - Navigate to Dispatch → Create Test Booking
   - Verify rate comparison works
   - Verify tracking number generation

### Day 12: WhatsApp Integration (Optional)
**Estimated Time:** 1-2 hours

1. **Navigate to Settings → API Settings**
   - Configure WhatsApp Business API
   - Enter API credentials
   - Set up message templates for:
     - Order confirmations
     - Delivery updates
     - Return status

2. **Test WhatsApp Confirmations**
   - Create test order
   - Trigger confirmation message
   - Verify delivery

### Day 13: Shopify Integration (Optional)
**Estimated Time:** 2-3 hours

1. **Navigate to Settings → API Settings**
   - Enable Shopify integration
   - Enter:
     - Store URL
     - API Key
     - API Secret

2. **Configure Sync Settings**
   - Product sync frequency
   - Order import settings
   - Inventory sync (push stock levels to Shopify)

3. **Initial Sync**
   - Trigger initial product sync
   - Verify products appear correctly
   - Test order import

### Day 14: Fraud Detection Configuration
**Estimated Time:** 1 hour

1. **Navigate to Fraud Reporting**
   - Review default fraud detection rules
   - Adjust risk thresholds:
     - Suspicious address patterns
     - High-value order limits
     - Repeat customer return rates
     - Phone number validation

**✅ Milestone:** All integrations configured and tested

---

## Phase 5: Initial Stock Setup (Days 14-21)

### Day 14-16: Create Purchase Orders
**Estimated Time:** 3-4 hours

1. **Navigate to Purchase Orders → Create PO**
   - Select Supplier
   - Select Destination Outlet (warehouse)
   - Add products with quantities
   - Review total cost
   - Set Expected Delivery Date
   - Submit PO

2. **Create POs for All Initial Stock**
   - Work with suppliers to coordinate deliveries
   - Stagger deliveries if warehouse capacity is limited

### Day 17-19: Process Goods Receiving (GRN)
**Estimated Time:** Varies by volume

1. **When Stock Arrives:**
   - Warehouse Manager navigates to Receiving → Create GRN
   - Select Purchase Order
   - Scan barcodes or manually enter received quantities
   - Document variances (shortages, damages, overages)
   - Take photos of damaged items
   - Save GRN

2. **Accept GRN to Update Inventory**
   - Review GRN details
   - Click "Accept GRN"
   - ✅ **AUTOMATIC:** Inventory is updated immediately
   - Stock is now available for sale/transfer

3. **Handle Variances**
   - System flags significant variances
   - Investigate with supplier
   - Create supplier deduction notes if needed
   - Adjust expectations or request credit

### Day 20-21: Verify Inventory Accuracy
**Estimated Time:** 2-3 hours

1. **Navigate to Inventory → Inventory Dashboard**
   - Review stock levels across all outlets
   - Verify quantities match physical count
   - Check low stock alerts are working

2. **Test Stock Transfers**
   - Create test transfer from warehouse to retail outlet
   - Warehouse marks "In Transit"
   - ✅ **AUTOMATIC:** Stock deducted from warehouse
   - Outlet receives and completes transfer
   - ✅ **AUTOMATIC:** Stock added to outlet

**✅ Milestone:** Initial inventory loaded and verified

---

## Phase 6: Go-Live Testing (Days 21+)

### Day 21: Complete System Test

1. **Test Complete Order Flow**
   - Create manual order (or import from Shopify)
   - ✅ **AUTOMATIC:** Stock reserved on order creation
   - Verify fraud detection flags high-risk orders
   - Clear address verification
   - Mark ready to dispatch
   - Process dispatch with barcode scanning
   - ✅ **AUTOMATIC:** Stock deducted on dispatch
   - Book courier
   - Generate tracking number
   - Mark dispatched

2. **Test POS Flow**
   - Store Manager opens POS session
   - Create sale with barcode scanning
   - Accept payment
   - ✅ **AUTOMATIC:** Stock deducted on POS sale
   - Close POS session
   - Verify cash reconciliation

3. **Test Return Flow**
   - Create return request
   - Approve return
   - Mark return as received
   - Select restock outlet
   - ✅ **AUTOMATIC:** Stock added back to inventory
   - Process refund

4. **Test Production Flow** (if applicable)
   - Create production batch
   - List components needed
   - Process batch completion
   - ✅ **AUTOMATIC:** Components deducted, finished goods added

5. **Test Smart Reorder**
   - Verify low stock alerts trigger
   - Check reorder recommendations
   - Test scheduled smart reorder function

### Go-Live Checklist

- [ ] All outlets configured with correct details
- [ ] All users created and credentials delivered
- [ ] All suppliers added with lead times
- [ ] All products imported with correct pricing
- [ ] Smart reorder settings configured
- [ ] Courier integrations tested
- [ ] Initial inventory loaded and verified
- [ ] Complete order flow tested (order → dispatch)
- [ ] POS flow tested (sale → inventory deduction)
- [ ] Return flow tested (return → restock)
- [ ] Stock transfer tested (warehouse → outlet)
- [ ] Production flow tested (if applicable)
- [ ] All automatic inventory updates verified
- [ ] All staff trained on their workflows
- [ ] Emergency contacts established
- [ ] Backup procedures documented

**✅ Milestone:** System ready for production use

---

## Daily Operations Checklist (Post Go-Live)

### Daily Tasks:
- [ ] Review dashboard metrics
- [ ] Check system health and errors
- [ ] Monitor user activity logs
- [ ] Review high-value transactions
- [ ] Check fraud detection alerts

### Weekly Tasks:
- [ ] Review smart reorder recommendations
- [ ] Analyze variance reports
- [ ] Monitor supplier performance
- [ ] Review return patterns
- [ ] Check integration health (Shopify, couriers, WhatsApp)

### Monthly Tasks:
- [ ] Conduct stock audits
- [ ] Review user permissions
- [ ] Analyze sales trends
- [ ] Review inventory turnover
- [ ] Update business settings if needed
- [ ] Train new staff
- [ ] Review and update SOPs

---

## Critical Understanding Points

### ✅ Automatic Inventory Updates
The system automatically updates inventory in these scenarios:
1. **GRN Acceptance** → Adds stock to warehouse
2. **Order Creation** → Reserves stock (not deducted yet)
3. **Order Dispatch** → Deducts stock from outlet
4. **POS Sale** → Deducts stock immediately
5. **Return Received** → Adds stock back to selected outlet
6. **Stock Transfer "In Transit"** → Deducts from source outlet
7. **Stock Transfer Completion** → Adds to destination outlet
8. **Production Batch Completion** → Deducts components, adds finished goods

### 🔐 Security Best Practices
- Never share super admin credentials
- Regularly audit user permissions
- Review activity logs for suspicious actions
- Enable RLS (Row-Level Security) policies
- Use strong passwords and 2FA if available

### 📊 Key Metrics to Monitor
- **Order Fulfillment Rate:** % of orders dispatched on time
- **Inventory Accuracy:** % variance from physical counts
- **Return Rate:** % of orders returned
- **Fraud Detection Rate:** % of orders flagged correctly
- **Stock-out Rate:** % of time products are out of stock
- **Supplier Performance:** Lead time accuracy, quality issues

---

## Getting Help

### Resources:
- **Product Requirements Document (PRD):** Detailed SOPs and workflows
- **Testing Documentation (TESTING.md):** System testing guidelines
- **User Management:** For role-specific permissions
- **Activity Logs:** Track all system actions

### Support Contacts:
- Technical Issues: [Your IT support contact]
- Supplier Issues: [Your procurement contact]
- Courier Issues: [Your logistics contact]

---

## Next Steps

Once system setup is complete:
1. Direct each role to their specific "First Steps" document
2. Schedule training sessions for each team
3. Monitor first week closely for issues
4. Gather feedback and refine workflows
5. Document any customizations or special processes

**Welcome to your new inventory and order management system! 🚀**
