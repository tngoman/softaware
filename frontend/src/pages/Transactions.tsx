import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, ArrowDownTrayIcon, FunnelIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ColumnDef } from '@tanstack/react-table';
import { TransactionModel, PaymentModel } from '../models';
import { Transaction, PaginationResponse, Payment } from '../types';
import { DataTable, CustomDatePicker } from '../components/UI';
import { getApiBaseUrl, getAssetUrl } from '../config/app';
import { formatDate, formatCurrency } from '../utils/formatters';
import Swal from 'sweetalert2';

const Transactions: React.FC = () => {
  const navigate = useNavigate();
  
  const [transactionsData, setTransactionsData] = useState<PaginationResponse<Transaction>>({
    data: [],
    pagination: { page: 0, limit: 25, total: 0, pages: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [processingPayments, setProcessingPayments] = useState(false);
  
  // Filter state
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ sortBy: 'transaction_date', sortOrder: 'desc' as 'asc' | 'desc' });
  const [filterType, setFilterType] = useState<'' | 'expense' | 'income'>('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [currentPage, searchQuery, sortConfig, filterType, fromDate, toDate]);

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: 25,
        ...sortConfig,
      };
      
      if (searchQuery) params.search = searchQuery;
      if (filterType) params.type = filterType;
      if (fromDate) params.from_date = fromDate.toISOString().split('T')[0];
      if (toDate) params.to_date = toDate.toISOString().split('T')[0];
      
      const data = await TransactionModel.getAll(params);
      setTransactionsData(data as PaginationResponse<Transaction>);
    } catch (error) {
      console.error('Error loading transactions:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load transactions' });
      setTransactionsData({ data: [], pagination: { page: 0, limit: 25, total: 0, pages: 0 } });
    } finally {
      setLoading(false);
    }
  };

  const loadPendingPayments = async () => {
    try {
      const response = await PaymentModel.getUnprocessed({ limit: 50 });
      const payments = Array.isArray(response) ? response : response?.data ?? [];
      setPendingPayments(payments);
    } catch (error) {
      console.error('Error loading pending payments:', error);
      setPendingPayments([]);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(0);
  };

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setSortConfig({ sortBy, sortOrder });
    setCurrentPage(0);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      await TransactionModel.delete(id);
      Swal.fire({ icon: 'success', title: 'Success!', text: 'Transaction deleted successfully', timer: 2000, showConfirmButton: false });
      loadTransactions();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      if (error.response?.data?.error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.response.data.error });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete transaction' });
      }
    }
  };

  const handleProcessPendingPayments = async () => {
    if (processingPayments) {
      return;
    }

    const pendingCount = pendingPayments.length;
    const pendingText = pendingCount === 1 ? 'payment' : 'payments';

    const modal = await Swal.fire<{ clearIncome: boolean }>({
      title: 'Process Pending Payments',
      html: `
        <div class="space-y-4 text-left">
          <p class="text-sm text-gray-700">
            ${pendingCount > 0
              ? `Convert ${pendingCount} pending ${pendingText} into transactions.`
              : 'No pending payments detected. Use the option below to clear income transactions and reset processed payments before converting them.'}
          </p>
          <label class="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" id="clear-income-toggle" class="mt-1" />
            <span>Clear all existing income transactions before processing.</span>
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      confirmButtonText: 'Process',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      preConfirm: () => {
        const checkbox = Swal.getPopup()?.querySelector<HTMLInputElement>('#clear-income-toggle');
        return { clearIncome: checkbox?.checked ?? false };
      }
    });

    if (!modal.isConfirmed) {
      return;
    }

    try {
      setProcessingPayments(true);

      let clearedCount = 0;
      if (modal.value?.clearIncome) {
        const clearResponse = await TransactionModel.clearIncome();
        clearedCount = clearResponse?.deleted ?? 0;
      }

      const processResponse = await PaymentModel.process({});
      const processed = Array.isArray(processResponse?.processed) ? processResponse.processed : [];
      const errors = Array.isArray(processResponse?.errors) ? processResponse.errors : [];

      if (errors.length > 0) {
        const summary = errors
          .map((err: { payment_id: number; message: string }) => `#${String(err.payment_id).padStart(5, '0')}: ${err.message}`)
          .join('\n');

        const lead = clearedCount > 0
          ? `Cleared ${clearedCount} income transaction${clearedCount === 1 ? '' : 's'} before processing.`
          : 'Some payments could not be processed.';

        Swal.fire({
          icon: 'warning',
          title: 'Some Payments Failed',
          html: `
            <div class="text-left space-y-3">
              <p class="text-sm text-gray-700">${lead}</p>
              <pre class="bg-gray-100 border border-gray-200 rounded-md p-3 text-xs text-gray-800 whitespace-pre-wrap">${summary}</pre>
            </div>
          `
        });
      } else if (processed.length === 0) {
        const info = 'No payments were processed. Clear income transactions to reset processed payments and try again.';

        Swal.fire({
          icon: 'info',
          title: 'Nothing To Process',
          text: info
        });
      } else {
        const details = [] as string[];
        if (clearedCount > 0) {
          details.push(`Cleared ${clearedCount} income transaction${clearedCount === 1 ? '' : 's'}.`);
        }
        details.push(`Processed ${processed.length} payment${processed.length === 1 ? '' : 's'} into transactions.`);

        Swal.fire({
          icon: 'success',
          title: 'Payments Processed',
          text: details.join(' '),
          timer: 2200,
          showConfirmButton: false
        });
      }

      await loadTransactions();
      await loadPendingPayments();
    } catch (error: any) {
      console.error('Error processing pending payments:', error);
      Swal.fire({
        icon: 'error',
        title: 'Processing Failed',
        text: error?.response?.data?.error || error?.message || 'Unable to process payments.'
      });
    } finally {
      setProcessingPayments(false);
    }
  };

  const getVatTypeBadge = (type: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      standard: { label: '15%', color: 'bg-picton-blue/10 text-picton-blue' },
      zero: { label: '0%', color: 'bg-gray-100 text-gray-800' },
      exempt: { label: 'Exempt', color: 'bg-yellow-100 text-yellow-800' },
      'non-vat': { label: 'Non-VAT', color: 'bg-red-100 text-red-800' },
    };
    
    const badge = badges[type] || badges['non-vat'];
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    if (type === 'expense') {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
          Expense
        </span>
      );
    }
    return (
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        Income
      </span>
    );
  };

  const columns: ColumnDef<Transaction>[] = [
    {
      accessorKey: 'transaction_date',
      header: 'Date',
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      accessorKey: 'transaction_type',
      header: 'Type',
      cell: ({ getValue }) => getTypeBadge(getValue() as string),
    },
    {
      accessorKey: 'party_name',
      header: 'Party',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900">{row.original.party_name}</div>
          {row.original.party_vat_number && (
            <div className="text-xs text-gray-500">VAT: {row.original.party_vat_number}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'invoice_number',
      header: 'Invoice #',
    },
    {
      accessorKey: 'category_name',
      header: 'Category',
      cell: ({ getValue, row }) => {
        const category = getValue() as string;
        return category || (row.original.transaction_type === 'income' ? 'Income' : '-');
      },
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      cell: ({ getValue }) => (
        <span className="font-medium">{formatCurrency(getValue() as number)}</span>
      ),
    },
    {
      accessorKey: 'vat_type',
      header: 'VAT',
      cell: ({ getValue }) => getVatTypeBadge(getValue() as string),
    },
    {
      accessorKey: 'vat_amount',
      header: 'VAT Amount',
      cell: ({ getValue }) => formatCurrency(getValue() as number),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.document_path && (
            <a
              href={getAssetUrl(row.original.document_path)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5 mr-1" />
              Download
            </a>
          )}
          <button
            onClick={() => handleDelete(row.original.transaction_id!)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-scarlet hover:bg-scarlet/90 rounded-lg transition-colors"
          >
            <TrashIcon className="h-3.5 w-3.5 mr-1" />
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Transactions</h1>
            <p className="text-white/90">VAT-compliant transaction ledger</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/transactions/add-expense')}
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-scarlet hover:bg-scarlet/90 shadow-md transition-all hover:shadow-lg"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Expense
            </button>
            <button
              onClick={() => navigate('/transactions/add-income')}
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Income
            </button>
            <button
              onClick={handleProcessPendingPayments}
              disabled={processingPayments}
              className={`inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg ${processingPayments ? 'bg-gray-400 cursor-not-allowed' : pendingPayments.length === 0 ? 'bg-gray-500 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {processingPayments ? (
                <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              ) : (
                <PlusIcon className="h-5 w-5 mr-2" />
              )}
              {processingPayments ? 'Processing…' : `Process Pending (${pendingPayments.length})`}
            </button>
          </div>
        </div>

        {/* Filters in header */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as '' | 'expense' | 'income')}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm [&>option]:text-gray-900"
          >
            <option value="">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </select>

          <CustomDatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="From Date"
            className="!px-4 !py-2 !pl-10 !rounded-lg !bg-white/10 !border-white/20 !text-white placeholder:!text-white/60 !shadow-none focus:!ring-2 focus:!ring-white/50 !backdrop-blur-sm"
            iconClassName="text-white/60"
          />

          <CustomDatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="To Date"
            className="!px-4 !py-2 !pl-10 !rounded-lg !bg-white/10 !border-white/20 !text-white placeholder:!text-white/60 !shadow-none focus:!ring-2 focus:!ring-white/50 !backdrop-blur-sm"
            iconClassName="text-white/60"
          />

          {(filterType || fromDate || toDate || searchQuery) && (
            <button
              onClick={() => {
                setFilterType('');
                setFromDate(null);
                setToDate(null);
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-medium transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <DataTable
        data={transactionsData.data}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage="No transactions found. Start by adding an expense or income."
        serverSide={true}
        totalItems={transactionsData.pagination.total}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onSort={handleSort}
        pageSize={25}
      />
    </div>
  );
};

export default Transactions;
