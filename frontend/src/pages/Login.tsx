import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthModel } from '../models';
import AppSettingsModel from '../models/AppSettingsModel';
import { useAppStore } from '../store';
import { getApiBaseUrl, getAssetUrl } from '../config/app';
import Swal from 'sweetalert2';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated, isAuthenticated } = useAppStore();
  const [siteLogo, setSiteLogo] = useState('');
  const [siteName, setSiteName] = useState('SoftAware Billing');
  const [siteDescription, setSiteDescription] = useState('Sign in to continue.');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    try {
      const cachedBranding = localStorage.getItem('app_branding');
      if (cachedBranding) {
        const { logoUrl, name, description } = JSON.parse(cachedBranding);
        if (logoUrl) {
          setSiteLogo(logoUrl);
        }
        if (name) {
          setSiteName(name);
        }
        if (description) {
          setSiteDescription(description);
        }
      }
    } catch (error) {
      console.warn('Failed to load cached branding:', error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      return;
    }

    const loadSettings = async () => {
      try {
        const settings = await AppSettingsModel.get();
        const baseUrl = settings.site_base_url || getApiBaseUrl();

        if (settings.site_logo) {
          setSiteLogo(getAssetUrl(`/assets/images/${settings.site_logo}`));
        }

        if (settings.site_name) {
          setSiteName(settings.site_name);
        }

        if (settings.site_description) {
          setSiteDescription(settings.site_description);
        }

        if (settings.site_title || settings.site_name) {
          document.title = settings.site_title || settings.site_name;
        }
      } catch (error) {
        console.error('Failed to load application settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please enter both email and password'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await AuthModel.login(email, password);
      
      if (response.success) {
        // API returns nested data: response.data contains token and user
        const { token, user } = response.data;
        
        // Store token first so subsequent API calls are authenticated
        AuthModel.storeAuth(token, user);
        
        // Fetch user permissions (now that token is stored)
        try {
          const permissions = await AuthModel.getUserPermissions();
          user.permissions = permissions;
          console.log('Loaded permissions:', permissions);
        } catch (permError) {
          console.warn('Failed to fetch permissions:', permError);
          user.permissions = [];
        }
        
        // Update localStorage with user including permissions
        AuthModel.storeAuth(token, user);
        
        // Update store - this triggers UI re-render
        setUser(user);
        setIsAuthenticated(true);
        
        // Small delay to ensure state propagates before navigation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
          <div className="bg-white px-8 py-8 flex flex-col items-center gap-3 border-b border-slate-200">
            <div className="h-16 flex items-center justify-center">
              <img
                src={siteLogo || '/images/logo_small.png'}
                alt={siteName}
                className="max-h-16 w-auto object-contain"
                onError={(event) => {
                  console.error('Logo failed to load:', siteLogo);
                  (event.target as HTMLImageElement).style.display = 'none';
                  const fallback = (event.target as HTMLImageElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            </div>
            <div className="hidden items-center justify-center h-12 w-12 rounded-full bg-slate-100 border border-slate-200">
              <span className="text-xl font-semibold text-gray-700">{siteName.charAt(0)}</span>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm">
                {siteDescription || 'Sign in to continue.'}
              </p>
            </div>
          </div>

          <div className="px-8 py-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all"
                  placeholder="billing@softaware.co.za"
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all"
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-picton-blue focus:ring-picton-blue border-slate-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                <a href="/forgot-password" className="text-sm font-medium text-picton-blue hover:text-picton-blue/80">
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500">
          © {new Date().getFullYear()} {siteName}.
        </p>
      </div>
    </div>
  );
};

export default Login;
