// src/api/agentReport.api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Agent-specific report API endpoints.
// All endpoints are scoped to the authenticated agent's data.
// ─────────────────────────────────────────────────────────────────────────────
import { api } from './client';

interface DateRangeParams {
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export const agentReportApi = {
  // Customer-wise pigmy collection summary
  getPigmyReport: (params?: DateRangeParams) =>
    api.get('/agent/reports/pigmy', { params }),

  // Loan status for assigned customers
  getLoanReport: (params?: DateRangeParams) =>
    api.get('/agent/reports/loans', { params }),

  // Date-wise collection history
  getCollectionReport: (params?: DateRangeParams) =>
    api.get('/agent/reports/collections', { params }),

  // Agent's own cash deposit history
  getDepositReport: (params?: DateRangeParams) =>
    api.get('/agent/reports/deposits', { params }),
};
