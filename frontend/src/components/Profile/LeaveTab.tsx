import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../UI';
import LeaveModel, { type LeaveBalance, type LeaveRequest } from '../../models/LeaveModel';
import CustomDatePicker from '../UI/CustomDatePicker';

const LeaveTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [form, setForm] = useState({
    leave_type: 'annual' as 'annual' | 'sick' | 'family_responsibility' | 'maternity' | 'parental',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const currentYear = new Date().getFullYear();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [balancesData, requestsData] = await Promise.all([
        LeaveModel.getMyBalances(currentYear),
        LeaveModel.getMyRequests(),
      ]);
      setBalances(balancesData);
      setRequests(requestsData);
    } catch (error: any) {
      console.error('Failed to load leave data', error);
      // Silently handle - user will see empty state message in the UI
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitRequest = async () => {
    if (!form.start_date || !form.end_date) {
      Swal.fire({ icon: 'warning', title: 'Missing dates', text: 'Please select start and end dates' });
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      Swal.fire({ icon: 'warning', title: 'Invalid dates', text: 'End date cannot be before start date' });
      return;
    }

    try {
      await LeaveModel.submitMyRequest(
        form.leave_type,
        form.start_date,
        form.end_date,
        form.reason || undefined
      );
      await loadData();
      setShowRequestForm(false);
      setForm({
        leave_type: 'annual',
        start_date: '',
        end_date: '',
        reason: '',
      });
      Swal.fire({
        icon: 'success',
        title: 'Submitted',
        text: 'Your leave request has been submitted for approval.',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error?.response?.data?.message || 'Failed to submit leave request',
      });
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
      {/* Leave Balances */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Leave Balances ({currentYear})</h3>
            <button
              onClick={loadData}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>

          {balances.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No leave balances found. Please contact admin to set up your leave entitlements.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {balances.map((balance) => (
                <div key={balance.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDaysIcon className="w-5 h-5 text-picton-blue" />
                    <h4 className="font-semibold text-gray-900">
                      {LeaveModel.getLeaveTypeLabel(balance.leave_type)}
                    </h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Entitled:</span>
                      <span className="font-medium">{balance.entitled_days} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Used:</span>
                      <span className="font-medium text-red-600">{balance.used_days} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pending:</span>
                      <span className="font-medium text-yellow-600">{balance.pending_days} days</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-900 font-semibold">Remaining:</span>
                      <span className="font-bold text-green-600 text-lg">{balance.remaining_days} days</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Leave Requests */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">My Leave Requests</h3>
            <button
              onClick={() => setShowRequestForm(!showRequestForm)}
              className="flex items-center gap-2 px-4 py-2 bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Request Leave
            </button>
          </div>

          {/* Request Form */}
          {showRequestForm && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-semibold text-gray-900 mb-4">New Leave Request</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                  <select
                    value={form.leave_type}
                    onChange={(e) => setForm({ ...form, leave_type: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
                  >
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="family_responsibility">Family Responsibility</option>
                    <option value="maternity">Maternity Leave</option>
                    <option value="parental">Parental Leave</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <CustomDatePicker
                    value={form.start_date ? new Date(form.start_date) : null}
                    onChange={(date) => setForm({ ...form, start_date: date ? date.toISOString().split('T')[0] : '' })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <CustomDatePicker
                    value={form.end_date ? new Date(form.end_date) : null}
                    onChange={(date) => setForm({ ...form, end_date: date ? date.toISOString().split('T')[0] : '' })}
                    className="w-full"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
                    placeholder="Provide additional details..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSubmitRequest}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Submit Request
                </button>
                <button
                  onClick={() => {
                    setShowRequestForm(false);
                    setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Requests List */}
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No leave requests yet.</div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">
                          {LeaveModel.getLeaveTypeLabel(request.leave_type)}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            request.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : request.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {request.status === 'pending' && <ClockIcon className="w-3 h-3 inline mr-1" />}
                          {request.status === 'approved' && <CheckCircleIcon className="w-3 h-3 inline mr-1" />}
                          {request.status === 'rejected' && <XCircleIcon className="w-3 h-3 inline mr-1" />}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <strong>Dates:</strong> {request.start_date} to {request.end_date} ({request.days}{' '}
                          days)
                        </div>
                        {request.reason && (
                          <div>
                            <strong>Reason:</strong> {request.reason}
                          </div>
                        )}
                        {request.status === 'rejected' && request.rejection_reason && (
                          <div className="text-red-600">
                            <strong>Rejection reason:</strong> {request.rejection_reason}
                          </div>
                        )}
                        {request.approved_at && (
                          <div className="text-xs text-gray-500">
                            {request.status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
                            {new Date(request.approved_at).toLocaleDateString()}
                            {request.reviewer_name && ` by ${request.reviewer_name}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LeaveTab;
