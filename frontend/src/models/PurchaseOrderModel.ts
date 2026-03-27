import api from '../services/api';
import { PurchaseOrder, PaginationParams, PaginationResponse } from '../types';

/**
 * Purchase Order Model
 * Handles all purchase order operations
 */
export class PurchaseOrderModel {
  /**
   * Get all purchase orders with pagination
   */
  static async getAll(params?: PaginationParams & { status?: number }) {
    const response = await api.get<PurchaseOrder[] | PaginationResponse<PurchaseOrder>>('/purchase-orders', { params });
    return response.data;
  }

  /**
   * Get single purchase order by ID
   */
  static async getById(id: number) {
    const response = await api.get<any>(`/purchase-orders/${id}`);
    return response.data?.data || response.data;
  }

  /**
   * Create a new purchase order
   */
  static async create(po: Record<string, any>) {
    const response = await api.post<{ success: boolean; id: number; data: any }>('/purchase-orders', po);
    return response.data;
  }

  /**
   * Update an existing purchase order
   */
  static async update(id: number, po: Record<string, any>) {
    const response = await api.put<{ success: boolean }>(`/purchase-orders/${id}`, po);
    return response.data;
  }

  /**
   * Delete a purchase order
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/purchase-orders/${id}`);
    return response.data;
  }

  /**
   * Generate PDF for purchase order
   */
  static async generatePDF(id: number) {
    const response = await api.post<{ success: boolean; filename: string; path: string }>(`/purchase-orders/${id}/generate-pdf`);
    return response.data;
  }

  /**
   * Send purchase order via email
   */
  static async sendEmail(id: number, data: { to: string; cc?: string; subject: string; body: string }) {
    const response = await api.post<{ success: boolean; message: string }>(`/purchase-orders/${id}/send-email`, data);
    return response.data;
  }

  /**
   * Create a purchase order from an invoice
   */
  static async createFromInvoice(invoiceId: number, contactId?: number) {
    const response = await api.post<{ success: boolean; message: string; data: any }>(
      `/purchase-orders/create-from-invoice/${invoiceId}`,
      contactId ? { contact_id: contactId } : {}
    );
    return response.data;
  }
}
