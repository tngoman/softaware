import api from '../services/api';

export interface AppSettings {
  // Company Information
  site_name: string;
  site_title: string;
  site_description: string;
  site_email: string;
  site_contact_no: string;
  site_vat_no: string;
  site_address: string;
  site_logo: string;
  site_icon: string;
  site_base_url: string;
  
  // Financial Settings
  site_quote_terms: string;
  default_markup_percentage: string;
  vat_percentage: string;
  email_signature: string;
  
  // Banking Details
  bank_account_name: string;
  bank_name: string;
  bank_account_no: string;
  bank_branch_code: string;
  bank_account_type: string;
  bank_reference: string;
  
  // Email Configuration
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_encryption: string;
  smtp_from_name: string;
  smtp_from_email: string;
  
  // Theme (optional)
  logo_bg?: string;
  navbar_bg?: string;
  sidebar_bg?: string;
  body_bg?: string;
  dashboard_bg?: string;
}

class AppSettingsModel {
  /**
   * Get all application settings
   */
  static async get(category?: string): Promise<AppSettings> {
    const params = category ? `?category=${category}` : '';
    const response = await api.get(`/app-settings${params}`);
    return response.data;
  }

  /**
   * Update multiple settings at once
   */
  static async update(settings: Partial<AppSettings>): Promise<void> {
    await api.put('/app-settings', settings);
  }

  /**
   * Get a single setting by key
   */
  static async getByKey(key: string): Promise<any> {
    const response = await api.get(`/app-settings/${key}`);
    return response.data;
  }

  /**
   * Update a single setting by key
   */
  static async updateByKey(key: string, value: any, type: string = 'string'): Promise<void> {
    await api.put(`/app-settings/${key}`, { value, type });
  }
}

export default AppSettingsModel;
