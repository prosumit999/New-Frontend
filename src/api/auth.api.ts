import { api } from './client';
import { LoginResponse, AuthUser } from '../types';

export const authApi = {
  login: async (phone: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', { phone, password });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  checkSession: async (): Promise<AuthUser> => {
    const response = await api.get('/user/me');
    return response.data.data.user;
  },
};
