// src/api/superadmin.api.ts
import { api } from './client';

export const superadminApi = {
  // ── Dashboard ──────────────────────────────────────────────
  getDashboard: () => api.get('/superadmin/dashboard'),

  // ── Admin Management ───────────────────────────────────────
  createAdmin: (data: { name: string; phone: string; email?: string; password: string }) =>
    api.post('/superadmin/admins', data),
  listAdmins: (params?: { page?: number; limit?: number; search?: string; isActive?: boolean }) =>
    api.get('/superadmin/admins', { params }),
  getAdmin: (id: string) => api.get(`/superadmin/admins/${id}`),
  resetAdminPassword: (id: string, data: { newPassword: string }) =>
    api.patch(`/superadmin/admins/${id}/password`, data),
  toggleAdminStatus: (id: string, data: { isActive: boolean; reason?: string }) =>
    api.patch(`/superadmin/admins/${id}/status`, data),

  // ── System Control ─────────────────────────────────────────
  lockSystem: () => api.patch('/superadmin/system/lock', {}),
  unlockSystem: () => api.patch('/superadmin/system/unlock', {}),
  toggleSms: (data: { enabled: boolean }) =>
    api.patch('/superadmin/system/sms', data),

  // ── Config ─────────────────────────────────────────────────
  getConfig: () => api.get('/superadmin/config'),
  updateConfig: (data: { key: string; value: string | number | boolean }) =>
    api.patch('/superadmin/config', data),

  // ── Loan Plans ─────────────────────────────────────────────
  createLoanPlan: (data: {
    planName: string;
    description?: string;
    durationMonths: number;
    baseInterestRateBps: number;
    processingFeeBps?: number;
    minLoanAmountInPaise?: number;
    maxLoanAmountInPaise: number;
  }) => api.post('/superadmin/loan-plans', data),
  listLoanPlans: (params?: { page?: number; limit?: number; isActive?: boolean }) =>
    api.get('/superadmin/loan-plans', { params }),
  getLoanPlan: (id: string) => api.get(`/superadmin/loan-plans/${id}`),
  updateLoanPlan: (id: string, data: {
    planName?: string;
    description?: string;
    baseInterestRateBps?: number;
    processingFeeBps?: number;
    minLoanAmountInPaise?: number;
    maxLoanAmountInPaise?: number;
    isActive?: boolean;
  }) => api.patch(`/superadmin/loan-plans/${id}`, data),

  // ── Ledger Accounts ────────────────────────────────────────
  createLedgerAccount: (data: {
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
    description?: string;
  }) => api.post('/superadmin/ledger-accounts', data),
  listLedgerAccounts: (params?: { page?: number; limit?: number; type?: string; isActive?: boolean }) =>
    api.get('/superadmin/ledger-accounts', { params }),
  getLedgerAccount: (id: string) => api.get(`/superadmin/ledger-accounts/${id}`),
  updateLedgerAccount: (id: string, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }) => api.patch(`/superadmin/ledger-accounts/${id}`, data),

  // ── Audit Logs ─────────────────────────────────────────────
  getAuditLogs: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
    entityId?: string;
    performedBy?: string;
    status?: string;
    from?: string;
    to?: string;
  }) => api.get('/superadmin/audit-logs', { params }),
};
