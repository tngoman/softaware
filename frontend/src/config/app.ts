/**
 * Application Configuration
 * Handles environment-specific settings and API base URL detection
 */

// Default configurations for different environments
const config = {
  // Local development — backend runs on port 8787
  local: {
    apiBaseUrl: 'http://localhost:8787/api',
    environment: 'development'
  },
  
  // Production — api.softaware.net.za
  production: {
    apiBaseUrl: 'https://api.softaware.net.za/api',
    environment: 'production'
  }
};

/**
 * Detect if running in local development environment
 */
function isLocalEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Check for local development indicators
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('.local')
  );
}

/**
 * Detect if running on the server's public IP (dev access via IP:3003)
 */
function isDirectIpAccess(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  // Matches any raw IP address (not a domain name)
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

/**
 * Get the current environment configuration
 */
function getEnvironmentConfig() {
  if (isLocalEnvironment()) {
    return config.local;
  }
  
  // Accessing via raw IP (e.g. 75.119.141.98:3003) — use same IP with backend port
  if (isDirectIpAccess()) {
    return {
      apiBaseUrl: `http://${window.location.hostname}:8787/api`,
      environment: 'development'
    };
  }
  
  return config.production;
}

/**
 * Get the API base URL for the current environment
 */
export function getApiBaseUrl(): string {
  // Skip localStorage override for direct-IP or local dev access
  // (stale settings may contain localhost:8787 from a different origin)
  if (!isLocalEnvironment() && !isDirectIpAccess()) {
    try {
      const appSettings = localStorage.getItem('app_settings');
      if (appSettings) {
        const settings = JSON.parse(appSettings);
        if (settings.site_base_url) {
          return settings.site_base_url;
        }
      }
    } catch (error) {
      console.warn('Failed to load app settings from localStorage:', error);
    }
  }
  
  // Fall back to environment detection
  const envConfig = getEnvironmentConfig();
  return envConfig.apiBaseUrl;
}

/**
 * Get the base URL for documents and assets (without /api suffix)
 */
export function getBaseUrl(): string {
  const apiUrl = getApiBaseUrl();
  // Use regex with $ anchor — plain .replace('/api', '') matches the '/api'
  // inside '://api.softaware.net.za' instead of the trailing '/api' path.
  return apiUrl.replace(/\/api$/, '');
}

/**
 * Get a full asset URL for documents, images, etc.
 */
export function getAssetUrl(path: string): string {
  const baseUrl = getBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Get the full configuration for the current environment
 */
export function getConfig() {
  return {
    ...getEnvironmentConfig(),
    apiBaseUrl: getApiBaseUrl()
  };
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return isLocalEnvironment();
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return !isLocalEnvironment();
}

// Export the current config
export const appConfig = getConfig();

export default appConfig;