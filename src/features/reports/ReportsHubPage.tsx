// src/features/reports/ReportsHubPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, FileText, TrendingUp, Users, BookOpen, Search,
  ArrowRight, Wallet, ReceiptText, PiggyBank, FileBarChart2,
  CreditCard, Download, Activity, ShieldCheck, Layers, ChevronRight
} from 'lucide-react';
import { reportApi } from '../../api/report.api';
import { customerApi } from '../../api/customer.api';
import { formatCurrency } from '../../utils/format';
import { useSystemStore } from '../../store/system.store';

// ── Helpers ────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow`}>
      <div className={`rounded-xl p-2.5 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ReportCard({ icon: Icon, title, desc, to, badge, color }: {
  icon: React.ElementType; title: string; desc: string;
  to: string; badge?: string; color: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="group flex items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left w-full hover:shadow-lg hover:border-blue-200 transition-all duration-200"
    >
      <div className={`rounded-xl p-3 ${color} flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          {badge && (
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full uppercase">{badge}</span>
          )}
        </div>
        <p className="text-xs text-slate-400 line-clamp-2">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
    </button>
  );
}

// ── Customer Lookup Sidebar ────────────────────────────────
function CustomerLookup() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const { data: searchRes, isLoading } = useQuery({
    queryKey: ['customer-search-reports', search],
    queryFn: () => customerApi.list({ search, limit: 8 }),
    enabled: search.length >= 2,
  });
  const customers: any[] = (searchRes as any)?.data?.customers || (searchRes as any)?.customers || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-white/20 rounded-xl p-2">
            <Search className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">Customer Account Lookup</p>
            <p className="text-blue-100 text-xs">Search to view account statements</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300" />
          <input
            id="customer-lookup-search"
            type="text"
            placeholder="Name, phone, or code..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null); }}
            className="w-full bg-white/20 text-white placeholder-blue-200 border border-white/30 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:bg-white/30 focus:ring-2 focus:ring-white/50"
          />
        </div>
      </div>

      {/* Results */}
      <div className="p-4">
        {search.length >= 2 && !selected && (
          <div>
            {isLoading && (
              <div className="text-center py-4 text-slate-400 text-sm">Searching...</div>
            )}
            {!isLoading && customers.length === 0 && (
              <p className="text-center py-4 text-slate-400 text-sm">No customers found</p>
            )}
            <div className="space-y-1.5">
              {customers.map((c: any) => (
                <button
                  key={c._id}
                  onClick={() => { setSelected(c); setSearch(c.name); }}
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 hover:bg-blue-50 rounded-xl transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-700">
                      {c.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.customerCode} · {c.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="space-y-3">
            {/* Customer card */}
            <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">
                  {selected.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 text-sm truncate">{selected.name}</p>
                <p className="text-xs text-slate-400">{selected.customerCode}</p>
              </div>
              <button
                onClick={() => { setSelected(null); setSearch(''); }}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >✕</button>
            </div>

            {/* Statement links */}
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Open Statement</p>
            <button
              onClick={() => navigate(`/reports/customer-accounts?customerId=${selected._id}&tab=saving`)}
              className="flex items-center gap-3 w-full bg-emerald-50 hover:bg-emerald-100 rounded-xl px-4 py-3 transition-colors"
            >
              <Wallet className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Saving Account Statement</span>
              <ArrowRight className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
            </button>
            <button
              onClick={() => navigate(`/reports/customer-accounts?customerId=${selected._id}&tab=pigmy`)}
              className="flex items-center gap-3 w-full bg-blue-50 hover:bg-blue-100 rounded-xl px-4 py-3 transition-colors"
            >
              <PiggyBank className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Pigmy Account Statement</span>
              <ArrowRight className="h-3.5 w-3.5 text-blue-500 ml-auto" />
            </button>
            <button
              onClick={() => navigate(`/reports/customer-accounts?customerId=${selected._id}&tab=loan`)}
              className="flex items-center gap-3 w-full bg-amber-50 hover:bg-amber-100 rounded-xl px-4 py-3 transition-colors"
            >
              <CreditCard className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">Loan Account Statement</span>
              <ArrowRight className="h-3.5 w-3.5 text-amber-500 ml-auto" />
            </button>
            <button
              onClick={() => navigate(`/reports/customer-accounts?customerId=${selected._id}&tab=overview`)}
              className="flex items-center gap-3 w-full bg-slate-100 hover:bg-slate-200 rounded-xl px-4 py-3 transition-colors"
            >
              <Users className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-700">Full Customer Overview</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 ml-auto" />
            </button>
          </div>
        )}

        {search.length < 2 && !selected && (
          <div className="text-center py-6">
            <Search className="h-8 w-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Type at least 2 characters to search</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────
export default function ReportsHubPage() {
  const branding = useSystemStore(s => s.branding);

  const { data: dashRes, isLoading } = useQuery({
    queryKey: ['report-dashboard'],
    queryFn: reportApi.getDashboard,
    refetchOnWindowFocus: false,
  });
  const dash = (dashRes?.data as any)?.data ?? (dashRes?.data as any) ?? {};

  const pigmyAccs  = dash.pigmyAccounts || {};
  const loanStats  = dash.loanPortfolio || {};
  const todayColl  = dash.todayCollection || {};
  const monthColl  = dash.monthCollection || {};
  const customers  = dash.customers || {};

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports Hub</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {branding?.institution?.name || 'Microfinance Institution'} — Analytics & Statements
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Activity className="h-4 w-4 text-emerald-500" />
          <span>Live data</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingUp} label="Today's Collection"
          value={isLoading ? '—' : formatCurrency(todayColl.totalInPaise || 0)}
          sub={`${todayColl.count || 0} collections`}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <KpiCard
          icon={BarChart3} label="Month Collection"
          value={isLoading ? '—' : formatCurrency(monthColl.totalInPaise || 0)}
          sub={monthColl.momGrowthPercent ? `${monthColl.momGrowthPercent}% vs last month` : undefined}
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />
        <KpiCard
          icon={PiggyBank} label="Active Pigmy Accounts"
          value={isLoading ? '—' : (pigmyAccs.activeAccounts || 0)}
          sub={formatCurrency(pigmyAccs.totalBalanceInPaise || 0) + ' corpus'}
          color="bg-gradient-to-br from-violet-500 to-violet-600"
        />
        <KpiCard
          icon={CreditCard} label="Active Loans"
          value={isLoading ? '—' : (loanStats.activeLoans || loanStats.active || 0)}
          sub={formatCurrency(loanStats.totalOutstandingInPaise || 0) + ' outstanding'}
          color="bg-gradient-to-br from-amber-500 to-amber-600"
        />
        <KpiCard
          icon={Users} label="Total Customers"
          value={isLoading ? '—' : (customers.total || 0)}
          sub={`${customers.kycVerified || 0} KYC verified`}
          color="bg-gradient-to-br from-pink-500 to-pink-600"
        />
        <KpiCard
          icon={ShieldCheck} label="Overdue Loans"
          value={isLoading ? '—' : (loanStats.overdueLoans || 0)}
          sub="Requires attention"
          color="bg-gradient-to-br from-red-500 to-red-600"
        />
        <KpiCard
          icon={Wallet} label="Agents Active Today"
          value={isLoading ? '—' : (todayColl.activeAgents || 0)}
          sub={`${todayColl.customersServed || 0} customers served`}
          color="bg-gradient-to-br from-cyan-500 to-cyan-600"
        />
        <KpiCard
          icon={FileBarChart2} label="Month Collections"
          value={isLoading ? '—' : (monthColl.count || 0)}
          sub="Total entries"
          color="bg-gradient-to-br from-indigo-500 to-indigo-600"
        />
      </div>

      {/* Report Categories + Lookup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Report Grid */}
        <div className="lg:col-span-2 space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Report Categories</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReportCard
              icon={CreditCard} color="bg-gradient-to-br from-amber-500 to-amber-600"
              title="Loan Portfolio"
              desc="Loan-by-loan register with disbursement, outstanding, overdue and penalty details."
              to="/reports/loans"
            />
            <ReportCard
              icon={TrendingUp} color="bg-gradient-to-br from-emerald-500 to-emerald-600"
              title="Financial Reports"
              desc="Trial balance, P&L statement, cash position and ledger-wise account history."
              to="/reports/financial"
            />
            <ReportCard
              icon={ReceiptText} color="bg-gradient-to-br from-indigo-500 to-indigo-600"
              title="Daily Transactions"
              desc="All transactions recorded on a given business date — filterable by type."
              to="/reports/daily-transactions"
            />
            <ReportCard
              icon={BookOpen} color="bg-gradient-to-br from-pink-500 to-pink-600"
              title="Customer Account Reports"
              desc="Saving passbook, pigmy collection register and loan repayment schedule per customer."
              to="/reports/customer-accounts"
              badge="New"
            />
          </div>
        </div>

        {/* Right: Customer Lookup */}
        <div className="lg:col-span-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Account Lookup</p>
          <CustomerLookup />
        </div>
      </div>
    </div>
  );
}
