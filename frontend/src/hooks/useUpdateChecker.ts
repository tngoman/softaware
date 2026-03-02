import { useState, useEffect } from 'react';
import api from '../services/api';

interface UpdateInfo {
  id: number;
  version: string;
  description: string;
  released_at: string;
}

interface UpdateCheckResponse {
  success: boolean;
  update_available: boolean;
  latest_update?: UpdateInfo;
  current_version: string;
  message?: string;
}

export const useUpdateChecker = (checkIntervalMinutes: number = 60) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkForUpdates = async () => {
    try {
      setChecking(true);
      const response = await api.get<UpdateCheckResponse>('/updates/check');
      
      if (response.data.success) {
        setUpdateAvailable(response.data.update_available);
        setCurrentVersion(response.data.current_version);
        
        if (response.data.update_available && response.data.latest_update) {
          setUpdateInfo(response.data.latest_update);
        } else {
          setUpdateInfo(null);
        }
        
        setLastChecked(new Date());
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Check immediately on mount
    checkForUpdates();

    // Set up periodic checking
    const intervalMs = checkIntervalMinutes * 60 * 1000;
    const interval = setInterval(checkForUpdates, intervalMs);

    return () => clearInterval(interval);
  }, [checkIntervalMinutes]);

  return {
    updateAvailable,
    updateInfo,
    currentVersion,
    checking,
    lastChecked,
    checkForUpdates
  };
};
