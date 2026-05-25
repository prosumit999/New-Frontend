// src/api/loan.api.ts
import { api } from './client';

export const loanApi = {
  // GET /loans/preview — preview loan terms before creating
  preview: async (params: { principalAmountInPaise: number; loanPlanId: string }) => {
    const res = await api.get('/loans/preview', { params });
    return res.data;
  },

  // POST /loans — create/disburse loan
  create: async (data: {
    customerId: string;
    loanPlanId: string;
    principalAmountInPaise: number;
    requestId?: string;
  }) => {
    const res = await api.post('/loans', data);
    return res.data;
  },

  // GET /loans — list loans
  list: async (params?: { page?: number; limit?: number; status?: string; customerId?: string; search?: string }) => {
    const res = await api.get('/loans', { params });
    return res.data;
  },

  // GET /loans/:id — single loan detail
  getById: async (id: string) => {
    const res = await api.get(`/loans/${id}`);
    return res.data;
  },

  // GET /loans/customer/:customerId — customer's loans
  getByCustomer: async (customerId: string) => {
    const res = await api.get(`/loans/customer/${customerId}`);
    return res.data;
  },

  // PATCH /loans/:id/close — close loan
  close: async (id: string, data: { closureReason: string; writeOff?: boolean }) => {
    const res = await api.patch(`/loans/${id}/close`, data);
    return res.data;
  },

  // POST /loans/:id/apply-penalty — apply penalty
  applyPenalty: async (id: string, data: { penaltyAmountInPaise: number; reason: string }) => {
    const res = await api.post(`/loans/${id}/apply-penalty`, data);
    return res.data;
  },

  // POST /loans/:id/send-reminder — send SMS reminder
  sendReminder: async (id: string) => {
    const res = await api.post(`/loans/${id}/send-reminder`, {});
    return res.data;
  },

  // POST /loans/:id/reopen — reactivate a closed or written-off loan
  reopen: async (id: string, data: { reactivationReason: string }) => {
    const res = await api.post(`/loans/${id}/reopen`, data);
    return res.data;
  },

  // POST /loans/:id/apply-pigmy — apply pigmy balance to loan
  applyPigmy: async (id: string, data: { amountInPaise: number; note?: string; requestId?: string }) => {
    const res = await api.post(`/loans/${id}/apply-pigmy`, data);
    return res.data;
  },

  // GET /loans/:id/statement — repayment history (paginated)
  // NOTE: If backend route not available yet, returns empty transactions gracefully.
  getStatement: async (
    id: string,
    params?: { page?: number; limit?: number; fromDate?: string; toDate?: string }
  ) => {
    try {
      const res = await api.get(`/loans/${id}/statement`, { params });
      return res.data;
    } catch {
      // Return empty statement if endpoint not yet implemented on backend
      return { success: true, data: { transactions: [], pagination: null } };
    }
  },


  // GET /loans/repayment-dashboard — repayment overview
  getRepaymentDashboard: async (params?: { daysThreshold?: number }) => {
    const res = await api.get('/loans/repayment-dashboard', { params });
    return res.data;
  },

  // GET /loans/deficit-dashboard — pigmy deficit overview
  // filter: 'all' | 'penalty_eligible' | 'warning_1' | 'warning_2'
  getDeficitDashboard: async (params?: { filter?: string }) => {
    const res = await api.get('/loans/deficit-dashboard', { params });
    return res.data;
  },

  // PATCH /loans/:id/lifelines — admin resets lifeline count
  // resetType: 'full' | 'increment' | 'decrement' | 'set'
  // value: required only when resetType = 'set'
  resetLifelines: async (
    id: string,
    data: { resetType: string; value?: number; reason?: string },
  ) => {
    const res = await api.patch(`/loans/${id}/lifelines`, data);
    return res.data;
  },
};

// Superadmin loan plan API (separate since it's under /superadmin)
export const loanPlanApi = {
  list: async () => {
    const res = await api.get('/superadmin/loan-plans');
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get(`/superadmin/loan-plans/${id}`);
    return res.data;
  },
};
