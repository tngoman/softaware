import React, { useState, useEffect } from 'react';
import {
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store';
import api from '../../services/api';
import TwoFactorSetup from '../../components/TwoFactorSetup';
import MobileAuthQR from '../../components/MobileAuthQR';
import PinSetup from '../../components/PinSetup';
import Swal from 'sweetalert2';

const PortalSettings: React.FC = () => {
  const { user } = useAppStore();
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'security' | 'billing'>('account');
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user as any).name || '',
        email: user.email || '',
        phone: (user as any).phone || '',
      });
    }
  }, [user]);

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      await api.put('/profile', {
        name: profileForm.name,
        phone: profileForm.phone,
      });
      Swal.fire({ icon: 'success', title: 'Saved', text: 'Profile updated.', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Mismatch', text: 'Passwords do not match.' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Too Short', text: 'Password must be at least 8 characters.' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/profile/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Swal.fire({ icon: 'success', title: 'Updated', text: 'Password changed successfully.', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: UserCircleIcon },
    { id: 'security' as const, label: 'Security', icon: ShieldCheckIcon },
    { id: 'billing' as const, label: 'Billing', icon: CreditCardIcon },
  ];

  const inputClass =
    'w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all text-sm';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? 'text-picton-blue border-picton-blue'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Profile Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                value={profileForm.name}
                onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input value={profileForm.email} className={`${inputClass} bg-gray-50`} disabled />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+27 ..."
                className={inputClass}
              />
            </div>
          </div>
          <div className="pt-2">
            <button
              onClick={handleProfileSave}
              disabled={saving}
              className="px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (<>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
          <div className="max-w-md space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder="Min. 8 characters"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div className="pt-2">
            <button
              onClick={handlePasswordChange}
              disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword}
              className="px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </div>

        {/* Quick PIN Login */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <PinSetup />
        </div>

        {/* Two-Factor Authentication */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <TwoFactorSetup isStaffOrAdmin={false} />
        </div>

        {/* Mobile App QR Authentication */}
        <MobileAuthQR />
      </>)}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Billing & Plan</h2>
          <div className="bg-picton-blue/5 border border-picton-blue/20 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Free Plan</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  500 messages/month • 50 pages indexed • 5 assistants
                </p>
              </div>
              <span className="inline-flex items-center px-3 py-1 text-xs font-semibold text-picton-blue bg-picton-blue/10 rounded-full">
                Current
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            <p>
              Need more capacity? Upgrade plans will be available soon. Contact{' '}
              <a href="mailto:support@softaware.co.za" className="text-picton-blue hover:text-picton-blue/80 transition-colors">
                support@softaware.co.za
              </a>{' '}
              for enterprise pricing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalSettings;
