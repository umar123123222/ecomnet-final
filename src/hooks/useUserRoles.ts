import { useAuth } from '@/contexts/AuthContext';
import { getRolePermissions } from '@/utils/rolePermissions';
import { UserRole } from '@/types/auth';

/**
 * Custom hook to access user roles and permissions
 * Provides easy access to user's roles and permission checks
 */
export const useUserRoles = () => {
  const { profile, userRoles } = useAuth();

  // Get user's primary role - prefer super_admin > super_manager > store_manager > others
  const primaryRole: UserRole = userRoles.includes('super_admin')
    ? 'super_admin'
    : userRoles.includes('super_manager')
    ? 'super_manager'
    : userRoles.includes('store_manager')
    ? 'store_manager'
    : (userRoles[0] || profile?.role || 'staff');

  const permissions = getRolePermissions(primaryRole);

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: UserRole): boolean => {
    return userRoles.includes(role) || profile?.role === role;
  };

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  /**
   * Check if user has all of the specified roles
   */
  const hasAllRoles = (roles: UserRole[]): boolean => {
    return roles.every(role => hasRole(role));
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
   * Check if user is senior staff (warehouse_manager or above)
   */
  const isSeniorStaff = (): boolean => {
    return hasAnyRole(['super_admin', 'super_manager', 'store_manager', 'warehouse_manager']);
  };

  return {
    primaryRole,
    userRoles,
    permissions,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isAdmin,
    isManager,
    isSeniorStaff,
  };
};
