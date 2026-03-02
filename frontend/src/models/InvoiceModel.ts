import api from '../services/api';
import { Invoice, InvoiceItem, PaginationParams, PaginationResponse } from '../types';

/**
 * Invoice Model
 * Handles all invoice and invoice item operations
 */
export class InvoiceModel {
  /**
   * Get all invoices with pagination
   */
  static async getAll(params?: PaginationParams) {
    const response = await api.get<Invoice[] | PaginationResponse<Invoice>>('/invoices', { params });
    return response.data;
  }

  /**
   * Get single invoice by ID
   */
  static async getById(id: number) {
    const response = await api.get<any>(`/invoices/${id}`);
    return response.data?.data || response.data;
  }

  /**
   * Create a new invoice
   */
  static async create(invoice: Partial<Invoice>) {
    const response = await api.post<{ success: boolean; id: number }>('/invoices', invoice);
    return response.data;
  }

  /**
   * Update an existing invoice
   */
  static async update(id: number, invoice: Partial<Invoice>) {
    const response = await api.put<{ success: boolean }>(`/invoices/${id}`, invoice);
    return response.data;
  }

  /**
   * Delete an invoice
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/invoices/${id}`);
    return response.data;
  }

  /**
   * Mark invoice as paid
   */
  static async markAsPaid(id: number) {
    const response = await api.post<{ success: boolean }>(`/invoices/${id}/mark-paid`);
    return response.data;
  }

  /**
   * Generate PDF for invoice
   */
  static async generatePDF(id: number) {
    const response = await api.post<{ success: boolean; filename: string; path: string }>(`/invoices/${id}/generate-pdf`);
    return response.data;
  }

  /**
   * Send invoice via email
   */
  static async sendEmail(id: number, data: { to: string; cc?: string; subject: string; body: string }) {
    const response = await api.post<{ success: boolean; message: string }>(`/invoices/${id}/send-email`, data);
    return response.data;
  }

  /**
   * Get invoice items for an invoice
   */
  static async getItems(invoiceId: number) {
    const response = await api.get<InvoiceItem[]>('/invoice-items', { params: { invoice_id: invoiceId } });
    return response.data;
  }

  /**
   * Update invoice items for an invoice
   */
  static async updateItems(invoiceId: number, items: InvoiceItem[]) {
    const response = await api.post<{ success: boolean }>('/invoice-items', { invoice_id: invoiceId, items });
    return response.data;
  }
}
