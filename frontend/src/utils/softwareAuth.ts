/**
 * Per-software authentication token management.
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
