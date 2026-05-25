// src/api/pigmy.api.ts
// Maps every route in pigmy.routes.js → pigmy.service.js
// Backend base: POST|GET /api/v1/pigmy-accounts
import { api } from './client';
import type { PigmyAccount, Pagination } from '../types';

// ── Shared response shapes ────────────────────────────────────────────────────
interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  message?: string;
}

export interface PigmyListResponse {
  accounts: PigmyAccount[];
  pagination: Pagination;
}

export interface PigmyStatementResponse {
  accountNumber: string;
  balanceInRupees: string;
  transactions: {
    _id: string;
    transactionId: string;
    type: string;
    amountInPaise: number;
    netAmountInPaise: number;
    feeInPaise: number;
    balanceAfterInPaise?: number;
    note?: string;
    status: string;
    businessDate: string;
    createdAt: string;
    performedBy?: { _id: string; name: string; role: string };
    reversalOf?: string;
  }[];
  pagination: Pagination;
}

export interface PigmyCloseResult {
  message: string;
  accountNumber: string;
  returnedBalanceInRupees: string;
}

export interface PigmyFreezeResult {
  message: string;
  accountNumber: string;
}

// ── API ───────────────────────────────────────────────────────────────────────
export const pigmyApi = {
  // POST /pigmy-accounts — CREATE
  create: async (data: {
    customerId: string;
    dailyDepositAmountInPaise: number;
    collectionFrequency?: 'daily'; // weekly not yet supported by backend
    assignedAgent?: string;
  }) => {
    const res = await api.post<ApiResponse<{ account: PigmyAccount }>>('/pigmy-accounts', data);
    return res.data;
  },

  // GET /pigmy-accounts — LIST (paginated, role-filtered)
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    assignedAgent?: string;
    isDeleted?: boolean;
  }) => {
    const res = await api.get<ApiResponse<PigmyListResponse>>('/pigmy-accounts', { params });
    return res.data;
  },

  // GET /pigmy-accounts/customer/:customerId — BY CUSTOMER
  getByCustomer: async (customerId: string) => {
    const res = await api.get<ApiResponse<PigmyAccount[]>>(`/pigmy-accounts/customer/${customerId}`);
    return res.data;
  },

  // GET /pigmy-accounts/:id — SINGLE
  getAccount: async (id: string) => {
    const res = await api.get<ApiResponse<{ account: PigmyAccount }>>(`/pigmy-accounts/${id}`);
    return res.data;
  },

  // GET /pigmy-accounts/:id/statement — STATEMENT
  getStatement: async (
    id: string,
    params?: { page?: number; limit?: number; fromDate?: string; toDate?: string }
  ) => {
    const res = await api.get<ApiResponse<PigmyStatementResponse>>(`/pigmy-accounts/${id}/statement`, { params });
    return res.data;
  },

  // PATCH /pigmy-accounts/:id/close — CLOSE
  close: async (id: string, data: { closureReason: string }) => {
    const res = await api.patch<ApiResponse<PigmyCloseResult>>(`/pigmy-accounts/${id}/close`, data);
    return res.data;
  },

  // PATCH /pigmy-accounts/:id/freeze — FREEZE
  freeze: async (id: string, data: { freezeReason: string }) => {
    const res = await api.patch<ApiResponse<PigmyFreezeResult>>(`/pigmy-accounts/${id}/freeze`, data);
    return res.data;
  },

  // PATCH /pigmy-accounts/:id — UPDATE SETTINGS
  update: async (id: string, data: {
    dailyDepositAmountInPaise?: number;
    collectionFrequency?: 'daily' | 'weekly';
  }) => {
    const res = await api.patch<ApiResponse<{ account: PigmyAccount }>>(`/pigmy-accounts/${id}`, data);
    return res.data;
  },

  // PATCH /pigmy-accounts/:id/unfreeze — UNFREEZE
  unfreeze: async (id: string, data?: { unfreezeReason?: string }) => {
    const res = await api.patch<ApiResponse<PigmyFreezeResult>>(`/pigmy-accounts/${id}/unfreeze`, data ?? {});
    return res.data;
  },

  transferToSaving: async (
    id: string,
    data: { amountInPaise: number; note?: string }
  ) => {
    const res = await api.post<ApiResponse<any>>(`/pigmy-accounts/${id}/transfer-to-saving`, data);
    return res.data;
  },

  // DELETE /pigmy-accounts/:id — DELETE
  delete: async (id: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/pigmy-accounts/${id}`);
    return res.data;
  },

  // POST /pigmy-accounts/:id/restore — RESTORE
  restore: async (id: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/pigmy-accounts/${id}/restore`);
    return res.data;
  },
};
