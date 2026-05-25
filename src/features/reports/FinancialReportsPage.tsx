// src/features/reports/FinancialReportsPage.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isValid } from 'date-fns';
import {
  ArrowLeft, Scale, TrendingUp, TrendingDown, Banknote,
  CheckCircle, XCircle, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../../api/report.api';
import { Button } from '../../components/ui/Button';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { useSystemStore } from '../../store/system.store';
import { exportReportPDF, exportReportCSV } from '../../utils/reportExport';
import { ReportInstitutionHeader } from '../../components/shared/ReportInstitutionHeader';

// ── Rupee string → formatted display
const fmtRup = (v: string | number | undefined | null, showSign = false) => {
  const n = parseFloat(String(v ?? '0'));
  if (isNaN(n)) return '₹0.00';
  const fmt = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2
  }).format(Math.abs(n));
  if (showSign && n > 0) return `+${fmt}`;
  if (showSign && n < 0) return `-${fmt}`;
  return fmt;
};

const getMonthStart = (d: Date) => format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');

// ─────────────────────────────────────────────────────────────────────────────
export default function FinancialReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'trial-balance' | 'pnl' | 'cash'>('trial-balance');

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      <ReportInstitutionHeader
        reportTitle="Financial Statements"
        subInfo="Trial balance, profit & loss, and live cash position"
      />

      <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit gap-1">
        {([
          { id: 'trial-balance', label: 'Trial Balance', icon: Scale, color: 'blue' },
          { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp, color: 'emerald' },
          { id: 'cash', label: 'Cash Position', icon: Banknote, color: 'amber' },
        ] as const).map(({ id, label, icon: Icon, color }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all ${activeTab === id
              ? color === 'blue' ? 'bg-blue-600 text-white shadow-sm'
                : color === 'emerald' ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-amber-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'trial-balance' && <TrialBalanceView />}
        {activeTab === 'pnl' && <PnlView />}
        {activeTab === 'cash' && <CashPositionView />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIAL BALANCE 
// ─────────────────────────────────────────────────────────────────────────────
function TrialBalanceView() {
  const { businessDate } = useBusinessDate();
  const branding = useSystemStore(s => s.branding);
  const maxDate = businessDate || format(new Date(), 'yyyy-MM-dd');
  const [asOfDate, setAsOfDate] = useState(maxDate);
  const [expandedType, setExpandedType] = useState<string | null>('asset');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trial-balance', asOfDate],
    queryFn: () => reportApi.getTrialBalance({ asOfDate }),
  });

  const tb = (data as any)?.data?.data as any;

  const types = [
    { key: 'assets', label: 'Assets', color: 'blue', icon: TrendingUp },
    { key: 'liabilities', label: 'Liabilities', color: 'amber', icon: TrendingDown },
    { key: 'income', label: 'Income', color: 'emerald', icon: TrendingUp },
    { key: 'expenses', label: 'Expenses', color: 'red', icon: TrendingDown },
  ] as const;

  const handleExport = (fmt: 'pdf' | 'csv') => {
    if (!tb) return;
    const allRows: Record<string, any>[] = [];
    types.forEach(({ key, label }) => {
      (tb[key] || []).forEach((row: any) => {
        allRows.push({
          type: label,
          code: row.accountCode,
          name: row.accountName,
          normalBalance: row.normalBalance,
          debit: row.debitInRupees ? `Rs. ${parseFloat(row.debitInRupees).toFixed(2)}` : '—',
          credit: row.creditInRupees ? `Rs. ${parseFloat(row.creditInRupees).toFixed(2)}` : '—',
          netBalance: `Rs. ${parseFloat(row.netBalanceInRupees || '0').toFixed(2)}`,
          side: row.side?.toUpperCase() || '',
        });
      });
    });
    const cols = [
      { header: 'Type', dataKey: 'type', width: 22 },
      { header: 'Code', dataKey: 'code', width: 18 },
      { header: 'Account Name', dataKey: 'name' },
      { header: 'Normal Bal', dataKey: 'normalBalance', width: 20 },
      { header: 'Debit (DR)', dataKey: 'debit', align: 'right' as const, width: 28 },
      { header: 'Credit (CR)', dataKey: 'credit', align: 'right' as const, width: 28 },
      { header: 'Net Balance', dataKey: 'netBalance', align: 'right' as const, width: 28 },
      { header: 'Side', dataKey: 'side', width: 14 },
    ];
    const summary = [
      { label: 'Total DR', value: `Rs. ${parseFloat(tb.grandTotals?.totalDebitsInRupees || '0').toFixed(2)}` },
      { label: 'Total CR', value: `Rs. ${parseFloat(tb.grandTotals?.totalCreditsInRupees || '0').toFixed(2)}` },
      { label: 'Status', value: tb.isBalanced ? 'BALANCED ✓' : 'IMBALANCED ✗' },
    ];
    const opts = {
      title: 'Trial Balance',
      subtitle: `As of ${asOfDate}`,
      dateRange: `As of ${asOfDate}`,
      filename: `trial_balance_${asOfDate}`,
      columns: cols, rows: allRows, summary, branding,
    };
    if (fmt === 'pdf') exportReportPDF({ ...opts, orientation: 'landscape' });
    else exportReportCSV(opts);
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="card">
        <div className="card-body flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-slate-600">As of date:</span>
          <input type="date" value={asOfDate} max={maxDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="form-input py-2 text-sm" />
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={!tb}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button size="sm" onClick={() => handleExport('pdf')} disabled={!tb}>
              <Download className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>

          {/* Integrity Badge */}
          {!isLoading && tb && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${tb.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
              {tb.isBalanced
                ? <><CheckCircle className="h-4 w-4" /> Ledger Balanced</>
                : <><XCircle className="h-4 w-4" /> IMBALANCED — Investigate</>}
            </div>
          )}
        </div>
      </div>

      {/* Grand Totals Banner */}
      {!isLoading && tb && (
        <div className={`rounded-2xl p-5 border-2 ${tb.isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Debits (DR)</p>
              <p className="text-2xl font-extrabold text-blue-700">{fmtRup(tb.grandTotals?.totalDebitsInRupees)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Credits (CR)</p>
              <p className="text-2xl font-extrabold text-emerald-700">{fmtRup(tb.grandTotals?.totalCreditsInRupees)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Difference</p>
              <p className={`text-2xl font-extrabold ${tb.isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
                {tb.isBalanced ? '₹0.00' : fmtRup(tb.grandTotals?.differenceInRupees)}
              </p>
            </div>
          </div>
          {!tb.isBalanced && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-700 font-medium justify-center">
              <AlertTriangle className="h-4 w-4" />
              Ledger is IMBALANCED — manual reconciliation required
            </div>
          )}
        </div>
      )}

      {/* Account Groups */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : tb ? (
        <div className="space-y-3">
          {types.map(({ key, label, color, icon: Icon }) => {
            const rows: any[] = tb[key] || [];
            const isExpanded = expandedType === key;
            const totalDr = rows.reduce((s: number, r: any) => s + parseFloat(r.debitInRupees || '0'), 0);
            const totalCr = rows.reduce((s: number, r: any) => s + parseFloat(r.creditInRupees || '0'), 0);

            const colorMap: Record<string, string> = {
              blue: 'border-blue-200 bg-blue-50',
              amber: 'border-amber-200 bg-amber-50',
              emerald: 'border-emerald-200 bg-emerald-50',
              red: 'border-red-200 bg-red-50',
            };
            const headerColor: Record<string, string> = {
              blue: 'text-blue-800', amber: 'text-amber-800', emerald: 'text-emerald-800', red: 'text-red-800'
            };

            return (
              <div key={key} className={`rounded-xl border ${colorMap[color]} overflow-hidden`}>
                <button
                  className="w-full px-5 py-3.5 flex items-center justify-between"
                  onClick={() => setExpandedType(isExpanded ? null : key)}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${headerColor[color]}`} />
                    <span className={`font-bold text-sm ${headerColor[color]}`}>{label}</span>
                    <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-semibold text-slate-600">
                      {rows.length} accounts
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-400">DR</p>
                      <p className="font-bold text-slate-700">{fmtRup(totalDr)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-400">CR</p>
                      <p className="font-bold text-slate-700">{fmtRup(totalCr)}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/50 bg-white">
                    <table className="data-table text-sm">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Account Name</th>
                          <th>Normal Balance</th>
                          <th className="text-right">Debit (DR)</th>
                          <th className="text-right">Credit (CR)</th>
                          <th className="text-right">Net Balance</th>
                          <th>Side</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-6 text-slate-400">No accounts</td></tr>
                        ) : (
                          rows.map((row: any) => (
                            <tr key={row.accountCode}>
                              <td className="font-mono text-xs text-slate-500">{row.accountCode}</td>
                              <td className="font-medium text-slate-900">{row.accountName}</td>
                              <td>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${row.normalBalance === 'debit' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                  }`}>{row.normalBalance}</span>
                              </td>
                              <td className="text-right text-slate-700">{parseFloat(row.debitInRupees || '0') > 0 ? fmtRup(row.debitInRupees) : '—'}</td>
                              <td className="text-right text-slate-700">{parseFloat(row.creditInRupees || '0') > 0 ? fmtRup(row.creditInRupees) : '—'}</td>
                              <td className="text-right font-semibold text-slate-900">{fmtRup(row.netBalanceInRupees)}</td>
                              <td>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${row.side === 'debit' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                  }`}>{row.side?.toUpperCase()}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFIT & LOSS
// ─────────────────────────────────────────────────────────────────────────────
function PnlView() {
  const { businessDate } = useBusinessDate();
  const branding = useSystemStore(s => s.branding);
  const maxDate = businessDate || format(new Date(), 'yyyy-MM-dd');
  const [fromDate, setFromDate] = useState(() => getMonthStart(businessDate ? new Date(businessDate) : new Date()));
  const [toDate, setToDate] = useState(maxDate);

  const { data, isLoading } = useQuery({
    queryKey: ['pnl', fromDate, toDate],
    queryFn: () => reportApi.getPnlReport({ fromDate, toDate }),
  });

  const pnl = (data as any)?.data?.data as any;
  const isProfit = pnl?.netProfit?.type === 'Profit';

  const handleExport = (fmt: 'pdf' | 'csv') => {
    if (!pnl) return;
    const rows: Record<string, any>[] = [];
    (pnl.income?.items || []).forEach((item: any) =>
      rows.push({ section: 'INCOME', code: item.code, name: item.name, amount: `Rs. ${parseFloat(item.amountInRupees || '0').toFixed(2)}` })
    );
    rows.push({ section: '', code: '', name: 'TOTAL INCOME', amount: `Rs. ${parseFloat(pnl.income?.totalInRupees || '0').toFixed(2)}` });
    (pnl.expenses?.items || []).forEach((item: any) =>
      rows.push({ section: 'EXPENSE', code: item.code, name: item.name, amount: `Rs. ${parseFloat(item.amountInRupees || '0').toFixed(2)}` })
    );
    rows.push({ section: '', code: '', name: 'TOTAL EXPENSES', amount: `Rs. ${parseFloat(pnl.expenses?.totalInRupees || '0').toFixed(2)}` });
    const cols = [
      { header: 'Section', dataKey: 'section', width: 24 },
      { header: 'Code', dataKey: 'code', width: 22 },
      { header: 'Account Name', dataKey: 'name' },
      { header: 'Amount', dataKey: 'amount', align: 'right' as const, width: 36 },
    ];
    const summary = [
      { label: 'Total Income', value: `Rs. ${parseFloat(pnl.income?.totalInRupees || '0').toFixed(2)}` },
      { label: 'Total Expenses', value: `Rs. ${parseFloat(pnl.expenses?.totalInRupees || '0').toFixed(2)}` },
      { label: `Net ${pnl.netProfit?.type || 'Result'}`, value: `Rs. ${parseFloat(pnl.netProfit?.inRupees || '0').toFixed(2)}` },
    ];
    const opts = {
      title: 'Profit & Loss Statement',
      subtitle: `Period: ${fromDate} to ${toDate}`,
      dateRange: `${fromDate} to ${toDate}`,
      filename: `pnl_${fromDate}_to_${toDate}`,
      columns: cols, rows, summary, branding,
    };
    if (fmt === 'pdf') exportReportPDF({ ...opts, orientation: 'portrait' });
    else exportReportCSV(opts);
  };

  return (
    <div className="space-y-5">
      {/* Date Controls */}
      <div className="card">
        <div className="card-body flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-slate-600">Period:</span>
          <input type="date" value={fromDate} max={maxDate} onChange={(e) => setFromDate(e.target.value)} className="form-input py-2 text-sm" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={toDate} max={maxDate} onChange={(e) => setToDate(e.target.value)} className="form-input py-2 text-sm" />
          {pnl?.period && (
            <span className="text-xs text-slate-400 ml-auto">{pnl.period.from} — {pnl.period.to}</span>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={!pnl}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button size="sm" onClick={() => handleExport('pdf')} disabled={!pnl}>
              <Download className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      ) : pnl ? (
        <>
          {/* Two-column P&L Statement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* INCOME */}
            <div className="card">
              <div className="card-header bg-emerald-50/60">
                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> INCOME
                </h3>
              </div>
              <div className="card-body space-y-2">
                {(pnl.income?.items || []).map((item: any) => (
                  <div key={item.code} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                    <div>
                      <p className="text-sm text-slate-700">{item.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.code}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">{fmtRup(item.amountInRupees)}</span>
                  </div>
                ))}
                {(pnl.income?.items || []).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">No income entries</p>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-emerald-200">
                  <span className="font-bold text-emerald-800">Total Income</span>
                  <span className="text-xl font-extrabold text-emerald-700">{fmtRup(pnl.income?.totalInRupees)}</span>
                </div>
              </div>
            </div>

            {/* EXPENSES */}
            <div className="card">
              <div className="card-header bg-red-50/60">
                <h3 className="text-sm font-bold text-red-800 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" /> EXPENSES
                </h3>
              </div>
              <div className="card-body space-y-2">
                {(pnl.expenses?.items || []).map((item: any) => (
                  <div key={item.code} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                    <div>
                      <p className="text-sm text-slate-700">{item.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.code}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-700">{fmtRup(item.amountInRupees)}</span>
                  </div>
                ))}
                {(pnl.expenses?.items || []).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">No expense entries</p>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-red-200">
                  <span className="font-bold text-red-800">Total Expenses</span>
                  <span className="text-xl font-extrabold text-red-700">{fmtRup(pnl.expenses?.totalInRupees)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Profit/Loss Banner */}
          <div className={`rounded-2xl p-8 border-2 text-center ${isProfit ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
              {pnl.netProfit?.indicator} {pnl.netProfit?.type === 'Profit' ? 'NET PROFIT' : 'NET LOSS'} FOR PERIOD
            </p>
            <p className={`text-5xl font-black mt-1 ${isProfit ? 'text-emerald-700' : 'text-red-700'}`}>
              {fmtRup(pnl.netProfit?.inRupees)}
            </p>
            <p className="text-xs text-slate-400 mt-3">{pnl.period?.from} to {pnl.period?.to}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CASH POSITION 
// ─────────────────────────────────────────────────────────────────────────────
function CashPositionView() {
  const branding = useSystemStore(s => s.branding);
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['cash-position'],
    queryFn: () => reportApi.getCashPosition(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const cashInfo = (data as any)?.data?.data as any;

  const asOfDate = cashInfo?.asOf
    ? (() => {
      const d = new Date(cashInfo.asOf);
      return isValid(d) ? format(d, 'dd MMM yyyy, hh:mm a') : cashInfo.asOf;
    })()
    : '—';

  const todayNet = parseFloat(cashInfo?.today?.netInRupees ?? '0');
  const isNetPositive = todayNet >= 0;

  const handleExport = (fmt: 'pdf' | 'csv') => {
    if (!cashInfo) return;
    const rows = [
      { label: 'Cash in Hand (Ledger 1001)', value: `Rs. ${parseFloat(cashInfo.cashInHandInRupees || '0').toFixed(2)}`, note: 'Double-entry closing balance' },
      { label: 'Cash In Today', value: `Rs. ${parseFloat(cashInfo.today?.cashInInRupees || '0').toFixed(2)}`, note: 'Total inflows today' },
      { label: 'Cash Out Today', value: `Rs. ${parseFloat(cashInfo.today?.cashOutInRupees || '0').toFixed(2)}`, note: 'Total outflows today' },
      { label: 'Net Today', value: `Rs. ${parseFloat(cashInfo.today?.netInRupees || '0').toFixed(2)}`, note: 'Net cash movement' },
    ];
    const cols = [
      { header: 'Description', dataKey: 'label' },
      { header: 'Amount', dataKey: 'value', align: 'right' as const, width: 40 },
      { header: 'Note', dataKey: 'note' },
    ];
    const opts = {
      title: 'Cash Position Report',
      subtitle: `As of ${asOfDate}`,
      dateRange: `As of ${asOfDate}`,
      filename: `cash_position_${new Date().toISOString().split('T')[0]}`,
      columns: cols, rows, branding,
    };
    if (fmt === 'pdf') exportReportPDF({ ...opts, orientation: 'portrait' });
    else exportReportCSV(opts);
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="card-body flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {dataUpdatedAt ? `Last updated: ${new Date(dataUpdatedAt).toLocaleTimeString('en-IN')}` : 'Live'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={!cashInfo}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button size="sm" onClick={() => handleExport('pdf')} disabled={!cashInfo}>
              <Download className="h-4 w-4 mr-1.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : cashInfo ? (
        <>
          {/* Main Balance Hero */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-white text-center">
            <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Banknote className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Cash in Hand (Ledger Account 1001)
            </p>
            <p className="text-6xl font-black text-white mb-2">{fmtRup(cashInfo.cashInHandInRupees)}</p>
            <p className="text-xs text-slate-500">As of {asOfDate}</p>
          </div>

          {/* Today's Movement */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="card-body">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Cash In Today</p>
                <p className="text-2xl font-extrabold text-emerald-600">{fmtRup(cashInfo.today?.cashInInRupees)}</p>
                <p className="text-xs text-slate-400 mt-1">Inflows recorded</p>
              </div>
            </div>
            <div className="card text-center">
              <div className="card-body">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Cash Out Today</p>
                <p className="text-2xl font-extrabold text-red-600">{fmtRup(cashInfo.today?.cashOutInRupees)}</p>
                <p className="text-xs text-slate-400 mt-1">Outflows recorded</p>
              </div>
            </div>
            <div className={`card text-center border-2 ${isNetPositive ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}>
              <div className="card-body">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Net Today</p>

                <p className={`text-2xl font-extrabold ${isNetPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                  {isNetPositive ? '+' : ''}{fmtRup(cashInfo.today?.netInRupees)}
                </p>
                <p className="text-xs text-slate-400 mt-1">Net cash movement</p>
              </div>
            </div>
          </div>

          {/* Ledger Note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700 flex items-start gap-3">
            <Scale className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Double-Entry Ledger Cash</p>
              <p className="text-xs text-blue-600">
                This balance is derived from the Cash In Hand ledger account (code: 1001) using DR − CR.
                It reflects all pigmy collections, loan disbursements, and agent deposits processed through the system.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
