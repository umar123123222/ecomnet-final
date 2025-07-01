
import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  RotateCcw,
  Users,
  Flag,
  MapPin,
  Settings,
  Bell,
  Search,
  Menu,
  Sun,
  Moon,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Layout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  const navigationItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { 
      name: 'Orders', 
      icon: Package,
      children: [
        { name: 'Order Dashboard', href: '/orders' },
        { name: 'Shipper Advice', href: '/orders/shipper-advice' },
        { name: 'Dispatch Portal', href: '/orders/dispatch' },
      ]
    },
    { name: 'Returns', href: '/returns', icon: RotateCcw },
    { name: 'Suspicious Customers', href: '/suspicious', icon: Flag },
    { name: 'Address Verification', href: '/address-verification', icon: MapPin },
    { name: 'User Management', href: '/users', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const NavItem = ({ item, isChild = false }: { item: any; isChild?: boolean }) => {
    const [expanded, setExpanded] = useState(false);
    
    if (item.children) {
      return (
        <div className="space-y-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg hover:bg-gray-100 text-gray-700 ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="flex items-center">
              <item.icon className="h-5 w-5 mr-3" />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </div>
            {!sidebarCollapsed && (
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            )}
          </button>
          {expanded && !sidebarCollapsed && (
            <div className="ml-8 space-y-1">
              {item.children.map((child: any) => (
                <NavItem key={child.href} item={child} isChild={true} />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        to={item.href}
        className={({ isActive }) =>
          `flex items-center px-3 py-2 text-sm font-medium rounded-lg hover:bg-gray-100 ${
            isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
          } ${sidebarCollapsed && !isChild ? 'justify-center' : ''}`
        }
      >
        {!isChild && <item.icon className="h-5 w-5 mr-3" />}
        {(!sidebarCollapsed || isChild) && <span>{item.name}</span>}
      </NavLink>
    );
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-lg transition-all duration-300`}>
        <div className="flex items-center justify-between p-4 border-b">
          {!sidebarCollapsed && (
            <h1 className="text-xl font-bold text-gray-900">Ecomnet Portal</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        
        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => (
            <NavItem key={item.name} item={item} />
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`${sidebarCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search orders, customers, tracking IDs..."
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      A
                    </div>
                    <span>Admin User</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
