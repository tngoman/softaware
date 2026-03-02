import api from '../services/api';
import { Transaction, PaginationParams, PaginationResponse } from '../types';

/**
 * Transaction Model
 * Handles all transaction operations (VAT-compliant expenses and income)
 */
export class TransactionModel {
  /**
   * Get all transactions with filtering and pagination
   */
  static async getAll(params?: PaginationParams & { type?: string; from_date?: string; to_date?: string }) {
    const response = await api.get<PaginationResponse<Transaction>>('/transactions', { params });
    return response.data;
  }

  /**
   * Get single transaction by ID
   */
  static async getById(id: number) {
    const response = await api.get<Transaction>(`/transactions/${id}`);
    return response.data;
  }

  /**
   * Create a new transaction (supports file upload)
   */
  static async create(data: FormData) {
    const response = await api.post<{ success: boolean; id: number; calculated: any }>(
      '/transactions',
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  }

  /**
   * Update an existing transaction
   */
  static async update(id: number, data: Partial<Transaction>) {
    const response = await api.put<{ success: boolean }>(`/transactions/${id}`, data);
    return response.data;
  }

  /**
   * Delete a transaction
   */
  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/transactions/${id}`);
    return response.data;
  }

  /**
   * Clear all income transactions (used to reset before reprocessing payments)
   */
  static async clearIncome() {
    const response = await api.post<{ deleted: number; payment_ids: number[] }>(
      '/transactions/clear-income'
    );
    return response.data;
  }
}
