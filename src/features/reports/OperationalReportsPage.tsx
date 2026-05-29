// src/features/reports/OperationalReportsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Data path for all reportApi calls:
//   data (useQuery result) = axios response
//   data.data              = ApiResponse { success, statusCode, data: payload, message }
//   data.data.data         = actual service payload
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft, Users, Briefcase, Wallet, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, TrendingUp, Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../../api/report.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { useEffect } from 'react';

const fmtRup = (v: string | number | undefined | null) => {
  const n = parseFloat(String(v ?? '0'));
  if (isNaN(n)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
};

const KYC_LABELS: Record<string, { label: string; color: string }> = {
  kyc_verified:         { label: 'Verified',          color: 'bg-emerald-100 text-emerald-700' },
  documents_submitted:  { label: 'Docs Submitted',    color: 'bg-blue-100 text-blue-700' },
  pending:              { label: 'Pending',            color: 'bg-amber-100 text-amber-700' },
  rejected:             { label: 'Rejected',           color: 'bg-red-100 text-red-700' },
};

// ── Date range defaults
const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
const today = format(new Date(), 'yyyy-MM-dd');

// ─────────────────────────────────────────────────────────────────────────────
export default function OperationalReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'agent' | 'collection' | 'customer'>('agent');

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 page-header mb-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Operational Reports</h1>
          <p className="page-subtitle">Agent performance, collections, and customer analytics</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit gap-1">
        {([
          { id: 'agent', label: 'Agent Performance', icon: Briefcase, color: 'blue' },
          { id: 'collection', label: 'Collections', icon: Wallet, color: 'emerald' },
          { id: 'customer', label: 'Customers', icon: Users, color: 'purple' },
        ] as const).map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all ${
              activeTab === id
                ? color === 'blue' ? 'bg-blue-600 text-white shadow-sm' :
                  color === 'emerald' ? 'bg-emerald-600 text-white shadow-sm' :
                  'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'agent'      && <AgentPerformanceView />}
        {activeTab === 'collection' && <CollectionReportView />}
        {activeTab === 'customer'   && <CustomerReportView />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AGENT PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────
function AgentPerformanceView() {
  const { businessDate: globalBusinessDate } = useBusinessDate();

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(globalBusinessDate || new Date());
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(globalBusinessDate || new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (globalBusinessDate && !fromDate.includes(globalBusinessDate.substring(0, 7))) {
       const d = new Date(globalBusinessDate);
       d.setDate(1);
       setFromDate(d.toISOString().split('T')[0]);
       setToDate(globalBusinessDate);
    }
  }, [globalBusinessDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-performance', fromDate, toDate],
    queryFn: () => reportApi.getAgentPerformance({ fromDate, toDate }),
  });

  const payload = (data as any)?.data?.data;
  const agents: any[] = payload?.performance || [];
  const period = payload?.period;

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="card">
        <div className="card-body flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Period:
          </div>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="form-input py-2 text-sm" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="form-input py-2 text-sm" />
          {period && (
            <span className="text-xs text-slate-400 ml-auto">
              {period.from} — {period.to} · {payload?.totalAgents} agents
            </span>
          )}
        </div>
      </div>

      {/* Agent Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card animate-pulse"><div className="card-body h-32 bg-slate-50 rounded" /></div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12 text-slate-400">
            <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No agent data for this period</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent: any, idx: number) => {
            const collRate = parseFloat(agent.collections?.collectionRate ?? '0');
            const attRate  = parseFloat(agent.period?.attendanceRate ?? '0%');
            const isTopPerformer = idx === 0;

            return (
              <div key={agent.agentId} className={`card overflow-hidden ${isTopPerformer ? 'border-2 border-emerald-200' : ''}`}>
                {isTopPerformer && (
                  <div className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 text-center">
                    ⭐ Top Performer
                  </div>
                )}
                <div className="card-body space-y-3">
                  {/* Agent Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{agent.name}</p>
                      <p className="text-xs text-slate-400">{agent.agentCode} · {agent.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Collection Rate</p>
                      <p className={`text-xl font-extrabold ${collRate >= 80 ? 'text-emerald-600' : collRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {agent.collections?.collectionRate ?? '0%'}
                      </p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 font-semibold">Accounts</p>
                      <p className="text-lg font-bold text-blue-800">{agent.assignedAccounts ?? 0}</p>
                    </div>
                    <div className="text-center p-2 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-emerald-600 font-semibold">Collected</p>
                      <p className="text-lg font-bold text-emerald-800">{agent.collections?.count ?? 0}</p>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded-lg">
                      <p className="text-xs text-amber-600 font-semibold">Working Days</p>
                      <p className="text-lg font-bold text-amber-800">
                        {agent.period?.workingDays ?? 0}/{agent.period?.totalDays ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                    <div>
                      <p className="text-xs text-slate-500">Total Collected</p>
                      <p className="text-base font-bold text-slate-800">
                        {formatCurrency(agent.collections?.totalInPaise ?? 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Expected</p>
                      <p className="text-base font-bold text-slate-400">{fmtRup(agent.collections?.expectedInRup)}</p>
                    </div>
                  </div>

                  {/* Collection Rate Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Collection Rate</span>
                      <span className="font-semibold">{agent.collections?.collectionRate ?? '0%'}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          collRate >= 80 ? 'bg-emerald-500' : collRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(collRate, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Attendance Rate */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    Attendance: <span className="font-semibold text-slate-700">{agent.period?.attendanceRate ?? '0%'}</span>
                    · Customers served: <span className="font-semibold text-slate-700">{agent.collections?.customersServed ?? 0}</span>
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. COLLECTION REPORT
// ─────────────────────────────────────────────────────────────────────────────
function CollectionReportView() {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate]     = useState(today);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data, isLoading } = useQuery({
    queryKey: ['collection-report', fromDate, toDate],
    queryFn: () => reportApi.getCollectionReport({ fromDate, toDate }),
  });

  const payload       = (data as any)?.data?.data;
  const summary       = payload?.summary;
  const daily:  any[] = payload?.dailyBreakdown  || [];
  const byAgent: any[] = payload?.agentBreakdown || [];
  const period        = payload?.period;

  const maxDayPaise = daily.length > 0 ? Math.max(...daily.map((d: any) => d.totalInPaise || 0)) : 1;

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="card">
        <div className="card-body flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-slate-600">Period:</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input py-2 text-sm" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-input py-2 text-sm" />
          {period && <span className="text-xs text-slate-400 ml-auto">{period.from} — {period.to}</span>}
        </div>
      </div>

      {/* Summary KPIs */}
      {!isLoading && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Collected', value: formatCurrency(summary.totalInPaise ?? 0), color: 'emerald' },
            { label: 'Transactions', value: summary.totalCollections ?? 0, color: 'blue' },
            { label: 'Customers Served', value: summary.uniqueCustomers ?? 0, color: 'purple' },
            { label: 'Active Agents', value: summary.uniqueAgents ?? 0, color: 'amber' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl border p-4 ${
              color === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
              color === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-700' :
              color === 'purple' ? 'bg-purple-50 border-purple-100 text-purple-700' :
              'bg-amber-50 border-amber-100 text-amber-700'
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
              <p className="text-xl font-extrabold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily Breakdown */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> Daily Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Count</th>
                <th className="text-right">Agents</th>
                <th className="text-right">Amount</th>
                <th className="w-32">Bar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-10">Loading…</td></tr>
              ) : daily.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No collections in this range</td></tr>
              ) : (
                daily.map((row: any, i: number) => {
                  const pct = maxDayPaise > 0 ? Math.round((row.totalInPaise / maxDayPaise) * 100) : 0;
                  return (
                    <tr key={i}>
                      <td className="font-medium text-slate-700">{formatDate(row.date)}</td>
                      <td className="text-right">{row.count}</td>
                      <td className="text-right text-slate-500">{row.agentCount ?? '—'}</td>
                      <td className="text-right font-semibold text-slate-900">{formatCurrency(row.totalInPaise ?? 0)}</td>
                      <td>
                        <div className="h-2 bg-slate-100 rounded-full">
                          <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Agent Breakdown (admin only) */}
      {isAdmin && byAgent.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800">Agent Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="text-right">Customers</th>
                  <th className="text-right">Collections</th>
                  <th className="text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {byAgent.map((a: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <p className="font-medium text-slate-900">{a.agentName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{a.agentCode ?? '—'}</p>
                    </td>
                    <td className="text-right">{a.customersServed ?? 0}</td>
                    <td className="text-right">{a.count ?? 0}</td>
                    <td className="text-right font-semibold text-blue-700">{formatCurrency(a.totalInPaise ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CUSTOMER REPORT
// ─────────────────────────────────────────────────────────────────────────────
function CustomerReportView() {
  const [page, setPage]       = useState(1);
  const [kyc,  setKyc]        = useState('');
  const [search, setSearch]   = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-report', page, kyc],
    queryFn: () => reportApi.getCustomerReport({ page, limit: 25, kycStatus: kyc || undefined }),
  });

  const payload    = (data as any)?.data?.data;
  const customers: any[] = (payload?.customers || []).filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.customerCode?.toLowerCase().includes(search.toLowerCase())
  );
  const pagination = payload?.pagination;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="card-body flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or code…"
              className="form-input pl-9 py-2 text-sm w-full"
            />
          </div>
          <select value={kyc} onChange={(e) => { setKyc(e.target.value); setPage(1); }}
            className="form-input py-2 text-sm">
            <option value="">All KYC Statuses</option>
            <option value="kyc_verified">Verified</option>
            <option value="documents_submitted">Docs Submitted</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          {pagination && (
            <span className="text-xs text-slate-400 ml-auto">
              {pagination.total} customers · Page {pagination.page}/{pagination.totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Code</th>
                <th>Phone</th>
                <th>KYC Status</th>
                <th>Assigned Agent</th>
                <th>Joined</th>
                <th className="text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10">Loading…</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No customers found</td></tr>
              ) : (
                customers.map((c: any) => {
                  const kycInfo = KYC_LABELS[c.kycStatus] ?? { label: c.kycStatus, color: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={c._id}>
                      <td className="font-medium text-slate-900">{c.name}</td>
                      <td className="font-mono text-xs text-blue-600">{c.customerCode}</td>
                      <td className="text-slate-500 text-sm">{c.phone}</td>
                      <td>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${kycInfo.color}`}>
                          {kycInfo.label}
                        </span>
                      </td>
                      <td className="text-sm text-slate-600">
                        {c.assignedAgent?.name ?? '—'}
                        {c.assignedAgent?.agentCode && (
                          <span className="text-xs text-slate-400 ml-1">({c.assignedAgent.agentCode})</span>
                        )}
                      </td>
                      <td className="text-slate-500 text-sm">{formatDate(c.createdAt)}</td>
                      <td className="text-center">
                        {c.isActive
                          ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                          : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
