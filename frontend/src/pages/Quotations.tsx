import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentDuplicateIcon, DocumentArrowDownIcon, PaperAirplaneIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline';
import { QuotationModel, ContactModel } from '../models';
import AppSettingsModel from '../models/AppSettingsModel';
import { useAppStore } from '../store';
import { Quotation, Contact } from '../types';
import { DataTable, BackButton, EmailModal } from '../components/UI';
import { QuotationStatusBadge } from '../components/Quotations';
import { formatDate, formatCurrency, parseNotes } from '../utils/formatters';
import Can from '../components/Can';
import { getApiBaseUrl, getAssetUrl } from '../config/app';
import Swal from 'sweetalert2';

const Quotations: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { quotations, setQuotations, customers, setCustomers } = useAppStore();
  
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');

  // Helper function for quote status badge
  const getStatusBadge = (status?: number) => {
    return <QuotationStatusBadge status={status} />;
  };

  // DataTable columns configuration
  const columns: any[] = [
    {
      accessorKey: 'quotation_id',
      header: 'Quote #',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-picton-blue">
          QUO-{String(getValue()).padStart(5, '0')}
        </span>
      )
    },
    {
      accessorKey: 'contact_name',
      header: 'Customer',
      cell: ({ getValue }: any) => (
        <span className="font-medium text-gray-900">{getValue()}</span>
      )
    },
    {
      accessorKey: 'quotation_date',
      header: 'Date',
      cell: ({ getValue }: any) => (
        <span className="text-sm text-gray-600">{formatDate(getValue())}</span>
      )
    },
    {
      accessorKey: 'quotation_valid_until',
      header: 'Valid Until',
      cell: ({ getValue }: any) => {
        const validDate = new Date(getValue());
        const today = new Date();
        const isExpired = validDate < today;
        return (
          <span className={`text-sm ${isExpired ? 'text-scarlet font-semibold' : 'text-gray-600'}`}>
            {formatDate(getValue())}
            {isExpired && ' (Expired)'}
          </span>
        );
      }
    },
    {
      accessorKey: 'quotation_total',
      header: 'Total',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-gray-900">{formatCurrency(getValue())}</span>
      )
    },
    {
      accessorKey: 'quotation_status',
      header: 'Status',
      cell: ({ getValue }: any) => getStatusBadge(getValue())
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Can permission="quotations.view">
            <button
              onClick={() => viewQuotation(row.original)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
            >
              <EyeIcon className="h-3.5 w-3.5 mr-1" />
              View
            </button>
          </Can>
          <Can permission="quotations.approve">
            <button
              onClick={() => convertToInvoice(row.original)}
              disabled={row.original.quotation_status === 2}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-scarlet hover:bg-scarlet/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DocumentDuplicateIcon className="h-3.5 w-3.5 mr-1" />
              Accept
            </button>
          </Can>
        </div>
      )
    }
  ];

  useEffect(() => {
    loadQuotations();
    loadCustomers();
  }, [pagination.page, pagination.limit, search]);

  // Handle route changes - clear selection when no ID
  useEffect(() => {
    if (!id) {
      setSelectedQuote(null);
    }
  }, [id]);

  // Handle finding existing quotations by ID
  useEffect(() => {
    if (id && id !== 'new') {
      // Fetch full quotation from API to get items
      const fetchQuotation = async () => {
        try {
          setLoading(true);
          const quote = await QuotationModel.getById(parseInt(id));
          console.log('Fetched quotation from API:', quote);
          setSelectedQuote(quote);
        } catch (error) {
          console.error('Error fetching quotation:', error);
          Swal.fire({
            icon: 'error',
            title: 'Failed to Load',
            text: 'Failed to load quotation'
          });
          navigate('/quotations');
        } finally {
          setLoading(false);
        }
      };
      fetchQuotation();
    }
  }, [id]);

  const loadQuotations = async () => {
    try {
      setLoading(true);
      const data = await QuotationModel.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search
      });
      
      if (Array.isArray(data)) {
        setQuotations(data);
      } else {
        const responseData = data as any;
        setQuotations(responseData.data || []);
        // Update total from pagination response
        if (responseData.pagination) {
          setPagination(prev => ({ 
            ...prev, 
            total: responseData.pagination.total 
          }));
        }
      }
    } catch (error: any) {
      console.error('Error loading quotations:', error);
      // Set empty array on error to prevent undefined issues
      setQuotations([]);
      // Only show error toast if it's not a 401 (which would trigger logout)
      if (error.response?.status !== 401) {
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load',
          text: 'Failed to load quotations'
        });
      }
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

  const viewQuotation = (quotation: Quotation) => {
    navigate(`/quotations/${quotation.quotation_id}`);
  };

  const convertToInvoice = async (quotation: Quotation) => {
    const result = await Swal.fire({
      title: 'Convert to Invoice?',
      text: 'Are you sure you want to convert this quotation to an invoice?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#00A4EE',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, convert it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        if (!quotation.quotation_id) {
          Swal.fire({
            icon: 'error',
            title: 'Invalid Quotation',
            text: 'Invalid quotation ID'
          });
          return;
        }
        const data = await QuotationModel.convertToInvoice(quotation.quotation_id);
        Swal.fire({
          icon: 'success',
          title: 'Converted!',
          text: 'Quotation converted to invoice',
          timer: 2000,
          showConfirmButton: false
        });
        navigate(`/invoices/${data.invoice_id}`);
      } catch (error) {
        console.error('Error converting quotation:', error);
        Swal.fire({
          icon: 'error',
          title: 'Conversion Failed',
          text: 'Failed to convert quotation'
        });
      }
    }
  };

  const generatePDF = async (quotation: Quotation) => {
    try {
      if (!quotation.quotation_id) {
        Swal.fire({
          icon: 'error',
          title: 'Invalid Quotation',
          text: 'Invalid quotation ID'
        });
        return;
      }
      setGeneratingPdf(true);

      // Call backend API to generate PDF using mPDF
      const response = await QuotationModel.generatePDF(quotation.quotation_id);
      
      // Get the base URL for downloading
      const settings = await AppSettingsModel.get();
      const baseUrl = (settings as any).site_base_url || getApiBaseUrl();
      
      // Open the PDF in a new tab instead of downloading
      const pdfUrl = `${baseUrl}/${response.path}`;
      window.open(pdfUrl, '_blank');
      
      Swal.fire({
        icon: 'success',
        title: 'PDF Generated!',
        text: 'PDF opened in new tab',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: 'Failed to generate PDF'
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendEmail = async (data: { to: string; subject: string; body: string }) => {
    if (!selectedQuote || !selectedQuote.quotation_id) return;
    
    try {
      await QuotationModel.sendEmail(selectedQuote.quotation_id, data);
      Swal.fire({
        icon: 'success',
        title: 'Email Sent!',
        text: 'Email sent successfully',
        timer: 2000,
        showConfirmButton: false
      });
      setEmailModalOpen(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Send',
        text: error.response?.data?.error || 'Failed to send email'
      });
      throw error; // Re-throw to keep modal open
    }
  };

  const createNewQuotation = () => {
    navigate('/quotations/new');
  };

  // If viewing a specific quotation detail
  if (selectedQuote) {
    console.log('Selected Quote:', selectedQuote);
    console.log('Quote Items:', selectedQuote.items);
    console.log('Items length:', selectedQuote.items?.length);
    
    return (
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/quotations')}
              className="inline-flex items-center text-white hover:text-white/80 transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Quotations
            </button>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                QUOTATION
              </h1>
              <p className="text-xl font-semibold">
                #{String(selectedQuote.quotation_id).padStart(5, '0')}
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <p><span className="font-semibold">Date:</span> {formatDate(selectedQuote.quotation_date)}</p>
                <p><span className="font-semibold">Valid Until:</span> {formatDate(selectedQuote.quotation_valid_until)}</p>
              </div>
            </div>
            
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => generatePDF(selectedQuote)}
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
              {pdfPath && (
                <button
                  onClick={() => window.open(getAssetUrl(pdfPath), '_blank')}
                  className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
                >
                  <EyeIcon className="h-5 w-5 mr-2" />
                  View PDF
                </button>
              )}
              <button
                onClick={() => setEmailModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
              >
                <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                Send Email
              </button>
              <Can permission="quotations.edit">
                <button
                  onClick={() => navigate(`/quotations/${selectedQuote.quotation_id}/edit`)}
                  className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 font-medium shadow-md transition-all"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Quotation
                </button>
              </Can>
              <Can permission="quotations.approve">
                <button
                  onClick={() => convertToInvoice(selectedQuote)}
                  disabled={selectedQuote.quotation_status === 2}
                  className="inline-flex items-center px-4 py-2 bg-scarlet text-white rounded-lg hover:bg-scarlet/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md transition-all"
                >
                  <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
                  {selectedQuote.quotation_status === 2 ? 'Already Accepted' : 'Create Invoice'}
                </button>
              </Can>
            </div>
          </div>
        </div>

        {/* Quote Document */}
        <div className="bg-white shadow-xl rounded-xl border-2 border-gray-100 overflow-hidden">
          {/* Customer Information */}
          <div className="bg-gradient-to-r from-non-photo-blue/30 to-white p-6 border-b-2 border-picton-blue/20">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quotation To</h3>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-gray-900">{selectedQuote.contact_name || 'Unknown Customer'}</p>
                  {selectedQuote.contact_phone && (
                    <p className="text-sm text-gray-600">Tel: {selectedQuote.contact_phone}</p>
                  )}
                  {selectedQuote.contact_email && (
                    <p className="text-sm text-gray-600">Email: {selectedQuote.contact_email}</p>
                  )}
                  
                  {/* Parsed Notes in Customer Section */}
                  {Object.keys(parseNotes(selectedQuote.quotation_notes)).length > 0 && (
                    <>
                      {Object.entries(parseNotes(selectedQuote.quotation_notes)).map(([key, value]) => (
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
                  {getStatusBadge(selectedQuote.quotation_status)}
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
                  {selectedQuote.items && selectedQuote.items.length > 0 ? (
                    selectedQuote.items.map((item: any, index: number) => {
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

          {/* Totals Section */}
          <div className="border-t-2 border-gray-200 bg-gray-50 p-6">
            <div className="max-w-md ml-auto space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Subtotal:</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(selectedQuote.quotation_subtotal)}</span>
              </div>
              {Number(selectedQuote.quotation_discount || 0) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">Discount:</span>
                  <span className="text-red-600 font-semibold">-{formatCurrency(selectedQuote.quotation_discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">VAT (15%):</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(selectedQuote.quotation_vat)}</span>
              </div>
              <div className="pt-3 border-t-2 border-picton-blue/30">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-picton-blue">{formatCurrency(selectedQuote.quotation_total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <EmailModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          onSend={handleSendEmail}
          defaultRecipient={selectedQuote.contact_email}
          defaultSubject={`Quotation #QUO-${String(selectedQuote.quotation_id).padStart(5, '0')}`}
          documentType="Quote"
          documentNumber={`QUO-${String(selectedQuote.quotation_id).padStart(5, '0')}`}
        />
      </div>
    );
  }

  // Main quotations list view
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Quotations</h1>
            <p className="text-white/90">Manage your customer quotations and convert them to invoices</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search quotations..."
                className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
                onChange={(e) => {
                  // Add search handler here if needed
                }}
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Can permission="quotations.create">
              <button
                onClick={createNewQuotation}
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Quotation
              </button>
            </Can>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Total Quotes</p>
                <p className="text-2xl font-bold mt-1">{pagination.total}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-bold mt-1">
                  {quotations.filter(q => q.quotation_status === 0).length}
                </p>
              </div>
              <div className="bg-amber-400/30 rounded-full p-3">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Total Value</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(quotations.reduce((sum, q) => sum + Number(q.quotation_total || 0), 0))}
                </p>
              </div>
              <div className="bg-green-400/30 rounded-full p-3">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        <DataTable
          data={quotations}
          columns={columns}
          loading={loading}
          searchable={false}
          emptyMessage="No quotations found. Create your first quotation to get started."
          serverSide={true}
          currentPage={pagination.page}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          onPageChange={(page: number) => setPagination(prev => ({ ...prev, page }))}
        />
      </div>
    </div>
  );
};

export default Quotations;