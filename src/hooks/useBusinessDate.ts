import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dayControlApi } from '../api/dayControl.api';

/**
 * A global hook to fetch the current active business date from the backend.
 * This ensures all frontend calendars and date pickers align with the true
 * financial business day, rather than the user's local browser clock.
 * 
 * UNIQUE SOURCE OF TRUTH: All components checking "isOpen" should use this hook.
 */
export function useBusinessDate() {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch, error, isError } = useQuery({
    queryKey: ['day-status'],
    queryFn: () => dayControlApi.getStatus(),
    // 30s staleTime — agents see day open/close within 30s without manual refresh.
    // 2 minutes was too long: admin opens day but agent sees "Day is closed" for up to 2 min.
    staleTime: 30 * 1000,
    // Keep cache for 2 min on errors so we don't hammer the server on transient failures
    gcTime: 2 * 60 * 1000,
    // Always refetch on mount/reconnect to avoid stale data after tab switch
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Do not retry indefinitely on permission errors (handled in UI)
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 403) return false;
      return failureCount < 2;
    }
  });

  // Payload extraction: Axios (.data) -> ApiResponse (.data) -> Object { dayStatus, isOpen, ... }
  const payload = (data as any)?.data?.data;

  // DEFAULT to local today only when the day/date is not yet loaded.
  const localToday = new Date().toISOString().split('T')[0];

  // PREFERRED: backend now sends a pre-computed businessDateFormatted (YYYY-MM-DD in IST)
  // so the frontend NEVER needs to do UTC-to-IST timezone math.
  // FALLBACK: if running against an older backend, attempt manual IST conversion.
  let formattedBusinessDate = localToday;

  if (payload?.businessDateFormatted) {
    // New backend: already in YYYY-MM-DD IST — use directly
    formattedBusinessDate = payload.businessDateFormatted;
  } else if (payload?.businessDate) {
    // Legacy fallback: apply IST offset (+5:30) to convert UTC→IST calendar date
    try {
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const d = new Date(new Date(payload.businessDate).getTime() + IST_OFFSET_MS);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      formattedBusinessDate = `${year}-${month}-${day}`;
    } catch {
      formattedBusinessDate = localToday;
    }
  }

  // Unified Invalidation helper
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['day-status'] });

  return {
    dayStatus: payload?.dayStatus ?? (isLoading ? null : 'CLOSED'),
    
    // BUSINESS LOGIC for isOpen:
    // 1. If still loading → assume OPEN (prevents flash-locking during initial load)
    // 2. If we received a successful payload → use its exact isOpen value (single source of truth)
    // 3. If there's a network/permission error → assume OPEN (don't punish user for transient error)
    //    The backend is the final gatekeeper anyway — it will reject invalid transactions.
    isOpen: isLoading ? true : (isError ? true : (payload?.isOpen ?? false)),
    
    // Current business date (YYYY-MM-DD IST) — the date the day is/was open for
    businessDate: formattedBusinessDate,
    
    // Server wall-clock date (YYYY-MM-DD IST) — always the actual calendar today
    serverDate: payload?.serverDate ?? localToday,

    // Next business date to be opened (smart: Max(LastClosed+1, ServerToday) when closed)
    // ⚠️ USE THIS — never use new Date() for business date display anywhere in the app
    nextBusinessDate: payload?.nextBusinessDateFormatted ?? null,
    nextBusinessDisplayDate: payload?.nextBusinessDisplayDate ?? null,

    // Non-null when the system was closed for more than 1 calendar day
    dayGapWarning: (() => {
      const warning = payload?.dayGapWarning;
      if (!warning || !warning.gapDays || warning.gapDays <= 1) return warning;
      
      const missedDates = [];
      const lastClosedStr = payload?.businessDateFormatted; // The last closed date
      if (lastClosedStr) {
        const lastClosedMs = new Date(lastClosedStr).getTime();
        for (let i = 1; i < warning.gapDays; i++) {
          const d = new Date(lastClosedMs + i * 86400000);
          missedDates.push(d.toISOString().split('T')[0]);
        }
      }
      return { ...warning, missedDates };
    })(),
    
    displayDate: payload?.displayDate || '',
    isLoading,
    isFetching,
    refetch,
    invalidate,
    error,
    isError,
    payload
  };
}
