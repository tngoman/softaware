import api from '../services/api';
import { Quotation, QuoteItem, PaginationParams, PaginationResponse } from '../types';

/**
 * Quotation Model
 * Handles all quotation and quote item operations
 */
export class QuotationModel {
  /**
   * Get all quotations with pagination
   */
  static async getAll(params?: PaginationParams) {
    const response = await api.get<Quotation[] | PaginationResponse<Quotation>>('/quotations', { params });
    return response.data;
  }

  /**
   * Get single quotation by ID
   */
  static async getById(id: number) {
    const response = await api.get<any>(`/quotations/${id}`);
    return response.data?.data || response.data;
  }

  /**
   * Create a new quotation
   */
  static async create(quotation: Partial<Quotation>) {
    const response = await api.post<{ success: boolean; id: number; data: any }>('/quotations', quotation);
    return response.data;
  }

  /**
   * Update an existing quotation
   */
  static async update(id: number, quotation: Partial<Quotation>) {
    const response = await api.put<{ success: boolean }>(`/quotations/${id}`, quotation);
    return response.data;
  }

  /**
   * Delete a quotation
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/quotations/${id}`);
    return response.data;
  }

  /**
   * Convert quotation to invoice
   */
  static async convertToInvoice(quoteId: number) {
    const response = await api.post<{ success: boolean; message: string; data: any }>(`/quotations/${quoteId}/convert-to-invoice`, {});
    return response.data;
  }

  /**
   * Convert quotation to proforma invoice
   */
  static async convertToProforma(quoteId: number) {
    const response = await api.post<{ success: boolean; data: any }>(`/quotations/${quoteId}/convert-to-proforma`, {});
    return response.data;
  }

  /**
   * Generate PDF for quotation
   */
  static async generatePDF(id: number) {
    const response = await api.post<{ success: boolean; filename: string; path: string }>(`/quotations/${id}/generate-pdf`);
    return response.data;
  }

  /**
   * Send quotation via email
   */
  static async sendEmail(id: number, data: { to: string; cc?: string; subject: string; body: string }) {
    const response = await api.post<{ success: boolean; message: string }>(`/quotations/${id}/send-email`, data);
    return response.data;
  }

  /**
   * Get quote items for a quotation
   */
  static async getItems(quoteId: number) {
    const response = await api.get<QuoteItem[]>('/quote-items', { params: { quote_id: quoteId } });
    return response.data;
  }

  /**
   * Update quote items for a quotation
   */
  static async updateItems(quoteId: number, items: QuoteItem[]) {
    const response = await api.post<{ success: boolean }>('/quote-items', { quote_id: quoteId, items });
    return response.data;
  }
}
