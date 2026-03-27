import { useAppStore } from '../store';

/**
 * Hook to check user permissions
 * 
 * Usage:
 *   const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = usePermissions();
 *   
 *   if (hasPermission('users.create')) {
 *     // Show create user button
 *   }
 */
export const usePermissions = () => {
  const { user } = useAppStore();

  /**
   * Check if user is admin (admins have all permissions)
   */
  const isAdmin = (): boolean => {
    // Handle both boolean and number (1/0) from database using truthy check
    // Only true admins bypass permission checks — staff use assigned permissions
    return !!user?.is_admin;
  };

  /**
   * Check if user is strictly an admin (not staff)
   */
  const isStrictAdmin = (): boolean => {
    return !!user?.is_admin;
  };

  /**
   * Check if user is staff
   */
  const isStaff = (): boolean => {
    return !!user?.is_staff;
  };

  /**
   * Check if user has a specific permission by slug
   */
  const hasPermission = (permissionSlug: string): boolean => {
    // Admins have all permissions
    if (isAdmin()) return true;
    
    // Check if user has the permission
    return user?.permissions?.some(p => p.slug === permissionSlug) || false;
  };

  /**
   * Check if user has ANY of the specified permissions
   */
  const hasAnyPermission = (permissionSlugs: string[]): boolean => {
    // Admins have all permissions
    if (isAdmin()) return true;
    
    // Check if user has at least one permission
    return permissionSlugs.some(slug => hasPermission(slug));
  };

  /**
   * Check if user has ALL of the specified permissions
   */
  const hasAllPermissions = (permissionSlugs: string[]): boolean => {
    // Admins have all permissions
    if (isAdmin()) return true;
    
    // Check if user has all permissions
    return permissionSlugs.every(slug => hasPermission(slug));
  };

  /**
   * Get all user permission slugs
   */
  const getPermissions = (): string[] => {
    return user?.permissions?.map(p => p.slug) || [];
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isStrictAdmin,
    isStaff,
    getPermissions,
    permissions: user?.permissions || [],
  };
};
