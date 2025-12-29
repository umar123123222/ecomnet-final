import { useAuth } from '@/contexts/AuthContext';
import { getRolePermissions } from '@/utils/rolePermissions';
import { UserRole } from '@/types/auth';

/**
 * Custom hook to access user roles and permissions
 * Now handles single role per user
 */
export const useUserRoles = () => {
  const { profile, userRole } = useAuth();

  // primaryRole is now just the userRole
  const primaryRole: UserRole = userRole || profile?.role || 'staff';

  const permissions = getRolePermissions(primaryRole);

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: UserRole): boolean => {
    return primaryRole === role;
  };

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.includes(primaryRole);
  };

  /**
   * Check if user has all of the specified roles (simplified for single role)
   */
  const hasAllRoles = (roles: UserRole[]): boolean => {
    return roles.length === 1 && roles[0] === primaryRole;
  };

  /**
   * Check if user is admin (super_admin only)
   */
  const isAdmin = (): boolean => {
    return hasRole('super_admin');
  };

  /**
   * Check if user is manager (super_admin, super_manager, or store_manager)
   */
  const isManager = (): boolean => {
    return hasAnyRole(['super_admin', 'super_manager', 'store_manager']);
  };

  /**
   * Check if user is senior staff (warehouse_manager or above, or senior_staff)
   */
  const isSeniorStaff = (): boolean => {
    return hasAnyRole(['super_admin', 'super_manager', 'store_manager', 'warehouse_manager', 'senior_staff']);
  };
  
  /**
   * Check if user can set delivered status with date picker
   * Only super_admin, super_manager, and senior_staff can do this
   */
  const canSetDeliveredStatus = (): boolean => {
    return hasAnyRole(['super_admin', 'super_manager', 'senior_staff']);
  };

  return {
    primaryRole,
    userRole: primaryRole, // For backward compatibility
    permissions,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isAdmin,
    isManager,
    isSeniorStaff,
    canSetDeliveredStatus,
  };
};
