// src/features/transactions/TransactionHistoryPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// FULL TRANSACTION HISTORY
// - Filterable by date range, type, status
// - Deep-link: /transactions/history?txnId=TXN-2026-00001 auto-opens detail
// - PDF + CSV export via exportReportPDF (unified report engine)
// - Click row → TransactionDetailModal
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Filter, Download, FileText, RefreshCw, ChevronLeft,
  ChevronRight, ClipboardList, Loader2, XCircle, ArrowUpRight,
  ArrowDownLeft, ArrowLeftRight, Banknote, CheckCircle, AlertCircle,
  Clock, Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { transactionApi, type TransactionRecord } from '../../api/transaction.api';
import TransactionDetailModal from '../../components/shared/TransactionDetailModal';
import { exportReportPDF } from '../../utils/reportExport';
import { useSystemStore } from '../../store/system.store';

// ── Constants ─────────────────────────────────────────────────────────────────
const TXN_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'saving_deposit', label: 'Saving Deposit' },
  { value: 'saving_withdrawal', label: 'Saving Withdrawal' },
  { value: 'saving_opening_charge', label: 'Account Opening Charge' },
  { value: 'pigmy_collection', label: 'Pigmy Collection' },
  { value: 'pigmy_withdrawal', label: 'Pigmy Withdrawal' },
  { value: 'agent_collection', label: 'Agent Collection' },
  { value: 'agent_collection_reversal', label: 'Agent Collection Reversal' },
  { value: 'agent_deposit', label: 'Agent Deposit' },
  { value: 'agent_deposit_reversal', label: 'Agent Deposit Reversal' },
  { value: 'loan_to_saving', label: 'Loan Disbursement' },
  { value: 'processing_fee', label: 'Processing Fee' },
  { value: 'interest_deduction', label: 'Interest Deduction' },
  { value: 'loan_repayment', label: 'Loan Repayment' },
  { value: 'loan_repayment_reversal', label: 'Loan Repayment Reversal' },
  { value: 'loan_closure', label: 'Loan Closure' },
  { value: 'loan_write_off', label: 'Loan Write-Off' },
  { value: 'penalty_charge', label: 'Penalty Charge' },
  { value: 'missed_collection_penalty', label: 'Missed Day Penalty' },
  { value: 'saving_to_loan_repayment', label: 'Saving → Loan Repayment' },
  { value: 'saving_to_pigmy_transfer', label: 'Saving → Pigmy Transfer' },
  { value: 'pigmy_to_saving_transfer', label: 'Pigmy → Saving Transfer' },
  { value: 'journal_voucher', label: 'Journal Voucher' },
];

const STATUS_OPTS = [
  { value: '', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'reversed', label: 'Reversed' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (paise: number) =>
  `₹${((paise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const labelFor = (type: string) =>
  TXN_TYPES.find((t) => t.value === type)?.label || type;

const getTypeIcon = (type: string) => {
  if (type.includes('deposit') || type.includes('saving_deposit')) return ArrowDownLeft;
  if (type.includes('withdrawal')) return ArrowUpRight;
  if (type.includes('repayment') || type.includes('closure')) return ArrowDownLeft;
  if (type.includes('loan_to_saving') || type.includes('disbursement')) return ArrowUpRight;
  if (type.includes('transfer')) return ArrowLeftRight;
  if (type.includes('penalty') || type.includes('fee') || type.includes('charge')) return AlertCircle;
  if (type.includes('journal')) return Banknote;
  return Banknote;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    reversed: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return map[status] || 'bg-slate-100 text-slate-500 border-slate-200';
};

// ── Account reference display ─────────────────────────────────────────────────
const accountRef = (txn: TransactionRecord): string => {
  const parts: string[] = [];
  if (txn.fromSavingAccount?.accountNumber) parts.push(txn.fromSavingAccount.accountNumber);
  if (txn.toSavingAccount?.accountNumber) parts.push(txn.toSavingAccount.accountNumber);
  if (txn.fromPigmyAccount?.accountNumber) parts.push(txn.fromPigmyAccount.accountNumber);
  if (txn.toPigmyAccount?.accountNumber) parts.push(txn.toPigmyAccount.accountNumber);
  if (txn.fromLoanAccount?.loanAccountNumber) parts.push(txn.fromLoanAccount.loanAccountNumber);
  if (txn.toLoanAccount?.loanAccountNumber) parts.push(txn.toLoanAccount.loanAccountNumber);
  // CRITICAL: use '->' instead of unicode arrow '→' to prevent jsPDF text corruption
  return parts.join(' -> ') || (txn.reference ?? '—');
};

// ── Narration builder ─────────────────────────────────────────────────────────
const buildNarration = (txn: TransactionRecord): string => {
  const base = txn.note || labelFor(txn.type) || '—';
  if (txn.feeInPaise && txn.feeInPaise > 0) {
    return `${base} (incl. fee ₹${((txn.feeInPaise) / 100).toFixed(2)})`;
  }
  return base;
};

// ── Income/Credit determination for global view ──────────────────────────────
const isIncomeType = (type: string) =>
  ['pigmy_collection', 'saving_deposit', 'loan_repayment', 'agent_deposit',
   'bank_receipt', 'saving_to_pigmy_transfer', 'loan_write_off_reversal',
   'loan_repayment_reversal', 'processing_fee', 'account_opening_charge',
   'penalty_charge', 'missed_collection_penalty'].includes(type);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function TransactionHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Filters ────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [txnType, setTxnType] = useState('');
  const [status, setStatus] = useState('');
  const [searchId, setSearchId] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // ── Deep-link modal ────────────────────────────────────────────────────────
  const [modalTxn, setModalTxn] = useState<TransactionRecord | null>(null);
  const [isLoadingDeepLink, setIsLoadingDeepLink] = useState(false);

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const branding = useSystemStore(s => s.branding);
  const [isExporting, setIsExporting] = useState(false);

  // ── Handle deep-link on mount ─────────────────────────────────────────────
  useEffect(() => {
    const txnId = searchParams.get('txnId');
    if (!txnId) return;
    setSearchParams({}, { replace: true }); // clean URL immediately
    openByTxnId(txnId);
  }, []);

  // Handle paste in search box: if it looks like a TXN ID, auto-lookup
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchId.trim()) {
      const val = searchId.trim().toUpperCase();
      if (/^TXN-\d{4}-\d+$/.test(val)) {
        openByTxnId(val);
      }
    }
  };

  const openByTxnId = useCallback(async (txnId: string) => {
    setIsLoadingDeepLink(true);
    try {
      const res = await transactionApi.getById(txnId);
      const txn = (res as any)?.data?.data?.transaction;
      if (txn) setModalTxn(txn);
      else toast.error(`Transaction not found: ${txnId}`);
    } catch {
      toast.error(`Transaction not found: ${txnId}`);
    } finally {
      setIsLoadingDeepLink(false);
    }
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const queryParams = useMemo(() => ({
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    type: txnType || undefined,
    status: status || undefined,
    page,
    limit: LIMIT,
  }), [fromDate, toDate, txnType, status, page]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['tx-history', queryParams],
    queryFn: () => transactionApi.list(queryParams),
    staleTime: 30_000,
  });

  const res = (data as any)?.data?.data;
  const transactions: TransactionRecord[] = res?.transactions ?? [];
  const pagination = res?.pagination ?? {};

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleCsvExport = () => {
    const headers = [
      'Date', 'Time', 'Txn ID', 'Type', 'Customer', 'Customer Code',
      'Account Ref', 'Payment Mode', 'Narration',
      'Debit (Dr) ₹', 'Credit (Cr) ₹', 'Balance After ₹', 'Status', 'Performed By'
    ];
    const rows = transactions.map((t) => {
      const isIncome = isIncomeType(t.type);
      const amt = ((t.amountInPaise ?? 0) / 100).toFixed(2);
      const bal = t.balanceAfterInPaise != null ? ((t.balanceAfterInPaise) / 100).toFixed(2) : '';
      const narration = buildNarration(t);

      return [
        new Date(t.businessDate).toLocaleDateString('en-IN'),
        new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        t.transactionId,
        labelFor(t.type),
        t.customer?.name || '—',
        t.customer?.customerCode || '—',
        accountRef(t),
        (t.paymentMode || 'CASH').toUpperCase(),
        `"${narration.replace(/"/g, '""')}"`,
        isIncome ? '' : amt,
        isIncome ? amt : '',
        bal,
        (t.status || '').toUpperCase(),
        t.performedBy?.name || 'System',
      ];
    });

    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows]
      .map((r) => r.join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-history-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // ── PDF export ─────────────────────────────────────────────────────────────
  const handlePdfExport = () => {
    // Landscape A4 usable width = 297 - 14 - 14 = 269mm total across all cols
    const columns = [
      { header: 'Date',        dataKey: 'date',      width: 20 },
      { header: 'Txn ID',      dataKey: 'txnId',     width: 30 },
      { header: 'Customer',    dataKey: 'customer',  width: 30 },
      { header: 'Account Ref', dataKey: 'acRef',     width: 28 },
      { header: 'Mode',        dataKey: 'mode',      width: 14 },
      { header: 'Narration',   dataKey: 'narration', width: 38 },
      { header: 'Debit (Dr)',  dataKey: 'debit',     width: 22, align: 'right' as const },
      { header: 'Credit (Cr)', dataKey: 'credit',    width: 22, align: 'right' as const },
      { header: 'Bal After',   dataKey: 'bal',       width: 22, align: 'right' as const },
      { header: 'Status',      dataKey: 'status',    width: 18 },
      { header: 'By',          dataKey: 'by',        width: 18 },
      { header: 'Time',        dataKey: 'time',      width: 14 },
    ];

    const rows = transactions.map((t) => {
      const isIncome = isIncomeType(t.type);
      const amt = ((t.amountInPaise ?? 0) / 100).toFixed(2);
      return {
        date:      new Date(t.businessDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        txnId:     t.transactionId,
        customer:  t.customer?.name || '-',
        acRef:     accountRef(t),
        mode:      (t.paymentMode || 'CASH').toUpperCase(),
        narration: buildNarration(t),
        debit:     isIncome ? '' : amt,
        credit:    isIncome ? amt : '',
        bal:       t.balanceAfterInPaise != null ? ((t.balanceAfterInPaise) / 100).toFixed(2) : '-',
        status:    (t.status || '').toUpperCase(),
        by:        t.performedBy?.name || 'System',
        time:      new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };
    });

    const periodLabel = fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate ? `From ${fromDate}` : toDate ? `To ${toDate}` : 'All Dates';

    setIsExporting(true);
    try {
      exportReportPDF({
        title: 'Transaction History Register',
        subtitle: periodLabel,
        columns,
        rows,
        orientation: 'landscape',
        branding,
        filename: `transaction-history-${today}`,
        summary: [
          { label: 'Total Records', value: String(pagination.total ?? transactions.length) },
          { label: 'Filter: Type', value: txnType ? labelFor(txnType) : 'All' },
          { label: 'Filter: Status', value: status || 'All' },
          { label: 'Generated On', value: new Date().toLocaleString('en-IN') },
        ],
      });
    } finally {
      setIsExporting(false);
    }
  };


  const resetFilters = () => {
    setFromDate(''); setToDate('');
    setTxnType(''); setStatus('');
    setSearchId(''); setPage(1);
  };

  const hasFilters = fromDate || toDate || txnType || status;

  return (
    <div className="animate-fade-in space-y-5" id="transaction-history-page">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 page-header mb-0">
        <div className="flex-1">
          <h1 className="page-title flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            Transaction History
          </h1>
          <p className="page-subtitle">Complete double-entry ledger trail — all financial events</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Paste TXN ID & press Enter"
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-60 bg-white"
            />
            {isLoadingDeepLink && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
            )}
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-3 flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-300" />
          <span className="text-sm font-semibold text-white">Filters</span>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1 text-xs text-slate-300 hover:text-red-300 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" /> Clear All
            </button>
          )}
        </div>
        <div className="p-4 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</label>
            <select
              value={txnType}
              onChange={(e) => { setTxnType(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 min-w-[180px]"
            >
              {TXN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            >
              {STATUS_OPTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleCsvExport}
              disabled={transactions.length === 0}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-200 bg-slate-50 rounded-xl px-4 py-2 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={handlePdfExport}
              disabled={transactions.length === 0 || isExporting}
              className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 border border-blue-200 bg-blue-50 rounded-xl px-4 py-2 hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Strip ─────────────────────────────────────── */}
      {pagination.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-blue-50 rounded-xl p-2"><ClipboardList className="h-4 w-4 text-blue-600" /></div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Records</p>
              <p className="text-xl font-bold text-slate-800">{pagination.total ?? transactions.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-emerald-50 rounded-xl p-2"><ArrowDownLeft className="h-4 w-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Credits (Cr)</p>
              <p className="text-xl font-bold text-emerald-700">
                {fmt(transactions.filter(t => isIncomeType(t.type)).reduce((s, t) => s + (t.amountInPaise ?? 0), 0))}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-red-50 rounded-xl p-2"><ArrowUpRight className="h-4 w-4 text-red-600" /></div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Debits (Dr)</p>
              <p className="text-xl font-bold text-red-600">
                {fmt(transactions.filter(t => !isIncomeType(t.type)).reduce((s, t) => s + (t.amountInPaise ?? 0), 0))}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-slate-100 rounded-xl p-2"><RefreshCw className="h-4 w-4 text-slate-500" /></div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Page</p>
              <p className="text-xl font-bold text-slate-700">{page} <span className="text-sm font-medium text-slate-400">of {pagination.totalPages ?? 1}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Txn ID</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Account Ref</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Mode</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Narration</th>
                <th className="text-right px-4 py-3.5 text-xs font-bold text-red-500 uppercase tracking-wider">Debit (Dr)</th>
                <th className="text-right px-4 py-3.5 text-xs font-bold text-emerald-600 uppercase tracking-wider">Credit (Cr)</th>
                <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Bal After</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">By</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Loading transactions…</p>
                  </td>
                </tr>
              )}
              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <ClipboardList className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-400">No transactions found</p>
                    <p className="text-xs text-gray-300 mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              )}
              {!isLoading && transactions.map((txn, idx) => {
                const isIncome = isIncomeType(txn.type);
                const isReversed = txn.isReversed || txn.status === 'reversed';
                return (
                  <tr
                    key={txn._id}
                    onClick={() => setModalTxn(txn)}
                    className={`hover:bg-blue-50/30 cursor-pointer transition-colors group border-b border-slate-50 last:border-0 ${
                      isReversed ? 'opacity-50' : ''
                    } ${isIncome ? 'bg-emerald-50/10' : 'bg-red-50/10'}`}
                  >
                    {/* # */}
                    <td className="px-4 py-3 text-center text-xs text-gray-400 font-mono">
                      {(page - 1) * LIMIT + idx + 1}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {new Date(txn.businessDate).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>

                    {/* Txn ID */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{txn.transactionId}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(txn.transactionId);
                            toast.success('Copied!');
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-blue-600 text-gray-400"
                          title="Copy ID"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      {txn.customer ? (
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{txn.customer.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{txn.customer.customerCode}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Account Ref */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{accountRef(txn)}</span>
                    </td>

                    {/* Mode */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium uppercase">
                        {txn.paymentMode || 'CASH'}
                      </span>
                    </td>

                    {/* Narration */}
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">
                      <p className="truncate" title={buildNarration(txn)}>{buildNarration(txn)}</p>
                    </td>

                    {/* Debit */}
                    <td className="px-4 py-3 text-right">
                      {!isIncome && (
                        <span className="font-semibold text-red-600 text-sm">{fmt(txn.amountInPaise)}</span>
                      )}
                    </td>

                    {/* Credit */}
                    <td className="px-4 py-3 text-right">
                      {isIncome && (
                        <span className="font-semibold text-emerald-600 text-sm">{fmt(txn.amountInPaise)}</span>
                      )}
                    </td>

                    {/* Bal After */}
                    <td className="px-4 py-3 text-right text-gray-600 font-medium text-sm">
                      {txn.balanceAfterInPaise != null ? fmt(txn.balanceAfterInPaise) : '—'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${statusBadge(txn.status)}`}>
                        {isReversed ? (
                          <><XCircle className="h-3 w-3" /> REVERSED</>
                        ) : (
                          <>
                            {txn.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                            {txn.status === 'pending' && <Clock className="h-3 w-3" />}
                            {txn.status === 'failed' && <AlertCircle className="h-3 w-3" />}
                            {txn.status}
                          </>
                        )}
                      </span>
                    </td>

                    {/* By */}
                    <td className="px-4 py-3">
                      {txn.performedBy ? (
                        <span className="text-xs text-gray-700">{txn.performedBy.name}</span>
                      ) : (
                        <span className="text-xs text-gray-300">System</span>
                      )}
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3 text-center text-xs text-gray-400 font-medium whitespace-nowrap">
                      {new Date(txn.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────── */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <p className="text-sm text-slate-500">
              Page <strong className="text-slate-700">{page}</strong> of <strong className="text-slate-700">{pagination.totalPages}</strong>
              <span className="ml-2 text-slate-400">({pagination.total} total)</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-xl px-4 py-2 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="flex items-center gap-1 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-xl px-4 py-2 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Transaction Detail Modal ────────────────────────── */}
      {modalTxn && (
        <TransactionDetailModal
          tx={modalTxn}
          onClose={() => setModalTxn(null)}
        />
      )}
    </div>
  );
}
