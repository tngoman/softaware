import React, { useState, useEffect } from 'react';
import { 
  ArrowDownTrayIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';
import { formatDate, formatDateTime } from '../utils/formatters';
import Swal from 'sweetalert2';

interface UpdateInfo {
  id: number;
  version: string;
  release_date: string;
  description: string;
  file_size: number;
  file_name: string;
  download_url: string;
  has_migrations: boolean;
}

interface UpdateCheckResponse {
  success: boolean;
  update_available: boolean;
  latest_update?: UpdateInfo;
  current_version: string;
  message?: string;
}

interface InstalledUpdate {
  id: number;
  update_id: number;
  version: string;
  description: string;
  downloaded_path: string;
  installed_at: string;
}

interface UpdateHistoryResponse {
  success: boolean;
  data: {
    updates: InstalledUpdate[];
    migrations: any[];
    current_version: string;
  };
}

const Updates: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [installedUpdates, setInstalledUpdates] = useState<InstalledUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkForUpdates();
    loadHistory();
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const response = await api.get<UpdateCheckResponse>('/updates/check');
      if (response.data.success) {
        setUpdateAvailable(response.data.update_available);
        setUpdateInfo(response.data.latest_update || null);
        setCurrentVersion(response.data.current_version);
      }
    } catch (error: any) {
      console.error('Failed to check for updates:', error);
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.message || 'Failed to check for updates',
        icon: 'error',
      });
    } finally {
      setChecking(false);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await api.get<UpdateHistoryResponse>('/updates/history');
      if (response.data.success) {
        setInstalledUpdates(response.data.data.updates);
        if (!currentVersion) {
          setCurrentVersion(response.data.data.current_version);
        }
      }
    } catch (error) {
      console.error('Failed to load update history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateInfo) return;

    // Calculate estimated installation time
    // Base: 5 seconds + 2 seconds per MB + 10 seconds if migrations
    const fileSizeMB = updateInfo.file_size / 1024 / 1024;
    const extractionTime = Math.ceil(5 + (fileSizeMB * 2));
    const migrationTime = updateInfo.has_migrations ? 10 : 0;
    const estimatedSeconds = extractionTime + migrationTime;
    const estimatedTime = estimatedSeconds < 60 
      ? `${estimatedSeconds} seconds`
      : `${Math.ceil(estimatedSeconds / 60)} minute${estimatedSeconds >= 120 ? 's' : ''}`;

    const result = await Swal.fire({
      title: 'Install Update?',
      html: `
        <div class="text-left">
          <p class="mb-2"><strong>Version:</strong> ${updateInfo.version}</p>
          <p class="mb-2"><strong>Release Date:</strong> ${formatDate(updateInfo.release_date)}</p>
          <p class="mb-2"><strong>Size:</strong> ${(updateInfo.file_size / 1024 / 1024).toFixed(2)} MB</p>
          ${updateInfo.has_migrations ? '<p class="mb-2 text-yellow-600">⚠️ Includes database migrations</p>' : ''}
          <p class="mb-3 text-gray-600">${updateInfo.description}</p>
          <div class="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
            <p class="text-sm text-blue-800">
              <strong>Estimated installation time:</strong> ~${estimatedTime}
            </p>
          </div>
          <div class="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p class="text-sm text-yellow-800">
              <strong>Warning:</strong> The application may be temporarily unavailable during installation.
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0ea5e9',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Install Now',
      cancelButtonText: 'Cancel',
      width: '600px'
    });

    if (result.isConfirmed) {
      setInstalling(true);
      try {
        const response = await api.post('/updates/install', {
          update_id: updateInfo.id
        });

        if (response.data.success) {
          await Swal.fire({
            title: 'Update Installed!',
            html: `
              <p>Version <strong>${response.data.new_version}</strong> has been installed successfully.</p>
              <p class="text-sm text-gray-600 mt-2">The page will reload to apply changes.</p>
            `,
            icon: 'success',
            timer: 3000,
            timerProgressBar: true
          });

          // Reload the page to apply updates
          window.location.reload();
        }
      } catch (error: any) {
        Swal.fire({
          title: 'Installation Failed',
          text: error.response?.data?.message || 'Failed to install update',
          icon: 'error',
        });
      } finally {
        setInstalling(false);
      }
    }
  };

  const handleRollback = async (update: InstalledUpdate) => {
    const result = await Swal.fire({
      title: 'Rollback to Previous Version?',
      html: `
        <p>This will reinstall version <strong>${update.version}</strong>.</p>
        <p class="text-sm text-yellow-600 mt-2">⚠️ This operation cannot be undone automatically.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Rollback',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      setInstalling(true);
      try {
        const response = await api.post('/updates/install', {
          update_id: update.update_id
        });

        if (response.data.success) {
          await Swal.fire({
            title: 'Rollback Complete!',
            text: `Version ${response.data.new_version} has been restored.`,
            icon: 'success',
            timer: 3000,
            timerProgressBar: true
          });

          window.location.reload();
        }
      } catch (error: any) {
        Swal.fire({
          title: 'Rollback Failed',
          text: error.response?.data?.message || 'Failed to rollback',
          icon: 'error',
        });
      } finally {
        setInstalling(false);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 text-white px-6 py-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold">System Updates</h1>
        <p className="mt-2 text-picton-blue-50">
          Manage application updates and view installation history
        </p>
      </div>

      {/* Current Version & Check for Updates */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current Version</h2>
            <p className="mt-1 text-3xl font-bold text-picton-blue">{currentVersion}</p>
          </div>
          <button
            onClick={checkForUpdates}
            disabled={checking || installing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50"
          >
            <ArrowPathIcon className={`-ml-1 mr-2 h-5 w-5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {/* Update Available */}
        {updateAvailable && updateInfo && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <InformationCircleIcon className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900">
                    New Update Available: v{updateInfo.version}
                  </h3>
                  <div 
                    className="mt-2 text-sm text-blue-700" 
                    dangerouslySetInnerHTML={{ __html: updateInfo.description }}
                  />
                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600 font-medium">Release Date:</span>
                      <p className="text-blue-900">{formatDate(updateInfo.release_date)}</p>
                    </div>
                    <div>
                      <span className="text-blue-600 font-medium">File Size:</span>
                      <p className="text-blue-900">{formatFileSize(updateInfo.file_size)}</p>
                    </div>
                    <div>
                      <span className="text-blue-600 font-medium">Migrations:</span>
                      <p className="text-blue-900">{updateInfo.has_migrations ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleInstallUpdate}
                      disabled={installing}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <ArrowDownTrayIcon className="- ml-1 mr-2 h-5 w-5" />
                      {installing ? 'Installing...' : 'Install Update'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Updates */}
        {!updateAvailable && !checking && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-center text-green-600">
              <CheckCircleIcon className="h-6 w-6 mr-2" />
              <span className="font-medium">Your application is up to date</span>
            </div>
          </div>
        )}
      </div>

      {/* Installation History */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Installation History</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-picton-blue"></div>
              <p className="mt-2 text-sm text-gray-500">Loading history...</p>
            </div>
          ) : installedUpdates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ClockIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No updates have been installed yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {installedUpdates.map((update, index) => (
                <div
                  key={update.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-picton-blue transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Version {update.version}
                        </h3>
                        {update.version === currentVersion && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Current
                          </span>
                        )}
                        {index === 0 && update.version !== currentVersion && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            Rolled Back
                          </span>
                        )}
                      </div>
                      <div 
                        className="mt-1 text-sm text-gray-600" 
                        dangerouslySetInnerHTML={{ __html: update.description }}
                      />
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Installed {formatDateTime(update.installed_at)}
                      </div>
                    </div>
                    {index !== 0 && (
                      <button
                        onClick={() => handleRollback(update)}
                        disabled={installing}
                        className="ml-4 inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50"
                      >
                        <ArrowPathIcon className="h-4 w-4 mr-1" />
                        Rollback
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Updates;
