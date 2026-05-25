// src/features/day-control/DayControlPage.tsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Sun, Moon, AlertTriangle, CheckCircle, XCircle, RotateCcw,
  Banknote, TrendingUp, Users, ShieldAlert, Calendar, Clock,
  ArrowRight, BarChart3, FileText, RefreshCw, Eye, EyeOff, Lock
} from 'lucide-react';
import { dayControlApi } from '../../api/dayControl.api';
import { agentDepositApi } from '../../api/agentDeposit.api';
import { agentApi } from '../../api/agent.api';
import { collectionApi } from '../../api/collection.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatusPulse({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {isOpen && (
        <>
          <span className="absolute inline-flex h-20 w-20 rounded-full bg-emerald-400 opacity-20 animate-ping" />
          <span className="absolute inline-flex h-16 w-16 rounded-full bg-emerald-300 opacity-30 animate-ping [animation-delay:300ms]" />
        </>
      )}
      <div className={`relative h-20 w-20 rounded-full flex items-center justify-center shadow-lg ${isOpen
        ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
        : 'bg-gradient-to-br from-slate-300 to-slate-400'
        }`}>
        {isOpen
          ? <Sun className="h-10 w-10 text-white" />
          : <Moon className="h-10 w-10 text-white" />}
      </div>
    </div>
  );
}

function SummaryStatCard({
  icon: Icon, label, value, sub, color = 'blue'
}: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colours: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return (
    <div className={`rounded-xl border p-4 ${colours[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORCED CLOSE MODAL — typed confirmation
// ─────────────────────────────────────────────────────────────────────────────
function ForceCloseModal({
  onConfirm,
  onCancel,
  loading,
  blockers,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  blockers: string[];
}) {
  const [typed, setTyped] = useState('');
  const CONFIRM_TEXT = 'FORCE CLOSE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="bg-red-600 rounded-t-2xl px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-7 w-7" />
            <div>
              <h2 className="text-lg font-bold">Force Close Override</h2>
              <p className="text-red-200 text-sm">This action will be permanently recorded in the audit log</p>
            </div>
          </div>
        </div>

        {/* Blockers list */}
        <div className="px-6 py-4 border-b border-red-100 bg-red-50">
          <p className="text-sm font-semibold text-red-800 mb-2">The following issues will be bypassed:</p>
          <ul className="space-y-1.5">
            {blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            By force closing the day, you acknowledge that manual reconciliation
            will be required. This incident will be logged against your account.
          </p>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">
              Type <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{CONFIRM_TEXT}</span> to confirm:
            </label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
              placeholder="Type FORCE CLOSE here..."
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={typed !== CONFIRM_TEXT || loading}
              isLoading={loading}
              onClick={onConfirm}
            >
              <ShieldAlert className="h-4 w-4 mr-1.5" /> Force Close Day
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKDATE OPEN MODAL — high-visibility risk acknowledgement
// ─────────────────────────────────────────────────────────────────────────────
function BackdateOpenModal({
  onConfirm, onCancel, loading, backdate
}: {
  onConfirm: () => void; onCancel: () => void; loading: boolean; backdate: string;
}) {
  const [typed, setTyped] = useState('');
  const CONFIRM_TEXT = 'BACKDATE';
  const displayDate = backdate
    ? new Date(backdate + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : backdate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-t-2xl px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <Lock className="h-7 w-7" />
            <div>
              <h2 className="text-lg font-bold">Backdated Day Open</h2>
              <p className="text-amber-100 text-sm">This is a privileged superadmin action</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
          <p className="text-sm font-semibold text-amber-900 mb-2">⚠️  You are opening the business books for a PAST date:</p>
          <p className="text-lg font-bold text-amber-800">{displayDate}</p>
          <ul className="mt-3 space-y-1.5">
            {[
              'All transactions entered today will be stamped with this past date',
              'Receipt numbers and ledger entries will use this date',
              'This action is permanently recorded in the audit log',
              'Reports will reflect this backdated activity',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">
              Type <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{CONFIRM_TEXT}</span> to confirm:
            </label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
              placeholder="Type BACKDATE here..."
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-0"
              disabled={typed !== CONFIRM_TEXT || loading}
              isLoading={loading}
              onClick={onConfirm}
            >
              <Lock className="h-4 w-4 mr-1.5" /> Confirm Backdated Open
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN DAY CONFIRMATION MODAL
// ─────────────────────────────────────────────────────────────────────────────
function OpenDayModal({
  onConfirm, onCancel, loading, nextDate
}: {
  onConfirm: () => void; onCancel: () => void; loading: boolean; nextDate: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-t-2xl px-6 py-5 text-white text-center">
          <Sun className="h-10 w-10 mx-auto mb-2 text-yellow-300" />
          <h2 className="text-xl font-bold">Open Business Day</h2>
          <p className="text-blue-200 text-sm mt-1">{nextDate}</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-4">
            Opening the business day will allow all transactions (pigmy collections,
            loan repayments, agent deposits) to be recorded for this date.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
            <p className="text-xs text-blue-700 font-medium">
              ✓ All transaction timestamps will be stamped with today's business date
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button className="flex-1" isLoading={loading} onClick={onConfirm}>
              <Sun className="h-4 w-4 mr-1.5" /> Open Day
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE DAY CONFIRMATION MODAL
// ─────────────────────────────────────────────────────────────────────────────
function CloseDayModal({
  onConfirm, onCancel, loading
}: {
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-t-2xl px-6 py-5 text-white text-center">
          <Moon className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          <h2 className="text-xl font-bold">Close Business Day</h2>
          <p className="text-slate-400 text-sm mt-1">This will end all transactions for today</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-4">
            Closing the day will transition overdue loans, finalize agent balances,
            and lock all further transactions until tomorrow's open.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
            <p className="text-xs text-amber-700 font-medium">
              ⚠ This action cannot be undone. No transactions can be reversed for a closed day.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button variant="destructive" className="flex-1" isLoading={loading} onClick={onConfirm}>
              <Moon className="h-4 w-4 mr-1.5" /> Close Day
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAY CLOSE SUMMARY PANEL
// ─────────────────────────────────────────────────────────────────────────────
function DaySummaryPanel({ payload, onDismiss }: { payload: any; onDismiss: () => void }) {
  const summary = payload?.daySummary || {};
  const eodResults = payload?.eodResults;
  const collections = summary?.collections || {};
  const loans = summary?.loans || {};
  const agents = summary?.agents || {};
  const isBalanced = summary?.ledgerIntegrity === 'BALANCED';

  return (
    <div className="card overflow-hidden border-2 border-emerald-200 animate-fade-in">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white text-center">
        <Moon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
        <h2 className="text-2xl font-bold mb-0.5">Day Closed Successfully</h2>
        <p className="text-slate-400 text-sm">{formatDate(summary?.businessDate)}</p>
      </div>

      {/* Summary Grid */}
      <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-100">
        <SummaryStatCard
          icon={Banknote} label="Collections"
          value={collections.count ?? '—'}
          sub={formatCurrency(collections.totalInPaise ?? 0)}
          color="emerald"
        />
        <SummaryStatCard
          icon={TrendingUp} label="Loan Repaid"
          value={formatCurrency(collections.totalRepaidInPaise ?? 0)}
          sub="From pigmy/EMI accounts"
          color="blue"
        />
        <SummaryStatCard
          icon={BarChart3} label="Overdue Loans"
          value={loans.totalOverdueCount ?? '—'}
          sub={`+${loans.newOverdueTodayCount ?? 0} new today`}
          color={loans.newOverdueTodayCount > 0 ? 'red' : 'blue'}
        />
        <SummaryStatCard
          icon={Users} label="Agents Settled"
          value={agents.unsettledCount === 0 ? 'All' : `${agents.unsettledCount} unsettled`}
          sub={agents.note?.slice(0, 40)}
          color={agents.unsettledCount === 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Ledger Integrity */}
      <div className={`px-6 py-4 flex items-center gap-4 border-b border-slate-100 ${isBalanced ? 'bg-emerald-50' : 'bg-red-50'
        }`}>
        {isBalanced
          ? <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
          : <XCircle className="h-6 w-6 text-red-500 shrink-0" />}
        <div>
          <p className={`font-bold text-sm ${isBalanced ? 'text-emerald-800' : 'text-red-800'}`}>
            Ledger: {isBalanced ? 'BALANCED ✓' : 'IMBALANCED — Force Closed'}
          </p>
          {!isBalanced && (
            <p className="text-xs text-red-600">
              Difference: {formatCurrency(summary?.ledgerDifferenceInPaise ?? 0)} — Manual reconciliation required
            </p>
          )}
          {isBalanced && (
            <p className="text-xs text-emerald-600">
              All debit and credit entries are balanced. Books are clean.
            </p>
          )}
        </div>
      </div>

      {/* EOD Results Section */}
      {eodResults && !eodResults.skipped && (
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            EOD Job Results
          </p>
          <div className="space-y-2">
            {[
              { label: 'Missed Day Tracking', result: eodResults.missedDayTracking },
              { label: 'Penalty & Overdue', result: eodResults.penaltyAndOverdue },
              { label: 'Deficit Warning', result: eodResults.deficitWarning },
              { label: 'Reconciliation', result: eodResults.reconcile },
            ].map(({ label, result }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{label}</span>
                {result?.error
                  ? <span className="text-red-600 text-xs">❌ {result.error}</span>
                  : <span className="text-emerald-600 text-xs font-semibold">✅ Done</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}
      {eodResults?.skipped && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-700">
            ⏭ EOD skipped — correction mode. No penalties or missed-day charges applied.
          </p>
        </div>
      )}

      <div className="px-6 py-4 bg-slate-50/50 flex justify-end">
        <Button variant="outline" onClick={onDismiss}>
          <RotateCcw className="h-4 w-4 mr-1.5" /> Dismiss Summary
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function DayControlPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showForceModal, setShowForceModal] = useState(false);
  const [showBackdateModal, setShowBackdateModal] = useState(false);
  const [closeSummary, setCloseSummary] = useState<any>(null);
  // Backdate state — only used when isSuperadmin + backdateMode on
  const [backdateMode, setBackdateMode] = useState(false);
  const [backdateValue, setBackdateValue] = useState('');
  const [backdatePassword, setBackdatePassword] = useState('');
  const [showBdPassword, setShowBdPassword] = useState(false);
  const [catchupMode, setCatchupMode] = useState(false);

  const isSuperadmin = user?.role === 'superadmin';
  // yesterday's date as max for the date picker
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  // ── Source of Truth: Unified Global Hook ────────────────────────────────
  const {
    isOpen,
    businessDate,
    serverDate,
    nextBusinessDate,
    nextBusinessDisplayDate,
    dayGapWarning,
    displayDate,
    isLoading: statusLoading,
    isFetching,
    refetch: refetchStatus,
    invalidate: invalidateStatus
  } = useBusinessDate();

  // ── Auto-refresh dash every 30s ─────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      refetchStatus();
    }, 30000);
    return () => clearInterval(timer);
  }, [refetchStatus]);

  // ── 1. Day History ──────────────────────────────────────────────────────────
  const { data: historyData } = useQuery({
    queryKey: ['day-history'],
    queryFn: () => dayControlApi.getHistory(30),
    staleTime: 10000,
  });
  const history = (historyData as any)?.data?.data?.history || [];

  // ── 2. Today's collection summary (for pre-close display) ─────────────────
  const { data: collectionSummaryData } = useQuery({
    queryKey: ['day-collection-summary', businessDate],
    queryFn: () => collectionApi.getDailySummary({ date: businessDate.split('T')[0] }),
    enabled: !!businessDate && isOpen,
    staleTime: 10000, // Short cache for dashboard accuracy
  });
  const collSummary = (collectionSummaryData as any)?.data as any;

  // ── 3. Agent balance pre-flight (for close day warning) ───────────────────
  const { data: agentListData } = useQuery({
    queryKey: ['agents-for-day-control'],
    queryFn: () => agentApi.list({ page: 1, limit: 200, isActive: 'true' as any }),
    enabled: isOpen,
    staleTime: 30000,
  });
  const agents = (agentListData?.data?.agents as any[]) || [];

  const { data: allBalancesData } = useQuery({
    queryKey: ['all-balances-preflight', agents.map((a: any) => a._id).join(',')],
    queryFn: async () => {
      const results = await Promise.allSettled(
        agents.map((a: any) => agentDepositApi.getCashBalance(a._id).then((r: any) => r.data?.data?.balance))
      );
      return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && !!r.value)
        .map((r) => r.value);
    },
    enabled: isOpen && agents.length > 0,
    staleTime: 15000,
  });

  const balances: any[] = allBalancesData || [];
  const unsettledAgents = balances.filter((b) => b?.depositStatus === 'outstanding');
  const totalUnsettledPaise = unsettledAgents.reduce((s, b) => s + (b?.balanceInPaise ?? 0), 0);
  const allAgentsSettled = isOpen && agents.length > 0 && unsettledAgents.length === 0;

  // Force-close blockers list (shown in modal)
  const forceBlockers: string[] = [];
  if (unsettledAgents.length > 0)
    forceBlockers.push(
      `${unsettledAgents.length} agent(s) with unsettled cash — Total: ${formatCurrency(totalUnsettledPaise)}`
    );

  // ── MUTATIONS ─────────────────────────────────────────────────────────────

  // Open Day
  const openMutation = useMutation({
    mutationFn: (payload?: any) => dayControlApi.openDay(payload),
    onSuccess: (res: any) => {
      const result = (res as any)?.data as any;
      const opened = result?.data ?? result;
      const dateLabel = opened?.isBackdated
        ? `backdated to ${new Date(opened.targetBackdate).toLocaleDateString('en-IN')}`
        : formatDate(opened?.businessDate || nextBusinessDate || new Date());
      toast.success(`✓ Day opened — ${dateLabel}`);
      invalidateStatus();
      queryClient.invalidateQueries({ queryKey: ['day-collection-summary'] });
      setShowOpenModal(false);
      setShowBackdateModal(false);
      // Reset backdate fields
      setBackdateMode(false);
      setBackdateValue('');
      setBackdatePassword('');
      setCatchupMode(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to open day');
      setShowOpenModal(false);
      setShowBackdateModal(false);
    },
  });

  // Close Day (normal)
  const closeMutation = useMutation({
    mutationFn: () => dayControlApi.closeDay({ forceClose: false }),
    onSuccess: (res: any) => {

      const result = (res as any)?.data as any;
      const payload = result?.data ?? result;
      toast.success('Business day closed successfully');
      invalidateStatus();
      queryClient.invalidateQueries({ queryKey: ['all-balances-preflight'] });
      setShowCloseModal(false);
      setCloseSummary(payload ?? null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to close day';
      toast.error(msg);
      setShowCloseModal(false);
    },
  });

  // Force Close
  const forceCloseMutation = useMutation({
    mutationFn: () => dayControlApi.closeDay({ forceClose: true }),
    onSuccess: (res: any) => {
      const result = (res as any)?.data as any;
      const payload = result?.data ?? result;
      toast.success('Force close completed — manual reconciliation required');
      invalidateStatus();
      queryClient.invalidateQueries({ queryKey: ['all-balances-preflight'] });
      setShowForceModal(false);
      setCloseSummary(payload ?? null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Force close failed');
      setShowForceModal(false);
    },
  });

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in animate-slide-up max-w-4xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Day Control</h1>
          <p className="page-subtitle">Business day open / close — financial state machine</p>
        </div>
        <button
          onClick={() => refetchStatus()}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isFetching ? 'text-blue-500 animate-pulse' : 'text-slate-400 hover:text-blue-600'}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Auto-refreshes every 30s
        </button>
      </div>

      {/* ── Day Close Summary ──────────────────────────────────── */}
      {closeSummary && (
        <div className="mb-6">
          <DaySummaryPanel payload={closeSummary} onDismiss={() => setCloseSummary(null)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Status Card ──────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className={`card overflow-hidden transition-all duration-500 ${isOpen ? 'border-emerald-200' : 'border-slate-200'
            }`}>
            <div className={`p-8 text-center transition-all duration-500 ${isOpen
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50'
              : 'bg-gradient-to-br from-slate-100 to-slate-50'
              }`}>
              <StatusPulse isOpen={isOpen} />
              <h2 className={`text-2xl font-bold mt-5 mb-1 ${isOpen ? 'text-emerald-800' : 'text-slate-600'
                }`}>
                {isOpen ? 'Day is Open' : 'Day is Closed'}
              </h2>
              {displayDate && (
                <p className="text-sm text-slate-500">{displayDate}</p>
              )}
              {businessDate && (
                <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(businessDate)}
                </p>
              )}
            </div>

            {/* Status badges */}
            <div className="px-5 py-4 space-y-2.5 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> System Status
                </span>
                <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                  {isOpen ? '● LIVE' : '○ OFFLINE'}
                </span>
              </div>
              {isOpen && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> Agent Settlement
                  </span>
                  {balances.length === 0 ? (
                    <span className="text-xs text-slate-400">Loading...</span>
                  ) : allAgentsSettled ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">All Clear ✓</span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                      {unsettledAgents.length} Unsettled
                    </span>
                  )}
                </div>
              )}
              {isOpen && collSummary && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Banknote className="h-4 w-4" /> Collections
                  </span>
                  <span className="text-xs font-semibold text-blue-700">
                    {collSummary.totalCollections ?? '—'} · {formatCurrency((collSummary.totalInPaise ?? 0))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Action Panel ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* OPEN DAY PANEL */}
          {!isOpen && (
            <div className="card">
              <div className="card-header bg-blue-50/60 flex items-center gap-2">
                <Sun className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-blue-900">Open Business Day</h2>
              </div>
              <div className="card-body">
                <p className="text-sm text-slate-600 mb-5">
                  Opening the day enables all financial transactions. All entries will
                  be stamped with the next business date.
                </p>

                {/* Day Gap Warning Banner — shown when system was closed >1 day */}
                {dayGapWarning && (
                  <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex gap-3 animate-fade-in">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Day Gap Detected</p>
                      <p className="text-xs text-amber-700 mt-0.5">{dayGapWarning.message}</p>
                      <div className="mt-2 flex gap-3 text-xs text-amber-700">
                        <span>Last closed: <strong>{dayGapWarning.lastClosedDate}</strong></span>
                        <span>Opening for: <strong>{dayGapWarning.suggestedNextDate}</strong></span>
                        <span>Gap: <strong>{dayGapWarning.gapDays} day(s)</strong></span>
                      </div>
                      <p className="text-xs text-amber-600 mt-2">
                        You have <strong>{dayGapWarning.gapDays}</strong> missed day(s).
                        To apply EOD for each, use Backdate Mode with Catch-up Mode ON,
                        processing each date sequentially (oldest first).
                      </p>
                      {dayGapWarning.missedDates && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {dayGapWarning.missedDates.map((d: string) => (
                            <span key={d} className="bg-amber-200 text-amber-800 text-xs px-2 py-1 rounded-lg font-mono">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs text-blue-500 font-semibold mb-1">Opening For</p>
                    <p className="font-bold text-blue-900">
                      {nextBusinessDisplayDate || nextBusinessDate || '—'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-slate-500 font-semibold mb-1">Server Date (Today)</p>
                    <p className="font-bold text-slate-700">{serverDate || '—'}</p>
                  </div>
                  {businessDate && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 sm:col-span-2">
                      <p className="text-xs text-slate-500 font-semibold mb-1">Last Closed Date</p>
                      <p className="font-bold text-slate-700">{businessDate}</p>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full py-3 text-base"
                  onClick={() => setShowOpenModal(true)}
                  isLoading={openMutation.isPending}
                >
                  <Sun className="h-5 w-5 mr-2" />
                  Open Business Day
                </Button>

                {/* SUPERADMIN ONLY: Backdate Mode ──────────────────────── */}
                {isSuperadmin && (
                  <div className="mt-4 border border-amber-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setBackdateMode(!backdateMode); setBackdateValue(''); setBackdatePassword(''); }}
                      className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-800">Backdate Mode</span>
                        <span className="text-xs text-amber-600">(Superadmin only)</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${backdateMode ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'
                        }`}>{backdateMode ? 'ON' : 'OFF'}</span>
                    </button>

                    {backdateMode && (
                      <div className="px-4 py-4 bg-amber-50/60 space-y-3 border-t border-amber-200">
                        <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-800">
                            ⚠️  You are about to open books for a PAST date. All transactions will carry that date.
                            This is permanently logged in the audit trail.
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Target Backdate</label>
                          <input
                            type="date"
                            max={yesterdayStr}
                            value={backdateValue}
                            onChange={(e) => setBackdateValue(e.target.value)}
                            className="w-full border border-amber-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Your Superadmin Password</label>
                          <div className="relative">
                            <input
                              type={showBdPassword ? 'text' : 'password'}
                              value={backdatePassword}
                              onChange={(e) => setBackdatePassword(e.target.value)}
                              placeholder="Enter your account password"
                              className="w-full border border-amber-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowBdPassword(!showBdPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showBdPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* ── CATCHUP MODE TOGGLE ──────────────────────── */}
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-300 mt-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Catch-up Mode</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Enable if this was a genuinely missed business day —
                              EOD charges (penalties, missed-day tracking) will run on close.
                              Leave OFF for ledger corrections.
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer ml-4">
                            <input
                              type="checkbox"
                              checked={catchupMode}
                              onChange={(e) => setCatchupMode(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-checked:bg-amber-500 rounded-full
                                            peer-focus:ring-2 peer-focus:ring-amber-400 transition-colors
                                            after:content-[''] after:absolute after:top-0.5 after:left-0.5
                                            after:bg-white after:rounded-full after:h-5 after:w-5
                                            after:transition-all peer-checked:after:translate-x-5" />
                          </label>
                        </div>
                        
                        <div className={`rounded-lg p-3 text-xs font-medium ${
                          catchupMode
                            ? 'bg-red-50 border border-red-200 text-red-800'
                            : 'bg-blue-50 border border-blue-200 text-blue-800'
                        }`}>
                          {catchupMode
                            ? '⚠️ CATCH-UP MODE: Full EOD will run on close — penalties will be charged for this date.'
                            : 'ℹ️ CORRECTION MODE: EOD skipped on close — ledger correction only, no charges.'}
                        </div>

                        <Button
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white border-0 py-2.5"
                          disabled={!backdateValue || !backdatePassword || openMutation.isPending}
                          isLoading={openMutation.isPending}
                          onClick={() => setShowBackdateModal(true)}
                        >
                          <Lock className="h-4 w-4 mr-2" /> Open Backdated Day
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CLOSE DAY PANEL */}
          {isOpen && (
            <div className="card">
              <div className="card-header bg-slate-50/60 flex items-center gap-2">
                <Moon className="h-4 w-4 text-slate-600" />
                <h2 className="text-sm font-semibold text-slate-800">Close Business Day</h2>
              </div>
              <div className="card-body space-y-4">

                {/* Pre-flight checks */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Pre-Close Checks</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {/* Check 1: Agent settlement */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {allAgentsSettled
                          ? <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                          : unsettledAgents.length > 0
                            ? <XCircle className="h-4.5 w-4.5 text-red-500" />
                            : <div className="h-4 w-4 rounded-full border-2 border-slate-300 animate-pulse" />}
                        <div>
                          <p className="text-sm font-medium text-slate-700">Agent Cash Settlement</p>
                          <p className="text-xs text-slate-400">All agents must have ₹0 balance</p>
                        </div>
                      </div>
                      {agents.length > 0 && (
                        allAgentsSettled
                          ? <span className="text-xs text-emerald-600 font-bold">All Settled ✓</span>
                          : unsettledAgents.length > 0
                            ? (
                              <button
                                className="text-xs text-red-600 font-bold hover:underline"
                                onClick={() => navigate('/agent-deposits/balances')}
                              >
                                {unsettledAgents.length} Unsettled →
                              </button>
                            )
                            : <span className="text-xs text-slate-400">Checking…</span>
                      )}
                    </div>

                    {/* Check 2: Collections today */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Today's Collections</p>
                          <p className="text-xs text-slate-400">Summary of pigmy collections</p>
                        </div>
                      </div>
                      <span className="text-xs text-blue-700 font-bold">
                        {collSummary ? `${collSummary.totalCollections} · ${formatCurrency(collSummary.totalInPaise ?? 0)}` : 'Loading…'}
                      </span>
                    </div>

                    {/* Check 3: Ledger (validated server-side) */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Ledger Integrity</p>
                          <p className="text-xs text-slate-400">DR = CR check (validated server-side on close)</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">Auto-verified</span>
                    </div>
                  </div>
                </div>

                {/* Warning if unsettled agents */}
                {unsettledAgents.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Day Close Will Be Blocked</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        <strong>{unsettledAgents.length} agent(s)</strong> still hold{' '}
                        <strong>{formatCurrency(totalUnsettledPaise)}</strong> in cash.
                        Use "Force Close" to override (will be audit-logged).
                      </p>
                      <button
                        className="text-xs text-amber-700 underline mt-1"
                        onClick={() => navigate('/agent-deposits/balances')}
                      >
                        View Agent Balances <ArrowRight className="h-3 w-3 inline" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                  <Button
                    variant="destructive"
                    className="flex-1 py-3 text-base"
                    onClick={() => setShowCloseModal(true)}
                    isLoading={closeMutation.isPending}
                    disabled={forceCloseMutation.isPending}
                  >
                    <Moon className="h-5 w-5 mr-2" />
                    Close Business Day
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setShowForceModal(true)}
                    disabled={closeMutation.isPending || forceCloseMutation.isPending}
                    title="Force close — bypasses pre-flight checks"
                  >
                    <ShieldAlert className="h-4 w-4 mr-1.5" />
                    Force
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Navigation Panel */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-800">Day Control Hub</h2>
            </div>
            <div className="card-body grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Agent Deposits', icon: Banknote, path: '/agent-deposits', color: 'blue' },
                { label: 'Agent Balances', icon: Users, path: '/agent-deposits/balances', color: 'amber' },
                { label: 'Collections', icon: TrendingUp, path: '/collections', color: 'emerald' },
                { label: 'Daily Sheet', icon: FileText, path: '/collections/sheet', color: 'indigo' },
                { label: 'Missed Collections', icon: AlertTriangle, path: '/collections/missed', color: 'red' },
                { label: 'Audit Logs', icon: BarChart3, path: '/superadmin/audit-logs', color: 'blue' },
              ].map(({ label, icon: Icon, path, color }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all hover:shadow-sm text-left ${color === 'blue' ? 'border-blue-100 hover:bg-blue-50 text-blue-700' :
                    color === 'emerald' ? 'border-emerald-100 hover:bg-emerald-50 text-emerald-700' :
                      color === 'amber' ? 'border-amber-100 hover:bg-amber-50 text-amber-700' :
                        color === 'red' ? 'border-red-100 hover:bg-red-50 text-red-700' :
                          'border-indigo-100 hover:bg-indigo-50 text-indigo-700'
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Day History Panel */}
          <div className="card mt-6 animate-fade-in">
            <div className="card-header bg-slate-50/60 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-semibold text-slate-800">Business Day History</h2>
            </div>
            <div className="card-body p-0 max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Date</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Mode</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Collections</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Ledger</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase">EOD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No history available</td>
                    </tr>
                  ) : history.map((day: any) => (
                    <tr key={day._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {new Date(day.businessDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-md font-semibold ${
                          day.openMode === 'CATCHUP' ? 'bg-amber-100 text-amber-800' :
                          day.openMode === 'CORRECTION' ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {day.openMode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {day.summary?.totalCollectionsCount ?? 0} entries
                      </td>
                      <td className="px-4 py-3">
                        {day.summary?.ledgerIntegrity === 'BALANCED' ? (
                          <span className="text-emerald-600 text-xs font-bold">✅ OK</span>
                        ) : day.summary?.ledgerIntegrity ? (
                          <span className="text-red-600 text-xs font-bold">⚠️ IMBL</span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${
                          day.eodStatus === 'COMPLETED' ? 'text-emerald-600' :
                          day.eodStatus === 'SKIPPED' ? 'text-blue-600' :
                          day.eodStatus === 'PARTIAL' ? 'text-amber-600' :
                          'text-slate-400'
                        }`}>
                          {day.eodStatus === 'COMPLETED' ? '✅ Done' :
                           day.eodStatus === 'SKIPPED' ? '⏭ Skip' :
                           day.eodStatus === 'PARTIAL' ? '⚠️ Partial' :
                           '❌ Pend'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {showOpenModal && (
        <OpenDayModal
          nextDate={nextBusinessDisplayDate || nextBusinessDate || '—'}
          onConfirm={() => openMutation.mutate(undefined)}
          onCancel={() => setShowOpenModal(false)}
          loading={openMutation.isPending}
        />
      )}

      {showBackdateModal && (
        <BackdateOpenModal
          backdate={backdateValue}
          onConfirm={() => openMutation.mutate({ backdate: backdateValue, backdatePassword, catchupMode })}
          onCancel={() => setShowBackdateModal(false)}
          loading={openMutation.isPending}
        />
      )}

      {showCloseModal && (
        <CloseDayModal
          onConfirm={() => closeMutation.mutate()}
          onCancel={() => setShowCloseModal(false)}
          loading={closeMutation.isPending}
        />
      )}

      {showForceModal && (
        <ForceCloseModal
          blockers={forceBlockers.length > 0 ? forceBlockers : ['Proceeding without any pending issue warnings']}
          onConfirm={() => forceCloseMutation.mutate()}
          onCancel={() => setShowForceModal(false)}
          loading={forceCloseMutation.isPending}
        />
      )}
    </div>
  );
}
