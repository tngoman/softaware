import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusIcon, CheckIcon, DocumentArrowDownIcon, EyeIcon, PaperAirplaneIcon, BanknotesIcon, ArrowPathIcon, DocumentDuplicateIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { InvoiceModel, ContactModel, PaymentModel, CreditNoteModel, PurchaseOrderModel } from '../../models';
import AppSettingsModel from '../../models/AppSettingsModel';
import { API_BASE_URL } from '../../services/api';
import { useAppStore } from '../../store';
import { Invoice } from '../../types';
import { DataTable, BackButton, EmailModal, PaymentModal } from '../../components/UI';
import { PaymentStatusBadge } from '../../components/Invoices';
import { formatDate, formatCurrency, parseNotes } from '../../utils/formatters';
import Can from '../../components/Can';
import { notify } from '../../utils/notify';

const Invoices: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoices, setInvoices, customers, setCustomers } = useAppStore();
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'tax' | 'proforma'>('tax');

  // DataTable columns configuration
  const columns: any[] = [
    {
      accessorKey: 'invoice_id',
      header: 'Invoice #',
      cell: ({ getValue }: any) => `INV-${String(getValue()).padStart(5, '0')}`
    },
    {
      accessorKey: 'contact_name',
      header: 'Customer'
    },
    {
      accessorKey: 'invoice_date',
      header: 'Date',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'invoice_due_date',
      header: 'Due Date',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'invoice_total',
      header: 'Total',
      cell: ({ getValue }: any) => formatCurrency(getValue())
    },
    {
      accessorKey: 'invoice_payment_status',
      header: 'Status',
      cell: ({ getValue }: any) => <PaymentStatusBadge status={getValue()} />
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Can permission="invoices.view">
            <button
              onClick={() => viewInvoice(row.original)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
            >
              <EyeIcon className="h-3.5 w-3.5 mr-1" />
              View
            </button>
          </Can>
        </div>
      )
    }
  ];

  useEffect(() => {
    loadInvoices();
    loadCustomers();
  }, [pagination.page, pagination.limit, search, invoiceTypeFilter]);

  // Handle route changes - clear selection when no ID
  useEffect(() => {
    if (!id) {
      setSelectedInvoice(null);
    }
  }, [id]);

  // Load payments for a specific invoice
  const loadPayments = async (invoiceId: number) => {
    try {
      const paymentsData = await PaymentModel.getByInvoice(invoiceId);
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  // Handle finding existing invoices by ID
  useEffect(() => {
    if (id === 'new') {
      // Create a new invoice object for the form
      setSelectedInvoice({
        invoice_id: 0,
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        invoice_contact_id: 0,
        invoice_total: 0,
        invoice_vat: 0,
        invoice_status: 0, // Draft
        invoice_payment_status: 0, // Unpaid
        invoice_notes: '',
        contact_name: '',
        items: []
      } as Invoice);
    } else if (id && id !== 'new') {
      // Fetch full invoice from API to get items
      const fetchInvoice = async () => {
        try {
          const invoice = await InvoiceModel.getById(parseInt(id));
          console.log('Fetched invoice from API:', invoice);
          setSelectedInvoice(invoice);
          // Load payments for this invoice
          loadPayments(parseInt(id));
        } catch (error) {
          console.error('Error fetching invoice:', error);
          notify.error('Failed to load invoice');
          navigate('/invoices');
        }
      };
      fetchInvoice();
    }
  }, [id, navigate]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await InvoiceModel.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search,
        invoice_type: invoiceTypeFilter,
      });
      
      if (Array.isArray(data)) {
        setInvoices(data);
      } else {
        const responseData = data as any;
        setInvoices(responseData.data);
        if (responseData.pagination) {
          setPagination(prev => ({ 
            ...prev, 
            total: responseData.pagination.total 
          }));
        }
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      notify.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await ContactModel.getAll('customers');
      const items = Array.isArray(data)
        ? data
        : data.data;
      setCustomers(items);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const viewInvoice = (invoice: Invoice) => {
    navigate(`/invoices/${invoice.invoice_id}`);
  };

  const markAsPaid = async (invoiceId: number) => {
    try {
      await InvoiceModel.markAsPaid(invoiceId);
      notify.success('Invoice marked as paid');
      loadInvoices(); // Reload to get updated data
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      notify.error('Failed to mark invoice as paid');
    }
  };

  const handleSendEmail = async (data: { to: string; cc?: string; subject: string; body: string }) => {
    if (!selectedInvoice || !selectedInvoice.invoice_id) return;
    
    await InvoiceModel.sendEmail(selectedInvoice.invoice_id, data);
    // Reload to get updated status
    loadInvoices();
    if (selectedInvoice.invoice_id) {
      const updatedInvoice = await InvoiceModel.getById(selectedInvoice.invoice_id);
      setSelectedInvoice(updatedInvoice);
    }
  };

  const handleAddPayment = async (data: { payment_amount: number; payment_date: string; process_payment: boolean }) => {
    if (!selectedInvoice || !selectedInvoice.invoice_id) return;
    
    try {
      await PaymentModel.create({
        payment_invoice: selectedInvoice.invoice_id,
        payment_amount: data.payment_amount,
        payment_date: data.payment_date,
        process_payment: data.process_payment
      });
      
      notify.success(
        data.process_payment
          ? 'Payment has been recorded and added to your transactions'
          : 'Payment has been recorded'
      );
      
      setPaymentModalOpen(false);
      
      // Reload invoice and payments
      loadInvoices();
      if (selectedInvoice.invoice_id) {
        const updatedInvoice = await InvoiceModel.getById(selectedInvoice.invoice_id);
        setSelectedInvoice(updatedInvoice);
        loadPayments(selectedInvoice.invoice_id);
      }
    } catch (error: any) {
      console.error('Error recording payment:', error);
      notify.error(error.response?.data?.error || 'Failed to record payment');
      throw error; // Re-throw to keep modal open
    }
  };

  const handleProcessPayment = async (paymentId: number) => {
    if (!selectedInvoice || !selectedInvoice.invoice_id || !paymentId) return;

    try {
      const result = await PaymentModel.process({ payment_ids: [paymentId] });

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }

      notify.success('Payment has been processed into your transactions');

      loadPayments(selectedInvoice.invoice_id);
      const updatedInvoice = await InvoiceModel.getById(selectedInvoice.invoice_id);
      setSelectedInvoice(updatedInvoice);
    } catch (error: any) {
      console.error('Error processing payment:', error);
      notify.error(error.message || error.response?.data?.error || 'Unable to process payment');
    }
  };

  const handleProcessPendingPayments = async () => {
    if (!selectedInvoice || !selectedInvoice.invoice_id) return;

    try {
      const result = await PaymentModel.process({ invoice_id: selectedInvoice.invoice_id });

      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((err) => `#${err.payment_id}: ${err.message}`).join('\n');
        notify.warning(errorMessages);
      } else {
        notify.success('All pending payments were processed into transactions');
      }

      loadPayments(selectedInvoice.invoice_id);
      const updatedInvoice = await InvoiceModel.getById(selectedInvoice.invoice_id);
      setSelectedInvoice(updatedInvoice);
    } catch (error: any) {
      console.error('Error processing payments:', error);
      notify.error(error.message || error.response?.data?.error || 'Unable to process payments');
    }
  };

  const generatePDF = async (invoice: Invoice) => {
    try {
      if (!invoice.invoice_id) {
        notify.error('Invalid invoice ID');
        return;
      }
      setGeneratingPdf(true);
      
      const response = await InvoiceModel.generatePDF(invoice.invoice_id);
      
      if (response.success && response.path) {
        // Open the PDF in a new tab
        const pdfUrl = `${API_BASE_URL}/${response.path}`;
        window.open(pdfUrl, '_blank');
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

  const createNewInvoice = () => {
    navigate('/invoices/new');
  };

  const convertToTaxInvoice = async () => {
    if (!selectedInvoice || !selectedInvoice.invoice_id) return;
    try {
      const data = await InvoiceModel.convertToTax(selectedInvoice.invoice_id);
      notify.success('Tax invoice created from proforma');
      navigate(`/invoices/${data.data?.invoice_id || data.data?.id}`);
    } catch (error) {
      console.error('Error converting to tax invoice:', error);
      notify.error('Failed to create tax invoice');
    }
  };

  const createCreditNote = async () => {
    if (!selectedInvoice || !selectedInvoice.invoice_id) return;
    try {
      const data = await CreditNoteModel.createFromInvoice(selectedInvoice.invoice_id);
      notify.success('Credit note created');
      navigate(`/credit-notes/${data.id}`);
    } catch (error) {
      console.error('Error creating credit note:', error);
      notify.error('Failed to create credit note');
    }
  };

  const createPurchaseOrder = async () => {
    if (!selectedInvoice || !selectedInvoice.invoice_id) return;
    try {
      const data = await PurchaseOrderModel.createFromInvoice(selectedInvoice.invoice_id);
      notify.success('Purchase order created');
      navigate(`/purchase-orders/${data.data?.po_id || data.data?.id}`);
    } catch (error) {
      console.error('Error creating purchase order:', error);
      notify.error('Failed to create purchase order');
    }
  };

  // If viewing a specific invoice
  if (selectedInvoice) {
    // If it's a new invoice (id = 0), show create form
    if (selectedInvoice.invoice_id === 0) {
      return (
        <div className="space-y-6">
          <BackButton to="/invoices" label="Back to Invoices" />
          
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Create New Invoice</h1>
            
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-4">Invoice creation form is not yet implemented.</p>
              <p className="text-sm">This feature is under development.</p>
              <p className="text-sm mt-2">Please use the existing system for now.</p>
            </div>
          </div>
        </div>
      );
    }
    
    // Existing invoice detail view
    const pendingPayments = payments.filter((payment: any) => Number(payment.payment_processed ?? 0) !== 1);

    return (
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/invoices')}
              className="inline-flex items-center text-white hover:text-white/80 transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Invoices
            </button>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {(selectedInvoice as any).invoice_type === 'proforma' ? 'PROFORMA INVOICE' : 'TAX INVOICE'}
              </h1>
              <p className="text-xl font-semibold">
                #{String(selectedInvoice.invoice_id).padStart(5, '0')}
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <p><span className="font-semibold">Date:</span> {formatDate(selectedInvoice.invoice_date)}</p>
                <p><span className="font-semibold">Due Date:</span> {formatDate(selectedInvoice.invoice_valid_until || selectedInvoice.invoice_due_date)}</p>
              </div>
            </div>
            
            <div className="flex flex-col space-y-2">
              <Can permission="invoices.edit">
                <button
                  onClick={() => navigate(`/invoices/${selectedInvoice.invoice_id}/edit`)}
                  className="inline-flex items-center px-4 py-2 bg-white text-amber-600 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Invoice
                </button>
              </Can>
              <Can permission="invoices.view">
                <button
                  onClick={() => generatePDF(selectedInvoice)}
                  disabled={generatingPdf}
                  className="inline-flex items-center px-4 py-2 bg-white text-picton-blue rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium shadow-md transition-all"
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
              </Can>
              <Can permission="invoices.email">
                <button
                  onClick={() => setEmailModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
                >
                  <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                  Send Email
                </button>
              </Can>
              {selectedInvoice.invoice_payment_status !== 2 && (
                <Can permission="invoices.payments">
                  <button
                    onClick={() => setPaymentModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Add Payment
                  </button>
                </Can>
              )}
              {(selectedInvoice as any).invoice_type === 'proforma' && (
                <Can permission="invoices.edit">
                  <button
                    onClick={convertToTaxInvoice}
                    className="inline-flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium shadow-md transition-all"
                  >
                    <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
                    Create Tax Invoice
                  </button>
                </Can>
              )}
              <Can permission="invoices.edit">
                <button
                  onClick={createCreditNote}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-md transition-all"
                >
                  <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
                  Credit Note
                </button>
              </Can>
              <Can permission="invoices.edit">
                <button
                  onClick={createPurchaseOrder}
                  className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium shadow-md transition-all"
                >
                  <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2" />
                  Create PO
                </button>
              </Can>
            </div>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="bg-white shadow-xl rounded-xl border-2 border-gray-100 overflow-hidden">
          {/* Customer Information */}
          <div className="bg-gradient-to-r from-non-photo-blue/30 to-white p-6 border-b-2 border-picton-blue/20">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Invoice To</h3>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-gray-900">{selectedInvoice.contact_name || 'Unknown Customer'}</p>
                  {selectedInvoice.contact_phone && (
                    <p className="text-sm text-gray-600">Tel: {selectedInvoice.contact_phone}</p>
                  )}
                  {selectedInvoice.contact_email && (
                    <p className="text-sm text-gray-600">Email: {selectedInvoice.contact_email}</p>
                  )}
                  
                  {/* Parsed Notes in Customer Section */}
                  {Object.keys(parseNotes(selectedInvoice.invoice_notes)).length > 0 && (
                    <>
                      {Object.entries(parseNotes(selectedInvoice.invoice_notes)).map(([key, value]) => (
                        <p key={key} className="text-sm text-gray-600">
                          {key}: {value}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block">
                  <PaymentStatusBadge status={selectedInvoice.invoice_payment_status} />
                </div>
                {selectedInvoice.invoice_payment_date && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-semibold">Paid on:</span> {formatDate(selectedInvoice.invoice_payment_date)}
                  </p>
                )}
              </div>
            </div>
            
            {/* Invoice Details */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-x-8">
                <div className="flex">
                  <span className="text-sm font-semibold text-gray-700 mr-2">Invoice #:</span>
                  <span className="text-sm text-gray-900">INV-{String(selectedInvoice.invoice_id).padStart(5, '0')}</span>
                </div>
                <div className="flex">
                  <span className="text-sm font-semibold text-gray-700 mr-2">Date:</span>
                  <span className="text-sm text-gray-900">{formatDate(selectedInvoice.invoice_date)}</span>
                </div>
                <div className="flex">
                  <span className="text-sm font-semibold text-gray-700 mr-2">Due Date:</span>
                  <span className="text-sm text-gray-900">{formatDate(selectedInvoice.invoice_valid_until || selectedInvoice.invoice_due_date)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">VAT</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                    selectedInvoice.items.map((item: any, index: number) => {
                      const itemVat = (item.item_vat === 1 || item.item_vat === '1') 
                        ? (Number(item.item_qty) * Number(item.item_price) * 0.15) 
                        : 0;
                      return (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4 text-sm text-gray-900">{item.item_product}</td>
                          <td className="px-4 py-4 text-sm text-gray-600 text-center">{item.item_qty}</td>
                          <td className="px-4 py-4 text-sm text-gray-600 text-right">{formatCurrency(item.item_price)}</td>
                          <td className="px-4 py-4 text-sm text-gray-600 text-right">{formatCurrency(itemVat)}</td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.item_subtotal)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History Section */}
          {payments.length > 0 && (
            <div className="border-t-2 border-gray-200 bg-white">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
                {pendingPayments.length > 0 && (
                  <button
                    onClick={handleProcessPendingPayments}
                    className="inline-flex items-center gap-2 rounded-lg bg-picton-blue/10 px-3 py-1.5 text-xs font-semibold text-picton-blue hover:bg-picton-blue/20 transition-colors"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Process Pending ({pendingPayments.length})
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment ID
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      let runningBalance = Number(selectedInvoice.invoice_total || 0);
                      return payments.map((payment: any) => {
                        runningBalance -= Number(payment.payment_amount || 0);
                        const processed = Number(payment.payment_processed ?? 0) === 1;
                        return (
                          <tr key={payment.payment_id}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              #{String(payment.payment_id).padStart(5, '0')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(payment.payment_date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-scarlet font-medium text-right">
                              -{formatCurrency(Number(payment.payment_amount || 0))}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {processed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                                  <CheckIcon className="h-4 w-4" />
                                  Processed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                                  Pending
                                </span>
                              )}
                              {payment.transaction_id && (
                                <div className="mt-1 text-xs text-gray-500">Txn #{String(payment.transaction_id).padStart(5, '0')}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-semibold text-right">
                              {formatCurrency(Math.max(0, runningBalance))}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {!processed ? (
                                <button
                                  onClick={() => handleProcessPayment(Number(payment.payment_id))}
                                  className="inline-flex items-center gap-1 rounded-lg bg-picton-blue text-white px-3 py-1.5 text-xs font-semibold hover:bg-picton-blue/90 transition-colors"
                                >
                                  <ArrowPathIcon className="h-4 w-4" />
                                  Process
                                </button>
                              ) : (
                                <span className="text-xs text-gray-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals Section */}
          <div className="border-t-2 border-gray-200 bg-gray-50 p-6">
            <div className="max-w-md ml-auto space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Subtotal:</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(selectedInvoice.invoice_subtotal)}</span>
              </div>
              {Number(selectedInvoice.invoice_discount || 0) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">Discount:</span>
                  <span className="text-scarlet font-semibold">-{formatCurrency(selectedInvoice.invoice_discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">VAT (15%):</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(selectedInvoice.invoice_vat)}</span>
              </div>
              <div className="flex justify-between items-center text-lg border-t-2 border-gray-300 pt-3">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="font-bold text-picton-blue">{formatCurrency(selectedInvoice.invoice_total)}</span>
              </div>
              {payments.length > 0 && (
                <>
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span className="font-medium">Amount Paid:</span>
                    <span className="font-semibold text-green-600">
                      -{formatCurrency(payments.reduce((sum: number, p: any) => sum + Number(p.payment_amount), 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-lg border-t-2 border-gray-300 pt-3">
                    <span className="font-bold text-gray-900">Outstanding:</span>
                    <span className="font-bold text-orange-600">
                      {formatCurrency(Math.max(0, Number(selectedInvoice.invoice_total || 0) - payments.reduce((sum: number, p: any) => sum + Number(p.payment_amount || 0), 0)))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Email Modal */}
        <EmailModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          onSend={handleSendEmail}
          defaultRecipient={(selectedInvoice as Invoice).contact_email || ''}
          defaultSubject={`Invoice #${String((selectedInvoice as Invoice).invoice_id).padStart(5, '0')}`}
          documentType="Invoice"
          documentNumber={String((selectedInvoice as Invoice).invoice_id).padStart(5, '0')}
        />

        {/* Payment Modal */}
        <PaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onSubmit={handleAddPayment}
          invoiceId={selectedInvoice.invoice_id || 0}
          invoiceTotal={Number(selectedInvoice.invoice_total || 0)}
          amountPaid={payments.reduce((sum: number, p: any) => sum + Number(p.payment_amount || 0), 0)}
        />
      </div>
    );
  }

  // Main invoices list view
  return (
    <Can 
      permission="invoices.view"
      fallback={
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-500">You don't have permission to view invoices.</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {invoiceTypeFilter === 'proforma' ? 'Proforma Invoices' : 'Tax Invoices'}
            </h1>
            <p className="text-white/90">Manage your customer invoices and payments</p>
            {/* Type toggle */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setInvoiceTypeFilter('tax'); setPagination(prev => ({ ...prev, page: 0 })); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${invoiceTypeFilter === 'tax' ? 'bg-white text-picton-blue' : 'bg-white/20 text-white hover:bg-white/30'}`}
              >
                Tax Invoices
              </button>
              <button
                onClick={() => { setInvoiceTypeFilter('proforma'); setPagination(prev => ({ ...prev, page: 0 })); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${invoiceTypeFilter === 'proforma' ? 'bg-white text-amber-600' : 'bg-white/20 text-white hover:bg-white/30'}`}
              >
                Proforma Invoices
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Can permission="invoices.create">
              <button
                onClick={createNewInvoice}
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Invoice
              </button>
            </Can>
          </div>
        </div>
      </div>

      <DataTable
        data={invoices}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage="No invoices found. Create your first invoice to get started."
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
    </Can>
  );
};

export default Invoices;