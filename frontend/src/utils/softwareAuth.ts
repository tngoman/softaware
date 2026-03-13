/**
 * Per-software authentication token management.
 *
 * ⚠️  DEPRECATED (v2.1.0) — The backend no longer requires per-user
 *    software tokens for task operations.  Task API calls now use
 *    source-level API keys resolved server-side from `task_sources`.
 *    This module is retained only for the legacy SoftwareManagement
 *    auth flow and will be removed in a future release.
 *
 * Tokens are stored in localStorage keyed by software ID so that
 * switching between software products uses the correct auth token.
 *
 *   Key pattern: `software_token_${softwareId}`
 */

export function getSoftwareToken(softwareId: number | undefined | null): string {
  if (!softwareId) return '';
  return localStorage.getItem(`software_token_${softwareId}`) || '';
}

export function setSoftwareToken(softwareId: number, token: string): void {
  localStorage.setItem(`software_token_${softwareId}`, token);
}

export function removeSoftwareToken(softwareId: number): void {
  localStorage.removeItem(`software_token_${softwareId}`);
}

export function hasSoftwareToken(softwareId: number | undefined | null): boolean {
  if (!softwareId) return false;
  return !!localStorage.getItem(`software_token_${softwareId}`);
}

/** Build headers object for proxied software API calls */
export function softwareAuthHeaders(softwareId: number | undefined | null): Record<string, string> {
  const token = getSoftwareToken(softwareId);
  return token ? { 'X-Software-Token': token } : {};
}
