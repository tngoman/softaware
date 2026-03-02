import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';

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
  const { isAuthenticated, user } = useAppStore();
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = usePermissions();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Not active user
  if (!user?.is_active) {
    return <Navigate to="/login" replace />;
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  // Check any permission (OR logic)
  if (anyPermission && !hasAnyPermission(anyPermission)) {
    return <Navigate to="/" replace />;
  }

  // Check all permissions (AND logic)
  if (allPermissions && !hasAllPermissions(allPermissions)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default PermissionRoute;
