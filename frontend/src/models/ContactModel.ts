import api from '../services/api';
import { Contact, PaginationParams, PaginationResponse } from '../types';
 
/**
 * Contact Model
 * Handles all contact-related operations (customers & suppliers)
 */
export class ContactModel {
  /**
   * Get all contacts with optional filtering
   */
  static async getAll(type?: 'customers' | 'suppliers', params?: PaginationParams) {
    const queryParams: any = { ...params };
    if (type) queryParams.type = type;
    
    const response = await api.get<Contact[] | PaginationResponse<Contact>>('/contacts', { params: queryParams });
    return response.data;
  }

  /**
   * Get single contact by ID
   */
  static async getById(id: number) {
    const response = await api.get<any>(`/contacts/${id}`);
    return response.data?.data || response.data;
  }

  /**
   * Create a new contact
   */
  static async create(contact: Partial<Contact>) {
    const response = await api.post<{ success: boolean; id: number }>('/contacts', contact);
    return response.data;
  }

  /**
   * Update an existing contact
   */
  static async update(id: number, contact: Partial<Contact>) {
    const response = await api.put<{ success: boolean }>(`/contacts/${id}`, contact);
    return response.data;
  }

  /**
   * Delete a contact
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/contacts/${id}`);
    return response.data;
  }

  /**
   * Get contact statement data including transactions and aging
   */
  static async getStatementData(id: number) {
    const response = await api.get<{
      success: boolean;
      data: {
        contact: Contact;
        transactions: any[];
        closing_balance: number;
        aging: {
          current: number;
          '30_days': number;
          '60_days': number;
          '90_days': number;
          total: number;
        };
      };
    }>(`/contacts/${id}/statement-data`);
    return response.data.data;
  }

  /**
   * Download contact statement PDF
   */
  static async downloadStatement(id: number) {
    const response = await api.get<{ success: boolean; filename: string; path: string }>(`/contacts/${id}/statement`);
    return response.data;
  }
}
