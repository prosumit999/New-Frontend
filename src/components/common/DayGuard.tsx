import React, { useEffect, useRef } from 'react';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { Lock, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

interface DayGuardProps {
  children: React.ReactNode;
  message?: string;
  showAsOverlay?: boolean;
}

/**
 * DayGuard — Production-grade Day Control gate.
 *
 * Uses `useBusinessDate()` as the SINGLE SOURCE OF TRUTH for day status.
 *
 * Behavior:
 *  - LOADING  → Render children (hook returns isOpen:true while loading, backend is gatekeeper)
 *  - ERROR    → Render children (transient network issues shouldn't lock users out)
 *  - OPEN     → Render children normally
 *  - CLOSED   → Show lock screen; auto-polls every 30s so agents get unblocked
 *               automatically when admin opens the day — no manual page reload needed.
 *
 * The backend is the final security layer. The DayGuard is a UX optimization
 * to prevent users from filling forms they cannot submit.
 */
export function DayGuard({ 
  children, 
  message = 'Transactions are currently disabled. The admin must open the business day first.',
  showAsOverlay = false,
}: DayGuardProps) {
  const { isOpen, isLoading, isFetching, isError, refetch, displayDate } = useBusinessDate();
  const user = useAuthStore(state => state.user);

  // Auto-poll every 30s when day is CLOSED so the guard lifts automatically
  // as soon as admin opens the day — no manual refresh needed by the agent.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isOpen && !isLoading && !isError) {
      intervalRef.current = setInterval(() => refetch(), 30_000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, isLoading, isError, refetch]);

  // While loading or errored, render children optimistically.
  // The backend will reject any rogue transactions if the day is truly closed.
  if (isLoading || isError) {
    return (
      <>
        {isFetching && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Checking business day status...
          </div>
        )}
        {children}
      </>
    );
  }

  // Day confirmed OPEN by backend — render normally
  if (isOpen) {
    return <>{children}</>;
  }

  // Day confirmed CLOSED — show the lock warning
  const lockScreen = (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 flex flex-col items-center justify-center text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center">
        <Lock className="h-6 w-6 text-rose-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-rose-900 mb-1">Business Day is Closed</h3>
        <p className="text-rose-700 max-w-md text-sm">{message}</p>
        {displayDate && (
          <p className="text-xs text-rose-500 mt-2 font-medium">
            Last business date: {displayDate}
          </p>
        )}
        <p className="text-xs text-rose-400 mt-1">
          Auto-checks every 30s. You'll be unblocked automatically when the admin opens today's day.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Checking...' : 'Refresh Now'}
        </button>
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <Link
            to="/day-control"
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            Open Business Day →
          </Link>
        )}
      </div>
    </div>
  );

  if (showAsOverlay) {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-white/30 p-4 rounded-xl">
          {lockScreen}
        </div>
      </div>
    );
  }

  return lockScreen;
}
