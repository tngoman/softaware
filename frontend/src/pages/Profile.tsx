import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  UserIcon, 
  EnvelopeIcon, 
  PhoneIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useAppStore } from '../store';
import { AuthModel } from '../models';
import Swal from 'sweetalert2';

interface ProfileFormData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

const Profile: React.FC = () => {
  const { user, setUser } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ProfileFormData>();

  useEffect(() => {
    if (user) {
      reset({
        username: user.username || '',
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: (user as any).phone || ''
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    setSaved(false);

    try {
      // Update user profile via API
      const response = await AuthModel.updateProfile(data);
      
      if (response.success) {
        // Update local user state
        setUser({
          ...user!,
          ...data
        });

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);

        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Profile updated successfully',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Failed to update profile'
      });
    } finally {
      setLoading(false);
    }
  };

  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    } else if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {(user as any)?.avatar ? (
              <img
                src={(user as any).avatar}
                alt={user?.username}
                className="h-20 w-20 rounded-full object-cover border-4 border-white/20"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-white/20 text-white flex items-center justify-center text-2xl font-bold border-4 border-white/20 backdrop-blur-sm">
                {getUserInitials()}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.username}
            </h1>
            <p className="text-white/90">{user?.email}</p>
            {user?.role && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm mt-2">
                {user.role.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                {...register('username', { required: 'Username is required' })}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                placeholder="Enter username"
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                placeholder="Enter email address"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* First Name & Last Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                {...register('first_name')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                placeholder="Enter first name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                {...register('last_name')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                placeholder="Enter last name"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <PhoneIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="tel"
                {...register('phone')}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            {saved && (
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircleIcon className="h-5 w-5 mr-1" />
                Profile updated successfully
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-200"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
