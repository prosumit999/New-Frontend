// src/features/loans/LoanDetailPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY loan view (CBS industry standard).
// Financial transactions (repayment) → Transaction Hub (/transactions)
// Admin lifecycle actions (Penalty, Close, Reopen) remain here.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, XCircle, AlertTriangle, MessageSquare,
  TrendingDown, Calendar, CheckCircle, Clock, BadgeDollarSign,
  RefreshCw, ShieldAlert, ArrowRightCircle,
  FileSpreadsheet, FileText, User, Wallet,
} from 'lucide-react';
import { loanApi } from '../../api/loan.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DetailRow } from '../../components/shared/DetailRow';
import TransactionDetailModal from '../../components/shared/TransactionDetailModal';
import { formatCurrency, formatDate, formatDateTime, rupeesToPaise, isCreditTransaction } from '../../utils/format';
import { exportStatementCSV, exportStatementPDF } from '../../utils/statementExport';
import { useSystemStore } from '../../store/system.store';
import { useAuthStore } from '../../store/auth.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const branding = useSystemStore((s) => s.branding);
  const { businessDate } = useBusinessDate();

  // ── Lifecycle admin modal state ────────────────────────────────────────────
  const [showClose, setShowClose]       = useState(false);
  const [closeReason, setCloseReason]   = useState('');
  const [writeOff, setWriteOff]         = useState(false);
  const [showReopen, setShowReopen]     = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showPenalty, setShowPenalty]   = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyReason, setPenaltyReason] = useState('');

  // ── Statement filters (default: 1st of business month → business date) ──
  const [stmtPage, setStmtPage] = useState(1);
  const [fromDate, setFromDate] = useState(() => businessDate ? businessDate.slice(0, 7) + '-01' : '');
  const [toDate, setToDate]     = useState(() => businessDate || '');

  // ── Transaction detail modal ───────────────────────────────────────────────
  const [selectedTx, setSelectedTx] = useState<any>(null);

  // ── Fetch loan ─────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['loan', id],
    queryFn: () => loanApi.getById(id!),
    enabled: !!id,
  });
  const loan    = data?.data?.loan as any;
  const summary = loan?.summary as any;

  // ── Fetch repayment history / statement ───────────────────────────────────
  const { data: stmtData, isLoading: stmtLoading } = useQuery({
    queryKey: ['loan-statement', id, stmtPage, fromDate, toDate],
    queryFn: () => loanApi.getStatement(id!, {
      page: stmtPage,
      limit: 15,
      fromDate: fromDate || undefined,
      toDate:   toDate   || undefined,
    }),
    enabled: !!id,
  });
  const transactions: any[] = stmtData?.data?.transactions ?? [];
  const stmtPagination      = stmtData?.data?.pagination;

  const lastTx = transactions[transactions.length - 1];
  const openBal = lastTx?.balanceAfterInPaise != null
    ? (isCreditTransaction(lastTx.type, 'loan') 
        ? lastTx.balanceAfterInPaise - lastTx.amountInPaise // For all accounts, credit INCREASES tracked balance, so Balance Before = After - Amount
        : lastTx.balanceAfterInPaise + lastTx.amountInPaise)
    : undefined;
  const closBal = transactions[0]?.balanceAfterInPaise;

  const totalDr = transactions.reduce((acc: number, r: any) => !isCreditTransaction(r.type, 'loan') ? acc + (r.amountInPaise || 0) : acc, 0);
  const totalCr = transactions.reduce((acc: number, r: any) => isCreditTransaction(r.type, 'loan') ? acc + (r.amountInPaise || 0) : acc, 0);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['loan', id] });
    queryClient.invalidateQueries({ queryKey: ['loan-statement', id] });
    queryClient.invalidateQueries({ queryKey: ['loans'] });
  };

  // ── Close mutation ─────────────────────────────────────────────────────────
  const closeMutation = useMutation({
    mutationFn: () => loanApi.close(id!, { closureReason: closeReason, writeOff }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Loan closed successfully');
      invalidateAll();
      setShowClose(false);
      setCloseReason('');
      setWriteOff(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Close failed'),
  });

  // ── Reopen mutation ────────────────────────────────────────────────────────
  const reopenMutation = useMutation({
    mutationFn: () => loanApi.reopen(id!, { reactivationReason: reopenReason }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Loan reactivated successfully');
      invalidateAll();
      setShowReopen(false);
      setReopenReason('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Reactivation failed'),
  });

  // ── Penalty mutation ───────────────────────────────────────────────────────
  const penaltyMutation = useMutation({
    mutationFn: () => loanApi.applyPenalty(id!, {
      penaltyAmountInPaise: rupeesToPaise(penaltyAmount),
      reason: penaltyReason,
    }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Penalty applied');
      invalidateAll();
      setShowPenalty(false);
      setPenaltyAmount('');
      setPenaltyReason('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Penalty failed'),
  });

  // ── Reminder mutation ──────────────────────────────────────────────────────
  const reminderMutation = useMutation({
    mutationFn: () => loanApi.sendReminder(id!),
    onSuccess: (res: any) => toast.success(res?.message || 'SMS reminder sent'),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Reminder failed'),
  });

  // ── Export handlers ────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!loan) return;
    const accountInfo = {
      accountNumber: loan.loanAccountNumber,
      balanceInPaise: loan.outstandingBalanceInPaise,
      status: loan.status,
      openedAt: loan.disbursedAt || loan.createdAt,
      customer: loan.customer,
    };
    exportStatementCSV(transactions, accountInfo, branding, { from: fromDate, to: toDate }, 'loan');
    toast.success('CSV downloaded');
  };

  const handleExportPDF = () => {
    if (!loan) return;
    const accountInfo = {
      accountNumber: loan.loanAccountNumber,
      balanceInPaise: loan.outstandingBalanceInPaise,
      status: loan.status,
      openedAt: loan.disbursedAt || loan.createdAt,
      customer: loan.customer,
    };
    exportStatementPDF(transactions, accountInfo, branding, { from: fromDate, to: toDate }, 'loan');
    toast.success('PDF statement generated');
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
    </div>
  );

  if (isError || !loan) return (
    <div className="text-center py-24">
      <TrendingDown className="h-12 w-12 mx-auto text-red-300 mb-4" />
      <p className="text-red-500 mb-4">Failed to load loan account.</p>
      <Button variant="outline" onClick={() => navigate('/loans')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Loans
      </Button>
    </div>
  );

  const isActive     = loan.status === 'active' || loan.status === 'overdue';
  const isClosed     = loan.status === 'closed' || loan.status === 'written_off';
  const isAdmin      = user?.role === 'admin' || user?.role === 'superadmin';
  const hasOutstanding = loan.outstandingBalanceInPaise > 0;
  const repaymentPct   = summary?.repaymentProgressPct || 0;
  const pigmyBal       = loan.pigmyAccount?.balanceInPaise || summary?.pigmyAvailableInPaise || 0;

  return (
    <div className="animate-fade-in animate-slide-up">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/loans')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title font-mono tracking-tight">{loan.loanAccountNumber}</h1>
              <StatusBadge status={loan.status} />
              {loan.isOverdue && (
                <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">
                  OVERDUE — {summary?.daysOverdue || 0}d
                </span>
              )}
            </div>
            <p className="page-subtitle">
              {loan.customer?.name} · {loan.customer?.customerCode} · {loan.customer?.phone}
            </p>
          </div>
        </div>

        {/* Action buttons — admin lifecycle only, no repay button here */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Transaction Counter shortcut */}
          <Link
            to={`/transactions/hub?account=${loan.loanAccountNumber}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            <ArrowRightCircle className="h-4 w-4" /> Transaction Counter
          </Link>

          {isActive && isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reminderMutation.mutate()}
                disabled={reminderMutation.isPending}
              >
                <MessageSquare className="h-4 w-4 mr-1.5" />
                {reminderMutation.isPending ? 'Sending...' : 'SMS Reminder'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => setShowPenalty(true)}
              >
                <AlertTriangle className="h-4 w-4 mr-1.5" /> Apply Penalty
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowClose(true)}
              >
                <XCircle className="h-4 w-4 mr-1.5" /> Close Loan
              </Button>
            </>
          )}
          {isClosed && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={() => setShowReopen(true)}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" /> Reactivate Loan
            </Button>
          )}
        </div>
      </div>

      {/* ── Info banner: use Transaction Counter for repayments ─────────────── */}
      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          To make a loan repayment — use the{' '}
          <Link to={`/transactions/hub?account=${loan.loanAccountNumber}`} className="font-semibold underline hover:text-blue-600">
            Transaction Counter
          </Link>{' '}
          → Internal Transfer → Saving → Loan Repayment.
        </span>
      </div>

      {/* ── Progress Bar ────────────────────────────────────────────────────── */}
      <div className="mb-6 bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-500 font-medium">Repayment Progress</span>
          <span className="font-bold text-blue-700">{repaymentPct}%</span>
        </div>
        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-2.5 rounded-full transition-all duration-700"
            style={{
              width: `${repaymentPct}%`,
              background: 'linear-gradient(90deg, #3b82f6, #10b981)',
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
          <span>Paid: {formatCurrency(loan.totalPaidInPaise)}</span>
          <span>Outstanding: {formatCurrency(loan.outstandingBalanceInPaise)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Loan Details + Statement ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Loan Details */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-900">Loan Details</h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Loan Account No." value={<span className="font-mono font-bold text-blue-700">{loan.loanAccountNumber}</span>} />
                <DetailRow label="Customer" value={`${loan.customer?.name} (${loan.customer?.customerCode})`} />
                <DetailRow label="Linked Saving" value={
                  loan.savingAccount?.accountNumber
                    ? <Link to={`/savings/${loan.savingAccount?._id}`} className="text-blue-600 hover:underline font-mono text-sm">{loan.savingAccount?.accountNumber}</Link>
                    : '—'
                } />
                <DetailRow label="Linked Pigmy" value={
                  loan.pigmyAccount?.accountNumber
                    ? <span>{loan.pigmyAccount.accountNumber} {pigmyBal > 0 ? `(Bal: ${formatCurrency(pigmyBal)})` : ''}</span>
                    : '—'
                } />
                <DetailRow label="Loan Plan" value={loan.loanPlan?.planName} />
                <DetailRow label="Duration" value={`${loan.durationMonths} months`} />
                <DetailRow label="Interest Rate" value={`${(loan.interestRateBps / 100).toFixed(2)}% flat per annum`} />
              </dl>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-900">Financial Breakdown</h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Principal Amount" value={<span className="font-bold">{formatCurrency(loan.principalAmountInPaise)}</span>} />
                <DetailRow label="Upfront Interest" value={formatCurrency(loan.interestInPaise)} />
                <DetailRow label="Processing Fee" value={formatCurrency(loan.processingFeeInPaise)} />
                <DetailRow label="Net Disbursal" value={<span className="font-bold text-emerald-700">{formatCurrency(loan.netDisbursalInPaise)}</span>} />
                <DetailRow label="Total Repaid" value={formatCurrency(loan.totalPaidInPaise)} />
                <DetailRow
                  label="Outstanding"
                  value={<span className={`font-bold ${loan.outstandingBalanceInPaise > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(loan.outstandingBalanceInPaise)}</span>}
                />
                <DetailRow label="Penalty Applied" value={formatCurrency(loan.penaltyAmountInPaise)} />
              </dl>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Disbursed At" value={formatDateTime(loan.disbursedAt)} />
                <DetailRow label="Maturity Date" value={formatDate(loan.maturityDate)} />
                {summary?.daysToMaturity > 0 && <DetailRow label="Days to Maturity" value={`${summary.daysToMaturity} days`} />}
                {summary?.daysOverdue > 0 && <DetailRow label="Days Overdue" value={<span className="text-red-600 font-semibold">{summary.daysOverdue} days</span>} />}
                {loan.closedAt && <DetailRow label="Closed At" value={formatDateTime(loan.closedAt)} />}
                {loan.closeNote && <DetailRow label="Closure Reason" value={loan.closeNote} />}
                {loan.writtenOffAt && <DetailRow label="Written Off At" value={formatDateTime(loan.writtenOffAt)} />}
                {loan.writeOffReason && <DetailRow label="Write-off Reason" value={loan.writeOffReason} />}
                <DetailRow label="Monthly Missed Days" value={loan.currentMonthMissedDays ?? 0} />
              </dl>
            </div>
          </div>

          {/* ── Repayment History / Statement ─────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-1">
                  <Calendar className="h-4 w-4 text-slate-500" /> Repayment History
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    disabled={transactions.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export CSV
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={transactions.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    <FileText className="h-3.5 w-3.5 text-red-600" /> Export PDF
                  </button>
                </div>
              </div>
              {/* Date filter */}
              <div className="flex gap-2 mt-2 flex-wrap">
                <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setStmtPage(1); }}
                  className="text-xs py-1 px-2 h-8 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span className="text-slate-400 self-center text-xs">to</span>
                <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setStmtPage(1); }}
                  className="text-xs py-1 px-2 h-8 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                {(fromDate || toDate) && (
                  <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); setStmtPage(1); }}>Clear</Button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Txn ID</th>
                    <th>Narration / Type</th>
                    <th className="text-right text-red-600">Dr (₹)</th>
                    <th className="text-right text-emerald-600">Cr (₹)</th>
                    <th className="text-right">Outstanding (₹)</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {stmtLoading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-500">Loading...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-500">No transactions found for this period.</td></tr>
                  ) : (
                    <>
                      {/* Banking Format - Opening Outstanding Row */}
                      <tr className="bg-blue-50/60">
                        <td colSpan={6} className="text-right py-2.5 pr-4 text-xs font-semibold text-blue-700">Opening Outstanding on Page</td>
                        <td className="text-right py-2.5 font-bold text-blue-800 text-sm">{openBal !== undefined ? formatCurrency(openBal) : '—'}</td>
                        <td></td>
                      </tr>

                      {transactions.map((tx: any, idx: number) => {
                        const isCredit = isCreditTransaction(tx.type, 'loan');
                        return (
                          <tr key={tx._id || idx} className={`transition-colors hover:bg-slate-50/80 ${isCredit ? 'bg-emerald-50/20' : 'bg-red-50/20'}`}>
                            <td className="text-xs text-slate-400">{idx + 1}</td>
                            <td className="text-slate-500 text-xs whitespace-nowrap">{formatDateTime(tx.businessDate || tx.createdAt)}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => setSelectedTx(tx)}
                                className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                title="Click to view full details"
                              >
                                {tx.transactionId}
                              </button>
                            </td>
                            <td>
                              <p className="text-xs font-medium text-slate-700">{tx.note || tx.type?.replace(/_/g, ' ') || '—'}</p>
                              <span className="text-[10px] text-slate-400 font-mono capitalize">{(tx.type || '').replace(/_/g, ' ')}</span>
                            </td>
                            {/* Dr — repayments/write-offs reduce outstanding */}
                            <td className="text-right font-mono font-semibold text-red-600 text-sm">
                              {!isCredit ? formatCurrency(Math.abs(tx.amountInPaise)) : <span className="text-slate-300">—</span>}
                            </td>
                            {/* Cr — disbursements/penalties/reversals increase outstanding */}
                            <td className="text-right font-mono font-semibold text-emerald-600 text-sm">
                              {isCredit ? formatCurrency(Math.abs(tx.amountInPaise)) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="text-right font-mono text-amber-700 font-bold text-sm">
                              {tx.balanceAfterInPaise != null ? formatCurrency(tx.balanceAfterInPaise) : '—'}
                            </td>
                            <td className="text-xs text-slate-500">{tx.performedBy?.name || '—'}</td>
                          </tr>
                        );
                      })}

                      {/* Banking Format - Grand Total Footer */}
                      <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold">
                        <td colSpan={4} className="text-right py-2.5 pr-4 text-xs text-slate-600 uppercase tracking-wider">Page Total</td>
                        <td className="text-right py-2.5 text-red-700 text-sm">{formatCurrency(totalDr)}</td>
                        <td className="text-right py-2.5 text-emerald-700 text-sm">{formatCurrency(totalCr)}</td>
                        <td className="text-right py-2.5 text-amber-800 text-sm">{closBal !== undefined ? formatCurrency(closBal) : '—'}</td>
                        <td></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {stmtPagination && stmtPagination.totalPages > 1 && (
              <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
                <span>Page {stmtPagination.page} of {stmtPagination.totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={stmtPage === 1} onClick={() => setStmtPage(p => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={stmtPage === stmtPagination.totalPages} onClick={() => setStmtPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Outstanding card */}
          <div className="card overflow-hidden">
            <div className="p-5 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-1">Outstanding</p>
              <p className={`text-3xl font-bold ${loan.outstandingBalanceInPaise === 0 ? 'text-emerald-300' : 'text-white'}`}>
                {formatCurrency(loan.outstandingBalanceInPaise)}
              </p>
              {loan.outstandingBalanceInPaise === 0 && (
                <p className="text-emerald-300 text-sm mt-1 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Fully Repaid
                </p>
              )}
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 bg-slate-50">
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">{formatCurrency(loan.totalPaidInPaise)}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total Paid</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">{repaymentPct}%</p>
                <p className="text-xs text-slate-400 mt-0.5">Progress</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
            </div>
            <div className="card-body space-y-2">
              <Link
                to={`/transactions/hub?account=${loan.loanAccountNumber}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                <ArrowRightCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Go to Transaction Counter</p>
                  <p className="text-xs text-blue-500">Repayment → Internal Transfer → Saving → Loan</p>
                </div>
              </Link>
              <button
                onClick={handleExportPDF}
                disabled={transactions.length === 0}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-40"
              >
                <FileText className="h-5 w-5 text-slate-600 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-800">Download Statement</p>
                  <p className="text-xs text-slate-500">PDF repayment history</p>
                </div>
              </button>
            </div>
          </div>

          {/* Pigmy Balance Info (read-only — no action button) */}
          {isActive && pigmyBal > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-slate-500" /> Pigmy Balance
                </h2>
              </div>
              <div className="card-body">
                <p className={`text-2xl font-bold mb-1 ${pigmyBal > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {formatCurrency(pigmyBal)}
                </p>
                {summary?.canFullySettleFromPigmy && (
                  <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 rounded px-2 py-1 mb-2">
                    ✓ Can fully settle loan outstanding!
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Use <strong>Transaction Counter → Internal Transfer → Pigmy → Saving → Loan</strong> to apply pigmy balance.
                </p>
              </div>
            </div>
          )}

          {/* Urgency indicator */}
          {isActive && summary?.daysToMaturity !== undefined && (
            <div className={`card p-4 border-l-4 ${
              summary?.daysOverdue > 0 ? 'border-l-red-500 bg-red-50' :
              summary?.daysToMaturity <= 7 ? 'border-l-orange-500 bg-orange-50' :
              summary?.daysToMaturity <= 30 ? 'border-l-amber-400 bg-amber-50' :
              'border-l-emerald-400 bg-emerald-50'
            }`}>
              <div className="flex items-start gap-2">
                <Clock className={`h-4 w-4 mt-0.5 ${
                  summary?.daysOverdue > 0 ? 'text-red-600' :
                  summary?.daysToMaturity <= 7 ? 'text-orange-600' :
                  summary?.daysToMaturity <= 30 ? 'text-amber-600' : 'text-emerald-600'
                }`} />
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    {summary?.daysOverdue > 0 ? `${summary.daysOverdue} days overdue` :
                     `${summary.daysToMaturity} days to maturity`}
                  </p>
                  <p className="text-xs text-slate-500">Matures: {formatDate(loan.maturityDate)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Created/Closed by */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" /> Responsibility
              </h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Opened By" value={loan.createdBy?.name} />
                {loan.closedBy && <DetailRow label="Closed By" value={loan.closedBy?.name} />}
                {loan.writtenOffBy && <DetailRow label="Written Off By" value={loan.writtenOffBy?.name} />}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* ── Close Loan Modal ─────────────────────────────────────────────────── */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Close Loan Account</h3>
                <p className="text-xs text-slate-500">Outstanding: {formatCurrency(loan.outstandingBalanceInPaise)}</p>
              </div>
            </div>

            {hasOutstanding && !writeOff && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Cannot close — outstanding balance exists</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Collect the remaining {formatCurrency(loan.outstandingBalanceInPaise)} via the Transaction Counter,
                    or enable <strong>Write-Off</strong> below to classify as bad debt.
                  </p>
                </div>
              </div>
            )}

            {writeOff && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl flex gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Write-Off — Irreversible Financial Action</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {formatCurrency(loan.outstandingBalanceInPaise)} will be posted as <strong>Bad Debt Expense</strong> to the P&L statement.
                    This permanently reduces company profit. Only use if the debt is genuinely irrecoverable.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="form-label">Reason <span className="text-red-500">*</span></label>
                <Textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Minimum 5 characters required..."
                  rows={3}
                />
              </div>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={writeOff}
                  onChange={(e) => setWriteOff(e.target.checked)}
                  className="rounded text-red-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Write off remaining balance</p>
                  <p className="text-xs text-slate-400">Use for bad debt — outstanding will be posted to P&L as expense</p>
                </div>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => { setShowClose(false); setWriteOff(false); setCloseReason(''); }} disabled={closeMutation.isPending}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1"
                isLoading={closeMutation.isPending}
                disabled={closeReason.trim().length < 5 || (hasOutstanding && !writeOff)}
                onClick={() => closeMutation.mutate()}
              >
                {writeOff ? '⚠ Write Off Loan' : 'Close Loan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Penalty Modal ────────────────────────────────────────────────────── */}
      {showPenalty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Apply Penalty</h3>
                <p className="text-xs text-slate-500">Outstanding: {formatCurrency(loan.outstandingBalanceInPaise)}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Penalty Amount (₹) <span className="text-red-500">*</span></label>
                <Input type="number" min="1" step="0.01" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} placeholder="Enter amount in rupees" />
                {penaltyAmount && <p className="text-xs text-slate-400 mt-1">{rupeesToPaise(penaltyAmount)} paise</p>}
              </div>
              <div>
                <label className="form-label">Reason <span className="text-red-500">*</span></label>
                <Textarea value={penaltyReason} onChange={(e) => setPenaltyReason(e.target.value)} placeholder="Reason for penalty..." rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setShowPenalty(false)} disabled={penaltyMutation.isPending}>Cancel</Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                isLoading={penaltyMutation.isPending}
                disabled={!penaltyAmount || parseFloat(penaltyAmount) < 1 || penaltyReason.length < 3}
                onClick={() => penaltyMutation.mutate()}
              >
                Apply Penalty
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen Loan Modal ────────────────────────────────────────────────── */}
      {showReopen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Reactivate Loan Account</h3>
                <p className="text-xs text-slate-500">{loan.loanAccountNumber} · {loan.customer?.name}</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <p className="text-xs font-semibold text-blue-800">Reactivation Details</p>
              <p className="text-xs text-blue-700">• Current status: <strong>{loan.status.toUpperCase()}</strong></p>
              <p className="text-xs text-blue-700">
                • Will restore as: <strong>{businessDate && businessDate > loan.maturityDate ? 'OVERDUE (penalty rate applies)' : 'ACTIVE (normal rate)'}</strong>
              </p>
              {loan.status === 'written_off' && (
                <p className="text-xs text-blue-700">
                  • Write-off ledger entry will be <strong>reversed</strong> — Bad Debt Expense removed from P&L
                </p>
              )}
              <p className="text-xs text-blue-700">
                • Outstanding: <strong>{formatCurrency(loan.outstandingBalanceInPaise)}</strong> will be restored on books
              </p>
            </div>

            <div>
              <label className="form-label">Reactivation Reason <span className="text-red-500">*</span></label>
              <Textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Customer returned and agreed to resume payments (min 5 characters)..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 mt-5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowReopen(false); setReopenReason(''); }}
                disabled={reopenMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                isLoading={reopenMutation.isPending}
                disabled={reopenReason.trim().length < 5}
                onClick={() => reopenMutation.mutate()}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" /> Confirm Reactivation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction Detail Modal ─────────────────────────────────────────── */}
      <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}

// ── Named Calculator icon (no lucide equivalent) ───────────────────────────
function Calculator({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="8" x2="8" y1="14" y2="14" />
      <line x1="12" x2="12" y1="14" y2="14" />
      <line x1="16" x2="16" y1="14" y2="14" />
      <line x1="8" x2="8" y1="18" y2="18" />
      <line x1="12" x2="12" y1="18" y2="18" />
      <line x1="16" x2="16" y1="18" y2="18" />
    </svg>
  );
}
