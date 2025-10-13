# Product Requirements Document (PRD)
## E-Commerce Inventory Management System

**Version:** 1.0  
**Last Updated:** 2025-10-13  
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Core Features](#core-features)
5. [Feature Workflows](#feature-workflows)
6. [Standard Operating Procedures (SOPs)](#standard-operating-procedures-sops)
7. [Integration Points](#integration-points)
8. [Security & Compliance](#security--compliance)

---

## Executive Summary

### Purpose
Enterprise-grade inventory management system designed for multi-outlet e-commerce businesses to:
- Eliminate inventory theft through real-time variance tracking
- Reduce fraudulent orders by 90% through automated detection
- Ensure supplier accountability with quality metrics
- Minimize returns through quality control
- Optimize stock distribution across outlets

### Target Users
- E-commerce business owners (100-10,000 orders/day)
- Warehouse managers
- Store managers
- Receiving staff
- Dispatch teams
- Inventory auditors

### Key Metrics
- **Inventory Accuracy Target:** 95%+
- **Fraud Prevention Rate:** 90%+
- **Stockout Reduction:** 70%
- **Return Rate Reduction:** 15-20%
- **Supplier Quality Score:** Track & improve to 95%+

---

## System Overview

### Architecture
- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Authentication:** Supabase Auth (Email, Phone, Google)
- **Real-time Updates:** Supabase Realtime subscriptions
- **File Storage:** Supabase Storage

### Tech Stack
- React 18.3
- TypeScript
- Tailwind CSS
- Shadcn/ui components
- React Query for data fetching
- Supabase 2.50+

---

## User Roles & Permissions

### 1. Super Admin
**Access Level:** Full system access

**Capabilities:**
- Manage all users and roles
- Access all outlets and warehouses
- Approve/reject major transactions
- View all analytics and reports
- Configure system settings
- Access fraud reporting dashboard
- Manage supplier relationships

**Navigation Access:**
- Dashboard
- Orders (all statuses)
- Inventory (all outlets)
- Returns Management
- Dispatch Management
- Purchase Orders
- Receiving (GRN)
- Stock Transfers
- Stock Audits
- Variance Management
- User Management
- Supplier Management & Analytics
- Fraud Reporting
- Suspicious Customers
- Activity Logs
- Settings

---

### 2. Super Manager
**Access Level:** Multi-outlet management

**Capabilities:**
- Manage multiple outlets
- Approve stock transfers
- Create purchase orders
- Process returns
- View analytics for assigned outlets
- Manage staff in assigned locations

**Navigation Access:**
- Dashboard
- Orders (view & manage)
- Inventory (assigned outlets)
- Returns Management
- Dispatch Management
- Purchase Orders
- Receiving
- Stock Transfers (create & approve)
- Stock Audits
- Variance Management (view)
- Supplier Management
- Activity Logs

---

### 3. Store Manager
**Access Level:** Single outlet management

**Capabilities:**
- Manage single outlet operations
- Request stock transfers
- Process customer orders
- Handle returns
- Conduct stock counts
- View outlet-specific reports

**Navigation Access:**
- Dashboard (outlet-specific)
- Orders (outlet orders)
- Inventory (own outlet)
- Returns (own outlet)
- Dispatch (own outlet)
- Stock Transfers (request only)
- Stock Audits (own outlet)
- Activity Logs (own outlet)

---

### 4. Warehouse Manager
**Access Level:** Warehouse operations

**Capabilities:**
- Receive goods (GRN processing)
- Manage warehouse inventory
- Fulfill transfer requests
- Conduct warehouse audits
- Manage stock movements

**Navigation Access:**
- Dashboard (warehouse view)
- Inventory (warehouse)
- Receiving (GRN)
- Stock Transfers (fulfill)
- Stock Audits (warehouse)
- Purchase Orders (view)

---

### 5. Warehouse Staff
**Access Level:** Operational tasks

**Capabilities:**
- Scan barcodes for receiving
- Pick & pack orders
- Assist in stock counts
- Record stock movements

**Navigation Access:**
- Inventory (view only)
- Receiving (scanning)
- Orders (pick & pack)
- Stock Audits (data entry)

---

### 6. Staff
**Access Level:** Basic operations

**Capabilities:**
- Process customer orders
- Handle customer inquiries
- View product information
- Record customer interactions

**Navigation Access:**
- Dashboard (limited)
- Orders (view & create)
- Customers
- Products (view only)

---

## Core Features

### Phase A: Inventory Flow Automation ✅ IMPLEMENTED

#### A1. Automated Inventory Updates on GRN Acceptance
**Status:** ✅ Live

**Description:**  
When goods are received and GRN is accepted, inventory is automatically updated without manual intervention.

**Business Impact:**
- Eliminates manual data entry errors
- Real-time inventory accuracy
- Immediate stock availability for sales

**Technical Implementation:**
- Edge Function: `process-grn`
- Trigger: GRN status change to 'accepted'
- Updates: `inventory.quantity`, `inventory.available_quantity`
- Creates: `stock_movements` record (type='purchase')

**User Workflow:**
1. Warehouse staff receives shipment
2. Creates GRN with item details
3. Compares received vs expected quantities
4. Clicks "Accept GRN"
5. ✅ System automatically updates inventory
6. ✅ Stock becomes available for sale

---

#### A2. Order Dispatch → Inventory Deduction
**Status:** ✅ Live

**Description:**  
When orders are dispatched, inventory is automatically deducted and reserved stock is released.

**Business Impact:**
- Prevents overselling
- Real-time stock accuracy
- Automatic stock tracking

**Technical Implementation:**
- Edge Function: `process-order-fulfillment`
- Actions: `dispatch`, `cancel`
- Updates: `inventory.quantity`, `inventory.reserved_quantity`, `inventory.available_quantity`
- Creates: `stock_movements` record (type='sale')
- Safety: Prevents dispatch if insufficient stock

**User Workflow:**
1. Order status changes to "Ready to Dispatch"
2. Dispatch team scans order barcode
3. System checks stock availability
4. Clicks "Dispatch Order"
5. ✅ Inventory automatically deducted
6. ✅ Stock movement recorded
7. ✅ Customer receives tracking

**Error Handling:**
- If stock insufficient: "Cannot dispatch - Stock unavailable"
- If product not found: "Product not in inventory"
- Transaction rollback on failure

---

#### A3. Return Received → Inventory Restock
**Status:** ✅ Live

**Description:**  
When customer returns are received, inventory is automatically restocked.

**Business Impact:**
- Accurate stock after returns
- Faster return processing
- Reduced manual errors

**Technical Implementation:**
- Edge Function: `process-return-restock`
- Action: `receive`
- Updates: `inventory.quantity`, `inventory.available_quantity`
- Creates: `stock_movements` record (type='return')
- Updates: `returns.return_status` to 'received'

**User Workflow:**
1. Customer initiates return
2. Return request created in system
3. Courier delivers return to warehouse
4. Staff verifies return condition
5. Clicks "Mark as Received" + selects outlet
6. ✅ Inventory automatically restocked
7. ✅ Stock available for resale
8. ✅ Refund process initiated

**Quality Check:**
- Staff inspects returned items
- If damaged: Mark as "Not Resaleable"
- If good condition: Restock to inventory
- Creates variance record if discrepancy

---

#### A4. Stock Reservation on Order Creation
**Status:** ✅ Live

**Description:**  
When orders are created, stock is immediately reserved to prevent overselling.

**Business Impact:**
- Prevents double-selling same item
- Accurate available stock display
- Better customer experience

**Technical Implementation:**
- Triggered in: `NewOrderDialog.tsx`
- Updates: `inventory.reserved_quantity` (increase)
- Updates: `inventory.available_quantity` (decrease)
- Creates: Order with status 'pending'
- Auto-release: If order cancelled within 24 hours

**User Workflow:**
1. Customer places order online or staff creates order
2. System checks `available_quantity`
3. If available:
   - ✅ Stock reserved immediately
   - ✅ `reserved_quantity` increased
   - ✅ `available_quantity` decreased
   - ✅ Order confirmed
4. If not available:
   - ❌ "Out of Stock" message
   - Suggest alternative products

**Stock Release Scenarios:**
- Order cancelled → Stock released
- Order expired (24h unpaid) → Stock released
- Order dispatched → Reserved → Deducted

---

### Phase B: Supplier & Analytics Dashboards ✅ PARTIALLY IMPLEMENTED

#### B1. Supplier Performance Analytics
**Status:** ✅ Live

**Location:** `/suppliers/analytics`

**Description:**  
Comprehensive dashboard tracking supplier quality, delivery performance, and reliability.

**Metrics Tracked:**
1. **On-Time Delivery Rate**
   - % of POs delivered by expected date
   - Trend over 3/6/12 months

2. **Quality Acceptance Rate**
   - % of GRNs accepted without discrepancies
   - Variance quantity tracking

3. **Average Lead Time**
   - Days from PO creation to delivery
   - Compare against promised lead time

4. **Total Discrepancies**
   - Count of quantity mismatches
   - Value of missing/damaged items

5. **Supplier Rating (1-5 stars)**
   - Auto-calculated based on above metrics
   - Manual adjustment by managers

**Business Impact:**
- Identify unreliable suppliers
- Negotiate better terms with good suppliers
- Reduce receiving discrepancies by 60%
- Improve supply chain efficiency

**User Actions:**
- Filter by date range, supplier, category
- Export reports (PDF/Excel)
- Set alerts for poor performance
- Flag suppliers for review

**Data Sources:**
- `purchase_orders` table
- `goods_received_notes` table
- `grn_items` table
- `suppliers` table

---

#### B2. Theft Analytics Dashboard
**Status:** 🔄 Integrated in Variance Management

**Location:** `/variance-management` + Analytics tab

**Description:**  
Real-time tracking of inventory variances indicating potential theft or loss.

**Metrics Displayed:**
1. **Variance Trends by Outlet**
   - Line chart showing daily/weekly variances
   - Compare across locations

2. **Variance by Product Category**
   - Which categories have highest shrinkage
   - High-value items with frequent variances

3. **Variance by Staff Member**
   - Track who conducted counts
   - Identify patterns in specific shifts

4. **Top 10 Products with Most Theft**
   - Products with consistent negative variance
   - Financial impact calculation

5. **Financial Impact Summary**
   - Total variance value (₹)
   - Monthly loss trends
   - % of total inventory value

**Severity Levels:**
- 🔴 Critical: Variance > ₹10,000
- 🟠 High: Variance ₹5,000-10,000
- 🟡 Medium: Variance ₹1,000-5,000
- 🟢 Low: Variance < ₹1,000

**Auto-Alerts:**
- Variance > threshold → Notify manager
- Repeat offender outlet → Notify super admin
- High-value product missing → Immediate alert

**Business Impact:**
- Detect theft within 24 hours
- Identify problematic outlets/staff
- Reduce shrinkage by 40%
- Insurance claim documentation

---

#### B3. Return Analytics Widget
**Status:** ✅ Live

**Location:** `/returns` → Analytics & Insights tab

**Description:**  
Track return patterns to identify quality issues and reduce return rates.

**Metrics Tracked:**
1. **Return Rate by Product**
   - % of units sold vs returned
   - Flag products with >20% return rate

2. **Return Reasons Breakdown**
   - Defective product
   - Wrong item shipped
   - Customer changed mind
   - Size/fit issues
   - Damaged in transit

3. **Return Rate Trends Over Time**
   - Monthly/weekly trends
   - Seasonal patterns

4. **High-Value Returns**
   - Products with highest return ₹ value
   - Impact on profitability

5. **Return Processing Time**
   - Average days from return request to restock
   - Bottlenecks in process

**Actionable Insights:**
- Flag suppliers with high return rates
- Identify products to discontinue
- Improve product descriptions
- Better packaging recommendations

**Business Impact:**
- Reduce return rate by 15-20%
- Improve product quality control
- Better supplier selection
- Enhanced customer satisfaction

---

### Phase C: Fraud Prevention Automation 🔄 IN PROGRESS

#### C1. Auto-block High-Risk Orders
**Status:** 🔄 Planned

**Description:**  
Automatically flag and hold suspicious orders for manual review before dispatch.

**Risk Detection Factors:**
1. **Address Mismatch**
   - GPS coordinates vs stated address
   - City/area discrepancies

2. **Suspicious Patterns**
   - Multiple orders from same IP
   - Prepaid orders with fake addresses
   - High-value orders to high-risk areas
   - COD orders with return history

3. **Customer History**
   - Previous RTO (Return to Origin)
   - Multiple cancelled orders
   - Frequent return requests
   - Blacklisted phone/email

4. **Order Characteristics**
   - Unusually large order from new customer
   - Rush delivery to unverified address
   - Multiple orders to same address, different names

**Risk Score Calculation:**
```
Risk Score = (Address Risk × 0.3) + 
             (Customer History × 0.3) + 
             (Order Pattern × 0.2) + 
             (Payment Method × 0.2)
```

**Automated Actions:**
- Risk Score 0-50: ✅ Auto-approve
- Risk Score 51-80: ⚠️ Flag for review
- Risk Score 81-100: 🛑 Auto-block, require manual approval

**Business Impact:**
- Block 90% of fraudulent orders
- Reduce RTO by 60%
- Save ₹X lakhs monthly in fraud losses

---

#### C2. Address Verification Workflow
**Status:** 🔄 Planned (GPS validation pending)

**Current Features:**
- Manual address verification page
- Unclear address flagging
- Customer contact for clarification

**Planned Enhancements:**
1. **GPS Coordinates Validation**
   - Capture GPS at order placement
   - Compare with stated address
   - Google Maps integration

2. **Auto-Verification**
   - Known addresses auto-approved
   - Repeated customer addresses whitelisted

3. **Delivery Partner Integration**
   - Validate address with courier API
   - Check serviceability

**SOP Enhancement:**
- GPS mismatch > 2km → Flag for call
- Rural/ambiguous addresses → Mandatory verification
- High-value orders → Always verify

---

### Phase D: Smart Reordering 🔄 PLANNED

#### D1. Automated Reorder Suggestions
**Status:** 🔄 Design phase

**Description:**  
AI-powered system that predicts when to reorder products based on sales velocity and lead time.

**Algorithm:**
```
Reorder Point = (Average Daily Sales × Lead Time Days) + Safety Stock

Safety Stock = Average Daily Sales × Safety Days (typically 7-14 days)

Optimal Order Quantity = Reorder Point - Current Stock + Buffer
```

**Factors Considered:**
- Historical sales velocity (30/60/90 days)
- Seasonal trends
- Supplier lead time
- Current stock level
- Stock in transit
- Promotional calendar

**Features:**
- Daily automated check
- One-click PO generation
- Email/SMS alerts to managers
- Prioritization by urgency

**Business Impact:**
- Reduce stockouts by 70%
- Optimize working capital
- Prevent dead stock
- Improve cash flow

---

#### D2. Inter-Outlet Transfer Recommendations
**Status:** 🔄 Design phase

**Description:**  
Smart system recommending stock transfers between outlets to optimize distribution.

**Logic:**
```
IF Outlet A: Stock > Average Sales × 30 days
AND Outlet B: Stock < Reorder Level
THEN: Suggest Transfer A → B
```

**Optimization Factors:**
- Sales velocity per outlet
- Transfer cost
- Stock age (prioritize old stock)
- Geographic proximity
- Transfer history

**User Experience:**
- Dashboard widget showing suggestions
- One-click transfer request
- Auto-calculate quantities
- Route optimization

**Business Impact:**
- Reduce dead stock by 50%
- Improve inter-outlet efficiency
- Balance inventory across network
- Reduce overall inventory holding

---

### Phase E: Production Readiness 🔄 PLANNED

#### E1. Batch/Lot Tracking
**Status:** 🔄 Database design phase

**Description:**  
Track products by batch number and expiry date for compliance and FIFO management.

**Features:**
- Batch number assignment at receiving
- Expiry date tracking
- FIFO enforcement (First In First Out)
- Near-expiry warnings (30/15/7 days)
- Recall management

**Use Cases:**
- Food & beverage products
- Pharmaceuticals
- Cosmetics & personal care
- Products with warranties

**Compliance:**
- FDA/FSSAI traceability
- Recall preparedness
- Audit trail

---

#### E2. Complete Barcode Workflow
**Status:** 🔄 Planned

**Description:**  
End-to-end barcode system for all inventory operations.

**Features:**
1. **Barcode Generation**
   - Auto-generate for new products
   - Print labels (thermal/laser)
   - QR codes with product info

2. **Barcode Scanning**
   - Mobile camera scanning
   - Handheld scanner support
   - Multi-item scan capability

3. **Operations with Scanning:**
   - Receiving (GRN verification)
   - Stock counts (faster audits)
   - Order picking (reduce errors)
   - Returns processing
   - Stock transfers

**Business Impact:**
- 80% faster stock counts
- 95% reduction in picking errors
- Real-time inventory updates
- Improved audit accuracy

---

#### E3. Business Intelligence Reports
**Status:** 🔄 Planned

**Automated Reports:**

1. **Daily Operations Summary** (Email @ 8 AM)
   - Yesterday's orders, dispatches, returns
   - Critical stock levels
   - Pending approvals
   - Urgent actions needed

2. **Weekly Inventory Health Report** (Monday @ 9 AM)
   - Stock turnover ratio
   - Dead stock alert
   - Overstock situations
   - Reorder recommendations

3. **Monthly Supplier Performance** (1st of month)
   - Top/bottom 5 suppliers
   - Quality metrics
   - Cost analysis
   - Renewal recommendations

4. **Fraud Prevention Summary** (Weekly)
   - Blocked orders count
   - Saved amount
   - Pattern analysis
   - Blacklist updates

**Export Formats:**
- PDF (for sharing)
- Excel (for analysis)
- CSV (for import to accounting)

---

## Feature Workflows

### Workflow 1: Purchase Order to Inventory

**Actors:** Super Admin, Warehouse Manager

**Steps:**
1. **Create Purchase Order**
   - Navigate to Purchase Orders
   - Click "New PO"
   - Select supplier
   - Add products and quantities
   - Set expected delivery date
   - Submit for approval

2. **PO Approval**
   - Manager reviews PO
   - Checks budget and necessity
   - Approves or rejects
   - System sends PO to supplier (email)

3. **Goods Receiving**
   - Supplier delivers goods
   - Warehouse staff creates GRN
   - Scans/enters received items
   - Notes any discrepancies
   - Compares against PO

4. **GRN Acceptance**
   - Manager reviews GRN
   - Checks quality and quantity
   - Accepts GRN
   - ✅ **System automatically updates inventory**
   - ✅ **Stock becomes available**

5. **Variance Handling**
   - If discrepancies found
   - System flags variance
   - Creates supplier deduction note
   - Notifies procurement team

**SOP Reference:** SOP-001

---

### Workflow 2: Order Creation to Dispatch

**Actors:** Staff, Store Manager, Dispatch Team

**Steps:**
1. **Order Creation**
   - Customer orders online OR staff creates manually
   - System checks stock availability
   - ✅ **Stock automatically reserved**
   - Order status: 'pending'

2. **Address Verification**
   - System auto-checks address
   - If unclear → Flag for verification
   - Staff contacts customer
   - Updates address
   - Status: 'address clear'

3. **Fraud Check**
   - System runs fraud detection
   - Risk score calculated
   - If high risk → 'pending_review'
   - If low risk → 'ready to dispatch'

4. **Order Dispatch**
   - Dispatch team picks order
   - Scans items (barcode)
   - Packs order
   - Clicks "Dispatch"
   - ✅ **System automatically deducts inventory**
   - ✅ **Stock movement recorded**
   - Status: 'dispatched'

5. **Delivery & Completion**
   - Courier delivers
   - Status: 'delivered'
   - Payment settlement (if COD)

**SOP Reference:** SOP-002

---

### Workflow 3: Customer Return Processing

**Actors:** Customer, Warehouse Staff, Manager

**Steps:**
1. **Return Initiation**
   - Customer requests return (within 7 days)
   - Selects reason
   - System creates return request
   - Status: 'requested'

2. **Return Approval**
   - Manager reviews request
   - Checks return policy eligibility
   - Approves or rejects
   - If approved: Generates return label
   - Status: 'approved'

3. **Return Shipment**
   - Courier picks up from customer
   - Status: 'in_transit'

4. **Return Receiving**
   - Warehouse receives package
   - Staff inspects condition
   - Verifies items against return request
   - Clicks "Mark as Received" + selects outlet
   - ✅ **System automatically restocks inventory**
   - Status: 'received'

5. **Refund Processing**
   - System initiates refund
   - If resaleable: Stock restocked
   - If damaged: Marked as loss
   - Status: 'completed'

**SOP Reference:** SOP-003

---

### Workflow 4: Stock Audit & Variance Management

**Actors:** Store Manager, Auditor, Warehouse Manager

**Steps:**
1. **Audit Scheduling**
   - Manager schedules stock count
   - Assigns auditor/team
   - Selects products/categories
   - Sets deadline

2. **Physical Stock Count**
   - Auditor uses barcode scanner OR manual count
   - Enters counted quantities
   - System compares with system quantity
   - Calculates variance

3. **Variance Review**
   - System flags discrepancies
   - Calculates financial impact
   - Assigns severity level
   - Creates variance record

4. **Investigation**
   - Manager investigates cause
   - Theft / Damage / Data error
   - Documents findings
   - Takes corrective action

5. **Inventory Adjustment**
   - Manager approves adjustment
   - System updates inventory
   - Creates stock movement (type='adjustment')
   - Audit trail recorded

**SOP Reference:** SOP-004

---

### Workflow 5: Stock Transfer Between Outlets

**Actors:** Store Manager (Requesting), Warehouse Manager (Fulfilling)

**Steps:**
1. **Transfer Request Creation**
   - Store Manager sees low stock
   - Creates transfer request
   - From: Warehouse/Other Outlet
   - To: Own outlet
   - Products and quantities
   - Status: 'pending'

2. **Request Approval**
   - Warehouse Manager reviews
   - Checks stock availability
   - Approves or rejects
   - Status: 'approved'

3. **Transfer Fulfillment**
   - Warehouse staff picks items
   - Packs for transfer
   - Marks "In Transit"
   - System deducts from source inventory
   - Status: 'in_transit'

4. **Transfer Receipt**
   - Destination outlet receives
   - Staff verifies items
   - Clicks "Complete Transfer"
   - System adds to destination inventory
   - Status: 'completed'

5. **Discrepancy Handling**
   - If quantity mismatch
   - System creates variance
   - Investigates loss in transit
   - Adjusts inventory accordingly

**SOP Reference:** SOP-005

---

## Standard Operating Procedures (SOPs)

### SOP-001: Purchase Order & Goods Receiving

**Purpose:** Ensure accurate receiving and inventory updates

**Frequency:** As needed

**Responsible Roles:** Warehouse Manager, Warehouse Staff

**Prerequisites:**
- Valid PO in system
- Supplier has been notified

**Procedure:**

**Step 1: Verify Delivery**
- Check PO number on delivery note
- Confirm supplier details
- Verify delivery date

**Step 2: Physical Inspection**
- Count all items received
- Check for damages
- Verify product SKUs/names
- Compare against PO

**Step 3: Create GRN**
- Log into system
- Navigate to: Receiving → New GRN
- Select related Purchase Order
- Enter received quantities per item
- Note any discrepancies in comments
- Upload photos if damaged items

**Step 4: GRN Acceptance**
- Manager reviews GRN
- If discrepancies:
  - Contact supplier immediately
  - Document variance
  - Create deduction note
- Click "Accept GRN"
- ✅ Inventory automatically updated

**Step 5: Quality Control**
- Random sample inspection
- If major quality issues:
  - Reject GRN
  - Initiate return to supplier

**Step 6: Storage**
- Move items to designated locations
- Update bin locations in system
- Apply FIFO principles

**Key Performance Indicators:**
- GRN processing time: < 2 hours
- Variance rate: < 5%
- Quality acceptance: > 95%

**Error Handling:**
- If system error: Contact IT immediately, do not retry
- If quantity mismatch: Document and report to procurement
- If damaged goods: Quarantine, photograph, report

---

### SOP-002: Order Fulfillment & Dispatch

**Purpose:** Accurate order fulfillment with real-time inventory tracking

**Frequency:** Continuous (daily)

**Responsible Roles:** Dispatch Team, Store Manager

**Prerequisites:**
- Order status: 'ready to dispatch'
- Stock availability confirmed
- Address verified

**Procedure:**

**Step 1: Order Picking**
- Log into system
- Navigate to: Orders → Ready to Dispatch
- Select order
- View pick list
- Scan/pick each item using barcode scanner
- System marks items as "picked"

**Step 2: Quality Check**
- Verify items match order
- Check product condition
- Ensure correct quantities
- Verify product specifications (size, color, etc.)

**Step 3: Packing**
- Use appropriate packaging
- Add invoice copy
- Add return label (if prepaid)
- Seal package
- Apply shipping label

**Step 4: Dispatch**
- Click "Dispatch Order" in system
- Select outlet (if multi-location)
- System performs final stock check
- ✅ Inventory automatically deducted
- ✅ Stock movement recorded
- Generate tracking number

**Step 5: Handover to Courier**
- Scan courier pickup
- Get courier acknowledgment
- Update tracking in system
- Status changes to 'dispatched'

**Quality Checks:**
- Right product ✓
- Right quantity ✓
- Right address ✓
- Proper packaging ✓
- Invoice included ✓

**Key Performance Indicators:**
- Order fulfillment time: < 24 hours
- Picking accuracy: > 99%
- Dispatch before cutoff: > 95%

**Error Handling:**
- Insufficient stock: System prevents dispatch, alert manager
- Wrong item picked: Re-pick, log incident
- Address issue: Hold order, contact customer

---

### SOP-003: Return Processing

**Purpose:** Efficient return handling with inventory restoration

**Frequency:** As returns arrive

**Responsible Roles:** Warehouse Staff, Manager

**Prerequisites:**
- Return request approved in system
- Return received at warehouse

**Procedure:**

**Step 1: Return Receipt**
- Receive package from courier
- Log into system
- Navigate to: Returns → In Transit
- Find return by tracking ID or order number
- Scan return barcode

**Step 2: Package Inspection**
- Open package
- Verify items match return request
- Check product condition:
  - ✅ Resaleable: Good condition, original packaging
  - ❌ Not Resaleable: Damaged, used, incomplete

**Step 3: Condition Documentation**
- Take photos if damaged
- Note condition in system
- Select condition: "New", "Good", "Damaged"
- Add notes explaining condition

**Step 4: Mark as Received**
- Click "Mark as Received"
- Select destination outlet for restocking
- If resaleable:
  - ✅ System automatically restocks inventory
  - ✅ Stock movement recorded
- If damaged:
  - Mark as "Loss"
  - Create damage report
  - No inventory update

**Step 5: Refund Initiation**
- System triggers refund process
- Refund amount calculated (may deduct if damaged)
- Finance team processes refund
- Customer notified

**Step 6: Investigation (if needed)**
- For high-value returns
- Identify root cause:
  - Wrong item shipped?
  - Quality issue?
  - Customer error?
- Document findings
- Take corrective action

**Key Performance Indicators:**
- Return processing time: < 48 hours
- Refund processing time: < 72 hours
- Restocking accuracy: > 98%

**Special Cases:**
- **High-Value Returns (>₹10,000):** Manager approval required before restocking
- **Repeated Returns (same customer):** Flag customer for fraud review
- **Defective Products:** Create quality incident, notify supplier

---

### SOP-004: Stock Audit & Cycle Counting

**Purpose:** Maintain inventory accuracy through regular audits

**Frequency:** 
- Monthly: High-value items
- Quarterly: Mid-value items
- Annually: All items

**Responsible Roles:** Auditor, Store Manager

**Prerequisites:**
- Audit schedule created
- Physical access to stock locations
- Barcode scanner (if available)

**Procedure:**

**Step 1: Pre-Audit Preparation**
- Log into system
- Navigate to: Stock Audit → New Audit
- Select audit type (full/partial)
- Select outlet/warehouse
- Select products/categories to audit
- Print count sheets (if needed)

**Step 2: Physical Counting**
- Go to physical location
- Count items systematically:
  - Aisle by aisle
  - Category by category
  - Use barcode scanner for speed
- Enter counted quantity in system
- Do NOT look at system quantity before counting (to avoid bias)

**Step 3: Variance Identification**
- System compares counted vs system quantity
- Automatic variance calculation:
  - Variance = Counted - System
  - Variance % = (Variance / System) × 100
  - Variance Value = Variance × Unit Cost
- System flags discrepancies

**Step 4: Variance Investigation**
- For significant variances (>5% or >₹1000):
  - Recount item
  - Check recent transactions
  - Review stock movements
  - Interview staff
  - Check for theft indicators

**Step 5: Manager Review**
- Manager reviews all variances
- Approves legitimate adjustments
- Investigates suspicious patterns
- Documents findings

**Step 6: Inventory Adjustment**
- Manager clicks "Approve Adjustment"
- System updates inventory to actual count
- Creates stock movement (type='adjustment')
- Variance recorded in analytics
- Audit trail created

**Step 7: Corrective Actions**
- If theft suspected: Security review, staff counseling
- If process issue: Update procedures
- If system error: IT investigation
- If damage: Identify cause, prevent recurrence

**Key Performance Indicators:**
- Audit completion rate: 100% on schedule
- Variance rate: < 2% of total inventory
- Variance value: < 1% of total inventory value

**Best Practices:**
- Count during low-activity hours
- Use 2-person teams for high-value items
- Surprise audits for theft prevention
- Blind counts (without seeing system quantity)

---

### SOP-005: Stock Transfer Between Locations

**Purpose:** Optimize inventory distribution across outlets

**Frequency:** As needed (typically weekly)

**Responsible Roles:** Store Manager (requesting), Warehouse Manager (fulfilling)

**Prerequisites:**
- Stock available at source location
- Transfer justification (low stock, high demand, etc.)

**Procedure:**

**Step 1: Transfer Request Creation**
- Store Manager logs in
- Identifies low stock items
- Navigate to: Stock Transfer → New Request
- Select source location (warehouse/outlet)
- Select destination (own outlet)
- Add products and quantities
- Add justification note
- Submit request

**Step 2: Request Review**
- Warehouse Manager receives notification
- Reviews request:
  - Check stock availability at source
  - Verify business need
  - Check transfer cost vs reorder cost
  - Review requesting outlet's sales velocity
- Approves or rejects with reason

**Step 3: Transfer Preparation**
- Warehouse staff picks items
- Quality check each item
- Pack for transfer
- Create packing list
- Assign transfer tracking ID

**Step 4: Shipment**
- Click "Mark in Transit"
- System deducts from source inventory
- System does NOT add to destination yet
- Transfer tracking begins
- Courier/internal transport assigned

**Step 5: Receipt at Destination**
- Destination outlet receives shipment
- Staff unpacks and counts
- Verifies items match packing list
- Navigate to: Stock Transfer → In Transit
- Select transfer
- Enter received quantities
- Click "Complete Transfer"
- ✅ System adds to destination inventory
- ✅ Stock movement recorded

**Step 6: Discrepancy Resolution**
- If received < sent:
  - System creates variance
  - Investigation initiated
  - Document lost items
  - File claim if courier responsible
- If received > sent:
  - Flag for investigation
  - Verify packing list

**Key Performance Indicators:**
- Transfer fulfillment time: < 48 hours
- Transfer accuracy: > 98%
- In-transit loss: < 1%

**Special Cases:**
- **High-Value Transfers (>₹50,000):** Require super admin approval
- **Inter-City Transfers:** Use insured courier only
- **Urgent Transfers:** Express processing, notify all parties

---

### SOP-006: Fraud Order Detection & Review

**Purpose:** Prevent fraudulent orders from being dispatched

**Frequency:** Real-time for all orders

**Responsible Roles:** Fraud Review Team, Store Manager

**Prerequisites:**
- Order created in system
- Automated fraud check completed

**Procedure:**

**Step 1: Automated Fraud Detection**
- System automatically runs on every order
- Calculates risk score (0-100)
- Checks:
  - Address consistency
  - Customer history
  - Order pattern
  - Payment method
  - IP address
  - Device fingerprint

**Step 2: Risk-Based Routing**
- **Low Risk (0-50):** Auto-approved, proceeds to fulfillment
- **Medium Risk (51-80):** Flagged for review
- **High Risk (81-100):** Auto-blocked, requires approval

**Step 3: Manual Review (for flagged orders)**
- Navigate to: Fraud Reporting → Pending Review
- Review order details:
  - Customer phone number
  - Delivery address
  - Order value and items
  - Payment method
  - Customer history
- Check external databases:
  - Google Maps for address
  - Truecaller for phone
  - Internal blacklist

**Step 4: Customer Verification**
- Call customer on registered number
- Verify:
  - Name and address
  - Order details
  - Reason for order (if suspicious)
  - Payment confirmation
- Ask security questions

**Step 5: Decision**
- **Approve:** Remove hold, proceed to dispatch
- **Reject:** Cancel order, refund (if prepaid), add to blacklist
- Document decision rationale

**Step 6: Blacklist Management**
- For confirmed fraud:
  - Add phone to blacklist
  - Add address to blacklist
  - Add device ID to blacklist
- Block future orders automatically

**Red Flags Checklist:**
- ⚠️ First-time customer with high-value order
- ⚠️ COD order to high-risk area
- ⚠️ Multiple orders from same IP, different names
- ⚠️ Address exists but GPS coordinates wrong
- ⚠️ Customer unreachable on phone
- ⚠️ Prepaid order with suspicious email
- ⚠️ Rush delivery request to unverified address

**Key Performance Indicators:**
- Fraud detection accuracy: > 90%
- False positive rate: < 10%
- RTO reduction: 60%
- Review time: < 2 hours

**Legal Considerations:**
- Document all fraud cases
- Keep evidence for 12 months
- Report major fraud to authorities

---

### SOP-007: Supplier Performance Review

**Purpose:** Maintain high supplier quality through regular reviews

**Frequency:** Quarterly (every 3 months)

**Responsible Roles:** Procurement Manager, Super Admin

**Prerequisites:**
- Minimum 3 months of transactions with supplier
- Access to Supplier Analytics Dashboard

**Procedure:**

**Step 1: Data Collection**
- Navigate to: Suppliers → Analytics Dashboard
- Select supplier
- Set date range: Last 3 months
- Export performance report

**Step 2: Metrics Review**
- **On-Time Delivery Rate:** Target >90%
- **Quality Acceptance Rate:** Target >95%
- **Average Lead Time:** Compare against SLA
- **Discrepancy Rate:** Target <5%
- **Pricing Competitiveness:** Compare with market

**Step 3: Scoring**
- Calculate overall supplier score:
  ```
  Score = (On-Time Delivery × 0.25) +
          (Quality × 0.35) +
          (Lead Time × 0.15) +
          (Price × 0.15) +
          (Communication × 0.10)
  ```
- Assign rating: 1-5 stars

**Step 4: Performance Discussion**
- Schedule meeting with supplier
- Share performance data
- Discuss issues and improvements
- Set improvement targets
- Document action items

**Step 5: Decision Making**
- **5 Stars (90-100%):** Preferred supplier, increase orders
- **4 Stars (80-89%):** Good supplier, maintain
- **3 Stars (70-79%):** Acceptable, but needs improvement
- **2 Stars (60-69%):** Probation, improvement plan required
- **1 Star (<60%):** Consider termination, find alternative

**Step 6: Contract Action**
- Update supplier terms if needed
- Adjust pricing negotiations
- Modify payment terms
- Add/remove products
- Terminate if consistently poor

**Key Performance Indicators:**
- Supplier review completion: 100% on schedule
- Supplier improvement rate: >60%
- New supplier onboarding: <30 days

**Documentation:**
- Keep all review records for 3 years
- Maintain supplier scorecards
- Track improvement over time

---

### SOP-008: Daily System Health Check

**Purpose:** Ensure system is functioning correctly and data is accurate

**Frequency:** Daily (start of business)

**Responsible Roles:** System Administrator, Super Admin

**Prerequisites:**
- System access
- Previous day's activity reports

**Procedure:**

**Step 1: Dashboard Review**
- Log into system as Super Admin
- Review Dashboard → Performance Metrics
- Check for anomalies:
  - Unusual order volume
  - Sudden inventory drops
  - High error rates
  - System alerts

**Step 2: Inventory Integrity Check**
- Navigate to: Inventory → Summary
- Verify:
  - Total inventory value within expected range
  - No negative stock quantities
  - Reserved stock ≤ Available stock
  - Stock movements logged for all transactions

**Step 3: Transaction Completeness**
- Check yesterday's transactions:
  - All orders have stock movements
  - All GRNs have inventory updates
  - All returns have restocking records
  - No pending system actions

**Step 4: Edge Function Health**
- Check edge function logs
- Verify:
  - `process-grn` - No errors
  - `process-order-fulfillment` - No failures
  - `process-return-restock` - All successful
  - Response times within SLA (<2 seconds)

**Step 5: User Access Review**
- Check active user sessions
- Verify no unauthorized access
- Review failed login attempts
- Check for unusual activity patterns

**Step 6: Backup Verification**
- Confirm database backup completed
- Verify backup size is reasonable
- Check backup integrity
- Test restore capability (weekly)

**Step 7: Alert Management**
- Review system alerts
- Address critical alerts immediately
- Schedule non-critical alerts
- Close resolved alerts

**Step 8: Report Generation**
- Generate daily system health report
- Share with management
- Document any issues and resolutions

**Key Performance Indicators:**
- System uptime: >99.9%
- Data integrity errors: 0
- Backup success rate: 100%
- Critical alert resolution time: <1 hour

**Escalation:**
- Critical issues: Immediate escalation to IT
- Data integrity issues: Stop transactions, investigate
- Security issues: Alert security team immediately

---

## Integration Points

### Current Integrations

1. **Supabase Backend**
   - Database: PostgreSQL
   - Authentication: Supabase Auth
   - Storage: Supabase Storage
   - Real-time: Supabase Realtime
   - Edge Functions: Deno runtime

2. **Frontend Technologies**
   - React 18.3
   - TypeScript
   - Tailwind CSS
   - React Query for API calls

---

### Planned Integrations

1. **Payment Gateways**
   - Razorpay / PayU / Paytm
   - COD confirmation tracking
   - Refund automation

2. **Courier APIs**
   - Delhivery
   - Bluedart
   - DTDC
   - Real-time tracking updates
   - Address serviceability check
   - Auto-AWB generation

3. **Accounting Software**
   - Tally integration
   - GST compliance
   - Invoice generation
   - Financial reports export

4. **E-commerce Platforms**
   - Shopify
   - WooCommerce
   - Magento
   - Amazon / Flipkart seller central
   - Order sync automation

5. **Communication Channels**
   - WhatsApp Business API (order updates)
   - SMS gateway (OTP, notifications)
   - Email (reports, alerts)

6. **Maps & Location**
   - Google Maps API (address verification)
   - GPS validation
   - Route optimization

7. **Analytics & BI**
   - Google Analytics
   - Metabase / Tableau
   - Custom dashboards

---

## Security & Compliance

### Security Measures

1. **Authentication**
   - Email/Phone OTP
   - Google OAuth
   - Password strength enforcement
   - Session timeout (30 minutes)
   - Multi-factor authentication (planned)

2. **Authorization**
   - Role-based access control (RBAC)
   - Row-level security (RLS) in database
   - API endpoint protection
   - Audit trail for all actions

3. **Data Protection**
   - Encrypted data at rest
   - Encrypted data in transit (SSL/TLS)
   - PII data masking
   - GDPR compliance ready

4. **Monitoring**
   - Activity logs
   - Failed login tracking
   - Suspicious activity alerts
   - Performance monitoring

---

### Compliance

1. **Financial Compliance**
   - GST invoice generation
   - Transaction audit trail
   - Financial year reports
   - Tax calculation automation

2. **Inventory Compliance**
   - FIFO/LIFO tracking
   - Batch/lot traceability
   - Expiry management
   - Recall readiness

3. **Data Privacy**
   - Customer data protection
   - Right to deletion
   - Data portability
   - Consent management

---

## Appendix

### Glossary

- **GRN:** Goods Received Note
- **PO:** Purchase Order
- **SKU:** Stock Keeping Unit
- **RTO:** Return to Origin
- **COD:** Cash on Delivery
- **FIFO:** First In First Out
- **RLS:** Row Level Security
- **SOP:** Standard Operating Procedure

### Support

- **Technical Support:** support@company.com
- **Training Materials:** docs.company.com/training
- **Issue Reporting:** Integrated in app (Help → Report Issue)

### Version History

- **v1.0 (2025-10-13):** Initial PRD with Phase A-E features

---

**Document Control**  
**Last Reviewed:** 2025-10-13  
**Next Review:** 2025-11-13  
**Owner:** Product Manager  
**Status:** Active
