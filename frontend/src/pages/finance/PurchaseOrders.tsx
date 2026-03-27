import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentArrowDownIcon, EyeIcon, PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';
import { PurchaseOrderModel, ContactModel } from '../../models';
import { API_BASE_URL } from '../../services/api';
import { PurchaseOrder } from '../../types';
import { DataTable, BackButton, EmailModal } from '../../components/UI';
import { formatDate, formatCurrency } from '../../utils/formatters';
import Can from '../../components/Can';
import { notify } from '../../utils/notify';

const statusLabels: Record<number, { text: string; color: string }> = {
  0: { text: 'Draft', color: 'bg-gray-100 text-gray-700' },
  1: { text: 'Sent', color: 'bg-blue-100 text-blue-700' },
  2: { text: 'Received', color: 'bg-green-100 text-green-700' },
  3: { text: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

const StatusBadge: React.FC<{ status?: number }> = ({ status }) => {
  const s = statusLabels[status ?? 0] || statusLabels[0];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.text}</span>;
};

const PurchaseOrders: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');

  // DataTable columns
  const columns: any[] = [
    {
      accessorKey: 'po_number',
      header: 'PO #',
      cell: ({ getValue }: any) => getValue() || 'N/A',
    },
    {
      accessorKey: 'contact_name',
      header: 'Supplier',
    },
    {
      accessorKey: 'po_date',
      header: 'Date',
      cell: ({ getValue }: any) => formatDate(getValue()),
    },
    {
      accessorKey: 'po_due_date',
      header: 'Delivery Date',
      cell: ({ getValue }: any) => getValue() ? formatDate(getValue()) : '-',
    },
    {
      accessorKey: 'po_amount',
      header: 'Amount',
      cell: ({ getValue }: any) => formatCurrency(getValue()),
    },
    {
      accessorKey: 'po_status',
      header: 'Status',
      cell: ({ getValue }: any) => <StatusBadge status={getValue()} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/purchase-orders/${row.original.po_id}`)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
          >
            <EyeIcon className="h-3.5 w-3.5 mr-1" />
            View
          </button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    loadPurchaseOrders();
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => {
    if (!id) setSelectedPO(null);
  }, [id]);

  useEffect(() => {
    if (id && id !== 'new') {
      const fetchPO = async () => {
        try {
          const po = await PurchaseOrderModel.getById(parseInt(id));
          setSelectedPO(po);
        } catch (error) {
          console.error('Error fetching purchase order:', error);
          notify.error('Failed to load purchase order');
          navigate('/purchase-orders');
        }
      };
      fetchPO();
    }
  }, [id, navigate]);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const data = await PurchaseOrderModel.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });
      if (Array.isArray(data)) {
        setPurchaseOrders(data);
      } else {
        const resp = data as any;
        setPurchaseOrders(resp.data);
        if (resp.pagination) {
          setPagination(prev => ({ ...prev, total: resp.pagination.total }));
        }
      }
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      notify.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async (po: PurchaseOrder) => {
    if (!po.po_id) return;
    try {
      setGeneratingPdf(true);
      const response = await PurchaseOrderModel.generatePDF(po.po_id);
      if (response.success && response.path) {
        window.open(`${API_BASE_URL}/${response.path}`, '_blank');
        notify.success('PDF generated successfully');
      } else {
        notify.error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      notify.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendEmail = async (data: { to: string; cc?: string; subject: string; body: string }) => {
    if (!selectedPO || !selectedPO.po_id) return;
    await PurchaseOrderModel.sendEmail(selectedPO.po_id, data);
    loadPurchaseOrders();
    if (selectedPO.po_id) {
      const updated = await PurchaseOrderModel.getById(selectedPO.po_id);
      setSelectedPO(updated);
    }
  };

  const deletePO = async () => {
    if (!selectedPO || !selectedPO.po_id) return;
    if (!window.confirm('Are you sure you want to delete this purchase order?')) return;
    try {
      await PurchaseOrderModel.delete(selectedPO.po_id);
      notify.success('Purchase order deleted');
      navigate('/purchase-orders');
      loadPurchaseOrders();
    } catch (error) {
      console.error('Error deleting PO:', error);
      notify.error('Failed to delete purchase order');
    }
  };

  // Detail view
  if (selectedPO) {
    const vatRate = 15; // Default VAT rate
    const items = selectedPO.items || [];
    const subtotal = items.reduce((sum, it) => sum + (Number(it.item_cost) || 0) * (Number(it.item_qty) || 1), 0);
    const vatAmount = items.reduce((sum, it) =>
      sum + (it.item_vat ? (Number(it.item_cost) || 0) * (Number(it.item_qty) || 1) * vatRate / 100 : 0), 0
    );
    const total = subtotal + vatAmount;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/purchase-orders')}
              className="inline-flex items-center text-white hover:text-white/80 transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Purchase Orders
            </button>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">PURCHASE ORDER</h1>
              <p className="text-xl font-semibold">{selectedPO.po_number}</p>
              <div className="mt-4 space-y-1 text-sm">
                <p><span className="font-semibold">Date:</span> {formatDate(selectedPO.po_date)}</p>
                {selectedPO.po_due_date && (
                  <p><span className="font-semibold">Delivery Date:</span> {formatDate(selectedPO.po_due_date)}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <Can permission="invoices.edit">
                <button
                  onClick={() => navigate(`/purchase-orders/${selectedPO.po_id}/edit`)}
                  className="inline-flex items-center px-4 py-2 bg-white text-amber-600 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              </Can>
              <button
                onClick={() => generatePDF(selectedPO)}
                disabled={generatingPdf}
                className="inline-flex items-center px-4 py-2 bg-white text-teal-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium shadow-md transition-all"
              >
                {generatingPdf ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
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
                onClick={() => setEmailModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
              >
                <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                Send Email
              </button>
              <Can permission="invoices.edit">
                <button
                  onClick={deletePO}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-md transition-all"
                >
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Delete
                </button>
              </Can>
            </div>
          </div>
        </div>

        {/* PO Document */}
        <div className="bg-white shadow-xl rounded-xl border-2 border-gray-100 overflow-hidden">
          {/* Supplier info */}
          <div className="bg-gradient-to-r from-teal-50 to-white p-6 border-b-2 border-teal-200">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Supplier</h3>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-gray-900">{selectedPO.contact_name || 'Unknown Supplier'}</p>
                  {selectedPO.contact_phone && <p className="text-sm text-gray-600">Tel: {selectedPO.contact_phone}</p>}
                  {selectedPO.contact_email && <p className="text-sm text-gray-600">Email: {selectedPO.contact_email}</p>}
                  {selectedPO.contact_vat && <p className="text-sm text-gray-600">VAT: {selectedPO.contact_vat}</p>}
                  {selectedPO.contact_address && <p className="text-sm text-gray-600">{selectedPO.contact_address}</p>}
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={selectedPO.po_status} />
                {selectedPO.po_invoice_id && (
                  <p className="text-sm text-gray-500 mt-2">
                    Created from Invoice #{String(selectedPO.po_invoice_id).padStart(5, '0')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-teal-600 text-white text-xs uppercase tracking-wider">
                  <th className="text-center px-4 py-3 w-16">Qty</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3 w-28">Cost Price</th>
                  <th className="text-right px-4 py-3 w-28">Sale Price</th>
                  <th className="text-center px-4 py-3 w-16">VAT</th>
                  <th className="text-right px-4 py-3 w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((item, idx) => {
                  const lineTotal = (Number(item.item_cost) || 0) * (Number(item.item_qty) || 1);
                  return (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="text-center px-4 py-3">{item.item_qty}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.item_product}</td>
                      <td className="text-right px-4 py-3">{formatCurrency(item.item_cost)}</td>
                      <td className="text-right px-4 py-3 text-gray-500">{formatCurrency(item.item_price)}</td>
                      <td className="text-center px-4 py-3">
                        {item.item_vat ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Yes</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No</span>
                        )}
                      </td>
                      <td className="text-right px-4 py-3 font-medium">{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">No items</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mt-6">
              <div className="w-72 bg-gray-50 rounded-lg overflow-hidden">
                <div className="flex justify-between px-4 py-2 text-sm">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                {vatAmount > 0 && (
                  <div className="flex justify-between px-4 py-2 text-sm">
                    <span className="text-gray-500">VAT ({vatRate}%):</span>
                    <span className="font-semibold">{formatCurrency(vatAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-3 bg-teal-600 text-white font-bold">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {selectedPO.po_notes && (
            <div className="px-6 pb-6">
              <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-teal-500">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{selectedPO.po_notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Email Modal */}
        <EmailModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          onSend={handleSendEmail}
          defaultRecipient={selectedPO.contact_email || ''}
          defaultSubject={`Purchase Order ${selectedPO.po_number}`}
          documentType="Purchase Order"
          documentNumber={selectedPO.po_number || ''}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage purchase orders to suppliers</p>
        </div>
        <Can permission="invoices.create">
          <button
            onClick={() => navigate('/purchase-orders/new')}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium shadow-sm transition-all"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Purchase Order
          </button>
        </Can>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-xl overflow-hidden">
        <DataTable
          columns={columns}
          data={purchaseOrders}
          loading={loading}
          searchable={false}
          searchPlaceholder="Search purchase orders..."
          serverSide={true}
          currentPage={pagination.page}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          onPageChange={(page: number) => setPagination(prev => ({ ...prev, page }))}
          onSearch={(query: string) => {
            setSearch(query);
            setPagination(prev => ({ ...prev, page: 0 }));
          }}
          emptyMessage="No purchase orders found"
        />
      </div>
    </div>
  );
};

export default PurchaseOrders;
