
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

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
const AdminPanel = lazy(() => 
  import("@/pages/AdminPanel/AdminPanel").then(module => ({ default: module.default }))
);
const Settings = lazy(() => 
  import("@/pages/Settings/Settings").then(module => ({ default: module.default }))
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
const ShipmentsDashboard = lazy(() => 
  import("@/pages/Shipments/ShipmentsDashboard").then(module => ({ default: module.default }))
);
const NewOrders = lazy(() => 
  import("@/pages/Orders/NewOrders").then(module => ({ default: module.default }))
);
const ProcessingOrders = lazy(() => 
  import("@/pages/Orders/ProcessingOrders").then(module => ({ default: module.default }))
);
const ShippedOrders = lazy(() => 
  import("@/pages/Orders/ShippedOrders").then(module => ({ default: module.default }))
);
const DeliveredOrders = lazy(() => 
  import("@/pages/Orders/DeliveredOrders").then(module => ({ default: module.default }))
);
const ReturnedOrders = lazy(() => 
  import("@/pages/Orders/ReturnedOrders").then(module => ({ default: module.default }))
);
const SettingsProfile = lazy(() => 
  import("@/pages/Settings/SettingsProfile").then(module => ({ default: module.default }))
);
const SettingsRoles = lazy(() => 
  import("@/pages/Settings/SettingsRoles").then(module => ({ default: module.default }))
);
const SettingsLocations = lazy(() => 
  import("@/pages/Settings/SettingsLocations").then(module => ({ default: module.default }))
);
const SettingsNotifications = lazy(() => 
  import("@/pages/Settings/SettingsNotifications").then(module => ({ default: module.default }))
);
const SettingsSecurity = lazy(() => 
  import("@/pages/Settings/SettingsSecurity").then(module => ({ default: module.default }))
);
const AddInventory = lazy(() => 
  import("@/pages/Inventory/AddInventory").then(module => ({ default: module.default }))
);
const TransferInventory = lazy(() => 
  import("@/pages/Inventory/TransferInventory").then(module => ({ default: module.default }))
);
const NotFound = lazy(() => import("./pages/NotFound"));

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

// Preload critical routes on app initialization
const preloadCriticalRoutes = () => {
  // Preload Dashboard (most common route)
  import("@/pages/Dashboard");
  // Preload Orders (second most common)
  setTimeout(() => import("@/pages/Orders/OrderDashboard"), 100);
};

const App = () => {
  // Start preloading on mount
  preloadCriticalRoutes();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
                <Route path="admin-panel" element={
                  <Suspense fallback={<PageLoader />}>
                    <AdminPanel />
                  </Suspense>
                } />
                <Route path="settings" element={
                  <Suspense fallback={<PageLoader />}>
                    <Settings />
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
                <Route path="stock-transfer" element={
                  <Suspense fallback={<PageLoader />}>
                    <StockTransferDashboard />
                  </Suspense>
                } />
                <Route path="shipments" element={
                  <Suspense fallback={<PageLoader />}>
                    <ShipmentsDashboard />
                  </Suspense>
                } />
                <Route path="orders/new" element={
                  <Suspense fallback={<PageLoader />}>
                    <NewOrders />
                  </Suspense>
                } />
                <Route path="orders/processing" element={
                  <Suspense fallback={<PageLoader />}>
                    <ProcessingOrders />
                  </Suspense>
                } />
                <Route path="orders/shipped" element={
                  <Suspense fallback={<PageLoader />}>
                    <ShippedOrders />
                  </Suspense>
                } />
                <Route path="orders/delivered" element={
                  <Suspense fallback={<PageLoader />}>
                    <DeliveredOrders />
                  </Suspense>
                } />
                <Route path="orders/returned" element={
                  <Suspense fallback={<PageLoader />}>
                    <ReturnedOrders />
                  </Suspense>
                } />
                <Route path="settings/profile" element={
                  <Suspense fallback={<PageLoader />}>
                    <SettingsProfile />
                  </Suspense>
                } />
                <Route path="settings/roles" element={
                  <Suspense fallback={<PageLoader />}>
                    <SettingsRoles />
                  </Suspense>
                } />
                <Route path="settings/locations" element={
                  <Suspense fallback={<PageLoader />}>
                    <SettingsLocations />
                  </Suspense>
                } />
                <Route path="settings/notifications" element={
                  <Suspense fallback={<PageLoader />}>
                    <SettingsNotifications />
                  </Suspense>
                } />
                <Route path="settings/security" element={
                  <Suspense fallback={<PageLoader />}>
                    <SettingsSecurity />
                  </Suspense>
                } />
                <Route path="inventory/add" element={
                  <Suspense fallback={<PageLoader />}>
                    <AddInventory />
                  </Suspense>
                } />
                <Route path="inventory/transfer" element={
                  <Suspense fallback={<PageLoader />}>
                    <TransferInventory />
                  </Suspense>
                } />
                <Route path="*" element={
                  <Suspense fallback={<PageLoader />}>
                    <NotFound />
                  </Suspense>
                } />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
