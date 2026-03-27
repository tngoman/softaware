import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ClockIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../UI';
import { BankingRequestStatus, PayrollModel, PayrollProfile, Payslip } from '../../models/PayrollModel';

function currency(cents?: number | null) {
  return `R ${((Number(cents || 0)) / 100).toFixed(2)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

const PayrollTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PayrollProfile | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [requestStatus, setRequestStatus] = useState<BankingRequestStatus | null>(null);
  const [form, setForm] = useState({
    bank_name: '',
    branch_code: '',
    account_number: '',
    account_type: 'cheque' as 'cheque' | 'savings' | 'transmission',
    account_holder_name: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileData, payslipData, bankingData] = await Promise.all([
        PayrollModel.getMyProfile(),
        PayrollModel.getMyPayslips(),
        PayrollModel.getMyBankingRequest(),
      ]);
      setProfile(profileData);
      setPayslips(payslipData);
      setRequestStatus(bankingData);
      setForm({
        bank_name: profileData.bank_name || '',
        branch_code: profileData.branch_code || '',
        account_number: '',
        account_type: (profileData.account_type as any) || 'cheque',
        account_holder_name: profileData.account_holder_name || '',
      });
    } catch (error: any) {
      console.error('Failed to load payroll tab', error);
      // Silently handle - user will see empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownload = async (payslip: Payslip) => {
    try {
      Swal.fire({
        icon: 'info',
        title: 'Downloading...',
        text: 'Your payslip download will begin shortly',
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });
      const blob = await PayrollModel.downloadMyPayslipPdf(payslip.id);
      downloadBlob(blob, `${payslip.reference_number}.pdf`);
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to download payslip' });
    }
  };

  const handleSubmitBankingRequest = async () => {
    try {
      await PayrollModel.submitMyBankingRequest(form);
      await loadData();
      Swal.fire({ icon: 'success', title: 'Submitted', text: 'Your banking change request was submitted for admin approval.', timer: 1600, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || error?.response?.data?.error || 'Failed to submit banking request' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-picton-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm"><BanknotesIcon className="w-4 h-4" /> Net latest</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{currency(payslips[0]?.net_salary_cents)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm"><DocumentTextIcon className="w-4 h-4" /> Payslips</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{payslips.length}</div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm"><ClockIcon className="w-4 h-4" /> Banking status</div>
            <div className="text-lg font-bold mt-2 capitalize text-gray-900">
              {requestStatus?.status || (profile?.bank_name ? 'No pending requests' : 'Not configured')}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payroll profile</h2>
              <p className="text-sm text-gray-500 mt-1">Your banking details are masked. Updates require admin approval.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-gray-500">Employment date</div><div className="font-medium text-gray-900 mt-1">{profile?.employment_date || '-'}</div></div>
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-gray-500">ID number</div><div className="font-medium text-gray-900 mt-1">{profile?.id_number || '-'}</div></div>
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-gray-500">Tax number</div><div className="font-medium text-gray-900 mt-1">{profile?.tax_number || '-'}</div></div>
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-gray-500">Bank</div><div className="font-medium text-gray-900 mt-1">{profile?.bank_name || '-'}</div></div>
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-gray-500">Account</div><div className="font-medium text-gray-900 mt-1">{profile?.account_number_masked || '-'}</div></div>
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-gray-500">Account type</div><div className="font-medium text-gray-900 mt-1 capitalize">{profile?.account_type || '-'}</div></div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BuildingLibraryIcon className="w-5 h-5 text-picton-blue" />
              <h2 className="text-lg font-semibold text-gray-900">Request banking update</h2>
            </div>
            {requestStatus && (
              <div className={`rounded-lg p-3 text-sm ${requestStatus.status === 'pending' ? 'bg-orange-50 text-orange-700' : requestStatus.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                Latest request status: <strong className="capitalize">{requestStatus.status}</strong>
                {requestStatus.rejection_reason ? <div className="mt-1">Reason: {requestStatus.rejection_reason}</div> : null}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Bank name" value={form.bank_name} onChange={(e) => setForm((prev) => ({ ...prev, bank_name: e.target.value }))} className="border rounded-lg px-3 py-2" />
              <input placeholder="Branch code" value={form.branch_code} onChange={(e) => setForm((prev) => ({ ...prev, branch_code: e.target.value }))} className="border rounded-lg px-3 py-2" />
              <input placeholder="New account number" value={form.account_number} onChange={(e) => setForm((prev) => ({ ...prev, account_number: e.target.value }))} className="border rounded-lg px-3 py-2" />
              <select value={form.account_type} onChange={(e) => setForm((prev) => ({ ...prev, account_type: e.target.value as any }))} className="border rounded-lg px-3 py-2">
                <option value="cheque">Cheque</option>
                <option value="savings">Savings</option>
                <option value="transmission">Transmission</option>
              </select>
              <input placeholder="Account holder name" value={form.account_holder_name} onChange={(e) => setForm((prev) => ({ ...prev, account_holder_name: e.target.value }))} className="md:col-span-2 border rounded-lg px-3 py-2" />
            </div>
            <div className="flex justify-end">
              <button onClick={handleSubmitBankingRequest} className="px-4 py-2 rounded-lg bg-picton-blue text-white">Submit for approval</button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">My payslips</h2>
          {payslips.length === 0 ? (
            <div className="text-sm text-gray-500">No payslips available yet.</div>
          ) : payslips.map((payslip) => (
            <div key={payslip.id} className="border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold text-gray-900">{payslip.reference_number}</div>
                <div className="text-sm text-gray-500">{payslip.pay_month}/{payslip.pay_year} • Net {currency(payslip.net_salary_cents)}</div>
              </div>
              <button onClick={() => handleDownload(payslip)} className="text-picton-blue flex items-center gap-2 text-sm font-medium">
                <ArrowDownTrayIcon className="w-4 h-4" /> Download PDF
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default PayrollTab;
