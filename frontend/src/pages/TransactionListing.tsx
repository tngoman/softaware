import React, { useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { FinancialReportModel } from '../models';
import { BackButton, CustomDatePicker } from '../components/UI';
import { formatDate } from '../utils/formatters';
import Swal from 'sweetalert2';

const TransactionListing: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [type, setType] = useState<string>('all');
  const [report, setReport] = useState<any>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }).format(amount).replace('ZAR', 'R');
  };

  const generateReport = async () => {
    if (!period.start || !period.end) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Please select both start and end dates' });
      return;
    }

    try {
      setLoading(true);
      const filterType = type === 'all' ? undefined : type;
      const data = await FinancialReportModel.transactionListing(period.start, period.end, filterType);
      setReport(data);
      Swal.fire({ 
        icon: 'success', 
        title: 'Success!', 
        text: 'Transaction listing generated', 
        timer: 2000, 
        showConfirmButton: false 
      });
    } catch (error) {
      console.error('Error generating transaction listing:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to generate transaction listing' });
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Transaction Listing</h1>
            <p className="text-white/90">Detailed transaction register</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm [&>option]:text-gray-900"
            >
              <option value="all">All Transactions</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
            <div className="w-44">
              <CustomDatePicker
                value={period.start ? new Date(period.start) : null}
                onChange={(date) => setPeriod({ ...period, start: date ? date.toISOString().split('T')[0] : '' })}
                placeholder="Period Start"
                className="!px-4 !py-2 !pl-10 !rounded-lg !bg-white/10 !border-white/20 !text-white placeholder:!text-white/60 !shadow-none focus:!ring-2 focus:!ring-white/50 !backdrop-blur-sm"
                iconClassName="text-white/60"
              />
            </div>
            <div className="w-44">
              <CustomDatePicker
                value={period.end ? new Date(period.end) : null}
                onChange={(date) => setPeriod({ ...period, end: date ? date.toISOString().split('T')[0] : '' })}
                placeholder="Period End"
                className="!px-4 !py-2 !pl-10 !rounded-lg !bg-white/10 !border-white/20 !text-white placeholder:!text-white/60 !shadow-none focus:!ring-2 focus:!ring-white/50 !backdrop-blur-sm"
                iconClassName="text-white/60"
              />
            </div>
            <button
              onClick={generateReport}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-picton-blue font-medium text-sm hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Generating...' : 'Generate'}
            </button>
            <BackButton to="/transactions" />
          </div>
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="bg-white shadow rounded-lg p-6 print:shadow-none">
          <div className="flex justify-between items-center mb-6 print:mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Transaction Listing Report</h3>
              <p className="text-sm text-gray-600">
                {formatDate(report.period.start)} - {' '}
                {formatDate(report.period.end)}
                {' '} ({report.count} transactions)
              </p>
            </div>
            <button
              onClick={printReport}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 print:hidden"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              Print
            </button>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier/Customer
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VAT
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.transactions.map((transaction: any) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {transaction.supplier}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        transaction.type === 'income' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type === 'income' ? 'Sales' : 'Purchases'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {transaction.reference}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium">
                      {formatCurrency(transaction.net)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium">
                      {formatCurrency(transaction.vat)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium">
                      {formatCurrency(transaction.gross)}
                    </td>
                  </tr>
                ))}
                {report.transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                      No transactions found for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
              {report.transactions.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-900">
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-sm font-bold text-gray-900">
                      Total ({report.count} transactions)
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-bold text-gray-900">
                      {formatCurrency(report.totals.net)}
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-bold text-gray-900">
                      {formatCurrency(report.totals.vat)}
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-bold text-gray-900">
                      {formatCurrency(report.totals.gross)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">Select a period and click Generate to view the transaction listing</p>
        </div>
      )}
    </div>
  );
};

export default TransactionListing;
