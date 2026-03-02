import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { ContactModel } from '../models';
import { BackButton } from '../components/UI';
import { formatDate } from '../utils/formatters';
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
  contact: any;
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

const Statement: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatementData | null>(null);

  useEffect(() => {
    if (id) {
      loadStatement();
    }
  }, [id]);

  const loadStatement = async () => {
    try {
      setLoading(true);
      const data = await ContactModel.getStatementData(parseInt(id!));
      setData(data);
    } catch (error) {
      console.error('Error loading statement:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load statement' });
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (id) {
      ContactModel.downloadStatement(parseInt(id));
      Swal.fire({ icon: 'success', title: 'Success!', text: 'Downloading statement...', timer: 2000, showConfirmButton: false });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No statement data available</p>
      </div>
    );
  }

  const { contact, transactions, closing_balance, aging } = data;

  return (
    <div className="space-y-6">
      <BackButton to="/contacts" label="Back to Contacts" />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customer Statement</h1>
          <p className="text-sm text-gray-600">{contact.contact_company || contact.contact_person}</p>
        </div>
        <button
          onClick={downloadPDF}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Download PDF
        </button>
      </div>

      {/* Customer Details */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 bg-blue-50">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Account Details</h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{contact.contact_company || contact.contact_person}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Statement Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(new Date().toISOString())}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Contact Person</dt>
              <dd className="mt-1 text-sm text-gray-900">{contact.contact_person || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{contact.contact_email || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{contact.contact_phone || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">VAT Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{contact.contact_vat_number || '-'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Aging Summary */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 bg-red-50">
          <h3 className="text-lg leading-6 font-medium text-red-900">Account Aging Summary</h3>
        </div>
        <div className="border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-6">
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-600 mb-2">CURRENT (0-30 days)</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(aging.current)}</div>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-600 mb-2">31-60 DAYS</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(aging['30_days'])}</div>
            </div>
            <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-600 mb-2">61-90 DAYS</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(aging['60_days'])}</div>
            </div>
            <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-600 mb-2">90+ DAYS</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(aging['90_days'])}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Transaction History</h3>
        </div>
        <div className="border-t border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-blue-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((trans, index) => (
                <tr
                  key={index}
                  className={trans.type === 'payment' ? 'bg-green-50' : undefined}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(trans.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trans.description}
                    {trans.days_overdue && trans.days_overdue > 0 && (
                      <span className="ml-2 text-xs text-red-600 font-semibold">
                        ({trans.days_overdue} days overdue)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {formatCurrency(trans.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {formatCurrency(trans.balance)}
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-600">
                <td colSpan={2}></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white text-right">
                  CLOSING BALANCE:
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white text-right">
                  {formatCurrency(closing_balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-600">
        <p>This is a computer-generated statement and does not require a signature.</p>
        <p>Please contact us if you have any questions regarding this statement.</p>
      </div>
    </div>
  );
};

export default Statement;
