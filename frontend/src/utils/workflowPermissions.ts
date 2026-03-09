/**
 * Workflow permission utilities
 * Determines who can assign tasks based on workflow phase and user role
 */

import { Task } from '../types';

// View As Role - Local storage key
const VIEW_AS_ROLE_KEY = 'softaware_view_as_role';

/**
 * Get the view-as role from localStorage
 */
export function getViewAsRole(): string | null {
  return localStorage.getItem(VIEW_AS_ROLE_KEY);
}

/**
 * Set the view-as role in localStorage
 */
export function setViewAsRole(roleSlug: string | null): void {
  if (roleSlug) {
    localStorage.setItem(VIEW_AS_ROLE_KEY, roleSlug);
  } else {
    localStorage.removeItem(VIEW_AS_ROLE_KEY);
  }
}

/**
 * Get the effective role for a user (view-as role overrides actual role for staff)
 */
export function getEffectiveRole(user: any): string {
  // Staff users can override their role with view-as
  if (user?.is_staff || user?.is_admin) {
    const viewAsRole = getViewAsRole();
    if (viewAsRole) {
      return viewAsRole;
    }
  }
  
  // Return actual role
  if (user?.roles?.[0]?.slug) return user.roles[0].slug;
  if (user?.role?.slug) return user.role.slug;
  if (user?.role_name) return user.role_name.toLowerCase();
  return '';
}

// Map workflow phases to the roles that can assign FROM that phase
const PHASE_ROLE_MAP: Record<string, string> = {
  intake: 'client_manager',
  quality_review: 'qa_specialist',
  triage: 'qa_specialist',
  development: 'developer',
  verification: 'qa_specialist',
  resolution: 'qa_specialist',
};

// Map workflow phases to their order (for detecting backward assignment)
const PHASE_ORDER: Record<string, number> = {
  intake: 1,
  quality_review: 2,
  triage: 2,
  development: 3,
  verification: 4,
  resolution: 5,
};

/**
 * Check if a user has a specific role (considers view-as role for staff)
 */
function userHasRole(user: any, ...roleNames: string[]): boolean {
  if (!user) return false;
  
  // Use effective role (includes view-as for staff)
  const effectiveRole = getEffectiveRole(user);
  if (effectiveRole && roleNames.some(role => role.toLowerCase() === effectiveRole.toLowerCase())) {
    return true;
  }
  
  return false;
}

/**
 * Check if a user can assign a task from its current phase
 */
export function canUserAssignTask(user: any | null, task: Task | null): boolean {
  if (!user || !task) return false;

  const taskPhase = task.workflow_phase?.toLowerCase() || 'intake';
  const viewAsRole = getViewAsRole();

  // If a view-as role is active, use ONLY the effective role — no admin bypass.
  // This lets staff/admins experience the app exactly as the chosen role would.
  const effectiveRole = getEffectiveRole(user).toLowerCase();

  if (!viewAsRole) {
    // No view-as override → real admin can always assign
    if (user.is_admin === true) {
      return true;
    }
    if (effectiveRole === 'admin' || effectiveRole === 'super_admin') {
      return true;
    }
  }

  // Any developer can action tasks in development phase, regardless of assignment
  if (taskPhase === 'development' && effectiveRole === 'developer') {
    return true;
  }

  // User's role must match the phase owner role
  const requiredRole = PHASE_ROLE_MAP[taskPhase];
  return effectiveRole === requiredRole;
}

/**
 * Get the role required to assign from a specific phase
 */
export function getRequiredRoleForPhase(phase: string | null | undefined): string {
  const normalizedPhase = phase?.toLowerCase() || 'intake';
  return PHASE_ROLE_MAP[normalizedPhase] || 'client_manager';
}

/**
 * Get a user-friendly label for a role
 */
export function getRoleLabel(role: string | undefined): string {
  const labels: Record<string, string> = {
    client_manager: 'Client Manager',
    qa_specialist: 'QA Specialist',
    developer: 'Developer',
    admin: 'Admin',
    super_admin: 'Super Admin',
    deployer: 'Deployer',
    viewer: 'Viewer',
  };
  return labels[role?.toLowerCase() || ''] || role || 'Unknown';
}

/**
 * Check if an assignment is backward in the workflow
 * (e.g., Development → QA Review, QA Review → Intake)
 */
export function isBackwardAssignment(
  fromPhase: string | null | undefined,
  toPhase: string | null | undefined
): boolean {
  const from = fromPhase?.toLowerCase() || 'intake';
  const to = toPhase?.toLowerCase() || 'intake';
  
  const fromOrder = PHASE_ORDER[from] || 1;
  const toOrder = PHASE_ORDER[to] || 1;
  
  return toOrder < fromOrder;
}

/**
 * Get permission error message
 */
export function getPermissionErrorMessage(user: any | null, task: Task | null): string {
  if (!task) return 'Task not found';
  if (!user) return 'User not authenticated';
  
  const requiredRole = getRequiredRoleForPhase(task.workflow_phase);
  const roleLabel = getRoleLabel(requiredRole);
  const phaseLabel = task.workflow_phase || 'Intake';
  const effectiveRole = getEffectiveRole(user);
  const viewAsActive = getViewAsRole();
  
  let message = `You must be a ${roleLabel} to assign tasks from ${phaseLabel} phase. Contact an admin to change your role.`;
  if (viewAsActive && (user?.is_staff || user?.is_admin)) {
    message += ` (Currently viewing as: ${getRoleLabel(effectiveRole)})`;
  }
  
  return message;
}
