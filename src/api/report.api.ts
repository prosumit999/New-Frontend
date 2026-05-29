// src/api/report.api.ts
// ─────────────────────────────────────────────────────────────────────────────
import { api } from './client';

export const reportApi = {
    // ── DASHBOARD ─────────────────────────────────────────────
    getDashboard: () =>
        api.get('/reports/dashboard'),

    // ── COLLECTION REPORTS ────────────────────────────────────
    getCollectionReport: (params?: { fromDate?: string; toDate?: string; agentId?: string }) =>
        api.get('/reports/collections', { params }),

    // ── AGENT PERFORMANCE ─────────────────────────────────────
    getAgentPerformance: (params?: { fromDate?: string; toDate?: string }) =>
        api.get('/reports/agents/performance', { params }),

    // ── CUSTOMER REPORT ───────────────────────────────────────
    getCustomerReport: (params?: {
        fromDate?: string; toDate?: string;
        kycStatus?: string; assignedAgent?: string;
        page?: number; limit?: number;
    }) => api.get('/reports/customers', { params }),

    // ── LOAN REPORTS ──────────────────────────────────────────
    getLoanPortfolio: () =>
        api.get('/reports/loans/portfolio'),

    getOverdueReport: (params?: { agentId?: string }) =>
        api.get('/reports/loans/overdue', { params }),

    // ── FINANCIAL ─────────────────────────────────────────────
    getTrialBalance: (params?: { asOfDate?: string }) =>
        api.get('/reports/financial/trial-balance', { params }),

    getPnlReport: (params?: { fromDate?: string; toDate?: string }) =>
        api.get('/reports/financial/pnl', { params }),

    getCashPosition: () =>
        api.get('/reports/financial/cash'),

    // ── DAILY TRANSACTION REPORT ──────────────────────────────
    getDailyTransactionReport: (params?: {
        date?: string; type?: string; page?: number; limit?: number;
    }) => api.get('/reports/transactions/daily', { params }),

    // ── LEDGER HISTORY ────────────────────────────────────────
    getLedgerHistory: (params?: {
        ledgerCode?: string; fromDate?: string; toDate?: string;
        page?: number; limit?: number;
    }) => api.get('/reports/financial/ledger-history', { params }),

    // ── CONSOLIDATED REPORTS ──────────────────────────────────
    getConsolidatedPigmy:   () => api.get('/reports/consolidated/pigmy'),
    getConsolidatedSavings: () => api.get('/reports/consolidated/savings'),
    getConsolidatedLoans:   () => api.get('/reports/consolidated/loans'),
    getConsolidatedAgents:  () => api.get('/reports/consolidated/agents'),

    // ── CUSTOMER ACCOUNT STATEMENTS  // ────────────────────────────────────────────────────────
    // The customer overview and statement endpoints were removed
    // as the feature now correctly uses the saving/pigmy/loan
    // APIs for unique source of truth
    // ────────────────────────────────────────────────────────
};
