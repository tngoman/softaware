import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../../components/UI';
import CustomDatePicker from '../../components/UI/CustomDatePicker';
import AppSettingsModel from '../../models/AppSettingsModel';
import { PayrollLineItem, PayrollModel, PayrollProfile, PayrollProfileListItem, SalaryConfig } from '../../models/PayrollModel';
import LeaveModel from '../../models/LeaveModel';

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

type AdminTab = 'profiles' | 'salaries' | 'payslips' | 'banking' | 'leave';

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

const blankProfile = (selectedUserId = ''): PayrollProfile => ({
  user_id: selectedUserId,
  employment_date: '',
  id_number: '',
  tax_number: '',
  bank_name: '',
  branch_code: '',
  account_number: '',
  account_type: 'cheque',
  account_holder_name: '',
});

const blankItem = (): PayrollLineItem => ({ type: '', label: '', amount_cents: 0 });

/** Normalize any date value to YYYY-MM-DD for <input type="date"> */
function toISODate(value: string | null | undefined): string {
  if (!value) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // ISO string like "2025-12-01T00:00:00.000Z"
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  // Anything else — try to parse
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Convert a line-item array from cents (backend) to rands (UI) */
function itemsToRands(items: PayrollLineItem[]): PayrollLineItem[] {
  return items.map(i => ({ ...i, amount_cents: Number(i.amount_cents || 0) / 100 }));
}
/** Convert a line-item array from rands (UI) to cents (backend) */
function itemsToCents(items: PayrollLineItem[]): PayrollLineItem[] {
  return items.map(i => ({ ...i, amount_cents: Math.round(Number(i.amount_cents || 0) * 100) }));
}

const AdminPayroll: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [deletingPayslipId, setDeletingPayslipId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('profiles');
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<PayrollProfileListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [profileForm, setProfileForm] = useState<PayrollProfile>(blankProfile());
  const [salaryForm, setSalaryForm] = useState({
    gross_salary_rands: 0,
    effective_from: '',
    notes: '',
    deductions: [blankItem()],
    allowances: [blankItem()],
  });
  const [selectedSalary, setSelectedSalary] = useState<SalaryConfig | null>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [bankingRequests, setBankingRequests] = useState<any[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [payMonth, setPayMonth] = useState(currentMonth);
  const [payYear, setPayYear] = useState(currentYear);
  const [paymentDay, setPaymentDay] = useState(25);

  const selectedStaff = useMemo(
    () => profiles.find((item) => item.user_id === selectedUserId) || null,
    [profiles, selectedUserId]
  );

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((item) =>
      item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  /** Employment-date-based year/month limits */
  const employmentDate = profileForm.employment_date ? new Date(profileForm.employment_date + 'T00:00:00') : null;
  const empYear = employmentDate ? employmentDate.getFullYear() : 2020;
  const empMonth = employmentDate ? employmentDate.getMonth() + 1 : 1;
  const yearOptions = useMemo(() => {
    const startYr = employmentDate ? empYear : 2020;
    return Array.from({ length: currentYear - startYr + 1 }, (_, i) => startYr + i);
  }, [empYear, employmentDate]);

  const monthOptions = useMemo(() => {
    const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
    return allMonths.filter((m) => {
      if (payYear === empYear && employmentDate && m < empMonth) return false;
      if (payYear === currentYear && m > currentMonth) return false;
      return true;
    });
  }, [payYear, empYear, empMonth, employmentDate]);

  /** Salary date: combines the global payment day with selected month/year */
  const salaryDateLabel = useMemo(() => {
    const day = Math.min(paymentDay, new Date(payYear, payMonth, 0).getDate()); // clamp to month length
    return `${String(day).padStart(2, '0')} ${new Date(2000, payMonth - 1).toLocaleString('en', { month: 'long' })} ${payYear}`;
  }, [paymentDay, payMonth, payYear]);

  const loadProfiles = async () => {
    const data = await PayrollModel.listProfiles({ search: search || undefined });
    setProfiles(data);
    if (!selectedUserId && data.length > 0) {
      setSelectedUserId(data[0].user_id);
    }
    return data;
  };

  const loadPayslips = async (userId?: string) => {
    const result = await PayrollModel.listPayslips({ year: payYear, user_id: userId });
    setPayslips(result.data);
  };

  const loadSummary = async () => {
    const data = await PayrollModel.getSummary({ month: payMonth, year: payYear });
    setSummary(data);
  };

  const loadBankingRequests = async () => {
    const data = await PayrollModel.listBankingRequests({ status: 'pending' });
    setBankingRequests(data);
  };

  const loadLeaveBalances = async (userId?: string) => {
    if (!userId) return;
    try {
      const data = await LeaveModel.getBalances(userId, currentYear);
      setLeaveBalances(data);
    } catch {
      setLeaveBalances([]);
    }
  };

  const loadLeaveRequests = async (userId?: string) => {
    if (!userId) return;
    try {
      const data = await LeaveModel.getUserRequests(userId);
      setLeaveRequests(data);
    } catch {
      setLeaveRequests([]);
    }
  };

  const loadSelectedUser = async (userId: string) => {
    setProfileForm(blankProfile(userId));
    setSelectedSalary(null);
    setSalaryForm({
      gross_salary_rands: 0,
      effective_from: '',
      notes: '',
      deductions: [blankItem()],
      allowances: [blankItem()],
    });

    try {
      const profile = await PayrollModel.getProfile(userId);
      setProfileForm({
        ...blankProfile(userId),
        ...profile,
        employment_date: toISODate(profile.employment_date),
        account_number: profile.account_number || '',
      });
    } catch {
      setProfileForm(blankProfile(userId));
    }

    try {
      const salary = await PayrollModel.getSalary(userId);
      setSelectedSalary(salary);
      setSalaryForm({
        gross_salary_rands: Number(salary.gross_salary_cents || 0) / 100,
        effective_from: toISODate(salary.effective_from),
        notes: salary.notes || '',
        deductions: salary.deductions.length ? itemsToRands(salary.deductions) : [blankItem()],
        allowances: salary.allowances.length ? itemsToRands(salary.allowances) : [blankItem()],
      });
    } catch {
      setSelectedSalary(null);
    }

    await loadLeaveBalances(userId);
    await loadLeaveRequests(userId);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      // Load global payment day setting
      try {
        const resp = await AppSettingsModel.getByKey('payroll_payment_day');
        if (resp?.value) setPaymentDay(Number(resp.value) || 25);
      } catch { /* keep default 25 */ }

      const list = await loadProfiles();
      const initialUserId = selectedUserId || list[0]?.user_id;
      if (initialUserId) {
        await loadSelectedUser(initialUserId);
        await loadPayslips(initialUserId);
      } else {
        setPayslips([]);
      }
      await Promise.all([loadSummary(), loadBankingRequests()]);
    } catch (error) {
      console.error('Failed to load payroll data', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load payroll data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    loadSelectedUser(selectedUserId);
    loadPayslips(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  useEffect(() => {
    loadSummary();
    if (selectedUserId) loadPayslips(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMonth, payYear]);

  /** Clamp payMonth if it falls outside allowed range after year change */
  useEffect(() => {
    if (monthOptions.length && !monthOptions.includes(payMonth)) {
      setPayMonth(monthOptions[monthOptions.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOptions]);

  const updateLineItem = (
    group: 'deductions' | 'allowances',
    index: number,
    key: keyof PayrollLineItem,
    value: string | number
  ) => {
    setSalaryForm((prev) => ({
      ...prev,
      [group]: prev[group].map((item, idx) => idx === index ? { ...item, [key]: value } : item),
    }));
  };

  const addLineItem = (group: 'deductions' | 'allowances') => {
    setSalaryForm((prev) => ({ ...prev, [group]: [...prev[group], blankItem()] }));
  };

  const removeLineItem = (group: 'deductions' | 'allowances', index: number) => {
    setSalaryForm((prev) => ({
      ...prev,
      [group]: prev[group].filter((_, idx) => idx !== index).length
        ? prev[group].filter((_, idx) => idx !== index)
        : [blankItem()],
    }));
  };

  const saveProfile = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await PayrollModel.saveProfile(selectedUserId, profileForm);
      await loadProfiles();
      await loadSelectedUser(selectedUserId);
      Swal.fire({ icon: 'success', title: 'Saved', text: 'Payroll profile saved successfully', timer: 1600, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || error?.response?.data?.error || 'Failed to save payroll profile' });
    } finally {
      setSaving(false);
    }
  };

  const saveSalary = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const cleanItems = (items: PayrollLineItem[]) => items.filter((item) => item.type && item.label && Number(item.amount_cents) >= 0);
      await PayrollModel.saveSalary(selectedUserId, {
        gross_salary_cents: Math.round(Number(salaryForm.gross_salary_rands) * 100),
        effective_from: salaryForm.effective_from,
        notes: salaryForm.notes,
        deductions: cleanItems(itemsToCents(salaryForm.deductions)),
        allowances: cleanItems(itemsToCents(salaryForm.allowances)),
      });
      await loadSelectedUser(selectedUserId);
      Swal.fire({ icon: 'success', title: 'Saved', text: 'Salary saved successfully', timer: 1600, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || error?.response?.data?.error || 'Failed to save salary' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSalary = async () => {
    if (!selectedUserId) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Remove salary?',
      text: 'Existing payslips will remain, but the current salary configuration will be removed.',
      showCancelButton: true,
      confirmButtonText: 'Remove',
    });
    if (!result.isConfirmed) return;

    try {
      await PayrollModel.deleteSalary(selectedUserId);
      await loadSelectedUser(selectedUserId);
      Swal.fire({ icon: 'success', title: 'Removed', timer: 1400, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to remove salary' });
    }
  };

  const handleGeneratePayslip = async () => {
    if (!selectedUserId) return;
    setGenerating(true);
    try {
      await PayrollModel.generatePayslip({ user_id: selectedUserId, month: payMonth, year: payYear });
      await Promise.all([loadPayslips(selectedUserId), loadSummary()]);
      Swal.fire({ icon: 'success', title: 'Generated', text: 'Payslip generated successfully', timer: 1600, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || error?.response?.data?.error || 'Failed to generate payslip' });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateBulk = async () => {
    setGeneratingBulk(true);
    try {
      const data = await PayrollModel.generateBulkPayslips({ month: payMonth, year: payYear });
      await Promise.all([loadPayslips(selectedUserId || undefined), loadSummary(), loadBankingRequests()]);
      Swal.fire({
        icon: 'success',
        title: 'Bulk generation complete',
        html: `<div style="text-align:left">Generated: <strong>${data.generated}</strong><br/>Skipped: <strong>${data.skipped}</strong><br/>Errors: <strong>${data.errors}</strong></div>`,
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to generate bulk payslips' });
    } finally {
      setGeneratingBulk(false);
    }
  };

  const handleDownloadPayslip = async (id: string, reference: string) => {
    try {
      Swal.fire({
        icon: 'info',
        title: 'Downloading...',
        text: 'Your payslip download will begin shortly',
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });
      const blob = await PayrollModel.downloadAdminPayslipPdf(id);
      downloadBlob(blob, `${reference}.pdf`);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to download payslip' });
    }
  };

  const handleApproveBanking = async (id: string) => {
    try {
      await PayrollModel.approveBankingRequest(id);
      await Promise.all([loadBankingRequests(), loadProfiles(), selectedUserId ? loadSelectedUser(selectedUserId) : Promise.resolve()]);
      Swal.fire({ icon: 'success', title: 'Approved', timer: 1400, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to approve request' });
    }
  };

  const handleRejectBanking = async (id: string) => {
    const result = await Swal.fire({
      title: 'Reject request',
      input: 'text',
      inputLabel: 'Reason',
      inputPlaceholder: 'Enter rejection reason',
      showCancelButton: true,
    });
    if (!result.isConfirmed || !result.value) return;

    try {
      await PayrollModel.rejectBankingRequest(id, result.value);
      await loadBankingRequests();
      Swal.fire({ icon: 'success', title: 'Rejected', timer: 1400, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to reject request' });
    }
  };

  const handleApproveLeaveRequest = async (requestId: string) => {
    try {
      await LeaveModel.approveRequest(requestId);
      await Promise.all([loadLeaveBalances(selectedUserId!), loadLeaveRequests(selectedUserId!)]);
      Swal.fire({ icon: 'success', title: 'Leave request approved', timer: 1400, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to approve leave request' });
    }
  };

  const handleRejectLeaveRequest = async (requestId: string) => {
    const result = await Swal.fire({
      title: 'Reject leave request',
      input: 'text',
      inputLabel: 'Reason',
      inputPlaceholder: 'Enter rejection reason',
      showCancelButton: true,
    });
    if (!result.isConfirmed || !result.value) return;

    try {
      await LeaveModel.rejectRequest(requestId, result.value);
      await Promise.all([loadLeaveBalances(selectedUserId!), loadLeaveRequests(selectedUserId!)]);
      Swal.fire({ icon: 'success', title: 'Leave request rejected', timer: 1400, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to reject leave request' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-picton-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BanknotesIcon className="w-8 h-8" />
              Payroll
            </h1>
            <p className="text-white/90 mt-2">Manage payroll profiles, salaries, banking approvals, and payslips.</p>
          </div>
          <button
            onClick={loadAll}
            className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* ───── Staff Sidebar ───── */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-picton-blue" />
                  Staff Members
                </h2>
                <span className="text-xs text-gray-400 font-medium">{filteredProfiles.length}</span>
              </div>
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Staff List */}
            <div className="divide-y divide-gray-100 max-h-[65vh] overflow-y-auto">
              {filteredProfiles.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <UserCircleIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    {search ? 'No matching staff found' : 'No staff members yet'}
                  </p>
                </div>
              ) : (
                filteredProfiles.map((item) => {
                  const isSelected = selectedUserId === item.user_id;
                  const initials = (item.name || item.email)
                    .split(/[\s@]+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() || '')
                    .join('');
                  const hasProfile = !!item.profile;
                  const isComplete = !!item.profile?.profile_complete;
                  const hasPending = !!item.profile?.has_pending_banking_request;

                  return (
                    <button
                      key={item.user_id}
                      onClick={() => setSelectedUserId(item.user_id)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-picton-blue/5 border-l-[3px] border-l-picton-blue'
                          : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected
                            ? 'bg-picton-blue text-white'
                            : hasProfile
                              ? 'bg-picton-blue/10 text-picton-blue'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium truncate ${isSelected ? 'text-picton-blue' : 'text-gray-900'}`}>
                          {item.name || item.email.split('@')[0]}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{item.email}</div>
                        {/* Role & status tags */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {item.is_admin && (
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 leading-none">
                              Admin
                            </span>
                          )}
                          {item.is_staff && (
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 leading-none">
                              Staff
                            </span>
                          )}
                          {isComplete ? (
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 leading-none">
                              Ready
                            </span>
                          ) : hasProfile ? (
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 leading-none">
                              Incomplete
                            </span>
                          ) : null}
                          {hasPending && (
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 leading-none">
                              Banking
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-picton-blue shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-2 flex flex-wrap gap-2">
            {[
              ['profiles', 'Profiles', UserCircleIcon],
              ['salaries', 'Salaries', BanknotesIcon],
              ['payslips', 'Payslips', DocumentTextIcon],
              ['banking', 'Banking Requests', BuildingLibraryIcon],
              ['leave', 'Leave Management', CalendarDaysIcon],
            ].map(([key, label, Icon]: any) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeTab === key ? 'bg-picton-blue text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'profiles' && (
            <Card>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Payroll profile</h2>
                    <p className="text-sm text-gray-500 mt-1">Employment date is mandatory before salary setup and payslip generation.</p>
                  </div>
                  {selectedStaff && <span className="text-sm text-gray-500">{selectedStaff.name}</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CustomDatePicker
                    label="Employment Date"
                    required
                    value={profileForm.employment_date ? new Date(profileForm.employment_date + 'T00:00:00') : null}
                    onChange={(date) => setProfileForm((p) => ({ ...p, employment_date: date ? date.toISOString().slice(0, 10) : '' }))}
                  />
                  <input placeholder="ID number" value={profileForm.id_number || ''} onChange={(e) => setProfileForm((p) => ({ ...p, id_number: e.target.value }))} className="border rounded-lg px-3 py-2" />
                  <input placeholder="Tax number" value={profileForm.tax_number || ''} onChange={(e) => setProfileForm((p) => ({ ...p, tax_number: e.target.value }))} className="border rounded-lg px-3 py-2" />
                  <input placeholder="Bank name" value={profileForm.bank_name || ''} onChange={(e) => setProfileForm((p) => ({ ...p, bank_name: e.target.value }))} className="border rounded-lg px-3 py-2" />
                  <input placeholder="Branch code" value={profileForm.branch_code || ''} onChange={(e) => setProfileForm((p) => ({ ...p, branch_code: e.target.value }))} className="border rounded-lg px-3 py-2" />
                  <input placeholder="Account number" value={profileForm.account_number || ''} onChange={(e) => setProfileForm((p) => ({ ...p, account_number: e.target.value }))} className="border rounded-lg px-3 py-2" />
                  <select value={profileForm.account_type || 'cheque'} onChange={(e) => setProfileForm((p) => ({ ...p, account_type: e.target.value as any }))} className="border rounded-lg px-3 py-2">
                    <option value="cheque">Cheque</option>
                    <option value="savings">Savings</option>
                    <option value="transmission">Transmission</option>
                  </select>
                  <input placeholder="Account holder name" value={profileForm.account_holder_name || ''} onChange={(e) => setProfileForm((p) => ({ ...p, account_holder_name: e.target.value }))} className="border rounded-lg px-3 py-2" />
                </div>

                <div className="flex justify-between">
                  {profileForm.id ? (
                    <button
                      onClick={async () => {
                        const confirm = await Swal.fire({
                          icon: 'warning',
                          title: 'Delete payroll profile?',
                          html: '<p>This will permanently delete this staff member\'s:</p><ul style="text-align:left;margin-top:8px"><li>• Payroll profile</li><li>• Salary configuration & deductions</li><li>• All payslips</li><li>• Banking change requests</li></ul>',
                          showCancelButton: true,
                          confirmButtonText: 'Delete everything',
                          confirmButtonColor: '#dc2626',
                        });
                        if (!confirm.isConfirmed) return;
                        try {
                          await PayrollModel.deleteProfile(selectedUserId);
                          await loadAll();
                          Swal.fire({ icon: 'success', title: 'Deleted', text: 'Profile and all associated payroll data removed.', timer: 2000, showConfirmButton: false });
                        } catch (error: any) {
                          Swal.fire({ icon: 'error', title: 'Error', text: error?.response?.data?.message || 'Failed to delete profile' });
                        }
                      }}
                      className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <TrashIcon className="w-4 h-4" /> Delete profile
                    </button>
                  ) : <div />}
                  <button onClick={saveProfile} disabled={saving || !selectedUserId} className="px-4 py-2 rounded-lg bg-picton-blue text-white disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save profile'}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'salaries' && (
            <Card>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Gross Salary (R)</label>
                    <input type="number" step="0.01" min="0" value={salaryForm.gross_salary_rands} onChange={(e) => setSalaryForm((p) => ({ ...p, gross_salary_rands: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <CustomDatePicker
                      label="Salary Effective From"
                      value={salaryForm.effective_from ? new Date(salaryForm.effective_from + 'T00:00:00') : null}
                      onChange={(date) => setSalaryForm((p) => ({ ...p, effective_from: date ? date.toISOString().slice(0, 10) : '' }))}
                    />
                    <p className="text-xs text-gray-400 mt-1">Date from which this salary applies.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Net salary</label>
                    <div className="h-[42px] rounded-lg border bg-gray-50 px-3 flex items-center font-semibold text-gray-800">
                      {currency(selectedSalary?.net_salary_cents)}
                    </div>
                  </div>
                </div>

                <textarea placeholder="Notes" value={salaryForm.notes} onChange={(e) => setSalaryForm((p) => ({ ...p, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 min-h-[80px]" />

                {(['deductions', 'allowances'] as const).map((group) => (
                  <div key={group} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 capitalize">{group}</h3>
                      <button onClick={() => addLineItem(group)} className="text-sm text-picton-blue flex items-center gap-1">
                        <PlusIcon className="w-4 h-4" /> Add line
                      </button>
                    </div>
                    {salaryForm[group].map((item, index) => (
                      <div key={`${group}-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <input placeholder="Type" value={item.type} onChange={(e) => updateLineItem(group, index, 'type', e.target.value)} className="md:col-span-3 border rounded-lg px-3 py-2" />
                        <input placeholder="Label" value={item.label} onChange={(e) => updateLineItem(group, index, 'label', e.target.value)} className="md:col-span-5 border rounded-lg px-3 py-2" />
                        <input placeholder="Amount (R)" type="number" step="0.01" min="0" value={item.amount_cents} onChange={(e) => updateLineItem(group, index, 'amount_cents', Number(e.target.value))} className="md:col-span-3 border rounded-lg px-3 py-2" />
                        <button onClick={() => removeLineItem(group, index)} className="md:col-span-1 text-red-500 hover:text-red-700 flex justify-center">
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}

                <div className="flex justify-between">
                  <button onClick={handleDeleteSalary} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                    Remove salary
                  </button>
                  <button onClick={saveSalary} disabled={saving || !selectedUserId} className="px-4 py-2 rounded-lg bg-picton-blue text-white disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save salary'}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'payslips' && (
            <div className="space-y-6">
              <Card>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Month</label>
                      <select value={payMonth} onChange={(e) => setPayMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2">
                        {monthOptions.map((month) => (
                          <option key={month} value={month}>
                            {new Date(2000, month - 1).toLocaleString('en', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Year</label>
                      <select value={payYear} onChange={(e) => setPayYear(Number(e.target.value))} className="border rounded-lg px-3 py-2">
                        {yearOptions.map((yr) => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Salary Date</label>
                      <div className="h-[42px] rounded-lg border bg-gray-50 px-3 flex items-center text-sm font-semibold text-gray-800">
                        {salaryDateLabel}
                      </div>
                    </div>
                    <div className="ml-auto flex gap-3 self-end">
                      <button onClick={handleGeneratePayslip} disabled={!selectedUserId || generating} className="px-4 py-2 rounded-lg bg-picton-blue text-white disabled:opacity-50 flex items-center gap-2">
                        {generating ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <DocumentTextIcon className="w-4 h-4" />} {generating ? 'Generating...' : 'Generate selected'}
                      </button>
                      <button onClick={handleGenerateBulk} disabled={generatingBulk} className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
                        {generatingBulk ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CalendarDaysIcon className="w-4 h-4" />} {generatingBulk ? 'Generating...' : 'Generate bulk'}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6 space-y-3">
                  {payslips.length === 0 ? (
                    <div className="text-sm text-gray-500">No payslips generated yet for the selected staff member.</div>
                  ) : payslips.map((payslip) => (
                    <div key={payslip.id} className="border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="font-semibold text-gray-900">{payslip.reference_number}</div>
                        <div className="text-sm text-gray-500">{payslip.pay_month}/{payslip.pay_year} • Net {currency(payslip.net_salary_cents)}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-2 py-1 rounded-full text-xs ${payslip.status === 'generated' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{payslip.status}</span>
                        <button onClick={() => handleDownloadPayslip(payslip.id, payslip.reference_number)} className="text-sm text-picton-blue flex items-center gap-1">
                          <ArrowDownTrayIcon className="w-4 h-4" /> PDF
                        </button>
                        {(payslip.status === 'generated' || payslip.status === 'voided') && (
                          <button
                            disabled={deletingPayslipId === payslip.id}
                            onClick={async () => {
                            const confirm = await Swal.fire({ icon: 'warning', title: 'Delete payslip?', text: `This will permanently delete ${payslip.reference_number}.`, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
                            if (!confirm.isConfirmed) return;
                            setDeletingPayslipId(payslip.id);
                            try {
                              await PayrollModel.voidPayslip(payslip.id);
                              loadPayslips(selectedUserId || undefined);
                            } finally {
                              setDeletingPayslipId(null);
                            }
                          }} className="text-sm text-red-600 flex items-center gap-1 disabled:opacity-50">
                            {deletingPayslipId === payslip.id ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <TrashIcon className="w-4 h-4" />} {deletingPayslipId === payslip.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'banking' && (
            <Card>
              <div className="p-6 space-y-4">
                {bankingRequests.length === 0 ? (
                  <div className="text-sm text-gray-500">No pending banking requests.</div>
                ) : bankingRequests.map((request) => (
                  <div key={request.id} className="border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="font-semibold text-gray-900">{request.staff_name}</div>
                        <div className="text-sm text-gray-500">{request.staff_email}</div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" /> {request.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="font-medium text-gray-700 mb-1">Current banking</div>
                        {request.current_banking ? (
                          <div className="text-gray-600 space-y-1">
                            <div>{request.current_banking.bank_name}</div>
                            <div>{request.current_banking.account_number}</div>
                            <div>{request.current_banking.account_holder_name}</div>
                          </div>
                        ) : <div className="text-gray-500">No banking details on profile</div>}
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="font-medium text-blue-700 mb-1">Requested banking</div>
                        <div className="text-blue-800 space-y-1">
                          <div>{request.requested_banking.bank_name}</div>
                          <div>{request.requested_banking.account_number}</div>
                          <div>{request.requested_banking.account_holder_name}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button onClick={() => handleRejectBanking(request.id)} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Reject</button>
                      <button onClick={() => handleApproveBanking(request.id)} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'leave' && (
            <div className="space-y-6">
              {/* Leave Balances */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Balances</h3>
                  {leaveBalances.length === 0 ? (
                    <div className="text-sm text-gray-500">No leave balances found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Leave Type</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Entitled</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Used</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Pending</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Remaining</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaveBalances.map((balance) => (
                            <tr key={balance.id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3">{LeaveModel.getLeaveTypeLabel(balance.leave_type)}</td>
                              <td className="px-4 py-3 text-right font-medium">{balance.entitled_days}</td>
                              <td className="px-4 py-3 text-right text-red-600">{balance.used_days}</td>
                              <td className="px-4 py-3 text-right text-yellow-600">{balance.pending_days}</td>
                              <td className="px-4 py-3 text-right font-semibold text-green-600">{balance.remaining_days}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>

              {/* Leave Requests */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Requests</h3>
                  {leaveRequests.length === 0 ? (
                    <div className="text-sm text-gray-500">No leave requests found.</div>
                  ) : (
                    <div className="space-y-3">
                      {leaveRequests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">{LeaveModel.getLeaveTypeLabel(request.leave_type)}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                {request.start_date} to {request.end_date} ({request.days_requested} days)
                              </div>
                              {request.reason && <div className="text-sm text-gray-500 mt-2 italic">Reason: {request.reason}</div>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                                request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                request.status === 'approved' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                <ClockIcon className="w-3 h-3" /> {request.status}
                              </span>
                              {request.status === 'pending' && (
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleRejectLeaveRequest(request.id)}
                                    className="px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs"
                                  >
                                    Reject
                                  </button>
                                  <button 
                                    onClick={() => handleApproveLeaveRequest(request.id)}
                                    className="px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs flex items-center gap-1"
                                  >
                                    <CheckCircleIcon className="w-3 h-3" /> Approve
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPayroll;
