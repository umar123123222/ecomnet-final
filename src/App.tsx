
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

// Lazy load all pages to improve initial load time
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const OrderDashboard = lazy(() => import("@/pages/Orders/OrderDashboard"));
const DispatchDashboard = lazy(() => import("@/pages/Dispatch/DispatchDashboard"));
const ReturnsDashboard = lazy(() => import("@/pages/Returns/ReturnsDashboard"));
const AllCustomers = lazy(() => import("@/pages/Customers/AllCustomers"));
const SuspiciousCustomers = lazy(() => import("@/pages/SuspiciousCustomers/SuspiciousCustomers"));
const AddressVerification = lazy(() => import("@/pages/AddressVerification/AddressVerification"));
const UserManagement = lazy(() => import("@/pages/UserManagement/UserManagement"));
const AdminPanel = lazy(() => import("@/pages/AdminPanel/AdminPanel"));
const Settings = lazy(() => import("@/pages/Settings/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-4" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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

export default App;
