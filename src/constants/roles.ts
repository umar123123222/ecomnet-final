/**
 * User Role Constants
 */

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  SUPER_MANAGER: 'super_manager',
  STORE_MANAGER: 'store_manager',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  DISPATCH_MANAGER: 'dispatch_manager',
  RETURNS_MANAGER: 'returns_manager',
  STAFF: 'staff',
  SENIOR_STAFF: 'senior_staff',
  FINANCE: 'finance',
  SUPPLIER: 'supplier',
} as const;

export type UserRoleType = typeof USER_ROLES[keyof typeof USER_ROLES];

export const USER_ROLE_LIST: UserRoleType[] = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SUPER_MANAGER,
  USER_ROLES.STORE_MANAGER,
  USER_ROLES.WAREHOUSE_MANAGER,
  USER_ROLES.DISPATCH_MANAGER,
  USER_ROLES.RETURNS_MANAGER,
  USER_ROLES.STAFF,
  USER_ROLES.SENIOR_STAFF,
  USER_ROLES.FINANCE,
  USER_ROLES.SUPPLIER,
];

// Role labels for display
export const USER_ROLE_LABELS: Record<UserRoleType, string> = {
  [USER_ROLES.SUPER_ADMIN]: 'Super Admin',
  [USER_ROLES.SUPER_MANAGER]: 'Super Manager',
  [USER_ROLES.STORE_MANAGER]: 'Store Manager',
  [USER_ROLES.WAREHOUSE_MANAGER]: 'Warehouse Manager',
  [USER_ROLES.DISPATCH_MANAGER]: 'Dispatch Manager',
  [USER_ROLES.RETURNS_MANAGER]: 'Returns Manager',
  [USER_ROLES.STAFF]: 'Staff',
  [USER_ROLES.SENIOR_STAFF]: 'Senior Staff',
  [USER_ROLES.FINANCE]: 'Finance',
  [USER_ROLES.SUPPLIER]: 'Supplier',
};

// Roles with outlet scope (only see their assigned outlet)
export const OUTLET_SCOPED_ROLES: UserRoleType[] = [
  USER_ROLES.STORE_MANAGER,
  USER_ROLES.WAREHOUSE_MANAGER,
];

// Roles that can manage users
export const USER_MANAGEMENT_ROLES: UserRoleType[] = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SUPER_MANAGER,
];

// Roles that can access admin features
export const ADMIN_ROLES: UserRoleType[] = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SUPER_MANAGER,
];

// Roles that can manage financial data
export const FINANCE_ROLES: UserRoleType[] = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SUPER_MANAGER,
  USER_ROLES.FINANCE,
];

// Roles that can assign couriers
export const COURIER_ASSIGN_ROLES: UserRoleType[] = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SUPER_MANAGER,
  USER_ROLES.WAREHOUSE_MANAGER,
];
