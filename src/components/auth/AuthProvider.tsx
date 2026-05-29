// src/components/auth/AuthProvider.tsx
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../api/auth.api';

// ─────────────────────────────────────────────────────────────────────────────
// AuthProvider
//
// Runs ONCE on app startup to restore a user session from the backend
// (via the httpOnly refresh token cookie). It does NOT re-run on auth state
// changes — that would cause an infinite loop.
//
// Flow:
//  1. Show "Resuming session..." spinner while checking.
//  2a. If /user/me succeeds (cookie valid) → restore user in Zustand → render app.
//  2b. If /user/me fails 401 → interceptor tries /auth/refresh:
//      - Refresh succeeds → interceptor saves new token → /user/me is retried.
//      - Refresh fails (400/401, no cookie) → error caught here → just set
//        isInitializing=false → AppLayout's <Navigate to="/login"> fires.
//
// IMPORTANT: Never use window.location.href for redirect in auth flows — it
// causes a hard page reload which remounts this provider and creates a loop.
// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      // If we're already on /login, skip the session check entirely.
      // There's nothing to restore and it avoids a pointless API round-trip.
      if (window.location.pathname === '/login') {
        setIsInitializing(false);
        return;
      }

      try {
        // Call /user/me. If access token is missing, the axios interceptor
        // (client.ts) will automatically attempt a silent refresh first,
        // then retry /user/me with the new token. If that also fails (no
        // refresh cookie), the request rejects and we fall into catch.
        const user = await authApi.checkSession();
        if (mounted) {
          // The interceptor already put the new access token in the store.
          // We just need to link the user object to mark as authenticated.
          setAuth(user, useAuthStore.getState().accessToken ?? 'restored');
        }
      } catch {
        // No valid session (no cookies, or all tokens expired).
        if (mounted) {
          console.info('[AuthProvider] No valid session — showing login page.');
          if (window.location.pathname !== '/login') {
            window.location.assign('/login');
          }
        }
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array: run ONCE on mount only. Re-running on auth changes causes loops.

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="text-slate-500 font-medium animate-pulse">Resuming session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
