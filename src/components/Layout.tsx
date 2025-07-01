
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider, 
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { ModernButton } from "@/components/ui/modern-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  Package, 
  Truck, 
  RotateCcw, 
  Users, 
  Settings, 
  Search, 
  Bell, 
  Moon, 
  Sun,
  Shield,
  MapPin,
  AlertTriangle
} from "lucide-react";

const Layout = () => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const menuItems = [
    { icon: Home, label: "Dashboard", href: "/", badge: null },
    { icon: Package, label: "Orders", href: "/orders", badge: "234" },
    { icon: Truck, label: "Dispatch", href: "/dispatch", badge: null },
    { icon: RotateCcw, label: "Returns", href: "/returns", badge: "12" },
    { icon: AlertTriangle, label: "Suspicious Customers", href: "/suspicious-customers", badge: "5" },
    { icon: MapPin, label: "Address Verification", href: "/address-verification", badge: null },
    { icon: Users, label: "User Management", href: "/user-management", badge: null },
    { icon: Shield, label: "Admin Panel", href: "/admin-panel", badge: null },
    { icon: Settings, label: "Settings", href: "/settings", badge: null },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
        <Sidebar className="border-r border-white/20 bg-gradient-to-b from-slate-900 via-purple-900/50 to-slate-900 dark:from-gray-950 dark:via-purple-950/50 dark:to-gray-950">
          <SidebarHeader className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Ecomnet Portal</h2>
                <p className="text-xs text-gray-300">Order Management</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4">
            <SidebarMenu className="space-y-2">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuButton 
                      asChild 
                      className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300 group"
                    >
                      <a href={item.href} className="flex items-center gap-3">
                        <Icon className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        <span className="font-medium">{item.label}</span>
                        {item.badge && (
                          <Badge className="ml-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          
          <SidebarFooter className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Admin User</p>
                <p className="text-xs text-gray-300">admin@ecomnet.com</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          {/* Top Navigation */}
          <header className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-lg border-b border-white/20 dark:border-gray-800/20 sticky top-0 z-50">
            <div className="flex items-center justify-between p-4 lg:px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="lg:hidden" />
                <div className="hidden md:flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search orders, customers..." 
                      className="pl-10 w-80 bg-white/50 dark:bg-gray-800/50 border-white/20 dark:border-gray-700/20 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <ModernButton 
                  variant="ghost" 
                  size="icon"
                  className="relative"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">3</span>
                  </span>
                </ModernButton>
                
                <ModernButton 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleTheme}
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </ModernButton>
                
                <ModernButton variant="default" size="sm">
                  Profile
                </ModernButton>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
