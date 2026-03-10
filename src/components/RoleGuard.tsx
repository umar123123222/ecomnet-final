import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRoles } from '@/hooks/useUserRoles';

interface RoleGuardProps {
  children: React.ReactNode;
  permissionKey: string;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, permissionKey }) => {
  const { permissions } = useUserRoles();

  const hasAccess = (permissions as Record<string, boolean>)[permissionKey];

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
