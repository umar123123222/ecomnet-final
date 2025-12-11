import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading, profile, userRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    // Redirect unauthenticated users to dedicated auth route
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Redirect suppliers to supplier portal (unless already there)
  if (userRole === 'supplier' && location.pathname !== '/supplier-portal') {
    return <Navigate to="/supplier-portal" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
