// src/api/customer.api.ts
import { api } from './client';
import { Customer, PaginatedResponse } from '../types';

export const customerApi = {
  // GET lists
  list: async (params?: Record<string, any>) => {
    const res = await api.get<PaginatedResponse<Customer>>('/customers', { params });
    return res.data;
  },

  getKycPending: async (params?: Record<string, any>) => {
    const res = await api.get<PaginatedResponse<Customer>>('/customers/kyc/pending', { params });
    return res.data;
  },

  // GET single
  getCustomer: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { customer: Customer } }>(`/customers/${id}`);
    return res.data;
  },

  // Lookup (single exact - account number, phone, customer code)
  lookup: async (search: string) => {
    const res = await api.get<{ success: boolean; data: any }>(`/customers/lookup`, { params: { search } });
    return res.data;
  },

  // Search (multi-result - returns list of matching customers by name/phone/code)
  search: async (search: string) => {
    const res = await api.get('/customers', { params: { search, limit: 20 } });
    return res.data;
  },

  // POST create
  create: async (data: Record<string, any>) => {
    const res = await api.post<{ success: boolean; data: { customer: Customer }; message: string }>('/customers', data);
    return res.data;
  },

  // PATCH update
  update: async (id: string, data: Record<string, any>) => {
    const res = await api.patch<{ success: boolean; data: { customer: Customer } }>(`/customers/${id}`, data);
    return res.data;
  },

  // DELETE (password-protected)
  deleteCustomer: async (id: string, adminPassword: string, reason: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/customers/${id}`, {
      data: { adminPassword, reason },
    });
    return res.data;
  },

  // RESTORE soft-deleted customer (password-protected, admin only)
  restoreCustomer: async (id: string, adminPassword: string) => {
    const res = await api.patch<{ success: boolean; data: { customer: any }; message: string }>(
      `/customers/${id}/restore`,
      { adminPassword },
    );
    return res.data;
  },

  // ── OTP Flow ────────────────────────────────────────────────────────────────
  resendOtp: async (id: string) => {
    const res = await api.post<{ success: boolean; data: any; message: string }>(`/customers/${id}/resend-otp`);
    return res.data;
  },

  verifyOtp: async (id: string, otp: string) => {
    const res = await api.post<{ success: boolean; data: any; message: string }>(`/customers/${id}/verify-otp`, { otp });
    return res.data;
  },

  // ── KYC Flow ────────────────────────────────────────────────────────────────
  submitKyc: async (id: string, formData: FormData) => {
    const res = await api.post<{ success: boolean; data: any; message: string }>(
      `/customers/${id}/kyc/submit`,
      formData,
      // NOTE: No Content-Type header — Axios auto-sets multipart/form-data with boundary
    );
    return res.data;
  },

  verifyKyc: async (id: string) => {
    const res = await api.patch<{ success: boolean; data: any; message: string }>(`/customers/${id}/kyc/verify`);
    return res.data;
  },

  rejectKyc: async (id: string, reason: string) => {
    const res = await api.patch<{ success: boolean; data: any; message: string }>(`/customers/${id}/kyc/reject`, { reason });
    return res.data;
  },

  getDecryptedAadhar: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { aadhaar: string; masked: string } }>(`/customers/${id}/aadhaar`);
    return res.data;
  },

  getDecryptedPan: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { pan: string; masked: string } }>(`/customers/${id}/pan-card`);
    return res.data;
  },

  // ── Agent Assignment ────────────────────────────────────────────────────────
  assignAgent: async (id: string, agentId: string) => {
    const res = await api.patch<{ success: boolean; data: { customer: Customer } }>(`/customers/${id}/assign-agent`, { agentId });
    return res.data;
  },

  // ── Phone Change (2-step OTP) ───────────────────────────────────────────────
  // Step 1: Admin sends new phone → OTP is sent to new number (pending, not committed)
  requestPhoneChange: async (id: string, newPhone: string) => {
    const res = await api.post<{ success: boolean; data: any; message: string }>(
      `/customers/${id}/phone/request-otp`,
      { newPhone },
    );
    return res.data;
  },
  // Step 2: Admin enters OTP received on new number → phone is atomically committed
  verifyPhoneChange: async (id: string, otp: string) => {
    const res = await api.post<{ success: boolean; data: any; message: string }>(
      `/customers/${id}/phone/verify-otp`,
      { otp },
    );
    return res.data;
  },
};

