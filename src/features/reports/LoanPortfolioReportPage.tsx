// src/features/reports/LoanPortfolioReportPage.tsx

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp, AlertTriangle, BarChart3, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { reportApi } from '../../api/report.api';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../utils/format';
import { useSystemStore } from '../../store/system.store';
import { exportReportPDF, exportReportCSV } from '../../utils/reportExport';
import { loanApi } from '../../api/loan.api';
import { Download } from 'lucide-react';
import { ReportInstitutionHeader } from '../../components/shared/ReportInstitutionHeader';

// Rupee string → formatted display
const fmtRup = (v: string | number | undefined | null) => {
  const n = parseFloat(String(v ?? '0'));
  if (isNaN(n)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
};

const AGING_COLORS: Record<string, { badge: string; bar: string }> = {
  '0-30 days': { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  '31-60 days': { badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
  '61-90 days': { badge: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
  '90+ days (NPA)': { badge: 'bg-red-200 text-red-900', bar: 'bg-red-800' },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function LoanPortfolioReportPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'portfolio' | 'overdue' | 'register'>('portfolio');

  return (
    <div className="animate-fade-in space-y-6">
      <ReportInstitutionHeader
        reportTitle="Loan Portfolio Analytics"
        subInfo="Portfolio health, NPA analysis, and overdue aging"
      />

      <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit gap-1">
        {([
          { id: 'portfolio', label: 'Portfolio Overview', icon: TrendingUp },
          { id: 'overdue', label: 'Overdue Analysis', icon: AlertTriangle },
          { id: 'register', label: 'Loan Register', icon: BarChart3 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all ${activeTab === id
                ? id === 'portfolio' ? 'bg-blue-600 text-white shadow-sm' : id === 'overdue' ? 'bg-red-600 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'portfolio' && <PortfolioOverviewView />}
        {activeTab === 'overdue' && <OverdueAnalysisView />}
        {activeTab === 'register' && <LoanRegisterView />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function PortfolioOverviewView() {
  const branding = useSystemStore(s => s.branding);
  const { data, isLoading } = useQuery({
    queryKey: ['loan-portfolio'],
    queryFn: () => reportApi.getLoanPortfolio(),
  });

  const pd = (data as any)?.data?.data as any;
  const byStatus = pd?.byStatus || {};
  const byPlan: any[] = pd?.byPlan || [];
  const trend: any[] = pd?.disbursementTrend || [];
  const npaRatio = pd?.npaRatio || '0.00%';
  const npaNum = parseFloat(npaRatio);

  const statuses = [
    { key: 'active', label: 'Active', color: 'blue' },
    { key: 'overdue', label: 'Overdue', color: 'red' },
    { key: 'closed', label: 'Closed', color: 'emerald' },
    { key: 'written_off', label: 'Written Off', color: 'slate' },
  ];

  const handleExport = (fmt: 'pdf' | 'csv') => {
    if (!pd) return;
    const rows = byPlan.map((plan: any) => ({
      planName: plan.planName ?? '—',
      duration: `${plan.durationMonths ?? '—'} mo`,
      count: plan.count,
      principal: `Rs. ${parseFloat(plan.totalPrincipalInRup || '0').toFixed(2)}`,
      outstanding: `Rs. ${parseFloat(plan.totalOutstandingInRup || '0').toFixed(2)}`
    }));
    const cols = [
      { header: 'Plan Name', dataKey: 'planName' },
      { header: 'Duration', dataKey: 'duration', width: 25 },
      { header: 'Loans', dataKey: 'count', align: 'right' as const, width: 20 },
      { header: 'Principal', dataKey: 'principal', align: 'right' as const, width: 35 },
      { header: 'Outstanding', dataKey: 'outstanding', align: 'right' as const, width: 35 },
    ];
    const summary = [
      { label: 'Active Loans', value: (byStatus['active']?.count ?? 0).toString() },
      { label: 'Overdue Loans', value: (byStatus['overdue']?.count ?? 0).toString() },
      { label: 'NPA Ratio', value: npaRatio },
    ];
    const opts = {
      title: 'Loan Portfolio Plan Breakdown',
      subtitle: `Generated: ${new Date().toLocaleString('en-IN')}`,
      filename: 'loan_portfolio_plans',
      columns: cols, rows, summary, branding,
    };
    if (fmt === 'pdf') exportReportPDF({ ...opts, orientation: 'portrait' });
    else exportReportCSV(opts);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* NPA Ratio Banner */}
      {pd && (
        <div className={`rounded-2xl p-5 border-2 flex items-center gap-5 ${npaNum > 10 ? 'bg-red-50 border-red-200' :
            npaNum > 5 ? 'bg-amber-50 border-amber-200' :
              'bg-emerald-50 border-emerald-200'
          }`}>
          {npaNum <= 5
            ? <CheckCircle className="h-10 w-10 text-emerald-500 shrink-0" />
            : <AlertTriangle className="h-10 w-10 text-red-500 shrink-0" />}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">NPA Ratio (Overdue / Active+Overdue)</p>
            <p className={`text-4xl font-extrabold mt-0.5 ${npaNum > 10 ? 'text-red-700' : npaNum > 5 ? 'text-amber-700' : 'text-emerald-700'
              }`}>{npaRatio}</p>
            <p className="text-xs text-slate-400 mt-1">
              {npaNum <= 5 ? 'Healthy portfolio' : npaNum <= 10 ? 'Monitor closely' : 'Action required — high NPA'}
            </p>
          </div>
          <p className="ml-auto text-xs text-slate-400">Generated {pd.generatedAt ? new Date(pd.generatedAt).toLocaleString('en-IN') : '—'}</p>
        </div>
      )}

      {/* Status Breakdown Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statuses.map(({ key, label, color }) => {
          const s = byStatus[key] || {};
          const colorMap: Record<string, string> = {
            blue: 'bg-blue-50 border-blue-200 text-blue-700',
            red: 'bg-red-50 border-red-200 text-red-700',
            emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
            slate: 'bg-slate-50 border-slate-200 text-slate-700',
          };
          return (
            <div key={key} className={`rounded-2xl border p-5 ${colorMap[color]}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-2">{label}</p>
              <p className="text-3xl font-extrabold mb-2">{s.count ?? 0}</p>
              <div className="space-y-1 text-xs opacity-80">
                <p>Principal: {fmtRup(s.principalInRupees)}</p>
                <p>Outstanding: {fmtRup(s.outstandingInRupees)}</p>
                {key !== 'closed' && <p>Repaid: {fmtRup(s.repaidInRupees)}</p>}
                {key === 'overdue' && <p>Penalty: {fmtRup(s.penaltyInRupees)}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan Breakdown */}
      {byPlan.length > 0 && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" /> Active Loans by Plan
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <Download className="h-4 w-4 mr-1.5" /> CSV
              </Button>
              <Button size="sm" onClick={() => handleExport('pdf')}>
                <Download className="h-4 w-4 mr-1.5" /> PDF
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan Name</th>
                  <th className="text-center">Duration</th>
                  <th className="text-right">Loans</th>
                  <th className="text-right">Principal</th>
                  <th className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {byPlan.map((plan: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium text-slate-900">{plan.planName ?? '—'}</td>
                    <td className="text-center text-slate-500">{plan.durationMonths ?? '—'} mo</td>
                    <td className="text-right font-semibold">{plan.count}</td>
                    <td className="text-right">{fmtRup(plan.totalPrincipalInRup)}</td>
                    <td className="text-right font-semibold text-amber-700">{fmtRup(plan.totalOutstandingInRup)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disbursement Trend (6-month table) */}
      {trend.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800">Monthly Disbursement Trend (Last 6 Months)</h2>
          </div>
          <div className="card-body grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {trend.map((t: any, i: number) => {
              const monthName = new Date(t.year, t.month - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
              const maxTrend = Math.max(...trend.map((x: any) => x.totalInRupees || 0), 1);
              const pct = Math.round(((t.totalInRupees || 0) / maxTrend) * 100);
              return (
                <div key={i} className="text-center">
                  <div className="flex flex-col items-center mb-2">
                    <div className="h-20 w-10 bg-slate-100 rounded-full flex flex-col-reverse overflow-hidden">
                      <div className="bg-blue-500 rounded-full transition-all" style={{ height: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold">{monthName}</p>
                  <p className="text-xs font-bold text-slate-800">{t.count} loans</p>
                  <p className="text-xs text-blue-600">{fmtRup(t.totalInRupees)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERDUE ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
function OverdueAnalysisView() {
  const branding = useSystemStore(s => s.branding);
  const { data, isLoading } = useQuery({
    queryKey: ['loan-overdue'],
    queryFn: () => reportApi.getOverdueReport(),
  });

  const payload = (data as any)?.data?.data as any;
  const overdueLoans: any[] = payload?.overdueLoans || [];
  const agingSummary: any[] = payload?.agingSummary || [];
  const totalOutstanding = payload?.totalOutstandingInRupees;
  const totalCount = payload?.totalOverdue ?? 0;

  const maxAgingCount = agingSummary.length > 0 ? Math.max(...agingSummary.map((a: any) => a.count || 0), 1) : 1;

  const handleExport = (fmt: 'pdf' | 'csv') => {
    if (!overdueLoans || overdueLoans.length === 0) return;
    const rows = overdueLoans.map((loan: any) => ({
      accNo: loan.loanAccountNumber,
      customer: loan.customer?.name ?? '—',
      phone: loan.customer?.phone ?? '—',
      maturityDate: formatDate(loan.maturityDate),
      daysOverdue: `${loan.daysOverdue} days`,
      aging: loan.aging,
      outstanding: `Rs. ${parseFloat(loan.outstandingInRupees || '0').toFixed(2)}`,
      penalty: `Rs. ${parseFloat(loan.penaltyInRupees || '0').toFixed(2)}`,
    }));
    const cols = [
      { header: 'Account No', dataKey: 'accNo', width: 22 },
      { header: 'Customer', dataKey: 'customer' },
      { header: 'Phone', dataKey: 'phone', width: 25 },
      { header: 'Days Overdue', dataKey: 'daysOverdue', align: 'center' as const, width: 22 },
      { header: 'Outstanding', dataKey: 'outstanding', align: 'right' as const, width: 30 },
      { header: 'Penalty', dataKey: 'penalty', align: 'right' as const, width: 30 },
    ];
    const summary = [
      { label: 'Total Overdue Loans', value: totalCount.toString() },
      { label: 'Total Outstanding', value: fmtRup(totalOutstanding) },
    ];
    const opts = {
      title: 'Overdue Loans Analysis',
      subtitle: `As of ${new Date().toLocaleString('en-IN')}`,
      filename: 'overdue_loans',
      columns: cols, rows, summary, branding,
    };
    if (fmt === 'pdf') exportReportPDF({ ...opts, orientation: 'landscape' });
    else exportReportCSV(opts);
  };

  return (
    <div className="space-y-5">
      {/* Header KPIs */}
      {!isLoading && payload && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-red-600 to-rose-700 rounded-2xl p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Total Overdue Loans</p>
            <p className="text-4xl font-extrabold">{totalCount}</p>
          </div>
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Total Outstanding</p>
            <p className="text-4xl font-extrabold">{fmtRup(totalOutstanding)}</p>
          </div>
        </div>
      )}

      {/* Aging Buckets */}
      {!isLoading && agingSummary.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-bold text-slate-800">Aging Buckets</h2>
          </div>
          <div className="card-body grid grid-cols-2 sm:grid-cols-4 gap-4">
            {agingSummary.map((bucket: any) => {
              const colors = AGING_COLORS[bucket.bucket] || { badge: 'bg-slate-100 text-slate-700', bar: 'bg-slate-400' };
              const pct = maxAgingCount > 0 ? Math.round((bucket.count / maxAgingCount) * 100) : 0;
              return (
                <div key={bucket.bucket} className="rounded-xl border border-slate-200 p-4">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                    {bucket.bucket}
                  </span>
                  <p className="text-3xl font-extrabold text-slate-900 mt-2 mb-1">{bucket.count}</p>
                  <p className="text-xs text-slate-500">{fmtRup(bucket.totalOutstandingInRupees)}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-3">
                    <div className={`h-1.5 ${colors.bar} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overdue Loans Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Overdue Loans
            <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{totalCount}</span>
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Sorted: most overdue first</span>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={overdueLoans.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button size="sm" onClick={() => handleExport('pdf')} disabled={overdueLoans.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loan Account</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Maturity Date</th>
                <th className="text-center">Days Overdue</th>
                <th>Aging</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10">Loading…</td></tr>
              ) : overdueLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <CheckCircle className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
                    <p className="text-emerald-600 font-semibold">No overdue loans!</p>
                  </td>
                </tr>
              ) : (
                overdueLoans.map((loan: any, i: number) => {
                  const colors = AGING_COLORS[loan.aging] || { badge: 'bg-slate-100 text-slate-600', bar: '' };
                  return (
                    <tr key={i}>
                      <td className="font-mono text-sm text-blue-600">{loan.loanAccountNumber}</td>
                      <td className="font-medium text-slate-900">{loan.customer?.name ?? '—'}</td>
                      <td className="text-sm text-slate-500">{loan.customer?.phone ?? '—'}</td>
                      <td className="text-sm text-slate-500">{formatDate(loan.maturityDate)}</td>
                      <td className="text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                          {loan.daysOverdue} days
                        </span>
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colors.badge}`}>
                          {loan.aging}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-red-700">{fmtRup(loan.outstandingInRupees)}</td>
                      <td className="text-right text-amber-700">{fmtRup(loan.penaltyInRupees)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAN REGISTER VIEW
// ─────────────────────────────────────────────────────────────────────────────
function LoanRegisterView() {
  const branding = useSystemStore(s => s.branding);
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['loan-register', page],
    queryFn: () => loanApi.list({ page, limit }),
  });

  // API response: { data: { data: { loans: [], pagination: {} } } }
  const inner = (data as any)?.data?.data ?? (data as any)?.data ?? {};
  const loans: any[] = Array.isArray(inner?.loans) ? inner.loans : Array.isArray(inner) ? inner : [];
  const pagination = inner?.pagination || { total: 0, totalPages: 1 };

  const handleExport = async (fmt: 'pdf' | 'csv') => {
    try {
      const allData = await loanApi.list({ page: 1, limit: 10000 });
      const allInner = (allData as any)?.data?.data ?? (allData as any)?.data ?? {};
      const allLoans: any[] = Array.isArray(allInner?.loans) ? allInner.loans : Array.isArray(allInner) ? allInner : [];
      if (allLoans.length === 0) return;

      const rows = allLoans.map((loan: any) => ({
        accNo: loan.loanAccountNumber,
        customer: loan.customer?.name ?? '—',
        principal: `Rs. ${parseFloat((loan.principalAmountInPaise / 100).toString()).toFixed(2)}`,
        outstanding: `Rs. ${parseFloat((loan.outstandingBalanceInPaise / 100).toString()).toFixed(2)}`,
        interest: `${loan.interestRate || loan.plan?.interestRate || 0}%`,
        status: loan.status.toUpperCase(),
        maturityDate: loan.maturityDate ? formatDate(loan.maturityDate) : '—',
      }));

      const cols = [
        { header: 'Account No', dataKey: 'accNo', width: 22 },
        { header: 'Customer', dataKey: 'customer' },
        { header: 'Principal', dataKey: 'principal', align: 'right' as const, width: 25 },
        { header: 'Outstanding', dataKey: 'outstanding', align: 'right' as const, width: 25 },
        { header: 'Interest', dataKey: 'interest', align: 'right' as const, width: 15 },
        { header: 'Status', dataKey: 'status', width: 20 },
        { header: 'Maturity Date', dataKey: 'maturityDate', width: 25 },
      ];

      const opts = {
        title: 'Loan Register',
        subtitle: `Generated: ${new Date().toLocaleString('en-IN')}`,
        filename: 'loan_register',
        columns: cols, rows, branding,
      };

      if (fmt === 'pdf') exportReportPDF({ ...opts, orientation: 'landscape' });
      else exportReportCSV(opts);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Loan Register
          </h2>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-1.5" /> CSV All
            </Button>
            <Button size="sm" onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4 mr-1.5" /> PDF All
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account No</th>
                <th>Customer</th>
                <th className="text-right">Principal</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Interest Rate</th>
                <th>Status</th>
                <th>Maturity Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10">Loading…</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10">No loans found</td></tr>
              ) : (
                loans.map((loan: any) => (
                  <tr key={loan._id}>
                    <td className="font-mono text-sm text-blue-600">{loan.loanAccountNumber}</td>
                    <td className="font-medium text-slate-900">{loan.customer?.name ?? '—'}</td>
                    <td className="text-right">{fmtRup((loan.principalAmountInPaise || 0) / 100)}</td>
                    <td className="text-right font-semibold text-amber-700">{fmtRup((loan.outstandingBalanceInPaise || 0) / 100)}</td>
                    <td className="text-right">{loan.interestRate || loan.plan?.interestRate || 0}%</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        loan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                        loan.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {loan.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-sm text-slate-500">{loan.maturityDate ? formatDate(loan.maturityDate) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="card-footer flex justify-between items-center bg-slate-50 border-t">
            <span className="text-xs text-slate-500">
              Showing page {page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages || isLoading}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
