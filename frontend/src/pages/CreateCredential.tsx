import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import Swal from 'sweetalert2';
import {
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Textarea from '../components/UI/Textarea';
import Card from '../components/UI/Card';
import { CredentialModel } from '../models';
import type { CreateCredentialData } from '../models';

interface CredentialFormData extends CreateCredentialData {
  id?: number;
}

export const CreateCredential: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<CredentialFormData>({
    defaultValues: {
      service_name: '',
      credential_type: 'api_key',
      identifier: '',
      credential_value: '',
      environment: 'development',
      expires_at: '',
      notes: '',
    },
  });

  const [loading, setLoading] = useState(false);
  const [showCredentialValue, setShowCredentialValue] = useState(false);
  const [additionalDataJson, setAdditionalDataJson] = useState('');

  const credentialType = watch('credential_type');

  useEffect(() => {
    if (isEditMode && id) {
      loadCredential(parseInt(id));
    }
  }, [id, isEditMode]);

  const loadCredential = async (credentialId: number) => {
    try {
      setLoading(true);
      const credential = await CredentialModel.getById(credentialId, true);
      
      reset({
        service_name: credential.service_name,
        credential_type: credential.credential_type,
        identifier: credential.identifier || '',
        credential_value: credential.credential_value || '',
        environment: credential.environment,
        expires_at: credential.expires_at ? credential.expires_at.split(' ')[0] : '',
        notes: credential.notes || '',
      });

      if (credential.additional_data) {
        setAdditionalDataJson(JSON.stringify(credential.additional_data, null, 2));
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to Load',
        text: error.message || 'Failed to load credential'
      });
      navigate('/credentials');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CredentialFormData) => {
    try {
      // Parse additional_data JSON if provided
      let additionalData = undefined;
      if (additionalDataJson.trim()) {
        try {
          additionalData = JSON.parse(additionalDataJson);
        } catch (e) {
          Swal.fire({
            icon: 'error',
            title: 'Invalid JSON',
            text: 'Invalid JSON in Additional Data field'
          });
          return;
        }
      }

      const payload: CreateCredentialData = {
        ...data,
        additional_data: additionalData,
      };

      if (isEditMode && id) {
        await CredentialModel.update(parseInt(id), payload);
        Swal.fire({
          icon: 'success',
          title: 'Updated!',
          text: 'Credential updated successfully',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        await CredentialModel.create(payload);
        Swal.fire({
          icon: 'success',
          title: 'Created!',
          text: 'Credential created successfully',
          timer: 2000,
          showConfirmButton: false
        });
      }

      navigate('/credentials');
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Operation Failed',
        text: error.message || `Failed to ${isEditMode ? 'update' : 'create'} credential`
      });
    }
  };

  const getIdentifierLabel = (type: string) => {
    const labels: Record<string, string> = {
      api_key: 'Key Name / Public Key',
      password: 'Username / Email',
      token: 'Token Name',
      oauth: 'Client ID',
      ssh_key: 'Key Name',
      certificate: 'Certificate Name',
      other: 'Identifier',
    };
    return labels[type] || 'Identifier';
  };

  const getCredentialValueLabel = (type: string) => {
    const labels: Record<string, string> = {
      api_key: 'API Key / Secret Key',
      password: 'Password',
      token: 'Token Value',
      oauth: 'Access Token',
      ssh_key: 'Private Key',
      certificate: 'Certificate Content',
      other: 'Credential Value',
    };
    return labels[type] || 'Credential Value';
  };

  const getCredentialValuePlaceholder = (type: string) => {
    const placeholders: Record<string, string> = {
      api_key: 'sk_test_abc123xyz789...',
      password: '••••••••',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      oauth: 'ya29.a0AfH6SMBx...',
      ssh_key: '-----BEGIN PRIVATE KEY-----\n...',
      certificate: '-----BEGIN CERTIFICATE-----\n...',
      other: 'Enter credential value',
    };
    return placeholders[type] || 'Enter credential value';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/credentials')}
          className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? 'Edit Credential' : 'Create New Credential'}
        </h1>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <p className="text-sm text-blue-700">
          <strong>Security:</strong> Credentials are automatically encrypted using AES-256 before storage.
          They can only be decrypted by administrators with proper permissions.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Service Name */}
            <div>
              <Controller
                name="service_name"
                control={control}
                rules={{ required: 'Service name is required' }}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Service Name"
                    required
                    error={errors.service_name?.message}
                    helperText="E.g., smtp, stripe, aws_s3"
                  />
                )}
              />
            </div>

            {/* Credential Type */}
            <div>
              <Controller
                name="credential_type"
                control={control}
                rules={{ required: 'Credential type is required' }}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Credential Type"
                    required
                    error={errors.credential_type?.message}
                  >
                    <option value="api_key">API Key</option>
                    <option value="password">Password</option>
                    <option value="token">Token</option>
                    <option value="oauth">OAuth</option>
                    <option value="ssh_key">SSH Key</option>
                    <option value="certificate">Certificate</option>
                    <option value="other">Other</option>
                  </Select>
                )}
              />
            </div>

            {/* Identifier */}
            <div>
              <Controller
                name="identifier"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label={getIdentifierLabel(credentialType)}
                    error={errors.identifier?.message}
                    helperText="Optional identifier (username, email, key name)"
                  />
                )}
              />
            </div>

            {/* Environment */}
            <div>
              <Controller
                name="environment"
                control={control}
                rules={{ required: 'Environment is required' }}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Environment"
                    required
                    error={errors.environment?.message}
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                    <option value="all">All Environments</option>
                  </Select>
                )}
              />
            </div>

            {/* Credential Value */}
            <div className="md:col-span-2">
              <Controller
                name="credential_value"
                control={control}
                rules={{ required: 'Credential value is required' }}
                render={({ field }) => (
                  credentialType === 'ssh_key' || credentialType === 'certificate' ? (
                    <Textarea
                      {...field}
                      label={getCredentialValueLabel(credentialType)}
                      required
                      rows={6}
                      placeholder={getCredentialValuePlaceholder(credentialType)}
                      error={errors.credential_value?.message}
                      helperText="This value will be encrypted before storage"
                    />
                  ) : (
                    <div className="relative">
                      <Input
                        {...field}
                        label={getCredentialValueLabel(credentialType)}
                        required
                        type={showCredentialValue ? 'text' : 'password'}
                        placeholder={getCredentialValuePlaceholder(credentialType)}
                        error={errors.credential_value?.message}
                        helperText="This value will be encrypted before storage"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCredentialValue(!showCredentialValue)}
                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                      >
                        {showCredentialValue ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  )
                )}
              />
            </div>

            {/* Additional Data (JSON) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Data (JSON)
              </label>
              <textarea
                value={additionalDataJson}
                onChange={(e) => setAdditionalDataJson(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder={`{\n  "port": 587,\n  "encryption": "tls",\n  "from_address": "noreply@example.com"\n}`}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Additional configuration as JSON (e.g., port, encryption, from_address for SMTP)
              </p>
            </div>

            {/* Expires At */}
            <div>
              <Controller
                name="expires_at"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Expires At"
                    type="date"
                    error={errors.expires_at?.message}
                    helperText="Optional: When this credential expires"
                  />
                )}
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    label="Notes"
                    rows={3}
                    error={errors.notes?.message}
                    helperText="Optional: Additional notes or documentation"
                  />
                )}
              />
            </div>

            {/* Action Buttons */}
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/credentials')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};
