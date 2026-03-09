import React, { useState, useEffect } from 'react';
import { 
  ArrowPathIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import { notify } from '../utils/notify';
import axios from 'axios';
import { getApiBaseUrl } from '../config/app';

const API_URL = getApiBaseUrl();

interface SyncStats {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
}

interface Permission {
  slug: string;
  name: string;
  description: string;
  group: string | null;
}

interface SyncPreview {
  to_create: Permission[];
  to_update: Array<{
    slug: string;
    current: { name: string; description: string; group: string | null };
    new: { name: string; description: string; group: string | null };
  }>;
  unchanged: string[];
  unregistered: Permission[];
  stats: {
    will_create: number;
    will_update: number;
    will_remain: number;
    unregistered_count: number;
  };
}

const PermissionSync: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const getAuthToken = () => {
    const userStr = localStorage.getItem('auth_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.token;
    }
    return null;
  };

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await axios.get(`${API_URL}/permissions/sync/preview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setPreview(response.data.data);
        setShowPreview(true);
      } else {
        notify.error('Failed to fetch sync preview');
      }
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to fetch preview');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (deleteUnregistered = false) => {
    if (!window.confirm(
      deleteUnregistered 
        ? 'This will sync permissions and DELETE unregistered ones. Continue?' 
        : 'This will sync permissions from code to database. Continue?'
    )) {
      return;
    }

    setLoading(true);
    setSyncStats(null);
    
    try {
      const token = getAuthToken();
      const response = await axios.post(
        `${API_URL}/permissions/sync`,
        { delete_unregistered: deleteUnregistered },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setSyncStats(response.data.data.stats);
        notify.success('Permissions synced successfully!');
        setShowPreview(false);
        setPreview(null);
      } else {
        notify.error('Failed to sync permissions');
      }
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to sync permissions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Permission Sync</h2>
          <p className="text-sm text-gray-600 mt-1">
            Sync permissions from code to database
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={fetchPreview}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Preview Changes
        </button>
        
        <button
          onClick={() => handleSync(false)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <CheckCircleIcon className="w-5 h-5" />
          Sync Now
        </button>
      </div>

      {/* Sync Stats */}
      {syncStats && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-green-900 mb-3">Sync Results:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{syncStats.created}</div>
              <div className="text-sm text-gray-600">Created</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{syncStats.updated}</div>
              <div className="text-sm text-gray-600">Updated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{syncStats.unchanged}</div>
              <div className="text-sm text-gray-600">Unchanged</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{syncStats.deleted}</div>
              <div className="text-sm text-gray-600">Deleted</div>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && preview && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Preview Changes:</h3>
          
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{preview.stats.will_create}</div>
              <div className="text-sm text-gray-600">Will Create</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{preview.stats.will_update}</div>
              <div className="text-sm text-gray-600">Will Update</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{preview.stats.will_remain}</div>
              <div className="text-sm text-gray-600">Unchanged</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{preview.stats.unregistered_count}</div>
              <div className="text-sm text-gray-600">Unregistered</div>
            </div>
          </div>

          {/* To Create */}
          {preview.to_create.length > 0 && (
            <div className="border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-3">
                Will Create ({preview.to_create.length}):
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {preview.to_create.map((perm) => (
                  <div key={perm.slug} className="bg-green-50 p-3 rounded">
                    <div className="font-medium text-gray-900">{perm.slug}</div>
                    <div className="text-sm text-gray-600">{perm.name}</div>
                    {perm.group && (
                      <div className="text-xs text-gray-500">Group: {perm.group}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* To Update */}
          {preview.to_update.length > 0 && (
            <div className="border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3">
                Will Update ({preview.to_update.length}):
              </h4>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {preview.to_update.map((change) => (
                  <div key={change.slug} className="bg-blue-50 p-3 rounded">
                    <div className="font-medium text-gray-900 mb-2">{change.slug}</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Current:</div>
                        <div className="text-gray-700">{change.current.name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">New:</div>
                        <div className="text-gray-700">{change.new.name}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unregistered */}
          {preview.unregistered.length > 0 && (
            <div className="border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-3">
                Unregistered in Code ({preview.unregistered.length}):
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                These exist in database but not in code. Use "Sync & Delete" to remove them.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {preview.unregistered.map((perm: any) => (
                  <div key={perm.slug} className="bg-red-50 p-3 rounded">
                    <div className="font-medium text-gray-900">{perm.slug}</div>
                    <div className="text-sm text-gray-600">{perm.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PermissionSync;
