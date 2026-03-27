import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentArrowDownIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline';
import { CreditNoteModel, type CreditNote } from '../../models/CreditNoteModel';
import { ContactModel } from '../../models';
import AppSettingsModel from '../../models/AppSettingsModel';
import { API_BASE_URL } from '../../services/api';
import { DataTable, BackButton } from '../../components/UI';
import { formatDate, formatCurrency } from '../../utils/formatters';
import Can from '../../components/Can';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';
import { getApiBaseUrl } from '../../config/app';

const CreditNotes: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [selectedCN, setSelectedCN] = useState<CreditNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');

  const columns: any[] = [
    {
      accessorKey: 'credit_note_number',
      header: 'Credit Note #',
    },
    {
      accessorKey: 'contact_name',
      header: 'Customer'
    },
    {
      accessorKey: 'linked_invoice_number',
      header: 'Invoice Ref',
      cell: ({ getValue }: any) => getValue() || '-'
    },
    {
      accessorKey: 'credit_note_date',
      header: 'Date',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'credit_note_total',
      header: 'Amount',
      cell: ({ getValue }: any) => formatCurrency(getValue())
    },
    {
      accessorKey: 'credit_note_status',
      header: 'Status',
      cell: ({ getValue }: any) => {
        const status = getValue();
        if (status === 0) return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Draft</span>;
        if (status === 1) return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>;
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Unknown</span>;
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => viewCreditNote(row.original)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
          >
            <EyeIcon className="h-3.5 w-3.5 mr-1" />
            View
          </button>
        </div>
      )
    }
  ];

  useEffect(() => {
    loadCreditNotes();
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => {
    if (!id) setSelectedCN(null);
  }, [id]);

  useEffect(() => {
    if (id && id !== 'new') {
      const fetch = async () => {
        try {
          setLoading(true);
          const cn = await CreditNoteModel.getById(parseInt(id));
          setSelectedCN(cn);
        } catch (error) {
          console.error('Error fetching credit note:', error);
          notify.error('Failed to load credit note');
          navigate('/credit-notes');
        } finally {
          setLoading(false);
        }
      };
      fetch();
    }
  }, [id]);

  const loadCreditNotes = async () => {
    try {
      setLoading(true);
      const data = await CreditNoteModel.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });

      if (Array.isArray(data)) {
        setCreditNotes(data);
      } else {
        const rd = data as any;
        setCreditNotes(rd.data || []);
        if (rd.pagination) setPagination(prev => ({ ...prev, total: rd.pagination.total }));
      }
    } catch (error) {
      console.error('Error loading credit notes:', error);
      notify.error('Failed to load credit notes');
    } finally {
      setLoading(false);
    }
  };

  const viewCreditNote = (cn: CreditNote) => {
    navigate(`/credit-notes/${cn.credit_note_id}`);
  };

  const generatePDF = async (cn: CreditNote) => {
    try {
      setGeneratingPdf(true);
      const response = await CreditNoteModel.generatePDF(cn.credit_note_id);
      if (response.success && response.path) {
        const settings = await AppSettingsModel.get();
        const baseUrl = (settings as any).site_base_url || getApiBaseUrl();
        const pdfUrl = `${baseUrl}/${response.path}`;
        window.open(pdfUrl, '_blank');
        notify.success('PDF generated successfully');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      notify.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const deleteCreditNote = async (cn: CreditNote) => {
    const result = await Swal.fire({
      title: 'Delete Credit Note?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      try {
        await CreditNoteModel.delete(cn.credit_note_id);
        notify.success('Credit note deleted');
        navigate('/credit-notes');
        loadCreditNotes();
      } catch (error) {
        notify.error('Failed to delete credit note');
      }
    }
  };

  // Detail view
  if (selectedCN) {
    const items = (selectedCN as any).items || [];

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/credit-notes')}
              className="inline-flex items-center text-white hover:text-white/80 transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Credit Notes
            </button>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">CREDIT NOTE</h1>
              <p className="text-xl font-semibold">#{selectedCN.credit_note_number}</p>
              <div className="mt-4 space-y-1 text-sm">
                <p><span className="font-semibold">Date:</span> {formatDate(selectedCN.credit_note_date)}</p>
                {selectedCN.linked_invoice_number && (
                  <p><span className="font-semibold">Invoice Ref:</span> {selectedCN.linked_invoice_number}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => generatePDF(selectedCN)}
                disabled={generatingPdf}
                className="inline-flex items-center px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium shadow-md transition-all"
              >
                {generatingPdf ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                    Download PDF
                  </>
                )}
              </button>
              <button
                onClick={() => navigate(`/credit-notes/${selectedCN.credit_note_id}/edit`)}
                className="inline-flex items-center px-4 py-2 bg-white text-amber-600 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button
                onClick={() => deleteCreditNote(selectedCN)}
                className="inline-flex items-center px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Credit Note Document */}
        <div className="bg-white shadow-xl rounded-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-red-50 to-white p-6 border-b-2 border-red-200">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Credit To</h3>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-gray-900">{selectedCN.contact_name || 'Unknown Customer'}</p>
                  {selectedCN.contact_phone && <p className="text-sm text-gray-600">Tel: {selectedCN.contact_phone}</p>}
                  {selectedCN.contact_email && <p className="text-sm text-gray-600">Email: {selectedCN.contact_email}</p>}
                </div>
              </div>
              <div className="text-right">
                {selectedCN.reason && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reason</h3>
                    <p className="text-sm text-gray-700">{selectedCN.reason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-red-600 text-white">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">QTY</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">VAT</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, index: number) => {
                  const vatRate = 15;
                  const lineVat = item.item_vat ? (item.item_qty * item.item_price * vatRate / 100) : 0;
                  const lineTotal = item.item_qty * item.item_price;
                  return (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="px-6 py-4 text-sm text-gray-600">{item.item_qty}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.item_product}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatCurrency(item.item_price)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatCurrency(lineVat)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-semibold text-right">{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-6 bg-gray-50 border-t-2 border-gray-100">
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Subtotal:</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(selectedCN.credit_note_subtotal || 0)}</span>
              </div>
              {(selectedCN.credit_note_vat || 0) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">VAT (15%):</span>
                  <span className="text-gray-900 font-semibold">{formatCurrency(selectedCN.credit_note_vat || 0)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg border-t-2 border-gray-300 pt-3">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="font-bold text-red-600">{formatCurrency(selectedCN.credit_note_total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Credit Notes</h1>
            <p className="text-white/90">Manage your credit notes</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search credit notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        data={creditNotes}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage="No credit notes found."
        serverSide={true}
        currentPage={pagination.page}
        totalItems={pagination.total}
        pageSize={pagination.limit}
        onPageChange={(page: number) => setPagination(prev => ({ ...prev, page }))}
        onSearch={(query: string) => {
          setSearch(query);
          setPagination(prev => ({ ...prev, page: 0 }));
        }}
      />
    </div>
  );
};

export default CreditNotes;
