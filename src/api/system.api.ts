// src/api/system.api.ts
import { api } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrandingResponse {
  institution: {
    name: string;
    logoUrl?: string | null;
    registrationNumber?: string;
    contactPhone?: string;
    contactEmail?: string;
    receiptTagline?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
  };
}

export interface InstitutionConfig {
  _id?: string;
  name?: string;
  registrationNumber?: string;
  /** Cloudinary-backed logo sub-document */
  logo?: { url: string | null; publicId: string | null };
  logoUrl?: string | null; // virtual from backend
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  contactPhone?: string;
  contactEmail?: string;
  receiptTagline?: string;
  smsFooter?: string;
}

export const systemApi = {
  // ── Public branding (login page) ─────────────────────────────────────────
  getPublicBranding: async (): Promise<BrandingResponse> => {
    const res = await api.get<{ data: BrandingResponse }>('/system/branding');
    return res.data.data;
  },

  // ── Institution config ────────────────────────────────────────────────────
  getInstitutionConfig: async (): Promise<InstitutionConfig> => {
    const res = await api.get<{ data: { institution: InstitutionConfig } }>('/system/config/institution');
    return res.data.data.institution;
  },

  updateInstitutionConfig: async (data: Partial<InstitutionConfig>): Promise<InstitutionConfig> => {
    const res = await api.put<{ data: { institution: InstitutionConfig } }>('/system/config/institution', data);
    return res.data.data.institution;
  },

  // ── Logo upload ───────────────────────────────────────────────────────────
  // Step 1: Upload file → get { logoUrl, publicId }
  // Step 2: Call updateInstitutionConfig({ logo: { url: logoUrl, publicId } })
  // This two-step pattern mirrors the KYC doc upload flow in CustomerDetailPage.
  uploadLogo: async (file: File): Promise<{ logoUrl: string; publicId: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ data: { logoUrl: string; publicId: string } }>(
      '/system/config/upload-logo',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data;
  },
};
