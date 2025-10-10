import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";
import { ModernButton } from "@/components/ui/modern-button";
import { Badge } from "@/components/ui/badge";
import { Home, Package, Truck, RotateCcw, Users, Settings, Bell, Moon, Sun, Shield, MapPin, LogOut, ChevronDown, Box, Building2, ArrowRightLeft, Warehouse, Activity } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from '@/contexts/AuthContext';
import { getNavigationItems } from '@/utils/rolePermissions';
import { useUserRoles } from '@/hooks/useUserRoles';
import { NotificationsPanel } from '@/components/NotificationsPanel';

const Layout = () => {
  const [isDark, setIsDark] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { user, profile, userRoles, signOut } = useAuth();
  const location = useLocation();

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = () => {
    signOut();
  };

  const { primaryRole, userRoles: currentRoles } = useUserRoles();
  const displayName = (profile?.full_name && profile.full_name !== 'New User') ? profile.full_name : (profile?.email || user?.email);
  const formatRole = (primaryRole as string).replace(/_/g, ' ');

  const navigationItems = user ? getNavigationItems(primaryRole as any) : [];

  const getIcon = (iconName: string) => {
    const icons = {
      Home, Package, Truck, RotateCcw, Users, Settings, Shield, MapPin, Box, Building2, ArrowRightLeft, Warehouse, Activity
    };
    return icons[iconName as keyof typeof icons] || Home;
  };

  // Check if current route matches any navigation item
  const isActiveRoute = (href: string) => location.pathname === href;
  const hasActiveSubItem = (subItems: any[]) => subItems.some(subItem => isActiveRoute(subItem.href));

  // Handle menu toggle - only one menu can be open at a time
  const handleMenuToggle = (menuLabel: string) => {
    setOpenMenu(openMenu === menuLabel ? null : menuLabel);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
        <Sidebar className="border-r border-white/20 bg-gradient-to-b from-slate-900 via-purple-900/50 to-slate-900 dark:from-gray-950 dark:via-purple-950/50 dark:to-gray-950" collapsible="icon">
          <SidebarHeader className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg group-data-[collapsible=icon]:mx-auto overflow-hidden">
                <img src="/lovable-uploads/16f7bf51-0496-44ab-846f-048636e7cc5d.png" alt="CORE47.AI" className="w-full h-full object-contain" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <h2 className="text-sm font-bold text-primary-foreground">CORE47.AI</h2>
                <p className="text-xs text-muted-foreground">Order Management</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-2">
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => {
                const IconComponent = getIcon(item.icon);
                
                if (item.subItems && item.subItems.length > 0) {
                  const hasActiveSub = hasActiveSubItem(item.subItems);
                  const isMenuOpen = openMenu === item.label || hasActiveSub;
                  return (
                    <SidebarMenuItem key={item.label}>
                      <Collapsible open={isMenuOpen} onOpenChange={() => handleMenuToggle(item.label)}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className={`w-full justify-start gap-2 px-3 py-2 rounded-lg transition-all duration-300 group ${
                            hasActiveSub 
                    ? 'text-primary-foreground bg-gradient-primary/30 border border-primary/30' 
                              : 'text-muted-foreground hover:text-primary-foreground hover:bg-gradient-primary/20'
                          }`}>
                            <IconComponent className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            <span className="font-medium group-data-[collapsible=icon]:hidden">{item.label}</span>
                            <ChevronDown className={`ml-auto h-3 w-3 transition-transform duration-300 group-data-[collapsible=icon]:hidden ${isMenuOpen ? 'rotate-180' : ''}`} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                          <SidebarMenuSub className="ml-2 mt-2 space-y-2">
                            {item.subItems.map((subItem, subIndex) => (
                              <SidebarMenuSubItem key={subIndex}>
                                 <SidebarMenuSubButton asChild className={`w-full justify-start gap-2 rounded-lg transition-all duration-300 py-2 ${
                                   isActiveRoute(subItem.href)
                                     ? 'text-primary-foreground bg-gradient-primary/25 border border-primary/25'
                                     : 'text-muted-foreground hover:text-primary-foreground hover:bg-gradient-primary/15'
                                 }`}>
                                    <Link to={subItem.href} className="flex items-center gap-2">
                                     <span className="font-medium whitespace-nowrap">{subItem.label}</span>
                    {subItem.badge && (
                                      <Badge variant="destructive" className="ml-auto text-xs font-semibold">
                                        {subItem.badge}
                                      </Badge>
                                     )}
                                   </Link>
                                 </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.label}>
                     <SidebarMenuButton asChild className={`w-full justify-start gap-2 px-3 py-2 rounded-lg transition-all duration-300 group ${
                       isActiveRoute(item.href) 
                         ? 'text-primary-foreground bg-gradient-primary/30 border border-primary/30' 
                         : 'text-muted-foreground hover:text-primary-foreground hover:bg-gradient-primary/20'
                     }`}>
                       <Link to={item.href} className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        <span className="font-medium group-data-[collapsible=icon]:hidden">{item.label}</span>
                        {item.badge && (
                          <Badge variant="destructive" className="ml-auto text-xs font-semibold group-data-[collapsible=icon]:hidden">
                            {item.badge}
                          </Badge>
                         )}
                       </Link>
                     </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-primary/10 border border-sidebar-border">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center group-data-[collapsible=icon]:mx-auto">
                <Users className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-semibold text-primary-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">{formatRole}</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navigation */}
          <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/20 sticky top-0 z-50">
            <div className="flex items-center justify-between p-4 lg:px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
              </div>
              
              <div className="flex items-center gap-3">
                <NotificationsPanel />
                
                <ModernButton variant="ghost" size="icon" onClick={toggleTheme}>
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </ModernButton>
                
                <ModernButton variant="destructive" size="sm" onClick={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
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
