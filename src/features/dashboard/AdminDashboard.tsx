// src/features/dashboard/AdminDashboard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Professional Admin Dashboard — Live KPIs from /reports/dashboard
// Auto-refreshes every 30 seconds.
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Landmark, IndianRupee, TrendingUp, TrendingDown,
  CalendarCheck, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Clock, Receipt, UserPlus, PiggyBank, Wallet,
  FileText, CalendarClock, Banknote, BarChart3,
  ShieldAlert, ChevronRight, Activity, Building2,
  CircleDollarSign, BadgeCheck, UserCheck, CreditCard,
  RefreshCw, Layers, AlertCircle, HandCoins, Eye, EyeOff
} from 'lucide-react';
import { useState } from 'react';
import { reportApi } from '../../api/report.api';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { useAuthStore } from '../../store/auth.store';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
  generatedAt: string;
  customers: {
    total: number;
    active: number;
    kycVerified: number;
    kycPending: number;
    newThisMonth: number;
  };
  pigmyAccounts: {
    totalAccounts: number;
    activeAccounts: number;
    frozenAccounts: number;
    closedAccounts: number;
    totalBalanceInPaise: number;
    totalBalanceInRupees: string;
  };
  todayCollection: {
    totalInPaise: number;
    totalInRupees: string;
    count: number;
    activeAgents: number;
    customersServed: number;
  };
  monthCollection: {
    totalInPaise: number;
    totalInRupees: string;
    count: number;
    momGrowthPercent: string | null;
    trend: string;
  };
  loans: {
    total: number;
    active: number;
    overdue: number;
    closed: number;
    writtenOff: number;
    totalDisbursedInRup: string;
    totalOutstandingInRup: string;
    totalRepaidInRup: string;
  };
  overdueAlert: {
    count: number;
    totalOutstandingInRup: string;
    totalPenaltyInRup: string;
  };
  recentActivity: {
    receipt: string;
    customer: string;
    agent: string;
    amountInRup: string;
    time: string;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatINR(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₹0';
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/60 p-5 animate-pulse ${className}`}>
      <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-28 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-32 bg-slate-100 rounded" />
    </div>
  );
}

// ─── KPI Stat Card ───────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, iconBg, iconColor, trend, trendValue, onClick
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  trend?: 'up' | 'down' | null;
  trendValue?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-blue-300 group' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${iconBg}`}>
          <Icon className={`h-5.5 w-5.5 ${iconColor}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}>
            {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 font-mono-nums">{value}</p>
      {sub && (
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          {sub}
          {onClick && <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-blue-500 transition-colors" />}
        </p>
      )}
    </div>
  );
}

// ─── Quick Action Button ─────────────────────────────────────────────────────
function QuickAction({
  icon: Icon, label, href, color, bgColor
}: {
  icon: any; label: string; href: string; color: string; bgColor: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(href)}
      className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-gradient-to-b hover:from-blue-50/50 hover:to-white transition-all duration-200 cursor-pointer group"
    >
      <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${bgColor} group-hover:scale-110 transition-transform duration-200`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <span className="text-xs font-medium text-slate-600 group-hover:text-blue-700 transition-colors text-center leading-tight">{label}</span>
    </button>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, action }: { icon: any; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ─── Mini Progress Bar ───────────────────────────────────────────────────────
function ProgressBar({ pct, color = 'bg-blue-500' }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  // ── Fetch dashboard KPIs ─────────────────────────────────────────────────
  const { data: dashRes, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => reportApi.getDashboard(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // ── Fetch cash & assets ──────────────────────────────────────────────────
  const { data: cashRes } = useQuery({
    queryKey: ['cash-position'],
    queryFn: () => reportApi.getCashPosition(),
    refetchInterval: 60_000,
  });

  const { data: tbRes } = useQuery({
    queryKey: ['trial-balance'],
    queryFn: () => reportApi.getTrialBalance(),
    refetchInterval: 60_000,
  });

  const [showCash, setShowCash] = useState(false);

  const d: DashboardData | null = dashRes?.data?.data || null;
  // Use the shared business date hook (single source of truth)
  const { isOpen: isDayOpen, businessDate: businessDateISO } = useBusinessDate();
  const businessDate = businessDateISO
    ? new Date(businessDateISO).toLocaleDateString('en-IN', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    })
    : '—';

  // MoM growth
  const momGrowth = d?.monthCollection.momGrowthPercent ? parseFloat(d.monthCollection.momGrowthPercent) : null;
  const momTrend = momGrowth !== null ? (momGrowth >= 0 ? 'up' : 'down') : null;

  // Loan repayment progress
  const totalDisbursed = parseFloat(d?.loans.totalDisbursedInRup || '0');
  const totalRepaid = parseFloat(d?.loans.totalRepaidInRup || '0');
  const repaymentPct = totalDisbursed > 0 ? Math.round((totalRepaid / totalDisbursed) * 100) : 0;

  // Cash & Assets extraction
  const cashData = (cashRes as any)?.data?.data;
  const cashTotal = cashData?.cashInHandInRupees || '0';
  
  const tbData = (tbRes as any)?.data?.data;
  const assets = tbData?.assets || [];
  const bankAccounts = assets.filter((a: any) => 
    a.accountCode !== '1001' && a.accountCode !== '1002' && !a.accountCode.startsWith('AGNT-')
  );

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // ── Loading State ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="page-header">
          <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────────────
  if (isError || !d) {
    return (
      <div className="animate-fade-in">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-red-800 mb-1">Failed to load dashboard</h2>
          <p className="text-sm text-red-600 mb-4">Please check your connection and try again.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">

      {/* ═══════ HEADER ═══════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here's what's happening with your institution today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Day Status Badge */}
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border ${isDayOpen
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
            <CalendarCheck className="h-3.5 w-3.5" />
            <span>{isDayOpen ? 'Day Open' : 'Day Closed'}</span>
            <span className="text-[10px] opacity-70 ml-1">{businessDate}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ═══════ DAY CLOSED WARNING ═══════════════════════════════════════ */}
      {!isDayOpen && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Business day is closed</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Collections, deposits, and loan disbursals are blocked until the day is opened.
            </p>
          </div>
          <button
            onClick={() => navigate('/day-control')}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors shrink-0"
          >
            Open Day
          </button>
        </div>
      )}

      {/* ═══════ KYC PENDING ALERT ════════════════════════════════════════ */}
      {d.customers.kycPending > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => navigate('/customers/kyc-pending')}
        >
          <ShieldAlert className="h-5 w-5 text-blue-500 shrink-0" />
          <p className="text-sm flex-1">
            <span className="font-semibold">{d.customers.kycPending} customer{d.customers.kycPending > 1 ? 's' : ''}</span> awaiting KYC verification
          </p>
          <ChevronRight className="h-4 w-4 text-blue-400" />
        </div>
      )}

      {/* ═══════ PRIMARY KPI CARDS ════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Customers"
          value={d.customers.total.toLocaleString('en-IN')}
          sub={`${d.customers.newThisMonth} new this month`}
          icon={Users}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          onClick={() => navigate('/customers')}
        />
        <KpiCard
          label="Active Loans"
          value={d.loans.active}
          sub={d.loans.overdue > 0 ? `⚠️ ${d.loans.overdue} overdue` : `${d.loans.closed} closed total`}
          icon={Landmark}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          onClick={() => navigate('/loans')}
        />
        <KpiCard
          label="Today's Collection"
          value={formatINR(d.todayCollection.totalInRupees)}
          sub={`${d.todayCollection.count} txns · ${d.todayCollection.activeAgents} agents active`}
          icon={IndianRupee}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          onClick={() => navigate('/collections/daily-summary')}
        />
        <KpiCard
          label="Month Collection"
          value={formatINR(d.monthCollection.totalInRupees)}
          sub={`${d.monthCollection.count} collections`}
          icon={TrendingUp}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          trend={momTrend as 'up' | 'down' | null}
          trendValue={momGrowth !== null ? `${Math.abs(momGrowth)}%` : undefined}
          onClick={() => navigate('/reports/operational')}
        />
      </div>

      {/* ═══════ FINANCIAL OVERVIEW — 3 Column ════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── Loan Portfolio Card ───────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
          onClick={() => navigate('/reports/loans')}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-100">
              <CreditCard className="h-4.5 w-4.5 text-purple-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Loan Portfolio</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Disbursed</span>
              <span className="font-semibold text-slate-800">{formatINR(d.loans.totalDisbursedInRup)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Outstanding</span>
              <span className="font-semibold text-red-600">{formatINR(d.loans.totalOutstandingInRup)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Repaid</span>
              <span className="font-semibold text-emerald-600">{formatINR(d.loans.totalRepaidInRup)}</span>
            </div>
            <div className="pt-1">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Repayment Progress</span>
                <span>{repaymentPct}%</span>
              </div>
              <ProgressBar pct={repaymentPct} color="bg-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100">
            {[
              { label: 'Active', val: d.loans.active, color: 'text-blue-600' },
              { label: 'Overdue', val: d.loans.overdue, color: 'text-red-600' },
              { label: 'Closed', val: d.loans.closed, color: 'text-slate-500' },
              { label: 'W/Off', val: d.loans.writtenOff, color: 'text-amber-600' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pigmy Deposits Card ──────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
          onClick={() => navigate('/pigmy')}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100">
              <PiggyBank className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Pigmy Deposits</h3>
          </div>

          <p className="text-3xl font-bold text-emerald-700 mb-1 font-mono-nums">
            {formatINR(d.pigmyAccounts.totalBalanceInRupees)}
          </p>
          <p className="text-xs text-slate-400 mb-4">Total pigmy balance held</p>

          <div className="space-y-2.5">
            {[
              { label: 'Active Accounts', val: d.pigmyAccounts.activeAccounts, dot: 'bg-emerald-500' },
              { label: 'Frozen Accounts', val: d.pigmyAccounts.frozenAccounts, dot: 'bg-blue-500' },
              { label: 'Closed Accounts', val: d.pigmyAccounts.closedAccounts, dot: 'bg-slate-400' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${row.dot}`} />
                  <span className="text-slate-500">{row.label}</span>
                </div>
                <span className="font-semibold text-slate-800">{row.val}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-400">Total Accounts</span>
            <span className="text-lg font-bold text-slate-700">{d.pigmyAccounts.totalAccounts}</span>
          </div>
        </div>

        {/* ── Overdue Alert Card ───────────────────────────────────────── */}
        <div
          className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ${d.overdueAlert.count > 0
              ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
              : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'
            }`}
          onClick={() => d.overdueAlert.count > 0 ? navigate('/loans/repayments') : navigate('/loans')}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${d.overdueAlert.count > 0 ? 'bg-red-100' : 'bg-emerald-100'
              }`}>
              {d.overdueAlert.count > 0
                ? <AlertTriangle className="h-4.5 w-4.5 text-red-600" />
                : <BadgeCheck className="h-4.5 w-4.5 text-emerald-600" />}
            </div>
            <h3 className={`text-sm font-semibold ${d.overdueAlert.count > 0 ? 'text-red-800' : 'text-emerald-800'}`}>
              {d.overdueAlert.count > 0 ? 'Overdue Loans' : 'Loans Healthy'}
            </h3>
          </div>

          {d.overdueAlert.count > 0 ? (
            <>
              <p className="text-4xl font-bold text-red-700 mb-1">{d.overdueAlert.count}</p>
              <p className="text-xs text-red-500 mb-4">loan{d.overdueAlert.count > 1 ? 's' : ''} past maturity date</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-red-500">Outstanding</span>
                  <span className="font-semibold text-red-800">{formatINR(d.overdueAlert.totalOutstandingInRup)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-red-500">Penalty Accrued</span>
                  <span className="font-semibold text-red-800">{formatINR(d.overdueAlert.totalPenaltyInRup)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold text-emerald-600 mb-1">0</p>
              <p className="text-xs text-emerald-600">
                All loans are within maturity. Great job!
              </p>
              <div className="mt-6">
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <BadgeCheck className="h-4 w-4" />
                  <span>No overdue loans in the portfolio</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════ CUSTOMER OVERVIEW STRIP ══════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers', val: d.customers.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'KYC Verified', val: d.customers.kycVerified, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'KYC Pending', val: d.customers.kycPending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'New This Month', val: d.customers.newThisMonth, icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((item) => (
          <div key={item.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${item.bg} border border-slate-100`}>
            <item.icon className={`h-5 w-5 ${item.color} shrink-0`} />
            <div>
              <p className="text-lg font-bold text-slate-800">{item.val}</p>
              <p className="text-[10px] text-slate-500 leading-none">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════ LIQUIDITY & ASSETS ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cash Position */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100">
                <Banknote className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Cash Position</h3>
            </div>
            <button onClick={() => setShowCash(!showCash)} className="text-slate-400 hover:text-amber-600 transition-colors">
              {showCash ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-2">
            <p className="text-xs text-slate-500 mb-1">Total Cash in Hand</p>
            <p className={`text-3xl font-bold font-mono-nums transition-all duration-300 ${showCash ? 'text-slate-900 blur-none' : 'text-slate-400 blur-sm select-none'}`}>
              {showCash ? formatINR(cashTotal) : '₹XX,XXX.XX'}
            </p>
          </div>
          <div className="mt-6 flex gap-2">
            <button onClick={() => navigate('/reports/financial')} className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors w-full text-center">
              View Detailed Cash Flow
            </button>
          </div>
        </div>

        {/* Bank & Asset Balances */}
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100">
              <Landmark className="h-4.5 w-4.5 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Bank & Asset Balances</h3>
          </div>
          <div className="space-y-3 mt-2 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
            {bankAccounts.length > 0 ? (
              bankAccounts.map((acc: any) => (
                <div key={acc.accountCode} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">{acc.accountName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{acc.accountCode}</span>
                  </div>
                  <span className={`font-semibold font-mono-nums ${acc.side === 'debit' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatINR(acc.netBalanceInRupees)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-slate-500 py-4">
                No bank accounts found in Trial Balance
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ BOTTOM ROW — Quick Actions + Recent Activity ════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Quick Actions (left 2 cols) ──────────────────────────────── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <SectionHeader icon={Layers} title="Quick Actions" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
            <QuickAction icon={HandCoins} label="Record Collection" href="/collections/record" color="text-emerald-600" bgColor="bg-emerald-100" />
            <QuickAction icon={UserPlus} label="New Customer" href="/customers/new" color="text-blue-600" bgColor="bg-blue-100" />
            <QuickAction icon={Wallet} label="New Saving" href="/savings/new" color="text-indigo-600" bgColor="bg-indigo-100" />
            <QuickAction icon={PiggyBank} label="New Pigmy" href="/pigmy/new" color="text-teal-600" bgColor="bg-teal-100" />
            <QuickAction icon={Banknote} label="Disburse Loan" href="/loans/new" color="text-purple-600" bgColor="bg-purple-100" />
            <QuickAction icon={CalendarClock} label="Day Control" href="/day-control" color="text-amber-600" bgColor="bg-amber-100" />
            <QuickAction icon={CircleDollarSign} label="Agent Deposits" href="/agent-deposits" color="text-orange-600" bgColor="bg-orange-100" />
            <QuickAction icon={BarChart3} label="Reports Hub" href="/reports" color="text-slate-600" bgColor="bg-slate-100" />
          </div>
        </div>

        {/* ── Recent Activity (right 3 cols) ───────────────────────────── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <SectionHeader
            icon={Activity}
            title="Recent Collections"
            action={
              <button
                onClick={() => navigate('/collections')}
                className="text-xs text-blue-600 font-medium hover:text-blue-800 flex items-center gap-0.5 transition-colors"
              >
                View All <ChevronRight className="h-3 w-3" />
              </button>
            }
          />

          {d.recentActivity.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Receipt</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Agent</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentActivity.map((item, idx) => (
                    <tr key={idx} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-blue-600 font-medium">{item.receipt}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700 font-medium truncate max-w-[120px]">{item.customer || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell">{item.agent || '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs font-semibold text-emerald-700 font-mono-nums">₹{item.amountInRup}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-400 hidden md:table-cell">
                        {relativeTime(item.time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Receipt className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">No recent collections</p>
              <p className="text-xs">Collections will appear here once agents start collecting.</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ COLLECTION TARGET INSIGHT ════════════════════════════════ */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-5 w-5 text-blue-200" />
              <h3 className="text-sm font-semibold text-blue-100">Collection Snapshot</h3>
            </div>
            <p className="text-3xl font-bold font-mono-nums">{formatINR(d.todayCollection.totalInRupees)}</p>
            <p className="text-xs text-blue-200 mt-1">
              collected today from {d.todayCollection.customersServed} customers by {d.todayCollection.activeAgents} agent{d.todayCollection.activeAgents !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold font-mono-nums">{d.todayCollection.count}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-wider">Transactions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono-nums">{d.todayCollection.activeAgents}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-wider">Active Agents</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono-nums">{d.todayCollection.customersServed}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-wider">Customers</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ FOOTER META ═════════════════════════════════════════════ */}
      <p className="text-center text-[10px] text-slate-300">
        Dashboard data last synced at {new Date(d.generatedAt).toLocaleTimeString('en-IN')} · Auto-refreshes every 30s
      </p>

    </div>
  );
}
