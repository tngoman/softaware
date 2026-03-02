import api from '../services/api';

export interface Credential {
  id: number;
  service_name: string;
  credential_type: 'api_key' | 'password' | 'token' | 'oauth' | 'ssh_key' | 'certificate' | 'other';
  identifier?: string;
  credential_value?: string; // Only present when decrypt=true
  additional_data?: Record<string, any>; // Only present when decrypt=true
  environment: 'development' | 'staging' | 'production' | 'all';
  expires_at?: string;
  is_active: number;
  notes?: string;
  created_by: number;
  updated_by?: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCredentialData {
  service_name: string;
  credential_type: string;
  identifier?: string;
  credential_value: string;
  additional_data?: Record<string, any>;
  environment: string;
  expires_at?: string;
  notes?: string;
}

export interface UpdateCredentialData extends Partial<CreateCredentialData> {
  is_active?: number;
}

export class CredentialModel {
  private static endpoint = '/credentials';

  /**
   * Get all credentials
   */
  static async getAll(decrypt: boolean = false, filters?: {
    type?: string;
    environment?: string;
  }): Promise<Credential[]> {
    const params = new URLSearchParams();
    if (decrypt) params.append('decrypt', 'true');
    if (filters?.type) params.append('type', filters.type);
    if (filters?.environment) params.append('environment', filters.environment);

    const response = await api.get(`${this.endpoint}?${params.toString()}`);
    return response.data?.data ?? response.data;
  }

  /**
   * Get credential by ID
   */
  static async getById(id: number, decrypt: boolean = false): Promise<Credential> {
    const params = decrypt ? '?decrypt=true' : '';
    const response = await api.get(`${this.endpoint}/${id}${params}`);
    return response.data?.data ?? response.data;
  }

  /**
   * Get credentials by service name
   */
  static async getByService(
    serviceName: string,
    environment?: string,
    decrypt: boolean = false
  ): Promise<Credential> {
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    if (decrypt) params.append('decrypt', 'true');

    const response = await api.get(`${this.endpoint}/service/${serviceName}?${params.toString()}`);
    return response.data?.data ?? response.data;
  }

  /**
   * Get expired credentials
   */
  static async getExpired(decrypt: boolean = false): Promise<Credential[]> {
    const params = decrypt ? '?decrypt=true' : '';
    const response = await api.get(`${this.endpoint}/expired${params}`);
    return response.data?.data ?? response.data;
  }

  /**
   * Get credentials expiring soon
   */
  static async getExpiringSoon(days: number = 30, decrypt: boolean = false): Promise<Credential[]> {
    const params = new URLSearchParams();
    params.append('days', days.toString());
    if (decrypt) params.append('decrypt', 'true');

    const response = await api.get(`${this.endpoint}/expiring?${params.toString()}`);
    return response.data?.data ?? response.data;
  }

  /**
   * Search credentials
   */
  static async search(query: string, decrypt: boolean = false): Promise<Credential[]> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (decrypt) params.append('decrypt', 'true');

    const response = await api.get(`${this.endpoint}/search?${params.toString()}`);
    return response.data?.data ?? response.data;
  }

  /**
   * Create new credential
   */
  static async create(data: CreateCredentialData): Promise<Credential> {
    const response = await api.post(this.endpoint, data);
    return response.data?.data ?? response.data;
  }

  /**
   * Update credential
   */
  static async update(id: number, data: UpdateCredentialData): Promise<Credential> {
    const response = await api.put(`${this.endpoint}/${id}`, data);
    return response.data?.data ?? response.data;
  }

  /**
   * Delete credential (permanent)
   */
  static async delete(id: number): Promise<void> {
    await api.delete(`${this.endpoint}/${id}`);
  }

  /**
   * Deactivate credential (soft delete)
   */
  static async deactivate(id: number): Promise<Credential> {
    const response = await api.post(`${this.endpoint}/${id}/deactivate`);
    return response.data;
  }

  /**
   * Rotate credential
   */
  static async rotate(id: number, newCredentialValue: string): Promise<Credential> {
    const response = await api.post(`${this.endpoint}/${id}/rotate`, {
      new_credential_value: newCredentialValue
    });
    return response.data;
  }

  /**
   * Test credential
   */
  static async test(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`${this.endpoint}/${id}/test`);
    return response.data;
  }
}
