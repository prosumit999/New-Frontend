// src/features/reports/AgentReportsHubPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Agent's personal reports hub — entry point for all agent-scoped reports.
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom';
import {
  PiggyBank, CreditCard, Receipt, Banknote, BarChart3,
  ChevronRight, TrendingUp, Activity
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { agentReportApi } from '../../api/agentReport.api';
import { formatCurrency } from '../../utils/format';

function ReportCard({ icon: Icon, title, desc, to, color }: {
  icon: React.ElementType; title: string; desc: string;
  to: string; color: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      id={`report-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={() => navigate(to)}
      className="group flex items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left w-full hover:shadow-lg hover:border-blue-200 transition-all duration-200"
    >
      <div className={`rounded-xl p-3 ${color} flex-shrink-0`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm">{title}</p>
        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
    </button>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`rounded-xl p-2.5 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xl font-bold text-slate-800 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AgentReportsHubPage() {
  // Quick stats from collection report
  const today = new Date().toISOString().split('T')[0];
  const { data: collData } = useQuery({
    queryKey: ['agent-report-coll-today', today],
    queryFn: () => agentReportApi.getCollectionReport({ fromDate: today, toDate: today, limit: 1 }),
    refetchOnWindowFocus: false,
  });
  const todaySummary = (collData?.data as any)?.data?.summary || (collData?.data as any)?.summary || {};

  const { data: pigmyData } = useQuery({
    queryKey: ['agent-report-pigmy-summary'],
    queryFn: () => agentReportApi.getPigmyReport({ limit: 1 }),
    refetchOnWindowFocus: false,
  });
  const pigmyPagination = (pigmyData?.data as any)?.data?.pagination || (pigmyData?.data as any)?.pagination || {};

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">
          View and export your pigmy collection reports
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Activity className="h-4 w-4 text-emerald-500" />
          <span>Agent Portal</span>
        </div>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="Today's Collection"
          value={formatCurrency(todaySummary.totalInPaise || 0)}
          sub={`${todaySummary.totalCount || 0} entries`}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <KpiCard
          icon={PiggyBank}
          label="Assigned Accounts"
          value={pigmyPagination.total || 0}
          sub="Active pigmy accounts"
          color="bg-gradient-to-br from-violet-500 to-violet-600"
        />
        <KpiCard
          icon={BarChart3}
          label="Collections Today"
          value={todaySummary.totalCount || 0}
          sub="Entries recorded"
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />
      </div>

      {/* Report Cards */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Available Reports</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReportCard
            icon={PiggyBank}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
            title="Pigmy Report"
            desc="Customer-wise pigmy account summary with collection stats and balances."
            to="/agent/reports/pigmy"
          />
          <ReportCard
            icon={Receipt}
            color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            title="Collection Report"
            desc="Date-wise collection register with receipt numbers and amounts. Exportable."
            to="/agent/reports/collections"
          />
          <ReportCard
            icon={Banknote}
            color="bg-gradient-to-br from-violet-500 to-violet-600"
            title="Deposit Report"
            desc="Your cash deposit history at office — with verification status and receipt details."
            to="/agent/reports/deposits"
          />
        </div>
      </div>
    </div>
  );
}
