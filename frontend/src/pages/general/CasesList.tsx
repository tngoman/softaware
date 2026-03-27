/**
 * CasesList — List all cases with filters and actions
 * Follows finance/Invoices.tsx design pattern
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlagIcon, EyeIcon, PlusIcon, FunnelIcon,
  BugAntIcon, ExclamationTriangleIcon, ShieldExclamationIcon,
  LightBulbIcon, TrashIcon
} from '@heroicons/react/24/outline';
import { CaseModel } from '../../models/CaseModel';
import { Case } from '../../types/cases';
import { DataTable } from '../../components/UI';
import { formatDate } from '../../utils/formatters';
import Can from '../../components/Can';
import Swal from 'sweetalert2';
import { notify } from '../../utils/notify';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  waiting: { label: 'Waiting', color: 'text-purple-700', bg: 'bg-purple-100' },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  low: { label: 'Low', color: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' },
  medium: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  bug: <BugAntIcon className="h-4 w-4 text-red-500" />,
  performance: <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />,
  ui_issue: <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />,
  data_issue: <ShieldExclamationIcon className="h-4 w-4 text-purple-500" />,
  security: <ShieldExclamationIcon className="h-4 w-4 text-red-700" />,
  feature_request: <LightBulbIcon className="h-4 w-4 text-blue-500" />,
  other: <FlagIcon className="h-4 w-4 text-gray-500" />,
};

const CasesList: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');

  const handleDeleteCase = async (caseId: string, caseNumber: string) => {
    const result = await Swal.fire({
      title: 'Delete Case?',
      text: `Delete ${caseNumber}? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete'
    });
    if (result.isConfirmed) {
      try {
        await CaseModel.delete(caseId);
        setCases(prev => prev.filter(c => c.id !== caseId));
        notify.success('Case deleted');
      } catch { notify.error('Failed to delete case'); }
    }
  };

  const handleDeleteAll = async () => {
    if (cases.length === 0) return;
    const result = await Swal.fire({
      title: `Delete all ${cases.length} case(s)?`,
      text: 'This will permanently delete all visible cases.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete All'
    });
    if (result.isConfirmed) {
      try {
        await Promise.all(cases.map(c => CaseModel.delete(c.id)));
        setCases([]);
        notify.success('All cases deleted');
      } catch { notify.error('Failed to delete cases'); }
    }
  };

  const columns: any[] = [
    {
      accessorKey: 'case_number',
      header: 'Case #',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-picton-blue font-mono text-sm">
          {getValue()}
        </span>
      )
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          {CATEGORY_ICONS[row.original.category ?? 'other']}
          <span className="font-medium text-gray-900">{row.original.title}</span>
        </div>
      )
    },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ getValue }: any) => {
        const config = SEVERITY_CONFIG[getValue() || 'medium'];
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </span>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }: any) => {
        const config = STATUS_CONFIG[getValue() || 'open'];
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
            {config.label}
          </span>
        );
      }
    },
    {
      accessorKey: 'reporter_name',
      header: 'Reported By',
      cell: ({ getValue }: any) => (
        <span className="text-sm text-gray-600">{getValue() || 'Unknown'}</span>
      )
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }: any) => (
        <span className="text-sm text-gray-600">{formatDate(getValue())}</span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/cases/${row.original.id}`)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
          >
            <EyeIcon className="h-3.5 w-3.5 mr-1" />
            View
          </button>
          <button
            onClick={() => handleDeleteCase(row.original.id, row.original.case_number)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <TrashIcon className="h-3.5 w-3.5 mr-1" />
            Delete
          </button>
        </div>
      )
    }
  ];

  useEffect(() => {
    loadCases();
  }, [pagination.page, pagination.limit, search, statusFilter, severityFilter]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;

      const result = await CaseModel.getMyCases(params);
      setCases(result.cases || []);
      if (result.pagination) {
        setPagination(prev => ({ ...prev, total: result.pagination.total }));
      }
    } catch (error) {
      console.error('Error loading cases:', error);
      notify.error('Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-scarlet to-scarlet/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Cases</h1>
            <p className="text-white/90">Track and manage your reported issues</p>
          </div>
          <div className="flex items-center gap-3">
            {cases.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="inline-flex items-center px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold shadow-lg transition-all"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                Delete All ({cases.length})
              </button>
            )}
            <Can permission="cases.create">
              <button
                onClick={() => {
                  notify.info('Use the floating "Report Issue" button on the right side of the screen to create a new case.');
                }}
                className="inline-flex items-center px-5 py-2.5 bg-white text-scarlet rounded-lg hover:bg-gray-100 font-semibold shadow-lg transition-all"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Report New Issue
              </button>
            </Can>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/20 focus:border-picton-blue"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/20 focus:border-picton-blue"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <DataTable
          columns={columns}
          data={cases}
          loading={loading}
          searchable={false}
          serverSide={true}
          totalItems={pagination.total}
          currentPage={pagination.page}
          pageSize={pagination.limit}
          onPageChange={(page: number) => setPagination(prev => ({ ...prev, page }))}
        />
      </div>
    </div>
  );
};

export default CasesList;
