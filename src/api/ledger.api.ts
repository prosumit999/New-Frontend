// src/api/ledger.api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typed API client for the Ledger module.
// All calls go through the shared axios instance (with auth header + interceptors).
// ─────────────────────────────────────────────────────────────────────────────
import { api } from './client';

// ─── Request / Response Types ────────────────────────────────────────────────

export interface LedgerAccount {
  _id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'income' | 'expense';
  normalBalance: 'debit' | 'credit';
  runningBalanceInPaise: number;
  description?: string;
  isSystem: boolean;
  isAgentAccount: boolean;
  agentRef?: string;
}

export interface LedgerEntryRow {
  _id: string;
  ledgerAccount: { code: string; name: string; type: string; normalBalance: string } | string;
  debitInPaise: number;
  creditInPaise: number;
  description: string;
  narration?: string;
  transactionRef?: string;
  performedBy?: { name: string; role: string };
  transaction?: { transactionId: string; type: string };
  businessDate: string;
  createdAt: string;
  runningBalanceInPaise?: number; // only on statement entries
}

export interface StatementAccountInfo {
  _id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  currentRunningBalanceInPaise: number;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JVEntry {
  ledgerCode: string;
  type: 'debit' | 'credit';
  amountInPaise: number;
  description?: string;
}

// ─── General Ledger ──────────────────────────────────────────────────────────
const getGeneralLedger = async () => {
  const res = await api.get('/ledger/general');
  return res.data;
};

// ─── Account Statement ───────────────────────────────────────────────────────
const getAccountStatement = async (
  accountId: string,
  params: { fromDate: string; toDate: string; page?: number; limit?: number },
) => {
  const res = await api.get(`/ledger/accounts/${accountId}/statement`, { params });
  return res.data;
};

// ─── Ledger Journal ──────────────────────────────────────────────────────────
const getLedgerJournal = async (params: {
  fromDate: string;
  toDate: string;
  page?: number;
  limit?: number;
  entryType?: 'debit' | 'credit';
  ledgerCode?: string;
}) => {
  const res = await api.get('/ledger/journal', { params });
  return res.data;
};

// ─── Integrity Check ─────────────────────────────────────────────────────────
const checkLedgerIntegrity = async (asOfDate?: string) => {
  const res = await api.get('/ledger/integrity', { params: asOfDate ? { asOfDate } : {} });
  return res.data;
};

// ─── Post Journal Voucher ────────────────────────────────────────────────────
const postJournalVoucher = async (payload: { narration: string; entries: JVEntry[] }) => {
  const res = await api.post('/ledger/journal-voucher', payload);
  return res.data;
};

// ─── Get Account By Code ─────────────────────────────────────────────────────
const getAccountByCode = async (code: string) => {
  const res = await api.get<{ success: boolean; data: any }>(`/ledger/accounts/code/${code}`);
  return res.data;
};

// ─── Get Transaction Ledger Trail ────────────────────────────────────────────
const getTransactionTrail = async (transactionId: string) => {
  const res = await api.get<{ success: boolean; data: any }>(`/ledger/transaction/${transactionId}/trail`);
  return res.data;
};

export const ledgerApi = {
  getGeneralLedger,
  getAccountStatement,
  getLedgerJournal,
  checkLedgerIntegrity,
  postJournalVoucher,
  getAccountByCode,
  getTransactionTrail,
};
