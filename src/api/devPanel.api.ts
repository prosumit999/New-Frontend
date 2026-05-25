// src/api/devPanel.api.ts
import { api } from './client';

export interface InstitutionAddress {
  line1: string;
  line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface InstitutionLogo {
  url: string | null;
  publicId: string | null;
}

export interface Institution {
  _id: string;
  singleton: string;
  name: string;
  shortName: string;
  registrationNumber: string;
  gstNumber: string;
  logo: InstitutionLogo;
  logoUrl: string | null;        // virtual — logo.url
  primaryColor: string;
  tagline: string;
  receiptTagline: string;
  smsFooter: string;
  address: InstitutionAddress;
  phone: string;
  email: string;
  website: string;
  systemGenesisDate: string | null;
  genesisUpdatedAt: string | null;
  privacyPolicy: string;
  microfinanceRules: string;
  termsAndConditions: string;
  privacyUpdatedAt: string | null;
  rulesUpdatedAt: string | null;
  termsUpdatedAt: string | null;
  isConfigured: boolean;
  configuredBy: string | null;
  lastUpdatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigAuditGroup {
  [category: string]: Array<{
    key: string;
    value: unknown;
    description: string;
    isUpdatable: boolean;
    isSystemInternal: boolean;
    isDeprecated: boolean;
    category: string;
    updatedAt?: string;
  }>;
}

export interface ConfigAuditResult {
  totalKeys: number;
  updatableKeys: number;
  deprecatedKeys: number;
  groups: ConfigAuditGroup;
}

export const devPanelApi = {
  // ── Institution ────────────────────────────────────────────────────────────
  getInstitution: () =>
    api.get<{ institution: Institution }>('/dev-panel/institution'),

  updateInstitution: (data: Partial<Institution>) =>
    api.patch<{ institution: Institution }>('/dev-panel/institution', data),

  // ── Config Audit ──────────────────────────────────────────────────────────
  getConfigAudit: () =>
    api.get<ConfigAuditResult>('/dev-panel/config-audit'),

  // ── Dev Password ──────────────────────────────────────────────────────────
  // ── Dev Password ──────────────────────────────────────────────────────────
  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => api.patch<{ message: string }>('/dev-panel/password', data),

  // ── Logo Upload ────────────────────────────────────────────────────────────
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ logoUrl: string; publicId: string }>(
      '/dev-panel/upload-logo',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  // ── Superadmin Password Reset ──────────────────────────────────────────────
  resetSuperadminPassword: (data: {
    newPassword: string;
    confirmPassword: string;
  }) => api.patch<{ message: string }>('/dev-panel/superadmin-password', data),
};
