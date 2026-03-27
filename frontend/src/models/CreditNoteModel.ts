import api from '../services/api';
import { PaginationParams, PaginationResponse } from '../types';

export interface CreditNote {
  credit_note_id: number;
  credit_note_number: string;
  contact_id: number;
  invoice_id?: number;
  credit_note_user_id?: string;
  credit_note_total: number;
  credit_note_subtotal: number;
  credit_note_vat?: number;
  credit_note_date: string;
  reason?: string;
  remarks?: string;
  credit_note_status: number;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_vat?: string;
  contact_address?: string;
  linked_invoice_number?: string;
  items?: CreditNoteItem[];
}

export interface CreditNoteItem {
  item_id?: number;
  item_product: string;
  item_description?: string;
  item_qty: number;
  item_quantity?: number;
  item_price: number;
  item_cost?: number;
  item_discount?: number;
  item_subtotal?: number;
  item_vat?: number;
  item_profit?: number;
}

/**
 * Credit Note Model
 * Handles all credit note operations
 */
export class CreditNoteModel {
  static async getAll(params?: PaginationParams) {
    const response = await api.get<CreditNote[] | PaginationResponse<CreditNote>>('/credit-notes', { params });
    return response.data;
  }

  static async getById(id: number) {
    const response = await api.get<any>(`/credit-notes/${id}`);
    return response.data?.data || response.data;
  }

  static async create(data: Partial<CreditNote>) {
    const response = await api.post<{ success: boolean; id: number; data: any }>('/credit-notes', data);
    return response.data;
  }

  static async update(id: number, data: Partial<CreditNote>) {
    const response = await api.put<{ success: boolean }>(`/credit-notes/${id}`, data);
    return response.data;
  }

  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/credit-notes/${id}`);
    return response.data;
  }

  static async generatePDF(id: number) {
    const response = await api.post<{ success: boolean; filename: string; path: string }>(`/credit-notes/${id}/generate-pdf`);
    return response.data;
  }

  static async createFromInvoice(invoiceId: number) {
    const response = await api.post<{ success: boolean; id: number; data: any }>(`/credit-notes/from-invoice/${invoiceId}`);
    return response.data;
  }
}
