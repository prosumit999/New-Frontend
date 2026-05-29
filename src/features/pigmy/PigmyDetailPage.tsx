// src/features/pigmy/PigmyDetailPage.tsx
// READ-ONLY account view. Financial transactions → Transaction Hub.
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Lock, Unlock, XCircle,
  PiggyBank, TrendingUp, User, Calendar,
  Wallet, AlertTriangle, ArrowRightCircle,
  FileSpreadsheet, FileText, Pencil, Check, X,
} from 'lucide-react';
import { pigmyApi } from '../../api/pigmy.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DetailRow } from '../../components/shared/DetailRow';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import TransactionDetailModal from '../../components/shared/TransactionDetailModal';
import { formatCurrency, formatDate, formatDateTime, isCreditTransaction } from '../../utils/format';
import { exportStatementCSV, exportStatementPDF } from '../../utils/statementExport';
import { useSystemStore } from '../../store/system.store';
import { useAuthStore } from '../../store/auth.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { PigmyAccount } from '../../types';

// ── Transaction type pill ─────────────────────────────────────────────────────
const TxTypeBadge = ({ type }: { type: string }) => {
  const colorMap: Record<string, string> = {
    pigmy_collection: 'bg-emerald-100 text-emerald-700',
    pigmy_withdrawal: 'bg-red-100 text-red-700',
    loan_repayment: 'bg-blue-100 text-blue-700',
    saving_to_pigmy_transfer: 'bg-indigo-100 text-indigo-700',
    pigmy_to_saving_transfer: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colorMap[type] ?? 'bg-slate-100 text-slate-600'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
};

export default function PigmyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const branding = useSystemStore((s) => s.branding);
  const { businessDate } = useBusinessDate();

  // Role guards matching backend permissions
  const canClose = user?.role === 'admin' || user?.role === 'superadmin';
  const canFreeze = user?.role === 'admin' || user?.role === 'superadmin';

  const [showClose, setShowClose] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [showFreeze, setShowFreeze] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [showUnfreeze, setShowUnfreeze] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  // Statement filters (default: 1st of business month → business date)
  const [statementPage, setStatementPage] = useState(1);
  const [fromDate, setFromDate] = useState(() => businessDate ? businessDate.slice(0, 7) + '-01' : '');
  const [toDate, setToDate]     = useState(() => businessDate || '');
  const [selectedTx, setSelectedTx] = useState<any>(null);
  // Edit settings state
  const [showEdit, setShowEdit] = useState(false);
  const [editDeposit, setEditDeposit] = useState('');
  const [editFrequency, setEditFrequency] = useState<'daily' | 'weekly'>('daily');

  // ── Fetch account ─────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pigmy', id],
    queryFn: () => pigmyApi.getAccount(id!),
    enabled: !!id,
  });
  // Backend: { success, data: { account } }
  const account: PigmyAccount | undefined = data?.data?.account;

  // ── Fetch statement ───────────────────────────────────────────────────────────
  const { data: stmtData, isLoading: stmtLoading } = useQuery({
    queryKey: ['pigmy-statement', id, statementPage, fromDate, toDate],
    queryFn: () => pigmyApi.getStatement(id!, {
      page: statementPage,
      limit: 15,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    enabled: !!id,
  });
  // Backend returns: { accountNumber, balanceInRupees, transactions, pagination }
  const transactions: any[] = stmtData?.data?.transactions ?? [];
  const stmtPagination = stmtData?.data?.pagination;

  const lastTx = transactions[transactions.length - 1];
  const openBal = lastTx?.balanceAfterInPaise != null
    ? (isCreditTransaction(lastTx.type, 'pigmy') 
        ? lastTx.balanceAfterInPaise - lastTx.amountInPaise 
        : lastTx.balanceAfterInPaise + lastTx.amountInPaise)
    : undefined;
  const closBal = transactions[0]?.balanceAfterInPaise;

  const totalDr = transactions.reduce((acc: number, r: any) => !isCreditTransaction(r.type, 'pigmy') ? acc + (r.amountInPaise || 0) : acc, 0);
  const totalCr = transactions.reduce((acc: number, r: any) => isCreditTransaction(r.type, 'pigmy') ? acc + (r.amountInPaise || 0) : acc, 0);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['pigmy', id] });
    queryClient.invalidateQueries({ queryKey: ['pigmy-statement', id] });
    queryClient.invalidateQueries({ queryKey: ['pigmy-accounts'] });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const closeMutation = useMutation({
    mutationFn: () => pigmyApi.close(id!, { closureReason: closeReason }),
    onSuccess: (res) => {
      toast.success(res.message || 'Account closed');
      invalidateAll();
      setShowClose(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Close failed'),
  });

  const freezeMutation = useMutation({
    mutationFn: () => pigmyApi.freeze(id!, { freezeReason }),
    onSuccess: (res) => {
      toast.success(res.message || 'Account frozen');
      invalidateAll();
      setShowFreeze(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Freeze failed'),
  });

  const unfreezeMutation = useMutation({
    mutationFn: () => pigmyApi.unfreeze(id!),
    onSuccess: (res) => {
      toast.success(res.message || 'Account unfrozen');
      invalidateAll();
      setShowUnfreeze(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Unfreeze failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => pigmyApi.delete(id!),
    onSuccess: (res) => {
      toast.success(res.message || 'Account deleted');
      invalidateAll();
      setShowDelete(false);
      navigate('/pigmy');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });

  const restoreMutation = useMutation({
    mutationFn: () => pigmyApi.restore(id!),
    onSuccess: (res) => {
      toast.success(res.message || 'Account restored');
      invalidateAll();
      setShowRestore(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Restore failed'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { dailyDepositAmountInPaise?: number; collectionFrequency?: 'daily' | 'weekly' }) =>
      pigmyApi.update(id!, payload),
    onSuccess: (res) => {
      toast.success(res.message || 'Settings updated');
      invalidateAll();
      setShowEdit(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (isError || !account) return (
    <div className="text-center py-20">
      <p className="text-red-500 mb-4">Failed to load pigmy account.</p>
      <Button variant="outline" onClick={() => navigate('/pigmy')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
    </div>
  );

  const isDeleted = account?.isDeleted;
  const isActive = account?.status === 'active' && !isDeleted;
  const isFrozen = account?.status === 'frozen' && !isDeleted;
  const isClosed = account?.status === 'closed' && !isDeleted;
  const canDelete = account?.balanceInPaise === 0 && !isDeleted && canClose;
  const canRestore = isDeleted && canClose;
  const canEdit = canClose && (isActive || isFrozen); // admin can edit active or frozen

  return (
    <div className="animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pigmy')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title font-mono">{account.accountNumber}</h1>
              {account.isDeleted ? (
                <span className="text-xs px-2 py-0.5 rounded border font-medium uppercase bg-red-100 text-red-700 border-red-200">
                  DELETED
                </span>
              ) : (
                <StatusBadge status={account.status} />
              )}
            </div>
            <p className="page-subtitle">
              <Link to={`/customers/${account.customer?._id}`} className="hover:text-blue-600 transition-colors">
                {account.customer?.name}
              </Link>
              {' · '}{account.customer?.customerCode}
            </p>
          </div>
        </div>
        {/* Transaction Counter shortcut */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/transactions/hub?account=${account.accountNumber}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            <ArrowRightCircle className="h-4 w-4" /> Transaction Counter
          </Link>
          {isActive && canFreeze && (
            <Button variant="outline" size="sm" className="text-amber-600 border-amber-200" onClick={() => setShowFreeze(true)}>
              <Lock className="h-4 w-4 mr-1.5" /> Freeze
            </Button>
          )}
          {isActive && canClose && (
            <Button variant="destructive" size="sm" onClick={() => setShowClose(true)}>
              <XCircle className="h-4 w-4 mr-1.5" /> Close
            </Button>
          )}
          {isFrozen && canFreeze && (
            <Button size="sm" onClick={() => setShowUnfreeze(true)}>
              <Unlock className="h-4 w-4 mr-1.5" /> Unfreeze
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" size="sm" onClick={() => setShowDelete(true)}>
              Delete
            </Button>
          )}
          {canRestore && (
            <Button variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" size="sm" onClick={() => setShowRestore(true)}>
              Restore
            </Button>
          )}
        </div>
      </div>

      {/* ── Status banners ────────────────────────────────────────────────────── */}
      {isFrozen && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          <span><strong>FROZEN</strong> — Collections paused. Reason: {account.freezeReason || 'Not specified'}</span>
        </div>
      )}
      {isClosed && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          <span><strong>CLOSED</strong> — {account.closureReason}</span>
        </div>
      )}
      {/* Info banner */}
      <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          To transfer funds or post collections — use the{' '}
          <Link to={`/transactions/hub?account=${account.accountNumber}`} className="font-semibold underline hover:text-blue-600">
            Transaction Counter
          </Link>.
        </span>
      </div>
      {account.activeLoan && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Active loan: <Link to={`/loans/${account.activeLoan.loanAccountNumber}`} className="font-medium underline hover:no-underline">
              {account.activeLoan.loanAccountNumber}
            </Link>
            {' — '} Outstanding: {formatCurrency(account.activeLoan.outstandingBalanceInPaise)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT ─────────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Account Details */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-slate-500" /> Account Details
              </h2>
              {canEdit && (
                <button
                  onClick={() => {
                    setEditDeposit(String(account.dailyDepositAmountInPaise / 100));
                    setEditFrequency(account.collectionFrequency as 'daily' | 'weekly');
                    setShowEdit(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-600 hover:text-blue-700 text-xs font-medium transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit Settings
                </button>
              )}
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
                <DetailRow label="Daily Deposit" value={<span className="font-semibold">{formatCurrency(account.dailyDepositAmountInPaise)}/day</span>} />
                <DetailRow label="Collection Frequency" value={account.collectionFrequency === 'daily' ? 'Daily' : 'Weekly'} />
                <DetailRow label="Total Collected" value={formatCurrency(account.totalCollectedInPaise)} />
                <DetailRow label="Collection Days" value={String(account.totalCollectionDays ?? 0)} />
                <DetailRow label="Last Collection" value={formatDate(account.lastCollectionDate)} />
                <DetailRow label="Opened At" value={formatDateTime(account.openedAt || account.createdAt)} />
                {account.openedBy && <DetailRow label="Opened By" value={`${account.openedBy.name} (${account.openedBy.role})`} />}
                {account.closedAt && <DetailRow label="Closed At" value={formatDateTime(account.closedAt)} />}
                {account.closureReason && <DetailRow label="Closure Reason" value={account.closureReason} />}
                {account.closedBy && <DetailRow label="Closed By" value={`${account.closedBy.name} (${account.closedBy.role})`} />}
                {account.frozenAt && <DetailRow label="Frozen At" value={formatDateTime(account.frozenAt)} />}
                {account.freezeReason && <DetailRow label="Freeze Reason" value={account.freezeReason} />}
                {account.frozenBy && <DetailRow label="Frozen By" value={`${account.frozenBy.name} (${account.frozenBy.role})`} />}
              </dl>

              {/* ── Edit Settings Panel ── */}
              {showEdit && canEdit && (
                <div className="mt-4 pt-4 border-t border-blue-100 bg-blue-50/40 rounded-lg p-4">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Edit Collection Settings</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label text-xs">Daily Deposit Amount (₹)</label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={editDeposit}
                        onChange={(e) => setEditDeposit(e.target.value)}
                        placeholder="e.g. 50"
                        className="h-9 text-sm"
                      />
                      <p className="text-xs text-slate-400 mt-0.5">Current: {formatCurrency(account.dailyDepositAmountInPaise)}/day</p>
                    </div>
                    <div>
                      <label className="form-label text-xs">Collection Frequency</label>
                      <select
                        value={editFrequency}
                        onChange={(e) => setEditFrequency(e.target.value as 'daily' | 'weekly')}
                        className="form-input h-9 text-sm w-full rounded-lg border border-slate-200"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                      <p className="text-xs text-slate-400 mt-0.5">Current: {account.collectionFrequency === 'daily' ? 'Daily' : 'Weekly'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-end">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setShowEdit(false)}
                      disabled={updateMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                    <Button
                      size="sm"
                      isLoading={updateMutation.isPending}
                      onClick={() => {
                        const paise = Math.round(parseFloat(editDeposit) * 100);
                        if (!editDeposit || isNaN(paise) || paise < 100) {
                          toast.error('Minimum daily deposit is ₹1');
                          return;
                        }
                        updateMutation.mutate({
                          dailyDepositAmountInPaise: paise,
                          collectionFrequency: editFrequency,
                        });
                      }}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Statement */}
          <div className="card">
            <div className="card-header">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-1">
                  <Calendar className="h-4 w-4 text-slate-500" /> Collection History
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (!account) return; exportStatementCSV(transactions, account, branding, { from: fromDate, to: toDate }); toast.success('CSV downloaded'); }}
                    disabled={transactions.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-40">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export CSV
                  </button>
                  <button onClick={() => { if (!account) return; exportStatementPDF(transactions, account, branding, { from: fromDate, to: toDate }); toast.success('PDF generated'); }}
                    disabled={transactions.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-40">
                    <FileText className="h-3.5 w-3.5 text-red-600" /> Export PDF
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
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
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance After</th>
                    <th>By</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {stmtLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-500">No collections yet.</td></tr>
                  ) : (
                    <>
                      {/* Banking Format - Opening Balance Row */}
                      <tr className="bg-slate-50/50">
                        <td colSpan={3} className="text-right py-3 text-sm font-semibold text-slate-600">Opening Balance on Page</td>
                        <td className="text-right py-3 font-bold text-slate-800">{openBal !== undefined ? formatCurrency(openBal) : '—'}</td>
                        <td colSpan={3}></td>
                      </tr>

                      {transactions.map((tx: any, idx: number) => {
                        const credit = isCreditTransaction(tx.type, 'pigmy');
                        return (
                          <tr key={tx._id || idx}>
                            <td className="text-slate-500 text-xs">{formatDateTime(tx.businessDate || tx.createdAt)}</td>
                            <td>
                              <button type="button" onClick={() => setSelectedTx(tx)}
                                className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                                {tx.transactionId}
                              </button>
                            </td>
                            <td><TxTypeBadge type={tx.type} /></td>
                            <td className="text-right font-mono">
                              <span className={credit ? 'text-emerald-600' : 'text-red-600'}>
                                {credit ? '+' : '-'}{formatCurrency(Math.abs(tx.amountInPaise))}
                              </span>
                            </td>
                            <td className="text-right font-mono text-slate-700">
                              {tx.balanceAfterInPaise != null ? formatCurrency(tx.balanceAfterInPaise) : '—'}
                            </td>
                            <td className="text-xs text-slate-500">{tx.performedBy?.name || '—'}</td>
                            <td className="text-slate-500 text-xs max-w-[140px] truncate">{tx.note || '—'}</td>
                          </tr>
                        );
                      })}

                      {/* Banking Format - Grand Total Footer */}
                      <tr className="bg-slate-100/80 border-t border-slate-200">
                        <td colSpan={3} className="text-right py-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">
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

        {/* ── RIGHT sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Balance + Stats */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-500" /> Balance & Stats
              </h2>
            </div>
            <div className="card-body text-center py-5">
              <p className="text-3xl font-bold text-emerald-700">{formatCurrency(account.balanceInPaise)}</p>
              <p className="text-xs text-slate-500 mt-1">Current Balance</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-base font-bold text-slate-800">{formatCurrency(account.dailyDepositAmountInPaise)}</p>
                  <p className="text-xs text-slate-500">Per Day</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-base font-bold text-slate-800">{account.totalCollectionDays ?? 0}</p>
                  <p className="text-xs text-slate-500">Days</p>
                </div>
              </div>
              {account.stats && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total Collected</span>
                    <span className="font-medium">{formatCurrency(account.stats.totalCollectedInPaise)}</span>
                  </div>
                  {account.stats.totalAppliedToLoanInPaise > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Applied to Loan</span>
                      <span className="font-medium text-blue-600">{formatCurrency(account.stats.totalAppliedToLoanInPaise)}</span>
                    </div>
                  )}
                  {account.stats.lastCollectionAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Last Collection</span>
                      <span className="font-medium">{formatDate(account.stats.lastCollectionAt)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Linked Saving Account */}
          {account.savingAccount && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-slate-500" /> Linked Saving Account
                </h2>
              </div>
              <div className="card-body">
                <dl>
                  <DetailRow label="Account No." value={
                    <Link to={`/savings/${account.savingAccount.accountNumber}`} className="text-blue-600 hover:underline font-mono text-sm">
                      {account.savingAccount.accountNumber}
                    </Link>
                  } />
                  <DetailRow label="Balance" value={formatCurrency(account.savingAccount.balanceInPaise)} />
                  <DetailRow label="Status" value={<StatusBadge status={account.savingAccount.status} />} />
                </dl>
              </div>
            </div>
          )}

          {/* Assigned Agent */}
          {account.assignedAgent && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-500" /> Assigned Agent
                </h2>
              </div>
              <div className="card-body">
                <dl>
                  <DetailRow label="Name" value={account.assignedAgent.name} />
                  <DetailRow label="Code" value={account.assignedAgent.agentCode} />
                  {account.assignedAgent.phone && <DetailRow label="Phone" value={account.assignedAgent.phone} />}
                </dl>
              </div>
            </div>
          )}

          {/* Customer quick link */}
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

      {/* ── Close Modal ───────────────────────────────────────────────────────── */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl border shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-red-700 mb-1">Close Pigmy Account</h3>
            <p className="text-sm text-slate-500 mb-1">
              Balance of <strong>{formatCurrency(account.balanceInPaise)}</strong> will be returned as cash.
            </p>
            <p className="text-xs text-red-600 mb-4">⚠ Cannot close if customer has an active/overdue loan.</p>
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

      {/* ── Freeze Modal ──────────────────────────────────────────────────────── */}
      {showFreeze && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl border shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-amber-700 mb-1">Freeze Pigmy Account</h3>
            <p className="text-sm text-slate-500 mb-4">Daily collections will be paused while frozen.</p>
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

      {/* ── Unfreeze Dialog ── */}
      <ConfirmDialog
        open={showUnfreeze}
        onOpenChange={setShowUnfreeze}
        title="Unfreeze Pigmy Account"
        description="This will reactivate daily collections for this account."
        confirmLabel="Unfreeze"
        isLoading={unfreezeMutation.isPending}
        onConfirm={() => unfreezeMutation.mutate()}
      />

      {/* ── Delete Dialog ── */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Pigmy Account"
        description="Are you sure you want to delete this account? It will be removed from standard lists but kept in the archive."
        confirmLabel="Delete Account"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      {/* ── Restore Dialog ── */}
      <ConfirmDialog
        open={showRestore}
        onOpenChange={setShowRestore}
        title="Restore Pigmy Account"
        description="This will restore the account and make it active or closed as it was before deletion."
        confirmLabel="Restore"
        isLoading={restoreMutation.isPending}
        onConfirm={() => restoreMutation.mutate()}
      />

      {/* ── Transaction Detail Modal ── */}
      <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
