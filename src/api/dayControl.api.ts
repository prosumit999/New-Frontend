// src/api/dayControl.api.ts
import { api } from './client';

export interface OpenDayPayload {
  /** ISO date YYYY-MM-DD — only for superadmin backdated opens */
  backdate?: string;
  /** Superadmin's own password — required when backdate is present */
  backdatePassword?: string;
  /** True to run EOD jobs on close (for missed days). False to skip EOD (for ledger correction). */
  catchupMode?: boolean;
}

export const dayControlApi = {
  // GET /day-control/status
  getStatus: () => api.get('/day-control/status'),

  // POST /day-control/open
  openDay: (payload?: OpenDayPayload) => api.post('/day-control/open', payload || {}),

  // POST /day-control/close
  closeDay: (data?: { forceClose?: boolean }) =>
    api.post('/day-control/close', data || {}),

  // GET /day-control/history
  getHistory: (limit = 30) => api.get(`/day-control/history?limit=${limit}`),
};
