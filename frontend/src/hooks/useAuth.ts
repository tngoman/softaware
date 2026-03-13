import { useEffect } from 'react';
import { useAppStore } from '../store';
import { AuthModel } from '../models';

export const useAuth = () => {
  const { setUser, setIsAuthenticated } = useAppStore();

  useEffect(() => {
    const initAuth = async () => {
      const token = AuthModel.getToken();
      
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      // Token exists in localStorage — mark authenticated immediately
      // so ProtectedRoute doesn't flash a spinner or redirect.
      setIsAuthenticated(true);
      
      try {
        const data = await AuthModel.me();
        const user = data.user;
        
        // Refresh localStorage + store with the latest user data
        AuthModel.storeAuth(token, user);
        setUser(user);
      } catch (error) {
        // If the 401 interceptor already called forceLogout(), the token
        // will have been removed from localStorage and a hard redirect to
        // /login is already in progress — propagate that to Zustand.
        //
        // For any OTHER failure (500, network timeout, transient error),
        // the token is still in localStorage and perfectly usable, so
        // keep the cached session instead of logging the user out.
        const tokenStillExists = !!AuthModel.getToken();
        if (!tokenStillExists) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    };

    initAuth();
  }, [setUser, setIsAuthenticated]);
};
