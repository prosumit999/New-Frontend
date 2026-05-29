// src/features/ledger/LedgerPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// LEDGER MODULE — Production-grade double-entry ledger viewer
// Tab 1: General Ledger (Chart of Accounts with balance sheet totals)
// Tab 2: Account Statement (drill-down per account, with CSV export)
// Tab 3: Ledger Journal (full audit trail)
// Tab 4: Post Journal Voucher (admin/superadmin manual adjustment)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  BookOpen, BarChart3, FileText, PenSquare, Download, Plus, Trash2,
  CheckCircle, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
  Shield, TrendingUp, TrendingDown, DollarSign, Banknote, Search,
  AlertCircle, Loader2,
} from 'lucide-react';
import { ledgerApi, JVEntry } from '../../api/ledger.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatCurrency } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { exportReportPDF } from '../../utils/reportExport';
import { useSystemStore } from '../../store/system.store';

// ─── Date Helpers ─────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

// ─── Account Type Metadata ────────────────────────────────────────────────────
const TYPE_META: Record<string, { label: string; icon: any; bg: string; text: string; border: string }> = {
  asset:     { label: 'Assets',      icon: DollarSign,  bg: 'bg-blue-50',    text: 'text-blue-800',   border: 'border-blue-200' },
  liability: { label: 'Liabilities', icon: TrendingDown, bg: 'bg-red-50',     text: 'text-red-800',    border: 'border-red-200' },
  income:    { label: 'Income',      icon: TrendingUp,   bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  expense:   { label: 'Expenses',    icon: Banknote,     bg: 'bg-amber-50',   text: 'text-amber-800',  border: 'border-amber-200' },
  equity:    { label: 'Equity',      icon: Shield,       bg: 'bg-indigo-50',  text: 'text-indigo-800', border: 'border-indigo-200' },
};

// ─── CSV Export Utility ───────────────────────────────────────────────────────
const downloadCSV = (rows: string[][], filename: string) => {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'general',   label: 'General Ledger',      icon: BarChart3 },
  { id: 'statement', label: 'Account Statement',    icon: FileText },
  { id: 'journal',   label: 'Ledger Journal',       icon: BookOpen },
  { id: 'voucher',   label: 'Post Journal Voucher', icon: PenSquare },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function LedgerPage() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-purple-600" /> Ledger
          </h1>
          <p className="page-subtitle">Double-entry bookkeeping — complete financial audit trail</p>
        </div>
        <IntegrityBadge />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          // Journal Voucher tab visible to all (admin + superadmin per client request)
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'general'   && <GeneralLedgerTab />}
      {activeTab === 'statement' && <AccountStatementTab />}
      {activeTab === 'journal'   && <LedgerJournalTab />}
      {activeTab === 'voucher'   && <JournalVoucherTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRITY BADGE (header widget)
// ─────────────────────────────────────────────────────────────────────────────
function IntegrityBadge() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ledger-integrity'],
    queryFn: () => ledgerApi.checkLedgerIntegrity(),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const result = data?.data;

  if (isLoading) return (
    <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
      <RefreshCw className="h-3.5 w-3.5" /> Checking integrity...
    </div>
  );

  if (!result) return null;

  return (
    <button
      onClick={() => refetch()}
      title="Click to re-check ledger integrity"
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        result.isBalanced
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 animate-pulse'
      }`}
    >
      {result.isBalanced
        ? <CheckCircle className="h-3.5 w-3.5" />
        : <XCircle className="h-3.5 w-3.5" />}
      {result.isBalanced ? 'Ledger Balanced ✓' : 'IMBALANCED — INVESTIGATE'}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1 — GENERAL LEDGER
// ═════════════════════════════════════════════════════════════════════════════
function GeneralLedgerTab() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const branding = useSystemStore(s => s.branding);
  const [isExporting, setIsExporting] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger-general'],
    queryFn: () => ledgerApi.getGeneralLedger(),
    staleTime: 2 * 60 * 1000,
  });

  const gl = data?.data;

  const toggleGroup = (type: string) =>
    setCollapsed((p) => ({ ...p, [type]: !p[type] }));

  if (isLoading) return <LoadingState label="Loading General Ledger..." />;
  if (error || !gl) return <ErrorState />;

  const { summary, groups } = gl;

  const handlePdfExport = () => {
    const allAccounts = groups.flatMap((g: any) =>
      g.accounts.map((a: any) => ({
        code: a.code,
        name: a.name,
        type: a.type,
        normalBal: a.normalBalance,
        balance: formatCurrency(a.runningBalanceInPaise),
        flags: [a.isSystem ? 'System' : '', a.isAgentAccount ? 'Agent' : ''].filter(Boolean).join(', ') || '—',
      }))
    );
    setIsExporting(true);
    try {
      exportReportPDF({
        title: 'General Ledger — Chart of Accounts',
        subtitle: `As at ${new Date().toLocaleDateString('en-IN')}`,
        orientation: 'landscape',
        branding,
        columns: [
          { header: 'Code',           dataKey: 'code',       width: 28 },
          { header: 'Account Name',   dataKey: 'name',       width: 93 },
          { header: 'Type',           dataKey: 'type',       width: 34 },
          { header: 'Normal Balance', dataKey: 'normalBal',  width: 43 },
          { header: 'Balance (₹)',    dataKey: 'balance',    width: 47, align: 'right' },
          { header: 'Flags',          dataKey: 'flags',      width: 31 },
        ],
        rows: allAccounts,
        summary: [
          { label: 'Total Assets',      value: formatCurrency(summary.totalAssetsInPaise) },
          { label: 'Total Liabilities', value: formatCurrency(summary.totalLiabilitiesInPaise) },
          { label: "Owner's Equity",   value: formatCurrency(summary.totalEquityInPaise ?? 0) },
          { label: 'Net Worth',         value: formatCurrency(summary.netWorthInPaise) },
          { label: 'Net Profit',        value: formatCurrency(summary.netProfitInPaise) },
          { label: 'Equation Balanced', value: summary.isEquationBalanced ? '✓ YES' : '✗ NO — INVESTIGATE' },
        ],
        filename: `general-ledger-${new Date().toISOString().slice(0, 10)}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard
          label="Total Assets"
          value={formatCurrency(summary.totalAssetsInPaise)}
          icon={DollarSign}
          color="blue"
        />
        <SummaryCard
          label="Total Liabilities"
          value={formatCurrency(summary.totalLiabilitiesInPaise)}
          icon={TrendingDown}
          color="red"
        />
        <SummaryCard
          label="Owner's Equity"
          value={formatCurrency(summary.totalEquityInPaise ?? 0)}
          icon={Shield}
          color="indigo"
          sub="Capital Invested"
        />
        <SummaryCard
          label="Net Worth"
          value={formatCurrency(summary.netWorthInPaise)}
          icon={Shield}
          color={summary.netWorthInPaise >= 0 ? 'emerald' : 'red'}
          sub="Assets − Liabilities"
        />
        <SummaryCard
          label="Net Profit"
          value={formatCurrency(summary.netProfitInPaise)}
          icon={TrendingUp}
          color={summary.netProfitInPaise >= 0 ? 'emerald' : 'amber'}
          sub="Income − Expenses"
        />
      </div>

      {/* Accounting Equation Banner */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border ${
        summary.isEquationBalanced
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-red-50 text-red-800 border-red-200'
      }`}>
        {summary.isEquationBalanced
          ? <CheckCircle className="h-4 w-4 shrink-0" />
          : <AlertTriangle className="h-4 w-4 shrink-0" />}
        <span>
          {summary.isEquationBalanced
            ? `✔ Balanced: Assets (${formatCurrency(summary.totalAssetsInPaise)}) = Liabilities + Equity + Net Profit`
            : 'WARNING: Accounting Equation FAILS. Investigate immediately.'}
        </span>
        <span className="text-xs text-slate-500">{summary.totalAccounts} accounts</span>
        <button
          onClick={handlePdfExport}
          disabled={isExporting}
          className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-current hover:bg-white/50 disabled:opacity-40 transition-colors"
        >
          {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Export PDF
        </button>
      </div>

      {/* Accounts by Group */}
      {groups.map((group: any) => {
        const meta = TYPE_META[group.type] || TYPE_META.asset;
        const Icon = meta.icon;
        const isCollapsed = collapsed[group.type];

        return (
          <div key={group.type} className={`card border ${meta.border}`}>
            <button
              onClick={() => toggleGroup(group.type)}
              className={`w-full flex items-center justify-between px-4 py-3 ${meta.bg} rounded-t-xl`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${meta.text}`} />
                <span className={`font-semibold text-sm ${meta.text}`}>{meta.label}</span>
                <span className="text-xs text-slate-500 ml-1">({group.accounts.length} accounts)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-bold text-sm ${meta.text}`}>
                  {formatCurrency(group.totalBalanceInPaise)}
                </span>
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </div>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th>Normal Balance</th>
                      <th className="text-right">Running Balance</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.accounts.map((acc: any) => (
                      <tr key={acc._id}>
                        <td>
                          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {acc.code}
                          </span>
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-sm text-slate-900">{acc.name}</p>
                            {acc.description && (
                              <p className="text-xs text-slate-400">{acc.description}</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                            acc.normalBalance === 'debit'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {acc.normalBalance}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="font-semibold text-sm font-mono">
                            {formatCurrency(acc.runningBalanceInPaise)}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500 space-x-1">
                          {acc.isSystem && (
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">System</span>
                          )}
                          {acc.isAgentAccount && (
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Agent</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2 — ACCOUNT STATEMENT
// ═════════════════════════════════════════════════════════════════════════════
function AccountStatementTab() {
  // Load all accounts for the dropdown
  const { data: glData } = useQuery({
    queryKey: ['ledger-general'],
    queryFn: () => ledgerApi.getGeneralLedger(),
    staleTime: 5 * 60 * 1000,
  });

  const allAccounts: any[] = glData?.data?.groups?.flatMap((g: any) => g.accounts) || [];

  const [selectedAccount, setSelectedAccount] = useState('');
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(today());
  const [page, setPage] = useState(1);
  const [limit] = useState(100);

  const branding = useSystemStore(s => s.branding);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ledger-statement', selectedAccount, fromDate, toDate, page, limit],
    queryFn: () => ledgerApi.getAccountStatement(selectedAccount, { fromDate, toDate, page, limit }),
    enabled: !!selectedAccount && !!fromDate && !!toDate,
    staleTime: 0,
  });

  const stmt = data?.data;

  const handleExportCSV = () => {
    if (!stmt) return;
    const rows: string[][] = [
      ['Account Statement Export'],
      [`Account: ${stmt.account.code} — ${stmt.account.name}`],
      [`Period: ${fromDate} to ${toDate}`],
      [`Opening Balance: ${(stmt.openingBalanceInPaise / 100).toFixed(2)}`],
      [],
      ['Date', 'Description', 'Narration', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)', 'Posted By', 'Transaction Ref'],
      ...stmt.entries.map((e: any) => [
        new Date(e.businessDate).toLocaleDateString('en-IN'),
        e.description,
        e.narration || '',
        e.debitInPaise > 0 ? (e.debitInPaise / 100).toFixed(2) : '',
        e.creditInPaise > 0 ? (e.creditInPaise / 100).toFixed(2) : '',
        ((e.runningBalanceInPaise || 0) / 100).toFixed(2),
        e.performedBy?.name || '',
        e.transactionRef || '',
      ]),
      [],
      [`Closing Balance: ${(stmt.closingBalanceInPaise / 100).toFixed(2)}`],
      [`Total Debits: ${(stmt.periodTotals.totalDebitInPaise / 100).toFixed(2)}`],
      [`Total Credits: ${(stmt.periodTotals.totalCreditInPaise / 100).toFixed(2)}`],
    ];
    downloadCSV(rows, `Statement_${stmt.account.code}_${fromDate}_${toDate}.csv`);
    toast.success('CSV exported successfully');
  };

  const handleExportPDF = () => {
    if (!stmt) return;
    const pdfRows = stmt.entries.map((e: any) => ({
      date: new Date(e.businessDate).toLocaleDateString('en-IN'),
      desc: e.description,
      ref: e.narration || e.transactionRef || e.transaction?.transactionId || '—',
      debit: e.debitInPaise > 0 ? `₹${(e.debitInPaise / 100).toFixed(2)}` : '',
      credit: e.creditInPaise > 0 ? `₹${(e.creditInPaise / 100).toFixed(2)}` : '',
      balance: `₹${((e.runningBalanceInPaise || 0) / 100).toFixed(2)}`,
      by: e.performedBy?.name || '—',
    }));
    setIsExporting(true);
    try {
      exportReportPDF({
        title: `Account Statement — [${stmt.account.code}] ${stmt.account.name}`,
        subtitle: `${stmt.account.type} account · Normal Balance: ${stmt.account.normalBalance}`,
        dateRange: `${fromDate} to ${toDate}`,
        orientation: 'landscape',
        branding,
        columns: [
          { header: 'Date',        dataKey: 'date',   width: 31 },
          { header: 'Description', dataKey: 'desc',   width: 70 },
          { header: 'Ref / Note',  dataKey: 'ref',    width: 45 },
          { header: 'Debit (₹)',   dataKey: 'debit',  width: 31, align: 'right' },
          { header: 'Credit (₹)',  dataKey: 'credit', width: 31, align: 'right' },
          { header: 'Balance (₹)', dataKey: 'balance',width: 33, align: 'right' },
          { header: 'Posted By',   dataKey: 'by',     width: 36 },
        ],
        rows: pdfRows,
        summary: [
          { label: 'Opening Balance', value: `₹${(stmt.openingBalanceInPaise / 100).toFixed(2)}` },
          { label: 'Total Debits',   value: `₹${(stmt.periodTotals.totalDebitInPaise / 100).toFixed(2)}` },
          { label: 'Total Credits',  value: `₹${(stmt.periodTotals.totalCreditInPaise / 100).toFixed(2)}` },
          { label: 'Closing Balance', value: `₹${(stmt.closingBalanceInPaise / 100).toFixed(2)}` },
        ],
        filename: `statement-${stmt.account.code}-${fromDate}-${toDate}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="form-label">Ledger Account *</label>
            <select
              value={selectedAccount}
              onChange={(e) => { setSelectedAccount(e.target.value); setPage(1); }}
              className="form-input"
            >
              <option value="">— Select Account —</option>
              {['asset', 'liability', 'equity', 'income', 'expense'].map((type) => {
                const accs = allAccounts.filter((a: any) => a.type === type);
                if (!accs.length) return null;
                return (
                  <optgroup key={type} label={TYPE_META[type].label}>
                    {accs.map((acc: any) => (
                      <option key={acc._id} value={acc._id}>
                        [{acc.code}] {acc.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div>
            <label className="form-label">From Date *</label>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="form-label">To Date *</label>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} min={fromDate} />
          </div>
        </div>
      </div>

      {/* Statement */}
      {!selectedAccount ? (
        <EmptySelection label="Select a ledger account and date range to view its statement." />
      ) : isLoading || isFetching ? (
        <LoadingState label="Loading account statement..." />
      ) : !stmt ? (
        <ErrorState />
      ) : (
        <div className="space-y-3">
          {/* Statement Header */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  [{stmt.account.code}] {stmt.account.name}
                </h3>
                <p className="text-sm text-slate-500 capitalize">
                  {stmt.account.type} account · Normal Balance: {stmt.account.normalBalance}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Period: {new Date(stmt.period.fromDate).toLocaleDateString('en-IN')} →{' '}
                  {new Date(stmt.period.toDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!stmt.entries.length}>
                  <Download className="h-4 w-4 mr-1.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!stmt.entries.length || isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />} PDF
                </Button>
              </div>
            </div>

            {/* Balance Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">Opening Balance</p>
                <p className="font-bold text-slate-800">{formatCurrency(stmt.openingBalanceInPaise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">Total Debits</p>
                <p className="font-bold text-blue-700">{formatCurrency(stmt.periodTotals.totalDebitInPaise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">Total Credits</p>
                <p className="font-bold text-purple-700">{formatCurrency(stmt.periodTotals.totalCreditInPaise)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">Closing Balance</p>
                <p className="font-bold text-slate-900 text-base">{formatCurrency(stmt.closingBalanceInPaise)}</p>
              </div>
            </div>
          </div>

          {/* Entries Table */}
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Ref / Narration</th>
                  <th className="text-right text-blue-700">Debit (₹)</th>
                  <th className="text-right text-purple-700">Credit (₹)</th>
                  <th className="text-right">Balance (₹)</th>
                  <th>Posted By</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="bg-slate-50 font-medium text-slate-600">
                  <td colSpan={5} className="text-xs text-slate-500 italic">Opening Balance (before {fromDate})</td>
                  <td className="text-right font-bold font-mono">{(stmt.openingBalanceInPaise / 100).toFixed(2)}</td>
                  <td />
                </tr>
                {stmt.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No entries found in this period.
                    </td>
                  </tr>
                ) : (
                  stmt.entries.map((e: any) => (
                    <tr key={e._id}>
                      <td className="whitespace-nowrap text-xs">
                        {new Date(e.businessDate).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <p className="text-sm text-slate-800">{e.description}</p>
                        {e.narration && <p className="text-xs text-slate-400">{e.narration}</p>}
                      </td>
                      <td className="text-xs font-mono text-slate-500">
                        {e.transactionRef || e.transaction?.transactionId || '—'}
                      </td>
                      <td className="text-right font-mono text-sm text-blue-700">
                        {e.debitInPaise > 0 ? (e.debitInPaise / 100).toFixed(2) : ''}
                      </td>
                      <td className="text-right font-mono text-sm text-purple-700">
                        {e.creditInPaise > 0 ? (e.creditInPaise / 100).toFixed(2) : ''}
                      </td>
                      <td className={`text-right font-mono text-sm font-semibold ${
                        (e.runningBalanceInPaise || 0) < 0 ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {((e.runningBalanceInPaise || 0) / 100).toFixed(2)}
                      </td>
                      <td className="text-xs text-slate-500">
                        {e.performedBy?.name || '—'}
                      </td>
                    </tr>
                  ))
                )}
                {/* Closing Balance Row */}
                <tr className="bg-slate-50 font-medium border-t-2 border-slate-200">
                  <td colSpan={5} className="text-xs text-slate-600 font-semibold">Closing Balance</td>
                  <td className="text-right font-bold font-mono text-slate-900">
                    {(stmt.closingBalanceInPaise / 100).toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {stmt.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Showing page {stmt.pagination.page} of {stmt.pagination.totalPages}
                {' '}({stmt.pagination.total} entries)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= stmt.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3 — LEDGER JOURNAL (ALL ENTRIES)
// ═════════════════════════════════════════════════════════════════════════════
function LedgerJournalTab() {
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(today());
  const [entryType, setEntryType] = useState('');
  const [ledgerCode, setLedgerCode] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(100);

  const branding = useSystemStore(s => s.branding);
  const [isJournalExporting, setIsJournalExporting] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ledger-journal', fromDate, toDate, entryType, ledgerCode, page, limit],
    queryFn: () =>
      ledgerApi.getLedgerJournal({
        fromDate,
        toDate,
        page,
        limit,
        entryType: (entryType as 'debit' | 'credit') || undefined,
        ledgerCode: ledgerCode || undefined,
      }),
    staleTime: 0,
  });

  const journal = data?.data;

  const handleExportCSV = () => {
    if (!journal?.entries?.length) return;
    const rows: string[][] = [
      ['Ledger Journal Export'],
      [`Period: ${fromDate} to ${toDate}`],
      [`Filters: Type=${entryType || 'All'}, Account=${ledgerCode || 'All'}`],
      [],
      ['Date', 'Account Code', 'Account Name', 'Description', 'Debit (₹)', 'Credit (₹)', 'Posted By', 'Txn Ref', 'Created At'],
      ...journal.entries.map((e: any) => {
        const acc = typeof e.ledgerAccount === 'object' ? e.ledgerAccount : { code: '—', name: '—' };
        return [
          new Date(e.businessDate).toLocaleDateString('en-IN'),
          acc.code,
          acc.name,
          e.description,
          e.debitInPaise > 0 ? (e.debitInPaise / 100).toFixed(2) : '',
          e.creditInPaise > 0 ? (e.creditInPaise / 100).toFixed(2) : '',
          e.performedBy?.name || '',
          e.transactionRef || '',
          new Date(e.createdAt).toLocaleString('en-IN'),
        ];
      }),
      [],
      [`Total Debits: ${(journal.totals.totalDebitInPaise / 100).toFixed(2)}`],
      [`Total Credits: ${(journal.totals.totalCreditInPaise / 100).toFixed(2)}`],
    ];
    downloadCSV(rows, `LedgerJournal_${fromDate}_${toDate}.csv`);
    toast.success('CSV exported successfully');
  };

  const handleExportJournalPDF = () => {
    if (!journal?.entries?.length) return;
    const pdfRows = journal.entries.map((e: any) => {
      const acc = typeof e.ledgerAccount === 'object' ? e.ledgerAccount : { code: '—', name: '—' };
      return {
        date: new Date(e.businessDate).toLocaleDateString('en-IN'),
        code: acc.code,
        account: acc.name,
        desc: e.description,
        debit: e.debitInPaise > 0 ? `₹${(e.debitInPaise / 100).toFixed(2)}` : '',
        credit: e.creditInPaise > 0 ? `₹${(e.creditInPaise / 100).toFixed(2)}` : '',
        by: e.performedBy?.name || '—',
        ref: e.transactionRef || '—',
      };
    });
    setIsJournalExporting(true);
    try {
      exportReportPDF({
        title: 'Ledger Journal',
        subtitle: `Type: ${entryType || 'All'} · Account: ${ledgerCode || 'All'}`,
        dateRange: `${fromDate} to ${toDate}`,
        orientation: 'landscape',
        branding,
        columns: [
          { header: 'Date',        dataKey: 'date',    width: 26 },
          { header: 'Code',        dataKey: 'code',    width: 19 },
          { header: 'Account',     dataKey: 'account', width: 49 },
          { header: 'Description', dataKey: 'desc',    width: 59 },
          { header: 'Debit (₹)',   dataKey: 'debit',   width: 28, align: 'right' },
          { header: 'Credit (₹)',  dataKey: 'credit',  width: 28, align: 'right' },
          { header: 'Posted By',   dataKey: 'by',      width: 33 },
          { header: 'Txn Ref',     dataKey: 'ref',     width: 35 },
        ],
        rows: pdfRows,
        summary: [
          { label: 'Total Debits',  value: `₹${(journal.totals.totalDebitInPaise / 100).toFixed(2)}` },
          { label: 'Total Credits', value: `₹${(journal.totals.totalCreditInPaise / 100).toFixed(2)}` },
          { label: 'Balanced',      value: journal.totals.isBalanced ? '✓ YES' : '✗ NO — INVESTIGATE' },
        ],
        filename: `ledger-journal-${fromDate}-${toDate}`,
      });
    } finally {
      setIsJournalExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="form-label">From Date *</label>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="form-label">To Date *</label>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} min={fromDate} />
          </div>
          <div>
            <label className="form-label">Entry Type</label>
            <select value={entryType} onChange={(e) => { setEntryType(e.target.value); setPage(1); }} className="form-input">
              <option value="">All</option>
              <option value="debit">Debit only</option>
              <option value="credit">Credit only</option>
            </select>
          </div>
          <div>
            <label className="form-label">Account Code</label>
            <Input
              placeholder="e.g. 1001, 2001"
              value={ledgerCode}
              onChange={(e) => { setLedgerCode(e.target.value.toUpperCase()); setPage(1); }}
              className="font-mono"
            />
          </div>
        </div>
      </div>

      {/* Period Totals */}
      {journal && (
        <div className={`flex items-center flex-wrap gap-4 px-4 py-3 rounded-lg text-sm border ${
          journal.totals.isBalanced
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {journal.totals.isBalanced
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>
            <strong>Period Totals:</strong>{' '}
            DR: {formatCurrency(journal.totals.totalDebitInPaise)} |{' '}
            CR: {formatCurrency(journal.totals.totalCreditInPaise)} |{' '}
            {journal.totals.isBalanced
              ? '✓ Balanced'
              : `⚠ Difference: ${formatCurrency(journal.totals.differenceInPaise)}`}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={!journal.entries.length}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-current hover:bg-white/50 disabled:opacity-40 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={handleExportJournalPDF}
              disabled={!journal.entries.length || isJournalExporting}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-current hover:bg-white/50 disabled:opacity-40 transition-colors"
            >
              {isJournalExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} PDF
            </button>
          </div>
        </div>
      )}

      {/* Journal Table */}
      {isLoading || isFetching ? (
        <LoadingState label="Loading ledger journal..." />
      ) : !journal ? (
        <ErrorState />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Description</th>
                <th className="text-right text-blue-700">Debit (₹)</th>
                <th className="text-right text-purple-700">Credit (₹)</th>
                <th>Posted By</th>
                <th>Txn Ref</th>
              </tr>
            </thead>
            <tbody>
              {journal.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No entries found for the selected filters.
                  </td>
                </tr>
              ) : (
                journal.entries.map((e: any) => {
                  const acc = typeof e.ledgerAccount === 'object' ? e.ledgerAccount : null;
                  return (
                    <tr key={e._id}>
                      <td className="whitespace-nowrap text-xs">
                        {new Date(e.businessDate).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        {acc ? (
                          <div>
                            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {acc.code}
                            </span>
                            <span className="text-xs text-slate-500 ml-1">{acc.name}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        <p className="text-sm text-slate-800">{e.description}</p>
                        {e.narration && <p className="text-xs text-slate-400">{e.narration}</p>}
                      </td>
                      <td className="text-right font-mono text-sm text-blue-700">
                        {e.debitInPaise > 0 ? (e.debitInPaise / 100).toFixed(2) : ''}
                      </td>
                      <td className="text-right font-mono text-sm text-purple-700">
                        {e.creditInPaise > 0 ? (e.creditInPaise / 100).toFixed(2) : ''}
                      </td>
                      <td className="text-xs text-slate-500">{e.performedBy?.name || '—'}</td>
                      <td className="text-xs font-mono text-slate-400">
                        {e.transactionRef || e.transaction?.transactionId || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {journal && journal.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {journal.pagination.page} of {journal.pagination.totalPages} ({journal.pagination.total} entries)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= journal.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4 — POST JOURNAL VOUCHER
// ═════════════════════════════════════════════════════════════════════════════

const EMPTY_ENTRY: JVEntry = { ledgerCode: '', type: 'debit', amountInPaise: 0 };

function JournalVoucherTab() {
  // Load all accounts for the dropdown
  const { data: glData } = useQuery({
    queryKey: ['ledger-general'],
    queryFn: () => ledgerApi.getGeneralLedger(),
    staleTime: 5 * 60 * 1000,
  });
  const allAccounts: any[] = glData?.data?.groups?.flatMap((g: any) => g.accounts) || [];

  const [narration, setNarration] = useState('');
  const [entries, setEntries] = useState<(JVEntry & { id: number; amountRupees: string })[]>([
    { id: 1, ledgerCode: '', type: 'debit',  amountInPaise: 0, amountRupees: '' },
    { id: 2, ledgerCode: '', type: 'credit', amountInPaise: 0, amountRupees: '' },
  ]);
  const [showConfirm, setShowConfirm] = useState(false);
  const nextId = useRef(3);

  const mutation = useMutation({
    mutationFn: () =>
      ledgerApi.postJournalVoucher({
        narration,
        entries: entries.map(({ ledgerCode, type, amountInPaise }) => ({
          ledgerCode,
          type,
          amountInPaise,
        })),
      }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Journal Voucher posted successfully');
      setNarration('');
      setEntries([
        { id: nextId.current++, ledgerCode: '', type: 'debit',  amountInPaise: 0, amountRupees: '' },
        { id: nextId.current++, ledgerCode: '', type: 'credit', amountInPaise: 0, amountRupees: '' },
      ]);
      setShowConfirm(false);
    },
    onError: (err: any) => {
      const backendErrors = err?.response?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        backendErrors.forEach((e: any) => {
          toast.error(e.message || 'Validation error');
        });
      } else {
        toast.error(err?.response?.data?.message || 'Failed to post Journal Voucher');
      }
      setShowConfirm(false);
    },
  });

  const addEntry = () => {
    setEntries((p) => [...p, { id: nextId.current++, ledgerCode: '', type: 'debit', amountInPaise: 0, amountRupees: '' }]);
  };

  const removeEntry = (id: number) => {
    if (entries.length <= 2) return toast.error('Minimum 2 entries required');
    setEntries((p) => p.filter((e) => e.id !== id));
  };

  const updateEntry = (id: number, field: string, value: any) => {
    setEntries((p) =>
      p.map((e) => {
        if (e.id !== id) return e;
        if (field === 'amountRupees') {
          const rupees = parseFloat(value) || 0;
          return { ...e, amountRupees: value, amountInPaise: Math.round(rupees * 100) };
        }
        return { ...e, [field]: value };
      }),
    );
  };

  // Running totals
  const totalDebit = entries
    .filter((e) => e.type === 'debit')
    .reduce((s, e) => s + e.amountInPaise, 0);
  const totalCredit = entries
    .filter((e) => e.type === 'credit')
    .reduce((s, e) => s + e.amountInPaise, 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;
  const difference = Math.abs(totalDebit - totalCredit);

  const isFormValid =
    narration.trim().length >= 10 &&
    isBalanced &&
    entries.every((e) => e.ledgerCode.trim() && e.amountInPaise > 0);

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">Journal Vouchers are permanent and cannot be deleted.</p>
          <p className="mt-1 text-xs">
            JV entries directly affect ledger balances and the balance sheet.
            Use this only for opening entry, accruals, corrections (via reversal narration), or adjustments.
            Each posting is permanently logged with your name and timestamp.
          </p>
        </div>
      </div>

      {/* Narration */}
      <div className="card p-4 space-y-4">
        <div>
          <label className="form-label">Narration / Reason * <span className="text-slate-400 font-normal text-xs">(min 10 characters)</span></label>
          <textarea
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="e.g. Opening balance entry for Cash in Hand as of 01-Apr-2026 — verified by management"
            rows={2}
            maxLength={500}
            className="form-input resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{narration.length}/500</p>
        </div>

        {/* Entries Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="form-label mb-0">Journal Entries *</label>
            <button
              type="button"
              onClick={addEntry}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 w-[35%]">Account</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 w-24">Type</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 w-32">Amount (₹)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const account = allAccounts.find((a) => a.code === entry.ledgerCode);
                  const isDebit = entry.type === 'debit';
                  
                  // Calculate balance effect logic
                  let effect = null;
                  if (account) {
                    const isNormalDebit = account.normalBalance === 'debit';
                    if (isNormalDebit) {
                      effect = isDebit ? { label: 'Increases Balance', icon: TrendingUp, color: 'text-emerald-600' } 
                                     : { label: 'Decreases Balance', icon: TrendingDown, color: 'text-amber-600' };
                    } else {
                      effect = isDebit ? { label: 'Decreases Balance', icon: TrendingDown, color: 'text-amber-600' }
                                     : { label: 'Increases Balance', icon: TrendingUp, color: 'text-emerald-600' };
                    }
                  }

                  return (
                    <tr key={entry.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <select
                          value={entry.ledgerCode}
                          onChange={(e) => updateEntry(entry.id, 'ledgerCode', e.target.value)}
                          className="form-input text-xs py-1.5 font-mono"
                        >
                          <option value="">— Account —</option>
                          {['asset', 'liability', 'equity', 'income', 'expense'].map((type) => {
                            const accs = allAccounts.filter((a: any) => a.type === type);
                            if (!accs.length) return null;
                            return (
                              <optgroup key={type} label={TYPE_META[type].label}>
                                {accs.map((acc: any) => (
                                  <option key={acc._id} value={acc.code}>
                                    [{acc.code}] {acc.name}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={entry.type}
                          onChange={(e) => updateEntry(entry.id, 'type', e.target.value)}
                          className={`form-input text-xs py-1.5 font-semibold ${
                            isDebit ? 'text-blue-700' : 'text-purple-700'
                          }`}
                        >
                          <option value="debit">DR (Debit)</option>
                          <option value="credit">CR (Credit)</option>
                        </select>
                        <div className="mt-1 flex items-center gap-1 min-h-[14px]">
                          {effect && (
                            <>
                              <effect.icon className={`h-3 w-3 ${effect.color}`} />
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${effect.color}`}>
                                {effect.label}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={entry.amountRupees}
                          onChange={(e) => updateEntry(entry.id, 'amountRupees', e.target.value)}
                          className="form-input text-xs py-1.5 text-right font-mono w-full"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          disabled={entries.length <= 2}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals Footer */}
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-3 py-2 text-xs font-semibold text-slate-600" colSpan={2}>Totals</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    <div className="text-blue-700">DR: {(totalDebit / 100).toFixed(2)}</div>
                    <div className="text-purple-700">CR: {(totalCredit / 100).toFixed(2)}</div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {totalDebit > 0 && totalCredit > 0 && (
                      isBalanced
                        ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                        : <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance Status */}
          {!isBalanced && totalDebit > 0 && totalCredit > 0 && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Out of balance by ₹{(difference / 100).toFixed(2)} — DR must equal CR before posting.
            </p>
          )}
          {isBalanced && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              Balanced ✓ — Ready to post
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!isFormValid || mutation.isPending}
          >
            <PenSquare className="h-4 w-4 mr-2" /> Preview & Post Journal Voucher
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <PenSquare className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-slate-900">Confirm Journal Voucher</h3>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="font-semibold text-amber-800">This action is permanent and irreversible.</p>
                <p className="text-xs text-amber-700 mt-1">
                  The entries will be posted to the ledger immediately and cannot be deleted.
                  To correct a mistake you must post a separate reversal entry.
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Narration</p>
                <p className="font-medium text-slate-800">{narration}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Entries ({entries.length} legs)</p>
                {entries.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm py-1 border-b border-slate-100">
                    <span className={`font-mono font-semibold ${e.type === 'debit' ? 'text-blue-700' : 'text-purple-700'}`}>
                      {e.type.toUpperCase()} [{e.ledgerCode}]
                    </span>
                    <span className="font-mono font-bold">₹{(e.amountInPaise / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold pt-1">
                <span>Total Amount</span>
                <span>₹{(totalDebit / 100).toFixed(2)}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button
                isLoading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Post Journal Voucher
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon: Icon, color, sub }: any) {
  const colors: any = {
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    val: 'text-blue-800' },
    red:     { bg: 'bg-red-50',     icon: 'text-red-500',     val: 'text-red-800' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-800' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   val: 'text-amber-800' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`${c.bg} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${c.icon}`} />
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className={`font-bold text-lg ${c.val}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
      <RefreshCw className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="text-center py-16 text-red-400">
      <XCircle className="h-10 w-10 mx-auto mb-2" />
      <p className="text-sm">Failed to load data. Please try again.</p>
    </div>
  );
}

function EmptySelection({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <Search className="h-10 w-10 mx-auto mb-2" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
