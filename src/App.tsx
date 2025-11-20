import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/Layout";
import { Loader2 } from "lucide-react";
import VersionChecker from "@/components/VersionChecker";

// Lazy load all pages with prefetching hints
const Dashboard = lazy(() => 
  import("@/pages/Dashboard").then(module => ({ default: module.default }))
);
const OrderDashboard = lazy(() => 
  import("@/pages/Orders/OrderDashboard").then(module => ({ default: module.default }))
);
const DispatchDashboard = lazy(() => 
  import("@/pages/Dispatch/DispatchDashboard").then(module => ({ default: module.default }))
);
const ReturnsDashboard = lazy(() => 
  import("@/pages/Returns/ReturnsDashboard").then(module => ({ default: module.default }))
);
const AllCustomers = lazy(() => 
  import("@/pages/Customers/AllCustomers").then(module => ({ default: module.default }))
);
const SuspiciousCustomers = lazy(() => 
  import("@/pages/SuspiciousCustomers/SuspiciousCustomers").then(module => ({ default: module.default }))
);
const AddressVerification = lazy(() => 
  import("@/pages/AddressVerification/AddressVerification").then(module => ({ default: module.default }))
);
const UserManagement = lazy(() => 
  import("@/pages/UserManagement/UserManagement").then(module => ({ default: module.default }))
);
const Settings = lazy(() => 
  import("@/pages/Settings/Settings").then(module => ({ default: module.default }))
);
const BusinessSettings = lazy(() => 
  import("@/pages/Settings/BusinessSettings").then(module => ({ default: module.default }))
);
const ShipperAdvice = lazy(() => 
  import("@/pages/Orders/ShipperAdvice").then(module => ({ default: module.default }))
);
const ReturnsNotReceived = lazy(() => 
  import("@/pages/Returns/ReturnsNotReceived").then(module => ({ default: module.default }))
);
const InventoryDashboard = lazy(() => 
  import("@/pages/Inventory/InventoryDashboard").then(module => ({ default: module.default }))
);
const OutletManagement = lazy(() => 
  import("@/pages/Outlets/OutletManagement").then(module => ({ default: module.default }))
);
const ProductManagement = lazy(() => 
  import("@/pages/Products/ProductManagement").then(module => ({ default: module.default }))
);
const StockTransferDashboard = lazy(() => 
  import("@/pages/StockTransfer/StockTransferDashboard").then(module => ({ default: module.default }))
);
const LocationsDashboard = lazy(() => 
  import("@/pages/Locations/LocationsDashboard").then(module => ({ default: module.default }))
);
const SupplierManagement = lazy(() =>
  import("@/pages/Suppliers/SupplierManagement").then(module => ({ default: module.default }))
);
const SupplierAnalyticsDashboard = lazy(() => 
  import("@/pages/Suppliers/SupplierAnalyticsDashboard").then(module => ({ default: module.default }))
);
const PurchaseOrderDashboard = lazy(() => 
  import("@/pages/PurchaseOrders/PurchaseOrderDashboard").then(module => ({ default: module.default }))
);
const ReceivingDashboard = lazy(() => 
  import("@/pages/Receiving/ReceivingDashboard").then(module => ({ default: module.default }))
);
const StockAuditDashboard = lazy(() => 
  import("@/pages/StockAudit/StockAuditDashboard").then(module => ({ default: module.default }))
);
const VarianceManagement = lazy(() => 
  import("@/pages/VarianceManagement/VarianceManagement").then(module => ({ default: module.default }))
);
const FraudReportDashboard = lazy(() => 
  import("@/pages/FraudReporting/FraudReportDashboard").then(module => ({ default: module.default }))
);
const PackagingManagement = lazy(() => 
  import("@/pages/Inventory/PackagingManagement").then(module => ({ default: module.default }))
);
const SupplierPortal = lazy(() => 
  import("@/pages/Suppliers/SupplierPortal").then(module => ({ default: module.default }))
);
const NotFound = lazy(() => import("./pages/NotFound"));
const ActivityLogs = lazy(() => 
  import("@/pages/ActivityLogs/ActivityLogs").then(module => ({ default: module.default }))
);
const POSMain = lazy(() =>
  import("@/pages/POS/POSMain").then(module => ({ default: module.default }))
);
const ScanHistory = lazy(() =>
  import("@/pages/Barcode/ScanHistory").then(module => ({ default: module.default }))
);
const ConfirmationDashboard = lazy(() =>
  import("@/pages/Confirmations/ConfirmationDashboard").then(module => ({ default: module.default }))
);
const ProductionDashboard = lazy(() =>
  import("@/pages/Production/ProductionDashboard").then(module => ({ default: module.default }))
);
const BOMManagement = lazy(() =>
  import("@/pages/Production/BOMManagement").then(module => ({ default: module.default }))
);
const LabelPrinter = lazy(() =>
  import("@/components/production/LabelPrinter").then(module => ({ default: module.LabelPrinter }))
);
const BarcodeManagement = lazy(() =>
  import("@/pages/Barcode/BarcodeManagement").then(module => ({ default: module.default }))
);
const AutomationHistory = lazy(() => 
  import("@/pages/Inventory/AutomationHistory").then(module => ({ default: module.default }))
);
const StockMovementHistory = lazy(() => 
  import("@/pages/Inventory/StockMovementHistory").then(module => ({ default: module.default }))
);

// Optimized QueryClient configuration for performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst', // Better offline experience
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// Optimized loading component with minimal UI
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="text-center">
      <Loader2 className="h-6 w-6 animate-spin text-purple-500 mx-auto mb-2" />
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  </div>
);

const App = () => {
  // Preload critical routes after mount
  useEffect(() => {
    // Preload Dashboard (most common route)
    import("@/pages/Dashboard");
    // Preload Orders (second most common)
    const timer = setTimeout(() => import("@/pages/Orders/OrderDashboard"), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <BrowserRouter>
            <VersionChecker />
            <AuthProvider>
              <Routes>
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={
                    <Suspense fallback={<PageLoader />}>
                      <Dashboard />
                    </Suspense>
                  } />
                  <Route path="orders" element={
                    <Suspense fallback={<PageLoader />}>
                      <OrderDashboard />
                    </Suspense>
                  } />
                  <Route path="dispatch" element={
                    <Suspense fallback={<PageLoader />}>
                      <DispatchDashboard />
                    </Suspense>
                  } />
                  <Route path="returns" element={
                    <Suspense fallback={<PageLoader />}>
                      <ReturnsDashboard />
                    </Suspense>
                  } />
                  <Route path="all-customers" element={
                    <Suspense fallback={<PageLoader />}>
                      <AllCustomers />
                    </Suspense>
                  } />
                  <Route path="suspicious-customers" element={
                    <Suspense fallback={<PageLoader />}>
                      <SuspiciousCustomers />
                    </Suspense>
                  } />
                  <Route path="address-verification" element={
                    <Suspense fallback={<PageLoader />}>
                      <AddressVerification />
                    </Suspense>
                  } />
                  <Route path="user-management" element={
                    <Suspense fallback={<PageLoader />}>
                      <UserManagement />
                    </Suspense>
                  } />
                  <Route path="settings" element={
                    <Suspense fallback={<PageLoader />}>
                      <Settings />
                    </Suspense>
                  } />
                  <Route path="business-settings" element={
                    <Suspense fallback={<PageLoader />}>
                      <BusinessSettings />
                    </Suspense>
                  } />
                  <Route path="shipper-advice" element={
                    <Suspense fallback={<PageLoader />}>
                      <ShipperAdvice />
                    </Suspense>
                  } />
                  <Route path="returns-not-received" element={
                    <Suspense fallback={<PageLoader />}>
                      <ReturnsNotReceived />
                    </Suspense>
                  } />
                  <Route path="inventory" element={
                    <Suspense fallback={<PageLoader />}>
                      <InventoryDashboard />
                    </Suspense>
                  } />
                  <Route path="outlets" element={
                    <Suspense fallback={<PageLoader />}>
                      <OutletManagement />
                    </Suspense>
                  } />
                  <Route path="products" element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductManagement />
                    </Suspense>
                  } />
                  <Route path="packaging" element={
                    <Suspense fallback={<PageLoader />}>
                      <PackagingManagement />
                    </Suspense>
                  } />
                  <Route path="stock-transfer" element={
                    <Suspense fallback={<PageLoader />}>
                      <StockTransferDashboard />
                    </Suspense>
                  } />
                  <Route path="locations" element={
                    <Suspense fallback={<PageLoader />}>
                      <LocationsDashboard />
                    </Suspense>
                  } />
                  <Route path="suppliers" element={
                    <Suspense fallback={<PageLoader />}>
                      <SupplierManagement />
                    </Suspense>
                  } />
                  <Route path="supplier-portal" element={
                    <Suspense fallback={<PageLoader />}>
                      <SupplierPortal />
                    </Suspense>
                  } />
                  <Route path="supplier-analytics" element={
                    <Suspense fallback={<PageLoader />}>
                      <SupplierAnalyticsDashboard />
                    </Suspense>
                  } />
                  <Route path="purchase-orders" element={
                    <Suspense fallback={<PageLoader />}>
                      <PurchaseOrderDashboard />
                    </Suspense>
                  } />
                  <Route path="receiving" element={
                    <Suspense fallback={<PageLoader />}>
                      <ReceivingDashboard />
                    </Suspense>
                  } />
                  <Route path="stock-audit" element={
                    <Suspense fallback={<PageLoader />}>
                      <StockAuditDashboard />
                    </Suspense>
                  } />
                  <Route path="variance-management" element={
                    <Suspense fallback={<PageLoader />}>
                      <VarianceManagement />
                    </Suspense>
                  } />
                  <Route path="fraud-reporting" element={
                    <Suspense fallback={<PageLoader />}>
                      <FraudReportDashboard />
                    </Suspense>
                  } />
                  <Route path="activity-logs" element={
                    <Suspense fallback={<PageLoader />}>
                      <ActivityLogs />
                    </Suspense>
                  } />
                  <Route path="pos" element={
                    <Suspense fallback={<PageLoader />}>
                      <POSMain />
                    </Suspense>
                  } />
                  <Route path="scan-history" element={
                    <Suspense fallback={<PageLoader />}>
                      <ScanHistory />
                    </Suspense>
                  } />
                  <Route path="confirmations" element={
                    <Suspense fallback={<PageLoader />}>
                      <ConfirmationDashboard />
                    </Suspense>
                  } />
                  <Route path="production" element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductionDashboard />
                    </Suspense>
                  } />
                  <Route path="production/bom" element={
                    <Suspense fallback={<PageLoader />}>
                      <BOMManagement />
                    </Suspense>
                  } />
                  <Route path="production/labels" element={
                    <Suspense fallback={<PageLoader />}>
                      <LabelPrinter />
                    </Suspense>
                  } />
                  <Route path="barcode-management" element={
                    <Suspense fallback={<PageLoader />}>
                      <BarcodeManagement />
                    </Suspense>
                  } />
                  <Route path="automation-history" element={
                    <Suspense fallback={<PageLoader />}>
                      <AutomationHistory />
                    </Suspense>
                  } />
                  <Route path="stock-movement-history" element={
                    <Suspense fallback={<PageLoader />}>
                      <StockMovementHistory />
                    </Suspense>
                  } />
                  <Route path="*" element={
                    <Suspense fallback={<PageLoader />}>
                      <NotFound />
                    </Suspense>
                  } />
                </Route>
              </Routes>
              <Toaster />
              <Sonner />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
