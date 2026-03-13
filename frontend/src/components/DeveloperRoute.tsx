import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store';
import ProtectedRoute from './ProtectedRoute';

interface DeveloperRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that restricts access to users with the developer,
 * admin, or super_admin role.
 */
const DeveloperRoute: React.FC<DeveloperRouteProps> = ({ children }) => {
  const { user } = useAppStore();

  const hasDeveloperAccess = (): boolean => {
    if (!user) return false;
    // Admins always have access
    if (user.is_admin) return true;
    // Staff developers have access (check both role shapes)
    if (user.role?.slug === 'developer') return true;
    if (user.roles?.some(r => r.slug === 'developer')) return true;
    return false;
  };

  return (
    <ProtectedRoute>
      {hasDeveloperAccess() ? <>{children}</> : <Navigate to="/" replace />}
    </ProtectedRoute>
  );
};

export default DeveloperRoute;
