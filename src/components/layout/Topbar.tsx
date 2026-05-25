// src/components/layout/Topbar.tsx
import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, Menu, CalendarCheck, CalendarX } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useSystemStore } from '../../store/system.store';
import { authApi } from '../../api/auth.api';
import { dayControlApi } from '../../api/dayControl.api';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const branding = useSystemStore((s) => s.branding);
  const navigate = useNavigate();

  // Fetch day status for topbar display
  const { data: dayRes } = useQuery({
    queryKey: ['day-status'],
    queryFn: () => dayControlApi.getStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const dayStatus = dayRes?.data?.data;
  const isDayOpen = dayStatus?.isDayOpen ?? false;
  const businessDate = dayStatus?.currentBusinessDate
    ? new Date(dayStatus.currentBusinessDate).toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  const institutionName = branding?.institution?.name || '';

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on logout
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="text-slate-500 hover:text-slate-700 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Institution name on mobile (hidden on desktop since sidebar shows it) */}
        {institutionName && (
          <span className="text-sm font-semibold text-slate-700 lg:hidden truncate max-w-[140px]">
            {institutionName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* ── Business Day Status ──────────────────────────────────── */}
        {businessDate && (
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
              isDayOpen
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
            onClick={() => navigate('/day-control')}
            title="Click to open Day Control"
          >
            {isDayOpen
              ? <CalendarCheck className="h-3.5 w-3.5" />
              : <CalendarX className="h-3.5 w-3.5" />
            }
            <span>{isDayOpen ? 'Day Open' : 'Day Closed'}</span>
            <span className="text-[10px] opacity-60">·</span>
            <span className="text-[10px] opacity-70 font-mono">{businessDate}</span>
          </div>
        )}

        {/* ── User Info ────────────────────────────────────────────── */}
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
        </div>
        
        <div className="h-8 w-8 overflow-hidden rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
          <UserIcon className="h-5 w-5 text-slate-500" />
        </div>

        <div className="ml-1 h-6 w-px bg-slate-200" />

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
