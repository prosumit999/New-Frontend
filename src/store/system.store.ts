import { create } from 'zustand';
import { systemApi, BrandingResponse } from '../api/system.api';

interface SystemState {
  branding: BrandingResponse | null;
  isLoading: boolean;
  error: string | null;
  fetchBranding: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set) => ({
  branding: null,
  isLoading: false,
  error: null,
  fetchBranding: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await systemApi.getPublicBranding();
      // systemApi.getPublicBranding() already extracts res.data.data,
      // so `data` is BrandingResponse directly.
      set({ branding: data as BrandingResponse, isLoading: false });
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || 'Failed to load branding', 
        isLoading: false 
      });
    }
  },
}));
