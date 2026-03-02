import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

interface CanProps {
  children: React.ReactNode;
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  requireAdmin?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Can - Conditionally render content based on permissions
 * 
 * Usage:
 *   <Can permission="users.create">
 *     <button>Create User</button>
 *   </Can>
 * 
 *   <Can anyPermission={["users.edit", "users.delete"]}>
 *     <EditButton />
 *   </Can>
 * 
 *   <Can requireAdmin={true}>
 *     <AdminPanel />
 *   </Can>
 * 
 *   <Can permission="users.view" fallback={<div>Access Denied</div>}>
 *     <UserList />
 *   </Can>
 */
const Can: React.FC<CanProps> = ({ 
  children, 
  permission, 
  anyPermission, 
  allPermissions,
  requireAdmin = false,
  fallback = null
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = usePermissions();

  // Check admin requirement
  if (requireAdmin && !isAdmin()) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check any permission (OR logic)
  if (anyPermission && !hasAnyPermission(anyPermission)) {
    return <>{fallback}</>;
  }

  // Check all permissions (AND logic)
  if (allPermissions && !hasAllPermissions(allPermissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default Can;
