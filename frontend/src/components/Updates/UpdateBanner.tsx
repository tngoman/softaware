import React from 'react';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface UpdateBannerProps {
  version: string;
  description: string;
  onDismiss: () => void;
  onInstall: () => void;
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({ version, description, onDismiss, onInstall }) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-blue-800">
              <ArrowDownTrayIcon className="h-6 w-6 text-white" />
            </span>
            <p className="ml-3 font-medium">
              <span className="md:hidden">Update available: v{version}</span>
              <span className="hidden md:inline">
                New update available: <span className="font-bold">v{version}</span> - {description}
              </span>
            </p>
          </div>
          <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
            <button
              onClick={onInstall}
              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 transition-colors"
            >
              Install Update
            </button>
          </div>
          <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
            <button
              type="button"
              onClick={onDismiss}
              className="-mr-1 flex p-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2"
            >
              <span className="sr-only">Dismiss</span>
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
