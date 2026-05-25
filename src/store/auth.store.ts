// src/store/auth.store.ts
import { create } from 'zustand';
import { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH STORE
// Access token and user data are kept strictly in memory.
// They are NEVER passed to localStorage or sessionStorage.
// The refresh token is managed entirely by the backend via httpOnly cookies.
// ─────────────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, token) => {
    set({ user, accessToken: token, isAuthenticated: true });
  },

  clearAuth: () => {
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-TAB LOGOUT SYNC
// If the user logs out in one tab, we broadcast a message to clear auth in all
// other open tabs.
// ─────────────────────────────────────────────────────────────────────────────
const authChannel = new BroadcastChannel('auth_channel');

authChannel.onmessage = (event) => {
  if (event.data === 'LOGOUT') {
    useAuthStore.getState().clearAuth();
    // In a real app, you might also want to redirect to login here
    window.location.href = '/login';
  }
};

export const broadcastLogout = () => {
  authChannel.postMessage('LOGOUT');
};
