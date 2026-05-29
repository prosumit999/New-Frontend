// src/api/agent.api.ts
import { api } from './client';

export const agentApi = {
  // ── LIST ───────────────────────────────────────────────────
  list: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean | string;
    kycStatus?: string;
    area?: string;
  }) => {
    const res = await api.get('/agents', { params });
    return res.data;
  },

  // ── KYC PENDING ────────────────────────────────────────────
  getKycPending: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get('/agents/kyc/pending', { params });
    return res.data;
  },

  // ── REASSIGNMENT ───────────────────────────────────────────
  getReassignmentStats: async () => {
    const res = await api.get('/agents/reassignment/stats');
    return res.data;
  },
  getReassignmentQueue: async (params?: { type?: 'pigmy' | 'customers' | 'all'; page?: number; limit?: number }) => {
    const res = await api.get('/agents/reassignment/queue', { params });
    return res.data;
  },
  reassign: async (data: { entityType: 'pigmy' | 'customers'; entityIds: string[]; newAgentId: string }) => {
    const res = await api.post('/agents/reassignment/assign', data);
    return res.data;
  },

  // ── PORTFOLIO HANDOVER ─────────────────────────────────────
  getPortfolio: async (id: string, params?: { cPage: number; pPage: number; limit?: number }) => {
    const res = await api.get(`/agents/${id}/portfolio`, { params });
    return res.data;
  },
  handoverPortfolio: async (id: string, data: { targetAgentId: string; transferAll: boolean; customerIds?: string[]; pigmyIds?: string[] }) => {
    const res = await api.post(`/agents/${id}/portfolio/handover`, data);
    return res.data;
  },

  // ── SINGLE AGENT ───────────────────────────────────────────
  getAgent: async (id: string) => {
    const res = await api.get(`/agents/${id}`);
    return res.data;
  },

  // ── CREATE ─────────────────────────────────────────────────
  create: async (data: {
    name: string;
    phone: string;
    password: string;
    email?: string;
    fullName?: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other';
    area?: string;
    assignedPincodes?: string[];
    commissionType?: 'percentage' | 'fixed' | 'none';
    commissionRateBps?: number;
    joiningDate?: string;
  }) => {
    const res = await api.post('/agents', data);
    return res.data;
  },

  // ── UPDATE AUTH FIELDS (name, email, smsEnabled) ──────────
  update: async (id: string, data: { name?: string; email?: string; smsEnabled?: boolean }) => {
    const res = await api.patch(`/agents/${id}`, data);
    return res.data;
  },

  // ── UPDATE PROFILE (compliance fields) ────────────────────
  updateProfile: async (id: string, data: Record<string, any>) => {
    const res = await api.patch(`/agents/${id}/profile`, data);
    return res.data;
  },

  // ── TOGGLE ACTIVE / INACTIVE ───────────────────────────────
  toggleStatus: async (id: string, data: { isActive: boolean; reason?: string }) => {
    const res = await api.patch(`/agents/${id}/status`, data);
    return res.data;
  },

  // ── SUSPEND / UNSUSPEND / TERMINATE ───────────────────────
  changeStatus: async (id: string, data: { action: 'suspend' | 'unsuspend' | 'terminate'; reason: string }) => {
    const res = await api.patch(`/agents/${id}/action`, data);
    return res.data;
  },

  // ── UPLOAD KYC DOCUMENTS (multipart) ─────────────────────
  uploadKycDocs: async (id: string, formData: FormData) => {
    const res = await api.post(`/agents/${id}/kyc/documents`, formData);
    return res.data;
  },

  // ── VERIFY / REJECT / RESET KYC ──────────────────────────
  verifyKyc: async (id: string, data: { action: 'approve' | 'reject' | 'reset'; note?: string }) => {
    const res = await api.patch(`/agents/${id}/kyc/verify`, data);
    return res.data;
  },

  // ── ADMIN: RESET AGENT PASSWORD ───────────────────────────
  resetPassword: async (id: string, data: { newPassword: string }) => {
    const res = await api.patch(`/agents/${id}/password`, data);
    return res.data;
  },

  // ── ADMIN: PHONE CHANGE — STEP 1: REQUEST OTP ─────────────
  requestPhoneChange: async (id: string, data: { newPhone: string }) => {
    const res = await api.post(`/agents/${id}/phone/request-otp`, data);
    return res.data;
  },

  // ── ADMIN: PHONE CHANGE — STEP 2: VERIFY OTP ──────────────
  verifyPhoneChange: async (id: string, data: { otp: string }) => {
    const res = await api.post(`/agents/${id}/phone/verify-otp`, data);
    return res.data;
  },

  // ── CREATION PHONE OTP: RESEND ────────────────────────────
  resendCreationOtp: async (id: string) => {
    const res = await api.post(`/agents/${id}/resend-otp`);
    return res.data;
  },

  // ── CREATION PHONE OTP: VERIFY ────────────────────────────
  verifyCreationOtp: async (id: string, data: { otp: string }) => {
    const res = await api.post(`/agents/${id}/verify-otp`, data);
    return res.data;
  },

  // ── DECRYPTED PII (admin/superadmin only — every access is audit-logged) ──
  getDecryptedAadhar: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { aadhaar: string; masked: string } }>(
      `/agents/${id}/aadhaar`,
    );
    return res.data;
  },

  getDecryptedPan: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { pan: string; masked: string } }>(
      `/agents/${id}/pan-card`,
    );
    return res.data;
  },
};
