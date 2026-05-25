// src/api/collection.api.ts
import { api } from './client';

export const collectionApi = {
  // POST /collections — record daily pigmy collection
  record: async (data: {
    accountId: string;
    amountInPaise: number;
    collectionDate?: string;
    collectionType?: 'daily' | 'weekly' | 'manual';
    note?: string;
    agentId?: string;
  }) => {
    const res = await api.post('/collections', data);
    return res.data;
  },

  // GET /collections — list all collections
  list: async (params?: {
    page?: number;
    limit?: number;
    fromDate?: string;
    toDate?: string;
    agentId?: string;
    customerId?: string;
    accountId?: string;
    status?: string;
  }) => {
    const res = await api.get('/collections', { params });
    return res.data;
  },

  // GET /collections/:id — single collection (by _id or receipt number)
  getById: async (id: string) => {
    const res = await api.get(`/collections/${id}`);
    return res.data;
  },

  // POST /collections/:id/reverse — reverse a collection
  // POST is semantically correct: reversal creates NEW ledger records, not a partial update.
  reverse: async (id: string, data: { reversalReason: string }) => {
    const res = await api.post(`/collections/${id}/reverse`, data);
    return res.data;
  },

  // GET /collections/summary/daily — daily totals
  getDailySummary: async (params?: { date?: string; agentId?: string }) => {
    const res = await api.get('/collections/summary/daily', { params });
    return res.data;
  },

  // GET /collections/summary/missed — missed accounts
  getMissedCollections: async (params?: { date?: string; agentId?: string }) => {
    const res = await api.get('/collections/summary/missed', { params });
    return res.data;
  },

  // GET /collections/sheet — agent's own daily sheet
  getAgentSheet: async (params?: { date?: string }) => {
    const res = await api.get('/collections/sheet', { params });
    return res.data;
  },

  // GET /collections/sheet/:agentId — admin views any agent's sheet
  getAgentSheetByAdmin: async (agentId: string, params?: { date?: string }) => {
    const res = await api.get(`/collections/sheet/${agentId}`, { params });
    return res.data;
  },

  // GET /collections/report/agent-wise — admin date-range grouped report
  getAgentWiseReport: async (params: { fromDate: string; toDate: string; agentId?: string }) => {
    const res = await api.get('/collections/report/agent-wise', { params });
    return res.data;
  },
};
