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
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton
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
  LogOut,
  ChevronDown
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const Layout = () => {
  const [isDark, setIsDark] = useState(false);
  const [isCustomersOpen, setIsCustomersOpen] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = () => {
    console.log('Logging out...');
  };

  const customerSubMenuItems = [
    { label: "All Customers", href: "/all-customers", badge: null },
    { label: "Suspicious Customers", href: "/suspicious-customers", badge: "5" },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
        <Sidebar className="border-r border-white/20 bg-gradient-to-b from-slate-900 via-purple-900/60 to-slate-900 dark:from-gray-950 dark:via-purple-950/60 dark:to-gray-950 backdrop-blur-xl">
          <SidebarHeader className="spacing-md border-b border-white/20 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Package className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Ecomnet Portal</h2>
                <p className="text-sm text-gray-300">Order Management System</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="spacing-sm overflow-visible">
            <SidebarMenu className="space-y-2">
              {/* Dashboard */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm"
                >
                  <a href="/" className="flex items-center gap-3">
                    <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Dashboard</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Orders */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm"
                >
                  <a href="/orders" className="flex items-center gap-3">
                    <Package className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Orders</span>
                    <Badge className="ml-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-xs font-semibold shadow-lg">
                      234
                    </Badge>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Customers Menu with Sub-items */}
              <SidebarMenuItem className="relative">
                <Collapsible open={isCustomersOpen} onOpenChange={setIsCustomersOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm">
                      <Users className="h-5 w-5 group-hover:scale-110 transition-transform" />
                      <span className="font-medium">Customers</span>
                      <ChevronDown className={`ml-auto h-4 w-4 transition-transform duration-300 ${isCustomersOpen ? 'rotate-180' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="relative z-50">
                    <SidebarMenuSub className="ml-4 mt-2 space-y-1 relative z-50 bg-gradient-to-r from-slate-800/90 via-purple-800/90 to-slate-800/90 backdrop-blur-xl rounded-lg border border-white/10 shadow-2xl">
                      {customerSubMenuItems.map((subItem, subIndex) => (
                        <SidebarMenuSubItem key={subIndex}>
                          <SidebarMenuSubButton 
                            asChild 
                            className="w-full justify-start gap-3 px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300 backdrop-blur-sm"
                          >
                            <a href={subItem.href} className="flex items-center gap-3">
                              <span className="font-medium">{subItem.label}</span>
                              {subItem.badge && (
                                <Badge className="ml-auto bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 text-xs font-semibold shadow-lg">
                                  {subItem.badge}
                                </Badge>
                              )}
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>

              {/* Dispatch */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm"
                >
                  <a href="/dispatch" className="flex items-center gap-3">
                    <Truck className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Dispatch</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Returns */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm"
                >
                  <a href="/returns" className="flex items-center gap-3">
                    <RotateCcw className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Returns</span>
                    <Badge className="ml-auto bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-xs font-semibold shadow-lg">
                      12
                    </Badge>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Address Verification */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm"
                >
                  <a href="/address-verification" className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Address Verification</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* User Management */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm"
                >
                  <a href="/user-management" className="flex items-center gap-3">
                    <Users className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">User Management</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Admin Panel */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm"
                >
                  <a href="/admin-panel" className="flex items-center gap-3">
                    <Shield className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Admin Panel</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Settings */}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 group backdrop-blur-sm"
                >
                  <a href="/settings" className="flex items-center gap-3">
                    <Settings className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Settings</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          
          <SidebarFooter className="spacing-sm border-t border-white/20">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-white/20 backdrop-blur-sm">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">Admin User</p>
                <p className="text-xs text-gray-300 truncate">admin@ecomnet.com</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navigation */}
          <header className="bg-gradient-to-r from-white/90 via-white/85 to-white/90 dark:from-gray-900/90 dark:via-gray-900/85 dark:to-gray-900/90 backdrop-blur-xl border-b border-white/30 dark:border-gray-800/30 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center justify-between p-4 lg:px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="lg:hidden" />
                <div className="hidden md:flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search orders, customers, products..." 
                      className="pl-10 w-80 bg-gradient-to-r from-white/80 to-white/60 dark:from-gray-800/80 dark:to-gray-800/60 border-white/40 dark:border-gray-700/40 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 rounded-lg backdrop-blur-sm"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <ModernButton 
                  variant="ghost" 
                  size="icon"
                  className="relative hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-[8px] text-white font-bold">3</span>
                  </span>
                </ModernButton>
                
                <ModernButton 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleTheme}
                  className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50"
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </ModernButton>
                
                <ModernButton 
                  variant="destructive" 
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </ModernButton>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-gradient-to-br from-transparent via-white/20 to-transparent">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
