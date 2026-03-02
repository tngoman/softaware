import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowDownTrayIcon, 
  PencilIcon, 
  DocumentTextIcon,
  DocumentDuplicateIcon,
  UserIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ReceiptPercentIcon,
  BanknotesIcon,
  ClockIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { ContactModel, InvoiceModel, QuotationModel } from '../models';
import { Contact, Invoice, Quotation } from '../types';
import { BackButton, Card, DataTable } from '../components/UI';
import { PaymentStatusBadge } from '../components/Invoices';
import { QuotationStatusBadge } from '../components/Quotations';
import { formatCurrency, formatDate } from '../utils/formatters';
import { API_BASE_URL } from '../services/api';
import Swal from 'sweetalert2';

interface Transaction {
  type: 'invoice' | 'payment';
  date: string;
  due_date?: string;
  description: string;
  invoice_id?: number;
  amount: number;
  balance: number;
  payment_status?: number;
  days_overdue?: number;
}

interface StatementData {
  contact: Contact;
  transactions: Transaction[];
  closing_balance: number;
  aging: {
    current: number;
    '30_days': number;
    '60_days': number;
    '90_days': number;
    total: number;
  };
}

const ContactDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [contact, setContact] = useState<Contact | null>(null);
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'quotations' | 'statement'>('overview');

  const isCustomer = contact?.contact_type === 1;
  const isSupplier = contact?.contact_type === 2;
  const contactTypeLabel = isCustomer ? 'Customer' : 'Supplier';

  useEffect(() => {
    if (id) {
      loadContactData();
    }
  }, [id]);

  const loadContactData = async () => {
    try {
      setLoading(true);
      
      // Load contact details
      const contactData = await ContactModel.getById(parseInt(id!));
      setContact(contactData);

      // Load invoices if customer
      if (contactData.contact_type === 1) {
        loadInvoices(parseInt(id!));
        loadQuotations(parseInt(id!));
        loadStatementData(parseInt(id!));
      }
    } catch (error) {
      console.error('Error loading contact:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load contact details' });
      navigate('/contacts');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async (contactId: number) => {
    try {
      const data = await InvoiceModel.getAll({ limit: 100 });
      const contactInvoices = Array.isArray(data) 
        ? data.filter((inv: Invoice) => inv.invoice_contact_id === contactId)
        : data.data.filter((inv: Invoice) => inv.invoice_contact_id === contactId);
      setInvoices(contactInvoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const loadQuotations = async (contactId: number) => {
    try {
      const data = await QuotationModel.getAll({ limit: 100 });
      const contactQuotations = Array.isArray(data)
        ? data.filter((quo: Quotation) => quo.quotation_contact_id === contactId)
        : data.data.filter((quo: Quotation) => quo.quotation_contact_id === contactId);
      setQuotations(contactQuotations);
    } catch (error) {
      console.error('Error loading quotations:', error);
    }
  };

  const loadStatementData = async (contactId: number) => {
    try {
      const data = await ContactModel.getStatementData(contactId);
      setStatementData(data);
    } catch (error) {
      console.error('Error loading statement:', error);
    }
  };

  const handleEdit = () => {
    navigate(`/contacts?edit=${id}`);
  };

  const downloadStatement = async () => {
    if (id) {
      try {
        const response = await ContactModel.downloadStatement(parseInt(id));
        
        if (response.success && response.path) {
          // Open the PDF in a new tab
          const pdfUrl = `${API_BASE_URL}/${response.path}`;
          window.open(pdfUrl, '_blank');
          Swal.fire({ 
            icon: 'success', 
            title: 'Success!', 
            text: 'Statement generated successfully', 
            timer: 2000, 
            showConfirmButton: false 
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: 'Failed to generate statement'
          });
        }
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to download statement'
        });
      }
    }
  };

  const calculateTotals = () => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.invoice_total || 0), 0);
    
    // Calculate actual outstanding based on payments
    const totalOutstanding = invoices.reduce((sum, inv) => {
      const amountPaid = (inv as any).amount_paid || 0;
      const outstanding = (inv.invoice_total || 0) - amountPaid;
      return sum + Math.max(0, outstanding);
    }, 0);
    
    // Calculate actual paid based on payments
    const totalPaid = invoices.reduce((sum, inv) => {
      return sum + ((inv as any).amount_paid || 0);
    }, 0);
    
    return { totalInvoiced, totalOutstanding, totalPaid };
  };

  // Invoice columns for DataTable
  const invoiceColumns: any[] = [
    {
      accessorKey: 'invoice_id',
      header: 'Invoice #',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-picton-blue">
          INV-{String(getValue()).padStart(5, '0')}
        </span>
      )
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
      header: 'Amount',
      cell: ({ getValue }: any) => (
        <span className="font-semibold">{formatCurrency(getValue())}</span>
      )
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
        <button
          onClick={() => navigate(`/invoices/${row.original.invoice_id}`)}
          className="text-picton-blue hover:text-picton-blue/80 text-sm font-medium"
        >
          View
        </button>
      )
    }
  ];

  // Quotation columns for DataTable
  const quotationColumns: any[] = [
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
      accessorKey: 'quotation_date',
      header: 'Date',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'quotation_valid_until',
      header: 'Valid Until',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'quotation_total',
      header: 'Amount',
      cell: ({ getValue }: any) => (
        <span className="font-semibold">{formatCurrency(getValue())}</span>
      )
    },
    {
      accessorKey: 'quotation_status',
      header: 'Status',
      cell: ({ getValue }: any) => <QuotationStatusBadge status={getValue()} />
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <button
          onClick={() => navigate(`/quotations/${row.original.quotation_id}`)}
          className="text-picton-blue hover:text-picton-blue/80 text-sm font-medium"
        >
          View
        </button>
      )
    }
  ];

  if (loading || !contact) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-picton-blue"></div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              {isCustomer ? (
                <UserIcon className="h-8 w-8 text-white" />
              ) : (
                <BuildingOfficeIcon className="h-8 w-8 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{contact.contact_name}</h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm">
                  {contactTypeLabel}
                </span>
              </div>
              {contact.contact_person && (
                <p className="text-white/90 text-lg">{contact.contact_person}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleEdit}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit {contactTypeLabel}
            </button>
            <BackButton to="/contacts" />
          </div>
        </div>

        {/* Contact Information in Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/20">
          {contact.contact_email && (
            <div className="flex items-start gap-2">
              <EnvelopeIcon className="h-5 w-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-xs text-white/70 mb-0.5">Email</p>
                <a href={`mailto:${contact.contact_email}`} className="text-white hover:text-white/80 text-sm font-medium">
                  {contact.contact_email}
                </a>
              </div>
            </div>
          )}

          {contact.contact_phone && (
            <div className="flex items-start gap-2">
              <PhoneIcon className="h-5 w-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-xs text-white/70 mb-0.5">Phone</p>
                <a href={`tel:${contact.contact_phone}`} className="text-white text-sm font-medium">
                  {contact.contact_phone}
                </a>
              </div>
            </div>
          )}

          {contact.contact_vat && (
            <div className="flex items-start gap-2">
              <ReceiptPercentIcon className="h-5 w-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-xs text-white/70 mb-0.5">VAT Number</p>
                <p className="text-white text-sm font-medium">{contact.contact_vat}</p>
              </div>
            </div>
          )}

          {contact.contact_address && (
            <div className="flex items-start gap-2">
              <MapPinIcon className="h-5 w-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-xs text-white/70 mb-0.5">Address</p>
                <p className="text-white text-sm font-medium whitespace-pre-line">{contact.contact_address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs for Customer Details */}
      {isCustomer && (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ChartBarIcon className="h-5 w-5 inline mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'invoices'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DocumentDuplicateIcon className="h-5 w-5 inline mr-2" />
                Invoices ({invoices.length})
              </button>
              <button
                onClick={() => setActiveTab('quotations')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'quotations'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DocumentTextIcon className="h-5 w-5 inline mr-2" />
                Quotations ({quotations.length})
              </button>
              <button
                onClick={() => setActiveTab('statement')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'statement'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BanknotesIcon className="h-5 w-5 inline mr-2" />
                Statement
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'overview' && (
              invoices.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Summary Stats */}
                <Card>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Financial Summary</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Total Invoiced</span>
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(totals.totalInvoiced)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Outstanding</span>
                      <span className="text-lg font-bold text-scarlet">{formatCurrency(totals.totalOutstanding)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Paid</span>
                      <span className="text-lg font-bold text-green-600">{formatCurrency(totals.totalPaid)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Invoices</span>
                      <span className="text-lg font-bold text-gray-900">{invoices.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Quotes</span>
                      <span className="text-lg font-bold text-gray-900">{quotations.length}</span>
                    </div>
                  </div>
                </Card>

                {/* Recent Invoices */}
                <Card className="lg:col-span-2">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Invoices</h3>
                  <div className="space-y-3">
                    {invoices.slice(0, 5).map((invoice) => (
                      <div 
                        key={invoice.invoice_id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/invoices/${invoice.invoice_id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100">
                            <DocumentDuplicateIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Invoice #{String(invoice.invoice_id).padStart(5, '0')}
                            </p>
                            <p className="text-sm text-gray-500">{formatDate(invoice.invoice_date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(invoice.invoice_total)}
                          </p>
                          <PaymentStatusBadge status={invoice.invoice_payment_status} />
                        </div>
                      </div>
                    ))}
                    {invoices.length > 5 && (
                      <button
                        onClick={() => setActiveTab('invoices')}
                        className="w-full mt-2 text-sm text-picton-blue hover:text-picton-blue/80 font-medium"
                      >
                        View all {invoices.length} invoices →
                      </button>
                    )}
                  </div>
                </Card>
              </div>
              ) : (
                <Card>
                  <div className="text-center py-12">
                    <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Data</h3>
                    <p className="text-gray-500">
                      Customer activity and aging analysis will appear here once invoices are created.
                    </p>
                  </div>
                </Card>
              )
            )}

            {activeTab === 'invoices' && (
              <Card>
                <DataTable
                  data={invoices}
                  columns={invoiceColumns}
                  searchable={true}
                  emptyMessage="No invoices found for this customer."
                />
              </Card>
            )}

            {activeTab === 'quotations' && (
              <Card>
                <DataTable
                  data={quotations}
                  columns={quotationColumns}
                  searchable={true}
                  emptyMessage="No quotations found for this customer."
                />
              </Card>
            )}

            {activeTab === 'statement' && (
              invoices.length > 0 && statementData ? (
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Account Statement</h3>
                  <button
                    onClick={downloadStatement}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-picton-blue hover:bg-picton-blue/90 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Download PDF
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {statementData.transactions.map((transaction, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(transaction.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {transaction.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                            {transaction.type === 'invoice' && formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                            {transaction.type === 'payment' && formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {formatCurrency(transaction.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                          Closing Balance:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-picton-blue">
                          {formatCurrency(statementData.closing_balance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
              ) : (
                <Card>
                  <div className="text-center py-12">
                    <ClockIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Statement Loading...</h3>
                    <p className="text-gray-500 mb-4">
                      The detailed account statement with payment history is being prepared.
                    </p>
                    <p className="text-sm text-gray-400">
                      You can view individual invoices in the "Invoices" tab above.
                    </p>
                  </div>
                </Card>
              )
            )}
          </div>
        </>
      )}

      {/* Supplier-specific content (if needed in future) */}
      {isSupplier && (
        <Card>
          <div className="text-center py-12">
            <BuildingOfficeIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Supplier Information</h3>
            <p className="text-gray-500">
              Additional supplier-specific features can be added here in the future.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ContactDetails;
