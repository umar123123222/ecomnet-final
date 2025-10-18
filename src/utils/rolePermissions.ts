
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
    canAccessProducts: false,
    canAccessStockTransfer: false,
    canAccessLocations: false,
    canAccessActivityLogs: false,
    canAccessSuppliers: false,
    canAccessSupplierAnalytics: false,
    canAccessPurchaseOrders: false,
    canAccessReceiving: false,
    canAccessStockAudit: false,
    canAccessVarianceManagement: false,
    canAccessFraudReporting: false,
    canAccessSupplierPortal: false,
    canAccessPackaging: false,
    canAccessPOS: false,
    canAccessScanHistory: false,
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
        canAccessProducts: true,
        canAccessStockTransfer: true,
        canAccessLocations: true,
        canAccessActivityLogs: true,
        canAccessSuppliers: true,
        canAccessSupplierAnalytics: true,
        canAccessPurchaseOrders: true,
        canAccessReceiving: true,
        canAccessStockAudit: true,
        canAccessVarianceManagement: true,
        canAccessFraudReporting: true,
        canAccessPackaging: true,
        canAccessPOS: true,
        canAccessScanHistory: true,
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
        canAccessActivityLogs: false, // Only super_admin for audit trail integrity
        canAccessSuppliers: true,
        canAccessSupplierAnalytics: true,
        canAccessPurchaseOrders: true,
        canAccessReceiving: true,
        canAccessStockAudit: true,
        canAccessVarianceManagement: true,
        canAccessFraudReporting: true,
        canAccessPackaging: true,
        canAccessPOS: true,
        canAccessScanHistory: true,
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
        canAccessSettings: true,
        canAccessSuppliers: true,
        canAccessSupplierAnalytics: true,
        canAccessPurchaseOrders: true,
        canAccessReceiving: true,
        canAccessStockAudit: true,
        canAccessVarianceManagement: true,
        canAccessFraudReporting: true,
        canAccessPOS: true,
        canAccessScanHistory: true,
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
        canAccessSettings: true,
        canAccessSuppliers: true,
        canAccessSupplierAnalytics: true,
        canAccessPurchaseOrders: true,
        canAccessReceiving: true,
        canAccessStockAudit: true,
        canAccessVarianceManagement: true,
        canAccessPackaging: true,
        canAccessScanHistory: true,
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
    
    // Add Confirmations for managers
    if (['super_admin', 'super_manager', 'warehouse_manager'].includes(role)) {
      orderSubItems.splice(1, 0, { label: 'Confirmations', href: '/confirmations', icon: '' });
    }
    
    items.push({
      label: 'Orders',
      href: '/orders',
      icon: 'Package',
      subItems: orderSubItems
    });
  }

  // 3. POINT OF SALE - Direct sales operations
  if (permissions.canAccessPOS || permissions.canAccessScanHistory) {
    const posSubItems: NavigationItem[] = [];
    
    if (permissions.canAccessPOS) {
      posSubItems.push({ label: 'Point of Sale', href: '/pos', icon: '' });
    }
    if (permissions.canAccessScanHistory) {
      posSubItems.push({ label: 'Scan History', href: '/scan-history', icon: '' });
    }

    items.push({
      label: 'Point of Sale',
      href: '/pos',
      icon: 'Activity',
      subItems: posSubItems
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
      badge: '12',
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

    items.push({
      label: 'Inventory',
      href: '/inventory',
      icon: 'Box',
      subItems: inventorySubItems
    });
  }

  // 6.5 PRODUCTION - Manufacturing & barcode printing
  if (['super_admin', 'super_manager', 'warehouse_manager', 'store_manager'].includes(role)) {
    items.push({
      label: 'Production',
      href: '/production',
      icon: 'Factory',
      subItems: [
        { label: 'Production Batches', href: '/production', icon: '' },
        { label: 'Bill of Materials', href: '/production/bom', icon: '' },
        { label: 'Print Labels', href: '/production/labels', icon: '' }
      ]
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
        { label: 'Suspicious Customers', href: '/suspicious-customers', icon: '', badge: '5' }
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
