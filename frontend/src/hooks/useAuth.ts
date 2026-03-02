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
      
      try {
        console.log('Fetching user from API...');
        const data = await AuthModel.me();
        console.log('User data from API:', data);
        
        // data is { user: User } - permissions are now included in the user object
        const user = data.user;
        console.log('User permissions from API:', user.permissions);
        
        // Update localStorage with fresh data
        AuthModel.storeAuth(token, user);
        
        // Update store
        setUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Token validation failed:', error);
        AuthModel.clearAuth();
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    initAuth();
  }, [setUser, setIsAuthenticated]);
};
