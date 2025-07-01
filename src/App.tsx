
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import OrderDashboard from "@/pages/Orders/OrderDashboard";
import DispatchDashboard from "@/pages/Dispatch/DispatchDashboard";
import ReturnsDashboard from "@/pages/Returns/ReturnsDashboard";
import SuspiciousCustomers from "@/pages/SuspiciousCustomers/SuspiciousCustomers";
import AddressVerification from "@/pages/AddressVerification/AddressVerification";
import UserManagement from "@/pages/UserManagement/UserManagement";
import AdminPanel from "@/pages/AdminPanel/AdminPanel";
import Settings from "@/pages/Settings/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<OrderDashboard />} />
            <Route path="dispatch" element={<DispatchDashboard />} />
            <Route path="returns" element={<ReturnsDashboard />} />
            <Route path="suspicious-customers" element={<SuspiciousCustomers />} />
            <Route path="address-verification" element={<AddressVerification />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="admin-panel" element={<AdminPanel />} />
            <Route path="settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
