import React, { useState } from 'react';
import { PrinterIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { FinancialReportModel } from '../../models';
import { BackButton, CustomDatePicker } from '../../components/UI';
import { formatDate } from '../../utils/formatters';
import Can from '../../components/Can';
import { notify } from '../../utils/notify';

const BalanceSheet: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<any>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }).format(amount).replace('ZAR', 'R');
  };

  const generateReport = async () => {
    try {
      setLoading(true);
      const data = await FinancialReportModel.balanceSheet(asOfDate);
      setReport(data);
      notify.success('Balance Sheet generated');
    } catch (error) {
      console.error('Error generating Balance Sheet:', error);
      notify.error('Failed to generate Balance Sheet');
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <Can 
      permission="reports.view"
      fallback={
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <LockClosedIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-500">You don't have permission to view financial reports.</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Balance Sheet</h1>
            <p className="text-white/90">Statement of Financial Position</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-48">
              <CustomDatePicker
                value={asOfDate ? new Date(asOfDate) : null}
                onChange={(date) => setAsOfDate(date ? date.toISOString().split('T')[0] : '')}
                placeholder="As of Date"
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
              <h3 className="text-xl font-bold text-gray-900">Balance Sheet</h3>
              <p className="text-sm text-gray-600">
                As at {formatDate(report.as_of_date)}
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

          <div className="space-y-6">
            {/* ASSETS */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-gray-200 pb-2">
                Assets
              </h4>

              {/* Current Assets */}
              <div className="ml-4 mb-4">
                <h5 className="text-md font-semibold text-gray-800 mb-2">Current Assets</h5>
                <table className="min-w-full">
                  <tbody>
                    <tr>
                      <td className="py-1 text-sm text-gray-700 pl-4">Bank</td>
                      <td className="py-1 text-sm text-right font-medium w-32">
                        {formatCurrency(report.assets.current_assets.bank)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 text-sm text-gray-700 pl-4">Accounts Receivable</td>
                      <td className="py-1 text-sm text-right font-medium">
                        {formatCurrency(report.assets.current_assets.accounts_receivable)}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200">
                      <td className="py-2 text-sm font-semibold text-gray-900">Total Current Assets</td>
                      <td className="py-2 text-sm text-right font-bold">
                        {formatCurrency(report.assets.current_assets.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Fixed Assets */}
              <div className="ml-4 mb-4">
                <h5 className="text-md font-semibold text-gray-800 mb-2">Fixed Assets</h5>
                <table className="min-w-full">
                  <tbody>
                    <tr>
                      <td className="py-1 text-sm text-gray-700 pl-4">Computer Equipment</td>
                      <td className="py-1 text-sm text-right font-medium w-32">
                        {formatCurrency(report.assets.fixed_assets.computer_equipment)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 text-sm text-gray-700 pl-4">Office Equipment</td>
                      <td className="py-1 text-sm text-right font-medium">
                        {formatCurrency(report.assets.fixed_assets.office_equipment)}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200">
                      <td className="py-2 text-sm font-semibold text-gray-900">Total Fixed Assets</td>
                      <td className="py-2 text-sm text-right font-bold">
                        {formatCurrency(report.assets.fixed_assets.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Assets */}
              <div className="border-t-2 border-gray-900 pt-2">
                <table className="min-w-full">
                  <tbody>
                    <tr className="bg-gray-50">
                      <td className="py-2 text-md font-bold text-gray-900">Total Assets</td>
                      <td className="py-2 text-md text-right font-bold text-gray-900 w-32">
                        {formatCurrency(report.assets.total_assets)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* LIABILITIES */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-gray-200 pb-2">
                Liabilities
              </h4>

              {/* Current Liabilities */}
              <div className="ml-4 mb-4">
                <h5 className="text-md font-semibold text-gray-800 mb-2">Current Liabilities</h5>
                <table className="min-w-full">
                  <tbody>
                    <tr>
                      <td className="py-1 text-sm text-gray-700 pl-4">Accounts Payable</td>
                      <td className="py-1 text-sm text-right font-medium w-32">
                        {formatCurrency(report.liabilities.current_liabilities.accounts_payable)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 text-sm text-gray-700 pl-4">Sales Tax</td>
                      <td className="py-1 text-sm text-right font-medium">
                        {formatCurrency(report.liabilities.current_liabilities.sales_tax)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 text-sm text-gray-700 pl-4">Unpaid Expense Claims</td>
                      <td className="py-1 text-sm text-right font-medium">
                        {formatCurrency(report.liabilities.current_liabilities.unpaid_expense_claims)}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200">
                      <td className="py-2 text-sm font-semibold text-gray-900">Total Current Liabilities</td>
                      <td className="py-2 text-sm text-right font-bold">
                        {formatCurrency(report.liabilities.current_liabilities.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Liabilities */}
              <div className="border-t-2 border-gray-900 pt-2">
                <table className="min-w-full">
                  <tbody>
                    <tr className="bg-gray-50">
                      <td className="py-2 text-md font-bold text-gray-900">Total Liabilities</td>
                      <td className="py-2 text-md text-right font-bold text-gray-900 w-32">
                        {formatCurrency(report.liabilities.total_liabilities)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* EQUITY */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-gray-200 pb-2">
                Equity
              </h4>

              <div className="ml-4">
                <table className="min-w-full">
                  <tbody>
                    <tr>
                      <td className="py-1 text-sm text-gray-700 pl-4">Net Assets</td>
                      <td className="py-1 text-sm text-right font-medium w-32">
                        {formatCurrency(report.equity.net_assets)}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-gray-900">
                      <td className="py-2 text-md font-bold text-gray-900">Total Equity</td>
                      <td className="py-2 text-md text-right font-bold text-gray-900">
                        {formatCurrency(report.equity.total_equity)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Balance Check */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">Assets = Liabilities + Equity</span>
                <span className="text-sm font-mono text-blue-900">
                  {formatCurrency(report.assets.total_assets)} = {' '}
                  {formatCurrency(report.liabilities.total_liabilities)} + {' '}
                  {formatCurrency(report.equity.total_equity)}
                </span>
              </div>
              {Math.abs(report.assets.total_assets - (report.liabilities.total_liabilities + report.equity.total_equity)) < 0.01 ? (
                <p className="text-xs text-blue-700 mt-1">✓ Balance Sheet is balanced</p>
              ) : (
                <p className="text-xs text-red-700 mt-1">⚠ Balance Sheet is not balanced</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">Select a date and click Generate to view the Balance Sheet</p>
        </div>
      )}
      </div>
    </Can>
  );
};

export default BalanceSheet;
