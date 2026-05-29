// src/features/loans/DeficitDashboardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Pigmy Collection Deficit & Lifeline Warning Dashboard
//
// Shows all active/overdue loans where customers are behind on their
// cumulative daily pigmy collection. Admin can:
//   1. See live expected vs actual vs deficit
//   2. See warning lifeline dots (consumed vs remaining)
//   3. Apply missed-collection penalty (enabled only when isPenaltyEligible)
//   4. Reset lifelines: full / +1 / -1
//
// Colors:
//   RED card   = isPenaltyEligible: true  (all lifelines gone, admin must act)
//   AMBER card = warnings active, lifelines still remaining
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  Plus,
  Minus,
  Phone,
  ShieldAlert,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { loanApi } from '../../api/loan.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/format';

// ── Types ────────────────────────────────────────────────────────────────────
interface DeficitLoan {
  loanId: string;
  loanAccountNumber: string;
  status: string;
  customer: { _id: string; name: string; phone: string; customerCode: string };
  pigmyAccountNumber: string;
  dailyDepositInRupees: string;
  dailyDepositAmountInPaise: number;
  businessDaysElapsed: number;
  expectedInRupees: string;
  actualInRupees: string;
  deficitInRupees: string;
  deficitInPaise: number;
  percentCollected: number;
  consecutiveDeficitDays: number;
  lifelinesRemaining: number | null;
  lifelinesUsed: number;
  maxWarnings: number;
  totalWarningsSentCount: number;
  isPenaltyEligible: boolean;
  suggestedPenaltyInPaise: number;
  suggestedPenaltyInRupees: string;
  lastDeficitWarningDate: string | null;
}

interface DashboardData {
  data: DeficitLoan[];
  summary: {
    total: number;
    penaltyEligibleCount: number;
    activeWarningsCount: number;
    maxWarnings: number;
    configuredPenaltyInRupees: string;
  };
}

// ── Lifeline Dot Component ────────────────────────────────────────────────────
function LifelineDots({
  max,
  remaining,
}: {
  max: number;
  remaining: number | null;
}) {
  const safe = remaining ?? max;
  const used = Math.max(0, max - safe);
  return (
    <div className="flex gap-1.5 items-center" title={`${safe}/${max} lifelines remaining`}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full border-2 transition-all ${
            i < used
              ? 'bg-red-500 border-red-500'          // consumed
              : 'bg-emerald-400 border-emerald-400'  // remaining
          }`}
        />
      ))}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ percent, isPenalty }: { percent: number; isPenalty: boolean }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${
          isPenalty
            ? 'bg-red-500'
            : percent >= 80
            ? 'bg-amber-400'
            : 'bg-slate-400'
        }`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DeficitDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['deficit-dashboard', activeFilter],
    queryFn: () => loanApi.getDeficitDashboard({ filter: activeFilter }),
    refetchInterval: 60_000, // auto-refresh every 60s
  });

  const dashboard = data?.data as DashboardData | undefined;
  const loans: DeficitLoan[] = dashboard?.data || [];
  const summary = dashboard?.summary;

  // ── Penalty Mutation ─────────────────────────────────────────────────────────
  const penaltyMutation = useMutation({
    mutationFn: ({ id, penaltyAmountInPaise }: { id: string; penaltyAmountInPaise: number }) =>
      loanApi.applyPenalty(id, {
        penaltyAmountInPaise,
        reason: 'Missed-collection penalty: all lifelines exhausted',
      }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Penalty applied successfully');
      queryClient.invalidateQueries({ queryKey: ['deficit-dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to apply penalty');
    },
  });

  // ── Lifeline Reset Mutation ──────────────────────────────────────────────────
  const lifelineMutation = useMutation({
    mutationFn: ({
      id,
      resetType,
      value,
    }: {
      id: string;
      resetType: string;
      value?: number;
    }) => loanApi.resetLifelines(id, { resetType, value }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Lifelines updated');
      queryClient.invalidateQueries({ queryKey: ['deficit-dashboard'] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to update lifelines',
      );
    },
  });

  // ── Filters ──────────────────────────────────────────────────────────────────
  const filters = [
    { key: 'all', label: 'All At Risk' },
    { key: 'penalty_eligible', label: '🔴 Penalty Eligible' },
    { key: 'warning_1', label: '1st Warning' },
    { key: 'warning_2', label: '2nd Warning' },
  ];

  return (
    <div className="animate-fade-in animate-slide-up space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/loans')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            Pigmy Deficit Warning Dashboard
          </h1>
          <p className="page-subtitle">
            Customers behind on daily pigmy collection — lifeline warnings &amp; penalty management
          </p>
        </div>
      </div>

      {/* ── Info banner ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
        <p>
          <strong>How it works:</strong> Expected = business days elapsed × daily deposit amount.{' '}
          Actual = total applied to loan + pigmy balance. If customer is behind by ≥ 1 full day, a
          warning SMS is sent. After <strong>{summary?.maxWarnings ?? 3} warnings</strong>, admin
          can apply a penalty of <strong>₹{summary?.configuredPenaltyInRupees ?? '100'}</strong>.
          (Both values are configured by superadmin in AppConfig.)
        </p>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-l-red-500">
          <p className="text-sm text-slate-500 font-medium mb-1">Penalty Eligible</p>
          <p className="text-3xl font-bold text-red-600">
            {summary?.penaltyEligibleCount ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">All lifelines exhausted</p>
        </div>
        <div className="card p-5 border-l-4 border-l-amber-500">
          <p className="text-sm text-slate-500 font-medium mb-1">Active Warnings</p>
          <p className="text-3xl font-bold text-amber-600">
            {summary?.activeWarningsCount ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Still have lifelines remaining</p>
        </div>
        <div className="card p-5 border-l-4 border-l-slate-400">
          <p className="text-sm text-slate-500 font-medium mb-1">Total At Risk</p>
          <p className="text-3xl font-bold text-slate-700">{summary?.total ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Requires admin attention</p>
        </div>
      </div>

      {/* ── Filter Tabs ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              activeFilter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Loan Cards ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="card p-10 text-center text-slate-500">
          Loading deficit data...
        </div>
      ) : loans.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">All customers are on track!</p>
          <p className="text-sm text-slate-400 mt-1">No deficit warnings or penalty flags.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => {
            const isRed = loan.isPenaltyEligible;
            const isPending =
              (penaltyMutation.isPending && penaltyMutation.variables?.id === loan.loanId) ||
              (lifelineMutation.isPending && (lifelineMutation.variables as any)?.id === loan.loanId);

            return (
              <div
                key={loan.loanId}
                className={`card p-5 border-l-4 transition-all hover:shadow-md ${
                  isRed ? 'border-l-red-500' : 'border-l-amber-400'
                }`}
              >
                {/* Card header row */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 rounded-full p-2 mt-0.5 ${
                        isRed ? 'bg-red-100' : 'bg-amber-100'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-4 w-4 ${isRed ? 'text-red-600' : 'text-amber-600'}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-mono font-semibold text-blue-600 cursor-pointer hover:underline text-sm"
                          onClick={() => navigate(`/loans/${loan.loanId}`)}
                        >
                          {loan.loanAccountNumber}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            loan.status === 'overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {loan.status}
                        </span>
                        {isRed && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-semibold">
                            PENALTY ELIGIBLE
                          </span>
                        )}
                      </div>
                      <p
                        className="text-base font-semibold text-slate-800 mt-0.5 cursor-pointer hover:text-blue-600"
                        onClick={() => navigate(`/customers/${loan.customer?._id}`)}
                      >
                        {loan.customer?.name}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {loan.customer?.phone} · {loan.customer?.customerCode}
                      </p>
                    </div>
                  </div>

                  {/* Daily deposit badge */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">Daily Deposit</p>
                    <p className="text-lg font-bold text-slate-800">₹{loan.dailyDepositInRupees}</p>
                    <p className="text-xs text-slate-400">Day {loan.businessDaysElapsed}</p>
                  </div>
                </div>

                {/* Collection amounts */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Expected</p>
                    <p className="font-semibold text-slate-700">₹{loan.expectedInRupees}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Collected</p>
                    <p className="font-semibold text-slate-700">₹{loan.actualInRupees}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-0.5">Deficit</p>
                    <p className={`font-bold ${isRed ? 'text-red-600' : 'text-amber-600'}`}>
                      ₹{loan.deficitInRupees}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{loan.percentCollected}% collected</span>
                    <span>{100 - loan.percentCollected}% short</span>
                  </div>
                  <ProgressBar percent={loan.percentCollected} isPenalty={isRed} />
                </div>

                {/* Lifelines + warnings */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-medium">Lifelines:</span>
                      <LifelineDots
                        max={loan.maxWarnings}
                        remaining={loan.lifelinesRemaining}
                      />
                      <span className="text-xs text-slate-400">
                        {loan.lifelinesRemaining ?? loan.maxWarnings}/{loan.maxWarnings} remaining
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Warnings sent: {loan.totalWarningsSentCount}
                      {loan.lastDeficitWarningDate && (
                        <> · Last: {formatDate(loan.lastDeficitWarningDate)}</>
                      )}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Apply Penalty button — enabled ONLY when isPenaltyEligible */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!loan.isPenaltyEligible || isPending}
                      isLoading={penaltyMutation.isPending && penaltyMutation.variables?.id === loan.loanId}
                      className={
                        loan.isPenaltyEligible
                          ? 'text-red-600 border-red-300 hover:bg-red-50'
                          : 'text-slate-400 border-slate-200 cursor-not-allowed'
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `Apply ₹${loan.suggestedPenaltyInRupees} penalty to ${loan.customer?.name} (${loan.loanAccountNumber})?\n\nThis will charge the customer and reset their lifelines.`,
                          )
                        ) {
                          penaltyMutation.mutate({
                            id: loan.loanId,
                            penaltyAmountInPaise: loan.suggestedPenaltyInPaise,
                          });
                        }
                      }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      {loan.isPenaltyEligible
                        ? `Apply Penalty ₹${loan.suggestedPenaltyInRupees}`
                        : 'Penalty Locked'}
                    </Button>

                    {/* Reset (full) */}
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={lifelineMutation.isPending && (lifelineMutation.variables as any)?.id === loan.loanId && (lifelineMutation.variables as any)?.resetType === 'full'}
                      className="text-slate-600 hover:bg-slate-50"
                      title="Restore all lifelines to max"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Reset ${loan.customer?.name}'s lifelines to max (${loan.maxWarnings})?\n\nThis will also clear the penalty flag.`,
                          )
                        ) {
                          lifelineMutation.mutate({ id: loan.loanId, resetType: 'full' });
                        }
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Reset ({loan.maxWarnings})
                    </Button>

                    {/* Fine-grained −/+ */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500"
                        title="Decrement lifeline by 1"
                        disabled={(loan.lifelinesRemaining ?? loan.maxWarnings) <= 0}
                        onClick={() =>
                          lifelineMutation.mutate({
                            id: loan.loanId,
                            resetType: 'decrement',
                          })
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-sm font-mono font-semibold text-slate-700 w-5 text-center">
                        {loan.lifelinesRemaining ?? loan.maxWarnings}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500"
                        title="Increment lifeline by 1"
                        disabled={(loan.lifelinesRemaining ?? loan.maxWarnings) >= loan.maxWarnings}
                        onClick={() =>
                          lifelineMutation.mutate({
                            id: loan.loanId,
                            resetType: 'increment',
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
