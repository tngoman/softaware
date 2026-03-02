import React, { useState } from 'react';
import { PrinterIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { FinancialReportModel } from '../models';
import { BackButton, CustomDatePicker } from '../components/UI';
import { formatDate, formatCurrency as utilFormatCurrency } from '../utils/formatters';
import Can from '../components/Can';
import Swal from 'sweetalert2';

const ProfitAndLoss: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
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
      const data = await FinancialReportModel.profitAndLoss(period.start, period.end);
      setReport(data);
      Swal.fire({ 
        icon: 'success', 
        title: 'Success!', 
        text: 'Profit & Loss generated', 
        timer: 2000, 
        showConfirmButton: false 
      });
    } catch (error) {
      console.error('Error generating Profit & Loss:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to generate Profit & Loss' });
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
            <h1 className="text-3xl font-bold mb-2">Profit and Loss</h1>
            <p className="text-white/90">Income Statement</p>
          </div>
          <div className="flex items-center gap-3">
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
              <h3 className="text-xl font-bold text-gray-900">Profit and Loss</h3>
              <p className="text-sm text-gray-600">
                For the period {formatDate(report.period.start)} - {' '}
                {formatDate(report.period.end)}
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
            {/* Trading Income */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-gray-200 pb-2">
                Trading Income
              </h4>
              <table className="min-w-full">
                <tbody>
                  <tr>
                    <td className="py-1 text-sm text-gray-700 pl-4">Sales</td>
                    <td className="py-1 text-sm text-right font-medium w-32">
                      {formatCurrency(report.trading_income.sales)}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="py-2 text-sm font-semibold text-gray-900">Total Trading Income</td>
                    <td className="py-2 text-sm text-right font-bold">
                      {formatCurrency(report.trading_income.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cost of Sales */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-gray-200 pb-2">
                Cost of Sales
              </h4>
              <table className="min-w-full">
                <tbody>
                  <tr>
                    <td className="py-1 text-sm text-gray-700 pl-4">Purchases</td>
                    <td className="py-1 text-sm text-right font-medium w-32">
                      {formatCurrency(report.cost_of_sales.purchases)}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="py-2 text-sm font-semibold text-gray-900">Total Cost of Sales</td>
                    <td className="py-2 text-sm text-right font-bold">
                      {formatCurrency(report.cost_of_sales.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Gross Profit */}
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="flex justify-between items-center">
                <span className="text-md font-bold text-blue-900">Gross Profit</span>
                <span className="text-md font-bold text-blue-900">
                  {formatCurrency(report.gross_profit)}
                </span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-gray-200 pb-2">
                Operating Expenses
              </h4>
              <table className="min-w-full">
                <tbody>
                  {report.operating_expenses.map((expense: any, index: number) => (
                    <tr key={index}>
                      <td className="py-1 text-sm text-gray-700 pl-4">{expense.category}</td>
                      <td className="py-1 text-sm text-right font-medium w-32">
                        {formatCurrency(expense.amount)}
                      </td>
                    </tr>
                  ))}
                  {report.operating_expenses.length === 0 && (
                    <tr>
                      <td className="py-2 text-sm text-gray-500 pl-4 italic">No operating expenses</td>
                      <td className="py-2 text-sm text-right font-medium w-32">
                        {formatCurrency(0)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-gray-200">
                    <td className="py-2 text-sm font-semibold text-gray-900">Total Operating Expenses</td>
                    <td className="py-2 text-sm text-right font-bold">
                      {formatCurrency(report.total_operating_expenses)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Profit */}
            <div className={`${report.net_profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded p-4`}>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Net Profit</span>
                <span className={`text-2xl font-bold ${report.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(report.net_profit)}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {report.net_profit >= 0 ? 'Profit for the period' : 'Loss for the period'}
              </p>
            </div>

            {/* Summary Calculation */}
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded text-sm">
              <p className="font-medium text-gray-700">Calculation:</p>
              <p className="text-gray-600 mt-1">
                Trading Income ({formatCurrency(report.trading_income.total)}) - {' '}
                Cost of Sales ({formatCurrency(report.cost_of_sales.total)}) = {' '}
                Gross Profit ({formatCurrency(report.gross_profit)})
              </p>
              <p className="text-gray-600 mt-1">
                Gross Profit ({formatCurrency(report.gross_profit)}) - {' '}
                Operating Expenses ({formatCurrency(report.total_operating_expenses)}) = {' '}
                Net Profit ({formatCurrency(report.net_profit)})
              </p>
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">Select a period and click Generate to view the Profit & Loss statement</p>
        </div>
      )}
      </div>
    </Can>
  );
};

export default ProfitAndLoss;
