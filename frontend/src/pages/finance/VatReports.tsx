import React, { useState } from 'react';
import { DocumentTextIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { VatReportModel } from '../../models';
import { Vat201Report, Itr14Report, Irp6Report } from '../../types';
import { BackButton, CustomDatePicker } from '../../components/UI';
import { formatDate } from '../../utils/formatters';
import { notify } from '../../utils/notify';

const VatReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vat201' | 'itr14' | 'irp6'>('vat201');
  const [loading, setLoading] = useState(false);
  
  // VAT 201 state
  const [vat201Period, setVat201Period] = useState({
    start: '',
    end: '',
  });
  const [vat201Report, setVat201Report] = useState<Vat201Report | null>(null);
  
  // ITR14 state
  const [itr14Year, setItr14Year] = useState(new Date().getFullYear().toString());
  const [itr14Report, setItr14Report] = useState<Itr14Report | null>(null);
  
  // IRP6 state
  const [irp6Date, setIrp6Date] = useState(new Date().toISOString().split('T')[0]);
  const [irp6Report, setIrp6Report] = useState<Irp6Report | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const generateVat201 = async () => {
    if (!vat201Period.start || !vat201Period.end) {
      notify.error('Please select both start and end dates');
      return;
    }

    try {
      setLoading(true);
      const data = await VatReportModel.vat201(vat201Period.start, vat201Period.end);
      console.log('VAT201 Report Data:', data);
      setVat201Report(data);
      notify.success('VAT 201 report generated');
    } catch (error) {
      console.error('Error generating VAT 201:', error);
      notify.error('Failed to generate VAT 201 report');
    } finally {
      setLoading(false);
    }
  };

  const generateItr14 = async () => {
    try {
      setLoading(true);
      const data = await VatReportModel.itr14(parseInt(itr14Year));
      console.log('ITR14 Report Data:', data);
      setItr14Report(data);
      notify.success('ITR14 report generated');
    } catch (error) {
      console.error('Error generating ITR14:', error);
      notify.error('Failed to generate ITR14 report');
    } finally {
      setLoading(false);
    }
  };

  const generateIrp6 = async () => {
    try {
      setLoading(true);
      const data = await VatReportModel.irp6(irp6Date);
      console.log('IRP6 Report Data:', data);
      setIrp6Report(data);
      notify.success('IRP6 calculation complete');
    } catch (error) {
      console.error('Error generating IRP6:', error);
      notify.error('Failed to generate IRP6 calculation');
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">SARS Tax Reports</h1>
            <p className="text-white/90">Generate reports for eFiling submission</p>
          </div>
          <BackButton to="/transactions" />
        </div>

        {/* Tab Navigation inside header */}
        <div className="border-b border-white/20">
          <div className="flex items-center justify-between">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('vat201')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'vat201'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/60 hover:text-white/90 hover:border-white/40'
                }`}
              >
                VAT 201 Return
              </button>
              <button
                onClick={() => setActiveTab('itr14')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'itr14'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/60 hover:text-white/90 hover:border-white/40'
                }`}
              >
                ITR14 Tax Summary
              </button>
              <button
                onClick={() => setActiveTab('irp6')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'irp6'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/60 hover:text-white/90 hover:border-white/40'
                }`}
              >
                IRP6 Provisional Tax
              </button>
            </nav>
            
            {/* VAT 201 Controls */}
            {activeTab === 'vat201' && (
              <div className="flex items-center gap-3 pb-2">
                <div className="w-44">
                  <CustomDatePicker
                    value={vat201Period.start ? new Date(vat201Period.start) : null}
                    onChange={(date) => setVat201Period({ ...vat201Period, start: date ? date.toISOString().split('T')[0] : '' })}
                    placeholder="Period Start"
                    className="!px-4 !py-2 !pl-10 !rounded-lg !bg-white/10 !border-white/20 !text-white placeholder:!text-white/60 !shadow-none focus:!ring-2 focus:!ring-white/50 !backdrop-blur-sm"
                    iconClassName="text-white/60"
                  />
                </div>
                <div className="w-44">
                  <CustomDatePicker
                    value={vat201Period.end ? new Date(vat201Period.end) : null}
                    onChange={(date) => setVat201Period({ ...vat201Period, end: date ? date.toISOString().split('T')[0] : '' })}
                    placeholder="Period End"
                    className="!px-4 !py-2 !pl-10 !rounded-lg !bg-white/10 !border-white/20 !text-white placeholder:!text-white/60 !shadow-none focus:!ring-2 focus:!ring-white/50 !backdrop-blur-sm"
                    iconClassName="text-white/60"
                  />
                </div>
                <button
                  onClick={generateVat201}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-picton-blue font-medium text-sm hover:bg-white/90 disabled:opacity-50 transition-colors"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            )}
            
            {/* ITR14 Controls */}
            {activeTab === 'itr14' && (
              <div className="flex items-center gap-3 pb-2">
                <label className="text-sm font-medium text-white/90">
                  Financial Year
                </label>
                <select
                  className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm [&>option]:text-gray-900"
                  value={itr14Year}
                  onChange={(e) => setItr14Year(e.target.value)}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <button
                  onClick={generateItr14}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-picton-blue font-medium text-sm hover:bg-white/90 disabled:opacity-50 transition-colors"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            )}
            
            {/* IRP6 Controls */}
            {activeTab === 'irp6' && (
              <div className="flex items-center gap-3 pb-2">
                <label className="text-sm font-medium text-white/90">
                  Calculate to Date
                </label>
                <CustomDatePicker
                  value={irp6Date ? new Date(irp6Date) : null}
                  onChange={(date) => setIrp6Date(date ? date.toISOString().split('T')[0] : '')}
                  placeholder="Select date..."
                  className="!px-4 !py-2 !pl-10 !rounded-lg !bg-white/10 !border-white/20 !text-white placeholder:!text-white/60 !shadow-none focus:!ring-2 focus:!ring-white/50 !backdrop-blur-sm"
                  iconClassName="text-white/60"
                />
                <button
                  onClick={generateIrp6}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-picton-blue font-medium text-sm hover:bg-white/90 disabled:opacity-50 transition-colors"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  {loading ? 'Calculating...' : 'Calculate'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VAT 201 Tab */}
      {activeTab === 'vat201' && (
        <div className="space-y-6">
          {vat201Report && vat201Report.vat201 && (
            <div className="bg-white shadow rounded-lg p-6 print:shadow-none">
              <div className="flex justify-between items-center mb-6 print:mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">VAT 201 Return</h3>
                  <p className="text-sm text-gray-600">
                    Period: {vat201Report.period?.start ? formatDate(vat201Report.period.start) : ''} - {vat201Report.period?.end ? formatDate(vat201Report.period.end) : ''}
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

              <div className="space-y-4">
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Output Tax (Sales)</h4>
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Field 1: Standard-Rated Supplies</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(vat201Report.vat201.field_1 || 0)}</td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="py-2 text-sm font-semibold text-gray-900">Field 4: Output Tax</td>
                        <td className="py-2 text-sm text-right font-bold text-blue-600">{formatCurrency(vat201Report.vat201.field_4 || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Field 5: Zero-Rated Supplies</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(vat201Report.vat201.field_5 || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Field 6: Exempt Supplies</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(vat201Report.vat201.field_6 || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Input Tax (Purchases)</h4>
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Field 11: Standard-Rated Purchases</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(vat201Report.vat201.field_11 || 0)}</td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="py-2 text-sm font-semibold text-gray-900">Field 14: Input Tax</td>
                        <td className="py-2 text-sm text-right font-bold text-blue-600">{formatCurrency(vat201Report.vat201.field_14 || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Field 15: Zero-Rated Purchases</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(vat201Report.vat201.field_15 || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border-t-2 border-gray-900 pt-4 bg-gray-50 p-4 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Field 19: Net VAT</span>
                    <span className={`text-2xl font-bold ${(vat201Report.vat201.field_19 || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(vat201Report.vat201.field_19 || 0)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {(vat201Report.vat201.field_19 || 0) > 0 ? 'Amount payable to SARS' : 'Amount refundable from SARS'}
                  </p>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Next Step:</strong> Log into SARS eFiling and manually enter these values into the corresponding fields on the VAT 201 return form.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ITR14 Tab */}
      {activeTab === 'itr14' && (
        <div className="space-y-6">
          {itr14Report && itr14Report.income && itr14Report.summary && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">ITR14 Tax Summary</h3>
                  <p className="text-sm text-gray-600">Financial Year: {itr14Report.year}</p>
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
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Income Summary</h4>
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                      <tr className="bg-green-50">
                        <td className="py-2 text-sm font-semibold text-gray-900">Total Revenue</td>
                        <td className="py-2 text-sm text-right font-bold text-green-600">{formatCurrency(itr14Report.income.total_revenue || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-sm text-gray-700">Taxable Income</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(itr14Report.income.taxable_income || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-sm text-gray-700">Zero-Rated Income</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(itr14Report.income.zero_rated_income || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-sm text-gray-700">Exempt Income</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(itr14Report.income.exempt_income || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Expenses by ITR14 Category</h4>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(itr14Report.expenses_by_category || []).map((cat, idx) => (
                        <tr key={idx}>
                          <td className="py-2 text-sm text-gray-900">{cat.itr14_mapping}</td>
                          <td className="py-2 text-sm text-right font-medium">{formatCurrency(cat.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t-2 border-gray-900 pt-4 space-y-2">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-semibold text-gray-900">Total Expenses</span>
                    <span className="text-lg font-bold text-red-600">{formatCurrency(itr14Report.summary.total_expenses || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-blue-50 px-4 rounded">
                    <span className="text-lg font-bold text-gray-900">Taxable Income</span>
                    <span className="text-2xl font-bold text-blue-600">{formatCurrency(itr14Report.summary.taxable_income || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-gray-50 px-4 rounded">
                    <span className="text-sm font-semibold text-gray-900">Corporate Tax (27%)</span>
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(itr14Report.summary.corporate_tax_27_percent || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* IRP6 Tab */}
      {activeTab === 'irp6' && (
        <div className="space-y-6">
          {irp6Report && irp6Report.period && irp6Report.actual_to_date && irp6Report.estimated_annual && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Provisional Tax Estimate</h3>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Actual to Date</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    {irp6Report.period.days_elapsed || 0} days of {irp6Report.period.days_in_year || 365} days elapsed
                  </p>
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Income</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(irp6Report.actual_to_date.income || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Expenses</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(irp6Report.actual_to_date.expenses || 0)}</td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="py-2 text-sm font-semibold text-gray-900">Profit to Date</td>
                        <td className="py-2 text-sm text-right font-bold text-blue-600">{formatCurrency(irp6Report.actual_to_date.profit || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Estimated Annual (Projected)</h4>
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Estimated Income</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(irp6Report.estimated_annual.income || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-sm text-gray-900">Estimated Expenses</td>
                        <td className="py-2 text-sm text-right font-medium">{formatCurrency(irp6Report.estimated_annual.expenses || 0)}</td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="py-2 text-sm font-semibold text-gray-900">Estimated Taxable Income</td>
                        <td className="py-2 text-sm text-right font-bold text-blue-600">{formatCurrency(irp6Report.estimated_annual.taxable_income || 0)}</td>
                      </tr>
                      <tr className="bg-yellow-50">
                        <td className="py-2 text-sm font-bold text-gray-900">Estimated Tax Due (27%)</td>
                        <td className="py-2 text-sm text-right font-bold text-yellow-700 text-xl">{formatCurrency(irp6Report.estimated_annual.tax_due_27_percent || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This is a projection based on your current year-to-date figures. Adjust your IRP6 payment on eFiling based on your actual expected annual income.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VatReports;
