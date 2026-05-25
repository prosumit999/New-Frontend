// src/features/savings/SavingDetailPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY account view (CBS industry standard).
// Financial transactions → Transaction Hub (/transactions)
// Lifecycle admin actions (Freeze / Unfreeze / Close) remain here.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DetailRow } from '../../components/shared/DetailRow';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import TransactionDetailModal from '../../components/shared/TransactionDetailModal';
import {
  ArrowLeft, Lock, Unlock, XCircle,
  TrendingUp, User, Calendar, Receipt,
  Download, FileText, ArrowRightCircle,
  FileSpreadsheet, AlertTriangle,
} from 'lucide-react';
import { savingApi } from '../../api/saving.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { formatCurrency, formatDate, formatDateTime, isCreditTransaction } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { exportStatementCSV, exportStatementPDF } from '../../utils/statementExport';
import { useSystemStore } from '../../store/system.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { SavingAccount } from '../../types';

// ── Transaction type pill ─────────────────────────────────────────────────────
const TxTypeBadge = ({ type }: { type: string }) => {
  const colorMap: Record<string, string> = {
    saving_deposit: 'bg-emerald-100 text-emerald-700',
    saving_withdrawal: 'bg-red-100 text-red-700',
    saving_opening_charge: 'bg-amber-100 text-amber-700',
    saving_to_pigmy_transfer: 'bg-indigo-100 text-indigo-700',
    pigmy_to_saving_transfer: 'bg-amber-100 text-amber-700',
    loan_repayment: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colorMap[type] ?? 'bg-slate-100 text-slate-600'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
};

export default function SavingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const branding = useSystemStore((s) => s.branding);
  const { businessDate } = useBusinessDate();

  const isSuperadmin = user?.role === 'superadmin';
  const canClose   = user?.role === 'admin';                          // CLOSE_SAVING_ACCOUNT: admin only
  const canFreeze  = user?.role === 'admin' || isSuperadmin;          // FREEZE/UNFREEZE: superadmin + admin

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [showClose, setShowClose]     = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [showFreeze, setShowFreeze]   = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [showUnfreeze, setShowUnfreeze] = useState(false);

  // ── Statement filters (default: 1st of business month → business date) ──
  const [statementPage, setStatementPage] = useState(1);
  const [fromDate, setFromDate] = useState(() => businessDate ? businessDate.slice(0, 7) + '-01' : '');
  const [toDate, setToDate]     = useState(() => businessDate || '');

  // ── Transaction detail modal ───────────────────────────────────────────────
  const [selectedTx, setSelectedTx] = useState<any>(null);

  // ── Fetch account ──────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['saving', id],
    queryFn: () => savingApi.getAccount(id!),
    enabled: !!id,
  });
  const account: SavingAccount | undefined = data?.data?.account;

  // ── Fetch statement ────────────────────────────────────────────────────────
  const { data: stmtData, isLoading: stmtLoading } = useQuery({
    queryKey: ['saving-statement', id, statementPage, fromDate, toDate],
    queryFn: () => savingApi.getStatement(id!, {
      page: statementPage,
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
    ? (isCreditTransaction(lastTx.type, 'saving') 
        ? lastTx.balanceAfterInPaise - lastTx.amountInPaise 
        : lastTx.balanceAfterInPaise + lastTx.amountInPaise)
    : undefined;
  const closBal = transactions[0]?.balanceAfterInPaise;

  const totalDr = transactions.reduce((acc: number, r: any) => !isCreditTransaction(r.type, 'saving') ? acc + (r.amountInPaise || 0) : acc, 0);
  const totalCr = transactions.reduce((acc: number, r: any) => isCreditTransaction(r.type, 'saving') ? acc + (r.amountInPaise || 0) : acc, 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['saving', id] });
    queryClient.invalidateQueries({ queryKey: ['saving-statement', id] });
    queryClient.invalidateQueries({ queryKey: ['savings'] });
  };

  // ── Close ──────────────────────────────────────────────────────────────────
  const closeMutation = useMutation({
    mutationFn: () => savingApi.close(id!, { closureReason: closeReason }),
    onSuccess: (res) => {
      toast.success(res.message || 'Account closed successfully');
      invalidate();
      setShowClose(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Close failed'),
  });

  // ── Freeze ─────────────────────────────────────────────────────────────────
  const freezeMutation = useMutation({
    mutationFn: () => savingApi.freeze(id!, { freezeReason }),
    onSuccess: (res) => {
      toast.success(res.message || 'Account frozen');
      invalidate();
      setShowFreeze(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Freeze failed'),
  });

  // ── Unfreeze ───────────────────────────────────────────────────────────────
  const unfreezeMutation = useMutation({
    mutationFn: () => savingApi.unfreeze(id!),
    onSuccess: (res) => {
      toast.success(res.message || 'Account unfrozen');
      invalidate();
      setShowUnfreeze(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Unfreeze failed'),
  });

  // ── Export handlers ────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!account) return;
    exportStatementCSV(transactions, account, branding, { from: fromDate, to: toDate });
    toast.success('CSV downloaded');
  };

  const handleExportPDF = () => {
    if (!account) return;
    exportStatementPDF(transactions, account, branding, { from: fromDate, to: toDate });
    toast.success('PDF statement generated');
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (isError || !account) return (
    <div className="text-center py-20">
      <p className="text-red-500 mb-4">Failed to load account details.</p>
      <Button variant="outline" onClick={() => navigate('/savings')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Accounts
      </Button>
    </div>
  );

  const isActive = account.status === 'active';
  const isFrozen = account.status === 'frozen';
  const isClosed = account.status === 'closed';

  return (
    <div className="animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/savings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title font-mono">{account.accountNumber}</h1>
              <StatusBadge status={account.status} />
            </div>
            <p className="page-subtitle">
              <Link to={`/customers/${account.customer?._id}`} className="hover:text-blue-600 transition-colors">
                {account.customer?.name}
              </Link>
              {' · '}{account.customer?.customerCode}
            </p>
          </div>
        </div>

        {/* Action buttons — role-scoped */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Transaction Counter shortcut — admin only (superadmin cannot access /transactions/hub) */}
          {!isSuperadmin && (
            <Link
              to={`/transactions/hub?account=${account.accountNumber}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              <ArrowRightCircle className="h-4 w-4" /> Transaction Counter
            </Link>
          )}

          {isActive && canFreeze && (
            <Button variant="outline" size="sm" className="text-amber-600 border-amber-200" onClick={() => setShowFreeze(true)}>
              <Lock className="h-4 w-4 mr-1.5" /> Freeze
            </Button>
          )}
          {isActive && canClose && (
            <Button variant="destructive" size="sm" onClick={() => setShowClose(true)}>
              <XCircle className="h-4 w-4 mr-1.5" /> Close Account
            </Button>
          )}
          {isFrozen && canFreeze && (
            <Button size="sm" onClick={() => setShowUnfreeze(true)}>
              <Unlock className="h-4 w-4 mr-1.5" /> Unfreeze
            </Button>
          )}
        </div>
      </div>

      {/* ── Status alerts ──────────────────────────────────────────────────── */}
      {isFrozen && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          <span><strong>FROZEN</strong> — Reason: {account.freezeReason || 'Not specified'} · Frozen by: {account.frozenBy?.name || '—'}</span>
        </div>
      )}
      {isClosed && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          <span><strong>CLOSED</strong> — {account.closureReason}</span>
        </div>
      )}

      {/* ── Info banner ─────────────────────────────────────────────────────── */}
      {isSuperadmin ? (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Read-only view.</strong> As Superadmin, you have oversight access only. Financial transactions (deposit, withdraw, transfer) are performed by branch admins.
          </span>
        </div>
      ) : (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            To deposit, withdraw, or transfer funds — use the{' '}
            <Link to={`/transactions/hub?account=${account.accountNumber}`} className="font-semibold underline hover:text-blue-600">
              Transaction Counter
            </Link>{' '}
            (single point for all financial operations).
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT ─────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Account Info */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-slate-500" /> Account Details
              </h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Account Number" value={<span className="font-mono font-semibold">{account.accountNumber}</span>} />
                <DetailRow label="Customer" value={
                  <Link to={`/customers/${account.customer?._id}`} className="text-blue-600 hover:underline">
                    {account.customer?.name} ({account.customer?.customerCode})
                  </Link>
                } />
                <DetailRow label="Phone" value={account.customer?.phone} />
                <DetailRow label="Balance" value={<span className="font-semibold text-emerald-700">{formatCurrency(account.balanceInPaise)}</span>} />
                <DetailRow label="Opening Charge" value={formatCurrency(account.openingChargeInPaise)} />
                <DetailRow label="Charge Deducted" value={account.openingChargeDeducted ? 'Yes' : 'No'} />
                <DetailRow label="Opened At" value={formatDateTime(account.openedAt || account.createdAt)} />
                {account.openedBy && <DetailRow label="Opened By" value={`${account.openedBy.name} (${account.openedBy.role})`} />}
                {account.closedAt && <DetailRow label="Closed At" value={formatDateTime(account.closedAt)} />}
                {account.closureReason && <DetailRow label="Closure Reason" value={account.closureReason} />}
                {account.closedBy && <DetailRow label="Closed By" value={`${account.closedBy.name} (${account.closedBy.role})`} />}
                {account.frozenAt && <DetailRow label="Frozen At" value={formatDateTime(account.frozenAt)} />}
                {account.freezeReason && <DetailRow label="Freeze Reason" value={account.freezeReason} />}
                {account.frozenBy && <DetailRow label="Frozen By" value={`${account.frozenBy.name} (${account.frozenBy.role})`} />}
              </dl>
            </div>
          </div>

          {/* Statement */}
          <div className="card">
            <div className="card-header">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-1">
                  <Calendar className="h-4 w-4 text-slate-500" /> Transaction History
                </h2>
                {/* Export buttons */}
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
                <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setStatementPage(1); }}
                  className="text-xs py-1 px-2 h-8" />
                <span className="text-slate-400 self-center text-xs">to</span>
                <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setStatementPage(1); }}
                  className="text-xs py-1 px-2 h-8" />
                {(fromDate || toDate) && (
                  <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); setStatementPage(1); }}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Txn ID</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance After</th>
                    <th>Note</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {stmtLoading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-500">Loading...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-500">No transactions found.</td></tr>
                  ) : (
                    <>
                      {/* Banking Format - Opening Balance Row */}
                      <tr className="bg-slate-50/50">
                        <td colSpan={4} className="text-right py-3 text-sm font-semibold text-slate-600">Opening Balance on Page</td>
                        <td className="text-right py-3 font-bold text-slate-800">{openBal !== undefined ? formatCurrency(openBal) : '—'}</td>
                        <td colSpan={3}></td>
                      </tr>
                      
                      {transactions.map((tx: any, idx: number) => (
                        <tr key={tx._id || idx} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedTx(tx)}>
                          <td className="text-slate-500 text-xs">{formatDateTime(tx.businessDate || tx.createdAt)}</td>
                          <td>
                            {/* Clickable Txn ID */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); }}
                              className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                              title="Click to view full details"
                            >
                              {tx.transactionId}
                            </button>
                          </td>
                          <td><TxTypeBadge type={tx.type} /></td>
                          <td>
                            <span className="text-xs text-slate-500 capitalize">
                              {tx.paymentMode ? tx.paymentMode.replace(/_/g, ' ') : '—'}
                            </span>
                          </td>
                          <td className="text-right font-mono">
                            <span className={isCreditTransaction(tx.type, 'saving') ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {isCreditTransaction(tx.type, 'saving') ? '+' : '-'}
                              {formatCurrency(Math.abs(tx.amountInPaise))}
                            </span>
                          </td>
                          <td className="text-right font-mono text-slate-700">
                            {tx.balanceAfterInPaise != null ? formatCurrency(tx.balanceAfterInPaise) : '—'}
                          </td>
                          <td className="text-slate-500 text-xs max-w-[160px] truncate">{tx.note || '—'}</td>
                          <td className="text-xs text-slate-500">{tx.performedBy?.name || '—'}</td>
                        </tr>
                      ))}
                      
                      {/* Banking Format - Grand Total Footer */}
                      <tr className="bg-slate-100/80 border-t border-slate-200">
                        <td colSpan={4} className="text-right py-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                          Page Total (Dr: <span className="text-red-600">{formatCurrency(totalDr)}</span> | Cr: <span className="text-emerald-600">{formatCurrency(totalCr)}</span>)
                        </td>
                        <td className="text-right py-3 font-bold text-slate-700">{formatCurrency(totalDr + totalCr)}</td>
                        <td className="text-right py-3 font-bold text-slate-800">{closBal !== undefined ? formatCurrency(closBal) : '—'}</td>
                        <td colSpan={2}></td>
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
                  <Button variant="outline" size="sm" disabled={statementPage === 1} onClick={() => setStatementPage(p => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={statementPage === stmtPagination.totalPages} onClick={() => setStatementPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Balance card */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-500" /> Balance
              </h2>
            </div>
            <div className="card-body text-center py-6">
              <p className="text-3xl font-bold text-emerald-700">{formatCurrency(account.balanceInPaise)}</p>
              <p className="text-sm text-slate-500 mt-1">Current Balance</p>
              {account.stats && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total Deposited</span>
                    <span className="font-medium">{formatCurrency(account.stats.totalDepositedInPaise)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total Transactions</span>
                    <span className="font-medium">{account.stats.totalDeposits}</span>
                  </div>
                  {account.stats.lastDepositAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Last Deposit</span>
                      <span className="font-medium">{formatDate(account.stats.lastDepositAt)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions card — hide Transaction Counter link for superadmin */}
          {!isSuperadmin && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
              </div>
              <div className="card-body space-y-2">
                <Link
                  to={`/transactions/hub?account=${account.accountNumber}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <ArrowRightCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Go to Transaction Counter</p>
                    <p className="text-xs text-blue-500">Deposit · Withdraw · Transfer · Repay</p>
                  </div>
                </Link>
                <button
                  onClick={handleExportPDF}
                  disabled={transactions.length === 0}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-40"
                >
                  <Download className="h-5 w-5 text-slate-600 flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-800">Download Statement</p>
                    <p className="text-xs text-slate-500">PDF account statement</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Customer quick card */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" /> Customer
              </h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Name" value={
                  <Link to={`/customers/${account.customer?._id}`} className="text-blue-600 hover:underline">
                    {account.customer?.name}
                  </Link>
                } />
                <DetailRow label="Code" value={account.customer?.customerCode} />
                <DetailRow label="Phone" value={account.customer?.phone} />
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* ── Close Modal ──────────────────────────────────────────────────── */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl border shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-red-700 mb-1">Close Account</h3>
            <p className="text-sm text-slate-500 mb-1">Remaining balance of <strong>{formatCurrency(account.balanceInPaise)}</strong> will be returned as cash.</p>
            <p className="text-xs text-red-600 mb-4">⚠ Cannot close if there is an active loan or linked pigmy account.</p>
            <div className="mb-4">
              <label className="form-label">Reason *</label>
              <Textarea value={closeReason} onChange={(e) => setCloseReason(e.target.value)}
                placeholder="Reason for closing (min 5 chars)" rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowClose(false)} disabled={closeMutation.isPending}>Cancel</Button>
              <Button variant="destructive" isLoading={closeMutation.isPending}
                onClick={() => closeMutation.mutate()} disabled={closeReason.length < 5}>Close Account</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Freeze Modal ─────────────────────────────────────────────────── */}
      {showFreeze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl border shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-amber-700 mb-1">Freeze Account</h3>
            <p className="text-sm text-slate-500 mb-4">Frozen accounts cannot receive deposits until unfrozen.</p>
            <div className="mb-4">
              <label className="form-label">Reason *</label>
              <Textarea value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)}
                placeholder="Reason for freezing (min 5 chars)" rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowFreeze(false)} disabled={freezeMutation.isPending}>Cancel</Button>
              <Button className="bg-amber-600 hover:bg-amber-700" isLoading={freezeMutation.isPending}
                onClick={() => freezeMutation.mutate()} disabled={freezeReason.length < 5}>Freeze</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unfreeze Dialog ───────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showUnfreeze}
        onOpenChange={setShowUnfreeze}
        title="Unfreeze Account"
        description="This will reactivate the account and allow deposits again."
        confirmLabel="Unfreeze"
        isLoading={unfreezeMutation.isPending}
        onConfirm={() => unfreezeMutation.mutate()}
      />

      {/* ── Transaction Detail Modal ──────────────────────────────────────── */}
      <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
