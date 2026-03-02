import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { BuildingOfficeIcon, EnvelopeIcon, CogIcon, CheckIcon, BanknotesIcon, PhotoIcon, PaperAirplaneIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';
import Select from '../components/UI/Select';
import Can from '../components/Can';
import AppSettingsModel, { AppSettings } from '../models/AppSettingsModel';
import api from '../services/api';
import { getApiBaseUrl } from '../config/app';
import Swal from 'sweetalert2';

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [iconPreview, setIconPreview] = useState<string>('');
  const [logoError, setLogoError] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<AppSettings>();

  const currentLogo = watch('site_logo');
  const currentIcon = watch('site_icon');
  const currentBaseUrl = watch('site_base_url') || getApiBaseUrl();

  useEffect(() => {
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSettings = async () => {
    try {
      setLoadingData(true);
      const data = await AppSettingsModel.get();
      // Convert smtp_port from string to number for the form
      const formData = {
        ...data,
        smtp_port: data.smtp_port || '587',
        site_base_url: data.site_base_url || getApiBaseUrl()
      };
      reset(formData);
      
      const baseUrl = data.site_base_url || getApiBaseUrl();
      
      // Set logo preview if logo exists - use timestamp to avoid cache
      if (data.site_logo) {
        setLogoPreview(`${baseUrl}/assets/images/${data.site_logo}?t=${Date.now()}`);
        setLogoError(false);
      }
      
      // Set icon preview if icon exists - use timestamp to avoid cache
      if (data.site_icon) {
        setIconPreview(`${baseUrl}/assets/images/${data.site_icon}?t=${Date.now()}`);
        setIconError(false);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - check both MIME type and extension
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid File Type',
        text: 'Please upload a valid image file (JPG, PNG, or GIF)'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'File Too Large',
        text: 'File size must be less than 5MB'
      });
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/app-settings/upload-logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const uploadedFile = response.data;
      
      // Update the form with the new filename
      setValue('site_logo', uploadedFile.filename);
      
      // Set preview to server URL with cache buster
      setLogoPreview(`${currentBaseUrl}/assets/images/${uploadedFile.filename}?t=${Date.now()}`);
      setLogoError(false);
      
      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Logo uploaded successfully!',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error: any) {
      console.error('Failed to upload logo:', error);
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: error.response?.data?.error || 'Failed to upload logo'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - check both MIME type and extension
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.ico'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid File Type',
        text: 'Please upload a valid icon file (JPG, PNG, GIF, or ICO)'
      });
      return;
    }

    // Validate file size (max 2MB for icons)
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'File Too Large',
        text: 'File size must be less than 2MB'
      });
      return;
    }

    try {
      setUploadingIcon(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/app-settings/upload-icon', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const uploadedFile = response.data;
      
      // Update the form with the new filename
      setValue('site_icon', uploadedFile.filename);
      
      // Set preview to server URL with cache buster
      setIconPreview(`${currentBaseUrl}/assets/images/${uploadedFile.filename}?t=${Date.now()}`);
      setIconError(false);
      
      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Icon uploaded successfully!',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error: any) {
      console.error('Failed to upload icon:', error);
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: error.response?.data?.error || 'Failed to upload icon'
      });
    } finally {
      setUploadingIcon(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerIconInput = () => {
    iconInputRef.current?.click();
  };

  const handleSendTestEmail = async () => {
    try {
      setSendingTestEmail(true);
      
      const response = await api.post('/test-email', {
        to: watch('site_email'), // Send to the configured site email
      });

      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Test Email Sent!',
          text: 'Check your inbox.',
          timer: 3000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed to Send',
          text: response.data.message || 'Failed to send test email'
        });
      }
    } catch (error: any) {
      console.error('Failed to send test email:', error);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Send',
        text: error.response?.data?.message || 'Failed to send test email'
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const onSubmit = async (data: AppSettings) => {
    try {
      setLoading(true);
      await AppSettingsModel.update(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-6">
            <Card>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Can 
      permission="settings.view"
      fallback={
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <LockClosedIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-500">You don't have permission to access application settings.</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-white/90">Manage your application configuration and company information</p>
      </div>

      <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Company Information */}
        <Card>
          <div className="p-6">
            <div className="flex items-center mb-6">
              <BuildingOfficeIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Company Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Company Name"
                placeholder="Enter company name"
                error={errors.site_name?.message}
                {...register('site_name', {
                  required: 'Company name is required',
                  minLength: { value: 2, message: 'Company name must be at least 2 characters' }
                })}
              />

              <Input
                label="Base URL"
                placeholder={getApiBaseUrl()}
                error={errors.site_base_url?.message}
                {...register('site_base_url', {
                  required: 'Base URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/i,
                    message: 'Must be a valid URL starting with http:// or https://'
                  }
                })}
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="company@example.com"
                error={errors.site_email?.message}
                {...register('site_email', {
                  required: 'Email address is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
              />

              <Input
                label="Phone Number"
                placeholder="+1 (555) 123-4567"
                error={errors.site_contact_no?.message}
                {...register('site_contact_no', {
                  required: 'Phone number is required'
                })}
              />

              <Input
                label="VAT Registration Number"
                placeholder="VAT123456789"
                error={errors.site_vat_no?.message}
                {...register('site_vat_no')}
              />

              <div className="md:col-span-2">
                <Input
                  label="Company Address"
                  placeholder="Enter full company address"
                  error={errors.site_address?.message}
                  {...register('site_address', {
                    required: 'Company address is required'
                  })}
                />
              </div>

              {/* Logo and Icon Side by Side */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Company Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Logo
                  </label>
                  <div className="flex items-start space-x-4">
                    {/* Logo Preview - Wider for logos */}
                    <div className="flex-shrink-0">
                      {(logoPreview || currentLogo) && !logoError ? (
                        <div className="w-48 h-32 border-2 border-gray-300 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                          <img
                            src={logoPreview || `${currentBaseUrl}/assets/images/${currentLogo}?t=${Date.now()}`}
                            alt="Company Logo"
                            className="max-w-full max-h-full object-contain"
                            onError={() => setLogoError(true)}
                          />
                        </div>
                      ) : (
                        <div className="w-48 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                          <PhotoIcon className="h-12 w-12 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Upload Button */}
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={triggerFileInput}
                        disabled={uploading}
                        className="mb-2"
                      >
                        {uploading ? 'Uploading...' : 'Upload New Logo'}
                      </Button>
                      <p className="text-sm text-gray-500">
                        JPG, PNG or GIF. Max file size 5MB.
                      </p>
                      {currentLogo && (
                        <p className="text-xs text-gray-400 mt-1">
                          Current: {currentLogo}
                        </p>
                      )}
                      {/* Hidden input to store filename in form */}
                      <input type="hidden" {...register('site_logo')} />
                    </div>
                  </div>
                </div>

                {/* Site Icon (Favicon) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Icon (Favicon)
                  </label>
                  <div className="flex items-start space-x-4">
                  {/* Icon Preview - Square for icons */}
                  <div className="flex-shrink-0">
                    {(iconPreview || currentIcon) && !iconError ? (
                      <div className="w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                        <img
                          src={iconPreview || `${currentBaseUrl}/assets/images/${currentIcon}?t=${Date.now()}`}
                          alt="Site Icon"
                          className="max-w-full max-h-full object-contain"
                          onError={() => setIconError(true)}
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        <PhotoIcon className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Upload Button */}
                  <div className="flex-1">
                    <input
                      ref={iconInputRef}
                      type="file"
                      accept="image/*,.ico"
                      onChange={handleIconUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={triggerIconInput}
                      disabled={uploadingIcon}
                      className="mb-2"
                    >
                      {uploadingIcon ? 'Uploading...' : 'Upload New Icon'}
                    </Button>
                    <p className="text-sm text-gray-500">
                      ICO, PNG, JPG or GIF. Max file size 2MB.
                    </p>
                    {currentIcon && (
                      <p className="text-xs text-gray-400 mt-1">
                        Current: {currentIcon}
                      </p>
                    )}
                    {/* Hidden input to store filename in form */}
                    <input type="hidden" {...register('site_icon')} />
                  </div>
                </div>
              </div>
            </div>

              <Input
                label="Site Title"
                placeholder="Your tagline or slogan"
                error={errors.site_title?.message}
                {...register('site_title')}
              />
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter site description"
                  {...register('site_description')}
                />
                {errors.site_description && (
                  <p className="mt-1 text-sm text-red-600">{errors.site_description.message}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Financial & Banking Information */}
        <Card>
          <div className="p-6">
            <div className="flex items-center mb-6">
              <BanknotesIcon className="h-6 w-6 text-purple-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Financial & Banking Information</h2>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quotation Terms & Conditions
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Enter quotation terms (e.g., validity period, lead time, etc.)"
                    {...register('site_quote_terms')}
                  />
                  {errors.site_quote_terms && (
                    <p className="mt-1 text-sm text-red-600">{errors.site_quote_terms.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Markup Percentage (%)"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 25 for 25%" 
                     helperText="Default markup rate applied to invoices and quotations"
                    error={errors.default_markup_percentage?.message}
                    {...register('default_markup_percentage', {
                      required: 'Markup percentage is required',
                      min: { value: 0, message: 'Markup must be 0 or greater' }
                    })}
                  />

                  <Input
                    label="VAT Percentage (%)"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 15 for 15%"
                    error={errors.vat_percentage?.message}
                    helperText="Default VAT rate applied to invoices and quotations"
                    {...register('vat_percentage', {
                      required: 'VAT percentage is required',
                      min: { value: 0, message: 'VAT must be 0 or greater' },
                      max: { value: 100, message: 'VAT cannot exceed 100%' }
                    })}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Banking Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Account Name"
                    placeholder="Company Name (Pty) Ltd"
                    error={errors.bank_account_name?.message}
                    {...register('bank_account_name', {
                      required: 'Account name is required'
                    })}
                  />

                  <Input
                    label="Bank Name"
                    placeholder="FNB, ABSA, Standard Bank, etc."
                    error={errors.bank_name?.message}
                    {...register('bank_name', {
                      required: 'Bank name is required'
                    })}
                  />

                  <Input
                    label="Account Number"
                    placeholder="1234567890"
                    error={errors.bank_account_no?.message}
                    {...register('bank_account_no', {
                      required: 'Account number is required'
                    })}
                  />

                  <Input
                    label="Branch Code"
                    placeholder="250655"
                    error={errors.bank_branch_code?.message}
                    {...register('bank_branch_code', {
                      required: 'Branch code is required'
                    })}
                  />

                  <Input
                    label="Account Type"
                    placeholder="Cheque, Savings, etc."
                    error={errors.bank_account_type?.message}
                    {...register('bank_account_type', {
                      required: 'Account type is required'
                    })}
                  />

                  <Input
                    label="Payment Reference"
                    placeholder="Company Name or Invoice No."
                    error={errors.bank_reference?.message}
                    helperText="Instructions for what customers should use as reference"
                    {...register('bank_reference', {
                      required: 'Payment reference is required'
                    })}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Email Signature</h3>
                <div>
                  <label htmlFor="email_signature" className="block text-sm font-medium text-gray-700 mb-2">
                    Default Email Signature
                  </label>
                  <textarea
                    id="email_signature"
                    rows={6}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter the default signature for outgoing emails (e.g., company name, contact details, etc.)"
                    {...register('email_signature')}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    This signature will be automatically added to all outgoing quotation and invoice emails.
                  </p>
                  {errors.email_signature && (
                    <p className="mt-1 text-sm text-red-600">{errors.email_signature.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* SMTP Configuration */}
        <Card>
          <div className="p-6">
            <div className="flex items-center mb-6">
              <EnvelopeIcon className="h-6 w-6 text-green-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">Email Configuration</h2>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <CogIcon className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">SMTP Settings</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Configure your email server settings to enable email notifications and invoicing.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="SMTP Host"
                placeholder="smtp.gmail.com"
                error={errors.smtp_host?.message}
                {...register('smtp_host', {
                  required: 'SMTP host is required'
                })}
              />

              <Input
                label="SMTP Port"
                type="number"
                placeholder="587"
                error={errors.smtp_port?.message}
                {...register('smtp_port', {
                  required: 'SMTP port is required',
                  min: { value: 1, message: 'Port must be greater than 0' },
                  max: { value: 65535, message: 'Port must be less than 65536' }
                })}
              />

              <Input
                label="SMTP Username"
                placeholder="your-email@gmail.com"
                error={errors.smtp_username?.message}
                {...register('smtp_username', {
                  required: 'SMTP username is required'
                })}
              />

              <Input
                label="SMTP Password"
                type="password"
                placeholder="Your email password or app password"
                error={errors.smtp_password?.message}
                {...register('smtp_password', {
                  required: 'SMTP password is required'
                })}
              />

              <Input
                label="From Name"
                placeholder="Company Name"
                error={errors.smtp_from_name?.message}
                helperText="Name that appears in sent emails"
                {...register('smtp_from_name', {
                  required: 'From name is required'
                })}
              />

              <Input
                label="From Email"
                type="email"
                placeholder="noreply@company.com"
                error={errors.smtp_from_email?.message}
                helperText="Email address that appears in sent emails"
                {...register('smtp_from_email', {
                  required: 'From email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
              />

              <div className="md:col-span-2">
                <Select
                  label="Encryption Method"
                  error={errors.smtp_encryption?.message}
                  {...register('smtp_encryption', {
                    required: 'Encryption method is required'
                  })}
                >
                  <option value="">Select encryption method</option>
                  <option value="tls">TLS (Recommended)</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None (Not Recommended)</option>
                </Select>
              </div>

              {/* Test Email Button */}
              <div className="md:col-span-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Test Email Configuration</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Send a test email to verify your SMTP settings are working correctly.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendTestEmail}
                      loading={sendingTestEmail}
                      disabled={sendingTestEmail}
                      startIcon={<PaperAirplaneIcon className="h-4 w-4" />}
                    >
                      {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <Can permission="settings.update">
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => loadSettings()}
              disabled={loading}
            >
              Reset Changes
            </Button>
            
            <Button
              type="submit"
              loading={loading}
              startIcon={saved ? <CheckIcon className="h-4 w-4" /> : undefined}
              className={saved ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {saved ? 'Settings Saved!' : 'Save Settings'}
            </Button>
          </div>
        </Can>
      </form>
      </div>
    </div>
    </Can>
  );
};

export default SettingsPage;
