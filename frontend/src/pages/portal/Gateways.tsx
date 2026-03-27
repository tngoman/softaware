import React from 'react';
import {
  ArrowsRightLeftIcon,
  CommandLineIcon,
  SignalIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { useProducts, type GatewayInfo } from '../../hooks/useProducts';

const statusBadge = (status: string) => {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircleIcon className="h-3.5 w-3.5" /> Active
      </span>
    );
  if (status === 'paused')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <PauseCircleIcon className="h-3.5 w-3.5" /> Paused
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <XCircleIcon className="h-3.5 w-3.5" /> Disabled
    </span>
  );
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

const GatewaysPage: React.FC = () => {
  const { gatewaySummary, packageInfo, loading } = useProducts();

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-gray-100 dark:bg-dark-700 rounded-lg" />
        <div className="h-64 bg-gray-100 dark:bg-dark-700 rounded-xl" />
      </div>
    );
  }

  if (!gatewaySummary || gatewaySummary.total_gateways === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5">
          <ArrowsRightLeftIcon className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No API Gateways</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
          You don't have any API gateway configurations yet. Contact your administrator to set up gateway access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowsRightLeftIcon className="h-6 w-6 text-indigo-500" />
            My Gateways
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {gatewaySummary.total_gateways} gateway configuration{gatewaySummary.total_gateways !== 1 ? 's' : ''}
            {packageInfo && (
              <> · <span className="font-medium text-gray-700 dark:text-gray-300">{packageInfo.name}</span> plan</>
            )}
          </p>
        </div>
      </div>

      {/* Gateway Cards */}
      {gatewaySummary.gateways.map((gw: GatewayInfo) => (
        <div
          key={gw.client_id}
          className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-600 shadow-sm overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-dark-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <SignalIcon className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{gw.client_name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400 font-mono">{gw.client_id}</span>
                  <button
                    onClick={() => copyToClipboard(gw.client_id)}
                    className="text-gray-400 hover:text-indigo-500 transition-colors"
                    title="Copy Client ID"
                  >
                    <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            {statusBadge(gw.status)}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 dark:bg-dark-600">
            <div className="bg-white dark:bg-dark-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{gw.tools_count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Registered Tools</p>
            </div>
            <div className="bg-white dark:bg-dark-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{gw.total_requests.toLocaleString()}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Requests</p>
            </div>
            <div className="bg-white dark:bg-dark-800 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{gw.rate_limit_rpm}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">RPM Limit</p>
            </div>
            <div className="bg-white dark:bg-dark-800 p-4 text-center">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {gw.last_request_at
                  ? new Date(gw.last_request_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last Request</p>
            </div>
          </div>

          {/* Tools */}
          {gw.tools.length > 0 && (
            <div className="p-5 border-t border-slate-100 dark:border-dark-600">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Registered Tools ({gw.tools_count})
              </p>
              <div className="flex flex-wrap gap-2">
                {gw.tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-mono"
                  >
                    <CommandLineIcon className="h-3 w-3" />
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Connection Details */}
          <div className="p-5 bg-slate-50 dark:bg-dark-900 border-t border-slate-100 dark:border-dark-600">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Connection Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Target API</span>
                <p className="font-mono text-gray-800 dark:text-gray-200 mt-0.5 break-all">{gw.target_base_url}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Auth Type</span>
                <p className="text-gray-800 dark:text-gray-200 mt-0.5 capitalize">{gw.auth_type.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Created</span>
                <p className="text-gray-800 dark:text-gray-200 mt-0.5">
                  {new Date(gw.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Documentation</span>
                <a
                  href={`/api/gateway/${gw.client_id}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 mt-0.5"
                >
                  View API Docs
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GatewaysPage;
