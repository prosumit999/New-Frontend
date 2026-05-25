// src/api/agentDeposit.api.ts
import { api } from './client';

export const agentDepositApi = {
  // POST /agent-deposits — Admin records cash handover from agent
  // Requires Idempotency-Key header (enforced by backend middleware)
  record: (data: { agentId: string; amountInPaise: number; note?: string }) =>
    api.post('/agent-deposits', data, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),

  // GET /agent-deposits — List deposits (agent auto-scoped, admin can filter by agentId)
  list: (params?: {
    page?: number;
    limit?: number;
    agentId?: string;
    fromDate?: string;
    toDate?: string;
    status?: 'completed' | 'reversed';
    isReversed?: boolean;
  }) => api.get('/agent-deposits', { params }),

  // GET /agent-deposits/:identifier — Single deposit by ObjectId | DEP-* | DRCP-*
  getById: (identifier: string) =>
    api.get(`/agent-deposits/${identifier}`),

  // POST /agent-deposits/:depositId/reverse — Reverse a deposit (Admin + Superadmin)
  reverse: (depositId: string, data: { reversalReason: string }) =>
    api.post(`/agent-deposits/${depositId}/reverse`, data),

  // GET /agent-deposits/cash-balance/:agentId — Agent's outstanding cash balance
  getCashBalance: (agentId: string) =>
    api.get(`/agent-deposits/cash-balance/${agentId}`),
};
