import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import ProtectedRoute from './ProtectedRoute';

interface PermissionRouteProps {
  children: React.ReactNode;
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  requireAdmin?: boolean;
}

/**
 * PermissionRoute - Protects routes based on permissions
 * 
 * Usage:
 *   <PermissionRoute permission="users.create">
 *     <CreateUserPage />
 *   </PermissionRoute>
 *
 *   <PermissionRoute anyPermission={["users.view", "users.edit"]}>
 *     <UsersPage />
 *   </PermissionRoute>
 *
 *   <PermissionRoute requireAdmin={true}>
 *     <AdminDashboard />
 *   </PermissionRoute>
 */
const PermissionRoute: React.FC<PermissionRouteProps> = ({ 
  children, 
  permission, 
  anyPermission, 
  allPermissions,
  requireAdmin = false 
}) => {
  const { user } = useAppStore();
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = usePermissions();

  return (
    <ProtectedRoute>
      {/* Not active user */}
      {user && !user.is_active ? (
        <Navigate to="/login" replace />
      ) : requireAdmin && !isAdmin() ? (
        <Navigate to="/" replace />
      ) : permission && !hasPermission(permission) ? (
        <Navigate to="/" replace />
      ) : anyPermission && !hasAnyPermission(anyPermission) ? (
        <Navigate to="/" replace />
      ) : allPermissions && !hasAllPermissions(allPermissions) ? (
        <Navigate to="/" replace />
      ) : (
        <>{children}</>
      )}
    </ProtectedRoute>
  );
};

export default PermissionRoute;