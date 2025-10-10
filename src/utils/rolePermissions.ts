
import { UserRole } from '@/types/auth';

export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
  subItems?: NavigationItem[];
}

export const getRolePermissions = (role: UserRole) => {
  const permissions = {
    canAccessDashboard: false,
    canAccessOrders: false,
    canAccessCustomers: false,
    canAccessDispatch: false,
    canAccessReturns: false,
    canAccessAddressVerification: false,
    canAccessUserManagement: false,
    canAccessSettings: false,
    canAddUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canAccessInventory: false,
    canAccessOutlets: false,
    canAccessProducts: false,
    canAccessStockTransfer: false,
    canAccessLocations: false,
    canAccessWarehouses: false,
  };

  switch (role) {
    case 'super_admin':
      return {
        ...permissions,
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessCustomers: true,
        canAccessDispatch: true,
        canAccessReturns: true,
        canAccessAddressVerification: true,
        canAccessUserManagement: true,
        canAccessSettings: true,
        canAddUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canAccessInventory: true,
        canAccessOutlets: true,
        canAccessProducts: true,
        canAccessStockTransfer: true,
        canAccessLocations: true,
        canAccessWarehouses: true,
      };
    
    case 'super_manager':
      return {
        ...permissions,
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessCustomers: true,
        canAccessDispatch: true,
        canAccessReturns: true,
        canAccessAddressVerification: true,
        canAccessUserManagement: true,
        canAccessSettings: true,
        canAddUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canAccessInventory: true,
        canAccessOutlets: true,
        canAccessProducts: true,
        canAccessStockTransfer: true,
        canAccessLocations: true,
        canAccessWarehouses: true,
        // No admin panel access
      };
    
    case 'store_manager':
      return {
        ...permissions,
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessCustomers: true,
        canAccessDispatch: true,
        canAccessReturns: true,
        canAccessAddressVerification: true,
        canAccessInventory: true,
        canAccessOutlets: true,
        canAccessProducts: true,
        canAccessStockTransfer: true,
        canAccessLocations: true,
        canAccessWarehouses: true,
        canAccessSettings: true,
      };
    
    case 'warehouse_manager':
      return {
        ...permissions,
        canAccessDashboard: true,
        canAccessInventory: true,
        canAccessOutlets: true,
        canAccessProducts: true,
        canAccessStockTransfer: true,
        canAccessLocations: true,
        canAccessWarehouses: true,
        canAccessSettings: true,
      };
    
    case 'dispatch_manager':
      return {
        ...permissions,
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessDispatch: true,
        canAccessSettings: true,
      };
    
    case 'returns_manager':
      return {
        ...permissions,
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessReturns: true,
        canAccessSettings: true,
      };
    
    case 'staff':
      return {
        ...permissions,
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessCustomers: true,
        canAccessDispatch: true,
        canAccessReturns: true,
        canAccessAddressVerification: true,
        canAccessSettings: true,
        // No admin panel and user management access
      };
    
    default:
      return permissions;
  }
};

export const getNavigationItems = (role: UserRole): NavigationItem[] => {
  const permissions = getRolePermissions(role);
  const items: NavigationItem[] = [];

  if (permissions.canAccessDashboard) {
    items.push({
      label: 'Dashboard',
      href: '/',
      icon: 'Home'
    });
  }

  if (permissions.canAccessOrders) {
    items.push({
      label: 'Orders',
      href: '/orders',
      icon: 'Package',
      subItems: [
        { label: 'All Orders', href: '/orders', icon: '' },
        { label: 'Shipper Advice', href: '/shipper-advice', icon: '' }
      ]
    });
  }

  if (permissions.canAccessCustomers) {
    items.push({
      label: 'Customers',
      href: '/customers',
      icon: 'Users',
      subItems: [
        { label: 'All Customers', href: '/all-customers', icon: '' },
        { label: 'Suspicious Customers', href: '/suspicious-customers', icon: '', badge: '5' }
      ]
    });
  }

  if (permissions.canAccessDispatch) {
    items.push({
      label: 'Dispatch',
      href: '/dispatch',
      icon: 'Truck'
    });
  }

  if (permissions.canAccessReturns) {
    items.push({
      label: 'Returns',
      href: '/returns',
      icon: 'RotateCcw',
      badge: '12',
      subItems: [
        { label: 'All Returns', href: '/returns', icon: '' },
        { label: 'Returns Not Received', href: '/returns-not-received', icon: '' }
      ]
    });
  }

  if (permissions.canAccessAddressVerification) {
    items.push({
      label: 'Address Verification',
      href: '/address-verification',
      icon: 'MapPin'
    });
  }

  if (permissions.canAccessInventory || permissions.canAccessProducts || permissions.canAccessStockTransfer) {
    const inventorySubItems: NavigationItem[] = [];
    
    if (permissions.canAccessInventory) {
      inventorySubItems.push({ label: 'Inventory', href: '/inventory', icon: '' });
    }
    if (permissions.canAccessProducts) {
      inventorySubItems.push({ label: 'Products', href: '/products', icon: '' });
    }
    if (permissions.canAccessStockTransfer) {
      inventorySubItems.push({ label: 'Stock Transfers', href: '/stock-transfer', icon: '' });
    }

    items.push({
      label: 'Inventory',
      href: '/inventory',
      icon: 'Box',
      subItems: inventorySubItems
    });
  }

  if (permissions.canAccessOutlets) {
    items.push({
      label: 'Outlets',
      href: '/outlets',
      icon: 'Building2'
    });
  }

  if (permissions.canAccessLocations) {
    items.push({
      label: 'Locations',
      href: '/locations',
      icon: 'MapPin'
    });
  }

  if (permissions.canAccessWarehouses) {
    items.push({
      label: 'Warehouses',
      href: '/warehouses',
      icon: 'Warehouse'
    });
  }

  if (permissions.canAccessUserManagement) {
    items.push({
      label: 'User Management',
      href: '/user-management',
      icon: 'Shield'
    });
  }

  if (permissions.canAccessSettings) {
    items.push({
      label: 'Settings',
      href: '/settings',
      icon: 'Settings'
    });
  }

  return items;
};
