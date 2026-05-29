// src/features/dashboard/SuperadminDashboard.tsx
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ShieldCheck, ShieldX, MessageSquare, MessageSquareOff,
  Calendar, Users, Briefcase, Lock, Unlock,
  Settings, FileText, BookOpen, ClipboardList,
  TrendingUp, AlertTriangle,
} from 'lucide-react';
import { superadminApi } from '../../api/superadmin.api';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card card-body">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function QuickLink({ icon: Icon, label, href, color }: { icon: any; label: string; href: string; color: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(href)}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer group`}
    >
      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700">{label}</span>
    </button>
  );
}

export default function SuperadminDashboard() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['sa-dashboard'],
    queryFn: () => superadminApi.getDashboard(),
    refetchInterval: 30_000,
  });

  const dashboard = dashData?.data?.data as any;
  const system = dashboard?.system;
  const counts = dashboard?.counts;

  const lockMutation = useMutation({
    mutationFn: () => system?.isLocked ? superadminApi.unlockSystem() : superadminApi.lockSystem(),
    onSuccess: (res: any) => {
      toast.success(res?.data?.data?.message || res?.data?.message || 'System updated');
      queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Action failed'),
  });

  const smsMutation = useMutation({
    mutationFn: () => superadminApi.toggleSms({ enabled: !system?.smsEnabled }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.data?.message || res?.data?.message || 'SMS updated');
      queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Action failed'),
  });

  const isLocked = system?.isLocked;
  const smsEnabled = system?.smsEnabled;
  const dayOpen = system?.dayStatus === 'open';
  const businessDate = system?.currentBusinessDate
    ? new Date(system.currentBusinessDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Superadmin Control Center</h1>
          <p className="page-subtitle">Welcome back, {user?.name}. Full system visibility and control.</p>
        </div>
      </div>

      {/* System Alert Banner */}
      {!isLoading && (
        <div className={`flex items-center gap-3 rounded-xl px-5 py-4 border-2 ${
          isLocked
            ? 'bg-red-50 border-red-300 text-red-800'
            : 'bg-emerald-50 border-emerald-300 text-emerald-800'
        }`}>
          {isLocked
            ? <ShieldX className="h-6 w-6 shrink-0 text-red-600" />
            : <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />}
          <div className="flex-1">
            <p className="font-semibold text-sm">
              System is currently {isLocked ? '🔴 LOCKED — All admin operations are blocked.' : '🟢 OPERATIONAL — All services running normally.'}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              SMS: {smsEnabled ? 'Enabled' : 'Disabled'} &nbsp;|&nbsp; Business Day: {dayOpen ? 'Open' : 'Closed'} &nbsp;|&nbsp; {businessDate}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant={isLocked ? 'default' : 'destructive'}
              isLoading={lockMutation.isPending}
              onClick={() => lockMutation.mutate()}
            >
              {isLocked ? <><Unlock className="h-3.5 w-3.5 mr-1.5" />Unlock</> : <><Lock className="h-3.5 w-3.5 mr-1.5" />Lock</>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              isLoading={smsMutation.isPending}
              onClick={() => smsMutation.mutate()}
            >
              {smsEnabled
                ? <><MessageSquareOff className="h-3.5 w-3.5 mr-1.5" />Disable SMS</>
                : <><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Enable SMS</>}
            </Button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card card-body h-24 animate-pulse bg-slate-100" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Admins"
              value={counts?.admins?.total ?? '—'}
              sub={`${counts?.admins?.active ?? 0} active`}
              color="text-blue-600"
            />
            <StatCard
              label="Active Admins"
              value={counts?.admins?.active ?? '—'}
              sub={`${(counts?.admins?.total ?? 0) - (counts?.admins?.active ?? 0)} inactive`}
              color="text-emerald-600"
            />
            <StatCard
              label="Total Agents"
              value={counts?.agents?.total ?? '—'}
              sub={`${counts?.agents?.active ?? 0} active`}
              color="text-purple-600"
            />
            <StatCard
              label="Active Agents"
              value={counts?.agents?.active ?? '—'}
              sub={`${(counts?.agents?.total ?? 0) - (counts?.agents?.active ?? 0)} inactive`}
              color="text-amber-600"
            />
          </>
        )}
      </div>

      {/* Quick Navigation */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-slate-900">Quick Navigation</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            <QuickLink icon={Users} label="Admin Users" href="/superadmin/admins" color="bg-blue-100 text-blue-600" />
            <QuickLink icon={Settings} label="System Control" href="/superadmin/system" color="bg-red-100 text-red-600" />
            <QuickLink icon={TrendingUp} label="Loan Plans" href="/superadmin/loan-plans" color="bg-emerald-100 text-emerald-600" />
            <QuickLink icon={BookOpen} label="Ledger Accounts" href="/superadmin/ledger-accounts" color="bg-purple-100 text-purple-600" />
            <QuickLink icon={ClipboardList} label="Audit Logs" href="/superadmin/audit-logs" color="bg-amber-100 text-amber-600" />
            <QuickLink icon={Briefcase} label="Agents" href="/agents" color="bg-slate-100 text-slate-600" />
          </div>
        </div>
      </div>

      {/* System Status Details */}
      {!isLoading && system && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`card card-body flex items-center gap-3 ${isLocked ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
            {isLocked ? <Lock className="h-6 w-6 text-red-500" /> : <Unlock className="h-6 w-6 text-emerald-500" />}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">System Lock</p>
              <p className={`font-semibold ${isLocked ? 'text-red-700' : 'text-emerald-700'}`}>{isLocked ? 'Locked' : 'Unlocked'}</p>
            </div>
          </div>
          <div className={`card card-body flex items-center gap-3 ${smsEnabled ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
            {smsEnabled ? <MessageSquare className="h-6 w-6 text-blue-500" /> : <MessageSquareOff className="h-6 w-6 text-slate-400" />}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Global SMS</p>
              <p className={`font-semibold ${smsEnabled ? 'text-blue-700' : 'text-slate-500'}`}>{smsEnabled ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>
          <div className={`card card-body flex items-center gap-3 ${dayOpen ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <Calendar className={`h-6 w-6 ${dayOpen ? 'text-amber-500' : 'text-slate-400'}`} />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Business Day</p>
              <p className={`font-semibold ${dayOpen ? 'text-amber-700' : 'text-slate-500'}`}>{dayOpen ? 'Open' : 'Closed'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Warning if system is locked */}
      {isLocked && !isLoading && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-800 text-sm">System is locked</p>
            <p className="text-red-700 text-xs mt-0.5">
              All admin operations (account creation, deposits, loans, collections) are currently blocked.
              Only superadmin can unlock the system.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
