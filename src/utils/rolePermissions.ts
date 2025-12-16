
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
    canAccessBusinessSettings: false,
    canAddUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canAccessInventory: false,
    canAccessOutlets: false,
    canManageOutlets: false,
    canAccessProducts: false,
    canManageProducts: false,
    canAccessStockTransfer: false,
    canCreateStockTransfer: false,
    canAccessLocations: false,
    canAccessActivityLogs: false,
    canAccessSuppliers: false,
    canManageSuppliers: false,
    canAccessSupplierAnalytics: false,
    canAccessPurchaseOrders: false,
    canAccessReceiving: false,
    canAccessStockAudit: false,
    canAccessVarianceManagement: false,
    canAccessFraudReporting: false,
    canAccessSupplierPortal: false,
    canAccessPackaging: false,
    canManagePackaging: false,
    canAdjustPackagingStock: false,
    canViewStockMovements: false,
    canBulkAdjustStock: false,
    canAccessPOS: false,
    canAssignCouriers: false,
  };

  switch (role) {
    case 'supplier':
      return {
        ...permissions,
        canAccessSupplierPortal: true,
        canAccessSettings: true,
      };
    
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
        canAccessBusinessSettings: true,
        canAddUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canAccessInventory: true,
        canAccessOutlets: true,
        canManageOutlets: true,
        canAccessProducts: true,
        canManageProducts: true,
        canAccessStockTransfer: true,
        canCreateStockTransfer: true,
        canAccessLocations: true,
        canAccessActivityLogs: true,
        canAccessSuppliers: true,
        canManageSuppliers: true,
        canAccessSupplierAnalytics: true,
        canAccessPurchaseOrders: true,
        canAccessReceiving: true,
        canAccessStockAudit: true,
        canAccessVarianceManagement: true,
        canAccessFraudReporting: true,
        canAccessPackaging: true,
        canManagePackaging: true,
        canAdjustPackagingStock: true,
        canViewStockMovements: true,
        canBulkAdjustStock: true,
        canAccessPOS: true,
        canAssignCouriers: true,
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
        canManageOutlets: true,
        canAccessProducts: true,
        canManageProducts: true,
        canAccessStockTransfer: true,
        canCreateStockTransfer: true,
        canAccessLocations: true,
        canAccessActivityLogs: true, // Super managers need audit trail visibility for operations
        canAccessSuppliers: true,
        canManageSuppliers: true,
        canAccessSupplierAnalytics: true,
        canAccessPurchaseOrders: true,
        canAccessReceiving: true,
        canAccessStockAudit: true,
        canAccessVarianceManagement: true,
        canAccessFraudReporting: true,
        canAccessPackaging: true,
        canManagePackaging: true,
        canAdjustPackagingStock: true,
        canViewStockMovements: true,
        canBulkAdjustStock: true,
        canAccessPOS: true,
        canAssignCouriers: true,
        // No admin panel access
      };
    
    case 'store_manager':
      return {
        ...permissions,
        canAccessDashboard: false,
        canAccessOrders: false,
        canAccessCustomers: false,
        canAccessDispatch: false,
        canAccessReturns: false,
        canAccessAddressVerification: false,
        canAccessInventory: true,
        canAccessOutlets: false,
        canManageOutlets: false,
        canAccessProducts: false,
        canManageProducts: false,
        canAccessStockTransfer: true,
        canCreateStockTransfer: true,
        canAccessLocations: false,
        canAccessSettings: true,
        canAccessSuppliers: false,
        canManageSuppliers: false,
        canAccessSupplierAnalytics: false,
        canAccessPurchaseOrders: false,
        canAccessReceiving: false,
        canAccessStockAudit: false,
        canAccessVarianceManagement: false,
        canAccessFraudReporting: false,
        canAccessPOS: true,
        canAssignCouriers: false,
      };
    
    case 'warehouse_manager':
      return {
        ...permissions,
        canAccessDashboard: true,
        canAccessOrders: true, // Warehouse managers need orders visibility
        canAccessDispatch: true, // Warehouse managers need dispatch visibility
        canAccessReturns: true, // Warehouse managers handle returns processing
        canAccessInventory: true,
        canAccessOutlets: true,
        canManageOutlets: false, // Cannot create/edit outlets
        canAccessProducts: true,
        canManageProducts: true, // Allow add/edit/delete products for warehouse managers
        canAccessStockTransfer: true,
        canCreateStockTransfer: true, // Can create stock transfer requests
        canAccessLocations: true,
        canAccessSettings: true,
        canAccessSuppliers: true,
        canManageSuppliers: false, // Cannot create/edit/delete suppliers
        canAccessSupplierAnalytics: true,
        canAccessPurchaseOrders: true,
        canAccessReceiving: true,
        canAccessStockAudit: true,
        canAccessVarianceManagement: true,
        canAccessPackaging: true,
        canManagePackaging: true, // Allow add/edit/delete packaging for warehouse managers
        canAdjustPackagingStock: true, // Can adjust packaging stock quantities
        canViewStockMovements: true, // Can view stock movement history
        canBulkAdjustStock: true, // Can perform bulk stock adjustments
        canAccessActivityLogs: true, // Can view activity logs for audit trail
        canAssignCouriers: true,
        // No POS or Scan History access
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
        canAccessAddressVerification: true,
        canAccessSettings: true,
        // No dispatch, returns, admin panel, or user management access
      };
    
    case 'finance':
      return {
        ...permissions,
        // Viewing access to most pages
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessCustomers: false, // Finance cannot access customers
        canAccessDispatch: true,
        canAccessReturns: true,
        canAccessAddressVerification: false, // Finance cannot access security features
        canAccessInventory: true,
        canAccessOutlets: true,
        canAccessProducts: true,
        canAccessStockTransfer: true,
        canAccessLocations: true,
        canAccessSuppliers: true,
        canAccessSupplierAnalytics: true,
        canAccessPurchaseOrders: true,
        canAccessReceiving: true,
        canAccessStockAudit: true,
        canAccessVarianceManagement: true,
        canAccessPackaging: true,
        canViewStockMovements: true,
        canAccessFraudReporting: false, // Finance cannot access security features
        canAccessSettings: true,
        // Explicitly denied - no management/editing capabilities
        canAccessUserManagement: false,
        canAccessActivityLogs: false,
        canAccessBusinessSettings: false,
        canAddUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canManageOutlets: false,
        canManageProducts: false,
        canCreateStockTransfer: false,
        canManageSuppliers: false,
        canManagePackaging: false,
        canAdjustPackagingStock: false,
        canBulkAdjustStock: false,
        canAccessPOS: false,
        canAssignCouriers: false,
      };
    
    default:
      return permissions;
  }
};

export const getNavigationItems = (role: UserRole): NavigationItem[] => {
  const permissions = getRolePermissions(role);
  const items: NavigationItem[] = [];

  // 1. DASHBOARD - First item, always visible
  if (permissions.canAccessDashboard) {
    items.push({
      label: 'Dashboard',
      href: '/',
      icon: 'Home'
    });
  }

  // 2. ORDERS - Core business operations
  if (permissions.canAccessOrders) {
    const orderSubItems = [
      { label: 'All Orders', href: '/orders', icon: '' },
      { label: 'Shipper Advice', href: '/shipper-advice', icon: '' }
    ];
    
    // Add Stuck Orders for managers
    if (['super_admin', 'super_manager', 'warehouse_manager', 'finance'].includes(role)) {
      orderSubItems.splice(1, 0, { label: 'Stuck Orders', href: '/stuck-orders', icon: '' });
    }
    
    items.push({
      label: 'Orders',
      href: '/orders',
      icon: 'Package',
      subItems: orderSubItems
    });
  }

  // 3. POINT OF SALE - Direct sales operations
  if (permissions.canAccessPOS) {
    items.push({
      label: 'Point of Sale',
      href: '/pos',
      icon: 'Activity'
    });
  }

  // 4. DISPATCH - Fulfillment operations
  if (permissions.canAccessDispatch) {
    items.push({
      label: 'Dispatch',
      href: '/dispatch',
      icon: 'Truck'
    });
  }

  // 5. RETURNS - Customer returns management
  if (permissions.canAccessReturns) {
    items.push({
      label: 'Returns',
      href: '/returns',
      icon: 'RotateCcw',
      subItems: [
        { label: 'All Returns', href: '/returns', icon: '' },
        { label: 'Returns Not Received', href: '/returns-not-received', icon: '' }
      ]
    });
  }

  // 6. INVENTORY - Stock management
  if (permissions.canAccessInventory || permissions.canAccessProducts || permissions.canAccessStockTransfer) {
    const inventorySubItems: NavigationItem[] = [];
    
    if (permissions.canAccessInventory) {
      inventorySubItems.push({ label: 'Overview', href: '/inventory', icon: '' });
      // Automation History only visible to super_admin
      if (role === 'super_admin') {
        inventorySubItems.push({ label: 'Automation History', href: '/automation-history', icon: '' });
      }
    }
    if (permissions.canAccessProducts) {
      inventorySubItems.push({ label: 'Products', href: '/products', icon: '' });
    }
    if (permissions.canAccessPackaging) {
      inventorySubItems.push({ label: 'Packaging', href: '/packaging', icon: '' });
    }
    if (permissions.canAccessStockTransfer) {
      inventorySubItems.push({ label: 'Stock Transfers', href: '/stock-transfer', icon: '' });
    }
    if (permissions.canViewStockMovements) {
      inventorySubItems.push({ label: 'Stock Movements', href: '/stock-movement-history', icon: '' });
    }
    
    // Store managers see only their outlet inventory
    if (role === 'store_manager') {
      inventorySubItems.unshift({ label: 'My Outlet', href: '/outlet-inventory', icon: '' });
    }

    items.push({
      label: 'Inventory',
      href: '/inventory',
      icon: 'Box',
      subItems: inventorySubItems
    });
  }

  // 7. PROCUREMENT - Supplier & purchasing operations
  if (permissions.canAccessSuppliers || permissions.canAccessPurchaseOrders || permissions.canAccessReceiving || permissions.canAccessStockAudit || permissions.canAccessVarianceManagement) {
    const procurementSubItems: NavigationItem[] = [];
    
    if (permissions.canAccessSuppliers) {
      procurementSubItems.push({ label: 'Suppliers', href: '/suppliers', icon: '' });
    }
    if (permissions.canAccessSupplierAnalytics) {
      procurementSubItems.push({ label: 'Supplier Analytics', href: '/supplier-analytics', icon: '' });
    }
    if (permissions.canAccessPurchaseOrders) {
      procurementSubItems.push({ label: 'Purchase Orders', href: '/purchase-orders', icon: '' });
    }
    if (permissions.canAccessReceiving) {
      procurementSubItems.push({ label: 'Receiving', href: '/receiving', icon: '' });
    }
    if (permissions.canAccessStockAudit) {
      procurementSubItems.push({ label: 'Stock Audit', href: '/stock-audit', icon: '' });
    }
    if (permissions.canAccessVarianceManagement) {
      procurementSubItems.push({ label: 'Variance Management', href: '/variance-management', icon: '' });
    }

    items.push({
      label: 'Procurement',
      href: '/suppliers',
      icon: 'Warehouse',
      subItems: procurementSubItems
    });
  }

  // 8. SUPPLIER PORTAL - For supplier users only
  if (permissions.canAccessSupplierPortal) {
    items.push({
      label: 'Supplier Portal',
      href: '/supplier-portal',
      icon: 'Package'
    });
  }

  // 9. CUSTOMERS - Customer management
  if (permissions.canAccessCustomers) {
    items.push({
      label: 'Customers',
      href: '/customers',
      icon: 'Users',
      subItems: [
        { label: 'All Customers', href: '/all-customers', icon: '' },
        { label: 'Suspicious Customers', href: '/suspicious-customers', icon: '' }
      ]
    });
  }

  // 10. FRAUD PREVENTION - Security features
  if (permissions.canAccessFraudReporting) {
    const fraudSubItems: NavigationItem[] = [];
    
    fraudSubItems.push({ label: 'Fraud Reports', href: '/fraud-reporting', icon: '' });
    
    if (permissions.canAccessAddressVerification) {
      fraudSubItems.push({ label: 'Address Verification', href: '/address-verification', icon: '' });
    }

    items.push({
      label: 'Security',
      href: '/fraud-reporting',
      icon: 'Shield',
      subItems: fraudSubItems
    });
  } else if (permissions.canAccessAddressVerification) {
    // If no fraud reporting but has address verification
    items.push({
      label: 'Address Verification',
      href: '/address-verification',
      icon: 'MapPin'
    });
  }

  // 11. LOCATIONS - Location/outlet management
  if (permissions.canAccessOutlets || permissions.canAccessLocations) {
    const locationSubItems: NavigationItem[] = [];
    
    if (permissions.canAccessOutlets) {
      locationSubItems.push({ label: 'Outlets/Warehouses', href: '/outlets', icon: '' });
    }
    if (permissions.canAccessLocations) {
      locationSubItems.push({ label: 'Service Locations', href: '/locations', icon: '' });
    }

    items.push({
      label: 'Locations',
      href: '/outlets',
      icon: 'Building2',
      subItems: locationSubItems
    });
  }

  // 12. USER MANAGEMENT - Admin features
  if (permissions.canAccessUserManagement) {
    items.push({
      label: 'User Management',
      href: '/user-management',
      icon: 'Users'
    });
  }

  // 13. ACTIVITY LOGS - Audit trail
  if (permissions.canAccessActivityLogs) {
    items.push({
      label: 'Activity Logs',
      href: '/activity-logs',
      icon: 'Activity'
    });
  }

  // 14. SETTINGS - Configuration (always at bottom)
  if (permissions.canAccessSettings || permissions.canAccessBusinessSettings) {
    const settingsSubItems: NavigationItem[] = [];
    
    if (permissions.canAccessSettings) {
      settingsSubItems.push({ label: 'User Settings', href: '/settings', icon: '' });
    }
    if (permissions.canAccessBusinessSettings) {
      settingsSubItems.push({ label: 'Business Settings', href: '/business-settings', icon: '' });
    }

    items.push({
      label: 'Settings',
      href: '/settings',
      icon: 'Settings',
      subItems: settingsSubItems
    });
  }

  return items;
};
