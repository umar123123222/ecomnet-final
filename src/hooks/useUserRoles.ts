import { useAuth } from '@/contexts/AuthContext';
import { getRolePermissions } from '@/utils/rolePermissions';
import { UserRole } from '@/types/auth';

/**
 * Custom hook to access user roles and permissions
 * Provides easy access to user's roles and permission checks
 */
export const useUserRoles = () => {
  const { profile, userRoles } = useAuth();

  // Get user's primary role - prefer owner > store_manager > others
  const primaryRole: UserRole = userRoles.includes('owner' as any)
    ? 'owner'
    : userRoles.includes('store_manager' as any)
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
   * Check if user is admin (owner or SuperAdmin)
   */
  const isAdmin = (): boolean => {
    return hasAnyRole(['owner', 'SuperAdmin']);
  };

  /**
   * Check if user is manager (store_manager, Manager, or admin)
   */
  const isManager = (): boolean => {
    return hasAnyRole(['owner', 'SuperAdmin', 'store_manager', 'Manager']);
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
  };
};
