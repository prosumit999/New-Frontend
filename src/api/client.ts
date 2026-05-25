// src/api/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore, broadcastLogout } from '../store/auth.store';
import { RefreshResponse } from '../types';

// Create the axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true, // IMPORTANT: Allows sending/receiving httpOnly cookies (refresh token)
  headers: {
    // NOTE: Do NOT set Content-Type here globally.
    // Axios automatically sets:
    //   - 'application/json' for plain object bodies
    //   - 'multipart/form-data; boundary=...' for FormData bodies
    // A hardcoded 'application/json' would override FormData uploads and break multer.
    'X-Client-Type': 'web', // Anti-CSRF marker expected by backend
  },
});

// Flag to prevent multiple concurrent refresh attempts
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST INTERCEPTOR
// Attaches the access token from Zustand memory to every request.
// ─────────────────────────────────────────────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Generate a unique idempotency key for mutations (POST/PATCH/PUT/DELETE)
    if (config.method && ['post', 'patch', 'put', 'delete'].includes(config.method.toLowerCase())) {
       // Only add if not already explicitly provided by the caller
       if (!config.headers['Idempotency-Key'] && !config.headers['idempotency-key']) {
          config.headers['Idempotency-Key'] = crypto.randomUUID();
       }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE INTERCEPTOR
// Handles 401 Unauthorized globally by attempting a silent token refresh.
// ─────────────────────────────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't already retried this request
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Check if it's the refresh route itself to prevent infinite loops
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // Handle concurrent 401s (queue them up while refreshing)
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        // Attempt to refresh. This hits the backend which reads the httpOnly cookie
        const response = await axios.post<RefreshResponse>(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: { 'X-Client-Type': 'web' },
          }
        );

        const newAccessToken = response.data.data.accessToken;
        
        // Update the Zustand store silently
        useAuthStore.setState((state) => ({
          ...state,
          accessToken: newAccessToken,
        }));

        isRefreshing = false;
        onRefreshed(newAccessToken);

        // Retry the original request
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        // Refresh failed (e.g., refresh token expired or never existed)
        isRefreshing = false;
        refreshSubscribers = [];
        
        useAuthStore.getState().clearAuth();
        
        // Since AuthProvider accurately skips initialization on '/login' now,
        // a hard redirect is perfectly safe and guarantees the user's broken 
        // session/state is purged from the DOM seamlessly without looping.
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
        
        return Promise.reject(refreshError);
      }
    }

    // Standard error rejection for all other errors
    return Promise.reject(error);
  }
);
