// src/api/saving.api.ts
// Maps every route in account.routes.js → saving.service.js
// Backend base: POST|GET /api/v1/accounts
import { api } from './client';
import type { SavingAccount, Pagination } from '../types';

// ── Shared response shapes ────────────────────────────────────────────────────
interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  message?: string;
}

export interface SavingListResponse {
  accounts: SavingAccount[];
  pagination: Pagination;
}

export interface SavingStatementResponse {
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

export interface DepositResult {
  accountNumber: string;
  transactionRef: string;
  amountInRupees: string;
  newBalanceInRupees: string;
  message: string;
}

export interface CloseResult {
  message: string;
  accountNumber: string;
  returnedBalanceInRupees: string;
}

export interface FreezeResult {
  message: string;
  accountNumber: string;
}

// ── API ───────────────────────────────────────────────────────────────────────
export const savingApi = {
  // GET /accounts/opening-charge — fetch current opening charge for the UI dialog
  getOpeningCharge: async () => {
    const res = await api.get<ApiResponse<{ openingChargeInPaise: number; openingChargeInRupees: string }>>('/accounts/opening-charge');
    return res.data;
  },

  // POST /accounts — CREATE (admin only; business day must be open)
  create: async (data: { customerId: string }) => {
    const res = await api.post<ApiResponse<{ account: SavingAccount }>>('/accounts', data);
    return res.data;
  },

  // GET /accounts — LIST (paginated, role-filtered)
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    assignedAgent?: string;
  }) => {
    const res = await api.get<ApiResponse<SavingListResponse>>('/accounts', { params });
    return res.data;
  },

  // GET /accounts/customer/:customerId — BY CUSTOMER
  getByCustomer: async (customerId: string) => {
    const res = await api.get<ApiResponse<SavingAccount[]>>(`/accounts/customer/${customerId}`);
    return res.data;
  },

  // GET /accounts/:id — SINGLE
  getAccount: async (id: string) => {
    const res = await api.get<ApiResponse<{ account: SavingAccount }>>(`/accounts/${id}`);
    return res.data;
  },

  // GET /accounts/:id/statement — STATEMENT
  getStatement: async (
    id: string,
    params?: { page?: number; limit?: number; fromDate?: string; toDate?: string }
  ) => {
    const res = await api.get<ApiResponse<SavingStatementResponse>>(`/accounts/${id}/statement`, { params });
    return res.data;
  },

  // POST /accounts/:id/deposit — DEPOSIT
  deposit: async (
    id: string,
    data: { 
      amountInPaise: number; 
      note?: string;
      paymentMode?: string;
      utrNumber?: string;
      chequeNumber?: string;
      bankName?: string;
    },
    idempotencyKey: string
  ) => {
    const res = await api.post<ApiResponse<DepositResult>>(`/accounts/${id}/deposit`, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return res.data;
  },

  // PATCH /accounts/:id/close — CLOSE
  close: async (id: string, data: { closureReason: string }) => {
    const res = await api.patch<ApiResponse<CloseResult>>(`/accounts/${id}/close`, data);
    return res.data;
  },

  // PATCH /accounts/:id/freeze — FREEZE
  freeze: async (id: string, data: { freezeReason: string }) => {
    const res = await api.patch<ApiResponse<FreezeResult>>(`/accounts/${id}/freeze`, data);
    return res.data;
  },

  // PATCH /accounts/:id/unfreeze — UNFREEZE
  unfreeze: async (id: string, data?: { unfreezeReason?: string }) => {
    const res = await api.patch<ApiResponse<FreezeResult>>(`/accounts/${id}/unfreeze`, data ?? {});
    return res.data;
  },

  // POST /accounts/:id/withdraw — WITHDRAW
  withdraw: async (
    id: string,
    data: { amountInPaise: number; note?: string },
    idempotencyKey: string
  ) => {
    const res = await api.post<ApiResponse<DepositResult>>(`/accounts/${id}/withdraw`, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return res.data;
  },

  // POST /accounts/:id/repay-loan — REPAY LOAN
  repayLoan: async (
    id: string,
    data: { amountInPaise: number; note?: string },
    idempotencyKey: string
  ) => {
    const res = await api.post<ApiResponse<DepositResult>>(`/accounts/${id}/repay-loan`, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return res.data;
  },

  // POST /accounts/:id/transfer-to-pigmy — TRANSFER
  transferToPigmy: async (
    id: string,
    data: { pigmyAccountId: string; amountInPaise: number; note?: string }
  ) => {
    const res = await api.post<ApiResponse<DepositResult>>(`/accounts/${id}/transfer-to-pigmy`, data);
    return res.data;
  },
};
