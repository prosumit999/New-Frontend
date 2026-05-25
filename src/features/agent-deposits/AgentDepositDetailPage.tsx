// src/features/agent-deposits/AgentDepositDetailPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, RotateCcw, Banknote, CheckCircle, XCircle,
  AlertTriangle, Hash
} from 'lucide-react';
import { agentDepositApi } from '../../api/agentDeposit.api';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { DetailRow } from '../../components/shared/DetailRow';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';

export default function AgentDepositDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [showReverse, setShowReverse] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalResult, setReversalResult] = useState<any>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agent-deposit', id],
    queryFn: () => agentDepositApi.getById(id!),
    enabled: !!id,
  });

  // API client returns res.data → response is { success, data: { deposit }, message }
  // So the path is: data (response from useQuery) = res.data → data.data.data.deposit
  const deposit = (data as any)?.data?.data?.deposit as any;

  const reverseMutation = useMutation({
    mutationFn: () => agentDepositApi.reverse(id!, { reversalReason }),
    onSuccess: (res: any) => {
      const result = res?.data?.data?.result;
      toast.success('Deposit reversed successfully');
      queryClient.invalidateQueries({ queryKey: ['agent-deposit', id] });
      queryClient.invalidateQueries({ queryKey: ['agent-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['agent-cash-balance'] });
      setShowReverse(false);
      setReversalResult(result);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Reversal failed');
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
    </div>
  );

  if (isError || !deposit) return (
    <div className="text-center py-24">
      <XCircle className="h-12 w-12 mx-auto text-red-300 mb-4" />
      <p className="text-red-500 mb-4">Failed to load deposit.</p>
      <Button variant="outline" onClick={() => navigate('/agent-deposits')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
    </div>
  );

  const isReversed = deposit.isReversed || deposit.status === 'reversed';

  // Compute balance before/after from transaction.balanceAfterInPaise
  // balanceAfterInPaise = balance AFTER deposit (agent balance decreases)
  const balanceAfterInPaise = deposit.transaction?.balanceAfterInPaise ?? null;
  const balanceBeforeInPaise = balanceAfterInPaise !== null
    ? balanceAfterInPaise + deposit.amountInPaise
    : null;

  return (
    <div className="animate-fade-in animate-slide-up max-w-3xl mx-auto">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agent-deposits')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title font-mono tracking-tight">{deposit.depositId}</h1>
              {isReversed ? (
                <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">REVERSED</span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">COMPLETED</span>
              )}
            </div>
            <p className="page-subtitle">Agent Deposit Voucher</p>
          </div>
        </div>
        {!isReversed && isAdmin && (
          <Button variant="destructive" size="sm" onClick={() => setShowReverse(true)}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reverse Deposit
          </Button>
        )}
      </div>

      {/* Reversal result banner */}
      {reversalResult && (
        <div className="card mb-5 border-l-4 border-l-amber-400 bg-amber-50/60 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Deposit Reversed</p>
              <p className="text-sm text-amber-700 mt-1">{reversalResult.note}</p>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <p className="text-xs text-amber-600">Amount Reversed</p>
                  <p className="font-bold text-amber-800">{formatCurrency(reversalResult.amountInPaise)}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-600">Agent Balance After</p>
                  <p className="font-bold text-red-700">{formatCurrency(reversalResult.agentBalanceAfterInPaise)}</p>
                </div>
              </div>
              <p className="text-xs text-amber-500 mt-2">
                Reversal Ref: <span className="font-mono">{reversalResult.reversalTransactionRef}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main voucher */}
        <div className="md:col-span-2 space-y-5">
          <div className={`card overflow-hidden ${isReversed ? 'opacity-70' : ''}`}>
            {/* Amount hero */}
            <div className={`p-6 text-center ${isReversed ? 'bg-red-50' : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white'}`}>
              <Banknote className={`h-8 w-8 mx-auto mb-2 ${isReversed ? 'text-red-400' : 'text-white/70'}`} />
              <p className={`text-4xl font-bold ${isReversed ? 'text-slate-400 line-through' : 'text-white'}`}>
                {formatCurrency(deposit.amountInPaise)}
              </p>
              <p className={`text-sm mt-1 ${isReversed ? 'text-red-500' : 'text-blue-200'}`}>
                {isReversed ? 'This deposit was reversed' : 'Deposit Amount'}
              </p>
            </div>

            {/* Voucher details */}
            <div className="card-body border-t-2 border-dashed border-slate-100">
              <dl>
                <DetailRow label="Deposit ID" value={<span className="font-mono font-bold text-blue-700">{deposit.depositId}</span>} />
                <DetailRow label="Receipt Number" value={<span className="font-mono text-slate-600">{deposit.receiptNumber || '—'}</span>} />
                <DetailRow label="Agent Ledger" value={<span className="font-mono text-xs text-slate-500">{deposit.agentLedgerCode}</span>} />
                <DetailRow label="Business Date" value={formatDate(deposit.businessDate)} />
                <DetailRow label="Recorded At" value={formatDateTime(deposit.createdAt)} />
                {balanceBeforeInPaise !== null && (
                  <DetailRow label="Agent Balance Before" value={<span className="font-semibold text-amber-700">{formatCurrency(balanceBeforeInPaise)}</span>} />
                )}
                {balanceAfterInPaise !== null && (
                  <DetailRow label="Agent Balance After" value={<span className="font-semibold text-emerald-700">{formatCurrency(balanceAfterInPaise)}</span>} />
                )}
                {deposit.note && <DetailRow label="Note" value={deposit.note} />}
              </dl>
            </div>
          </div>

          {/* Reversal details */}
          {isReversed && (
            <div className="card border-l-4 border-l-red-400 bg-red-50/50">
              <div className="card-body">
                <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Reversal Details
                </h3>
                <dl>
                  <DetailRow label="Reversal Reason" value={deposit.reversalNote || deposit.reversalReason || '—'} />
                  <DetailRow label="Reversed At" value={formatDateTime(deposit.reversedAt)} />
                  <DetailRow label="Reversed By" value={deposit.reversedBy?.name || '—'} />
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Right side panels */}
        <div className="space-y-5">
          {/* Agent */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-800">Agent</h2>
            </div>
            <div className="card-body">
              <p className="font-bold text-slate-900">{deposit.agent?.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">{deposit.agent?.agentCode}</p>
              <p className="text-sm text-slate-500">{deposit.agent?.phone}</p>
            </div>
          </div>

          {/* Received By */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-800">Received By</h2>
            </div>
            <div className="card-body">
              <p className="font-medium text-slate-900">{deposit.receivedBy?.name || '—'}</p>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">{deposit.receivedBy?.role}</p>
            </div>
          </div>

          {/* Transaction ref */}
          {deposit.transaction && (
            <div className="card p-4">
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Transaction Reference
              </p>
              <p className="font-mono text-xs text-blue-600 break-all">
                {deposit.transaction?.transactionId}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Status:{' '}
                <span className={`font-medium ${deposit.transaction?.status === 'completed' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {deposit.transaction?.status}
                </span>
              </p>
            </div>
          )}

          {/* Status indicator */}
          <div className={`card p-4 flex items-center gap-3 ${isReversed ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
            {isReversed
              ? <XCircle className="h-5 w-5 text-red-500" />
              : <CheckCircle className="h-5 w-5 text-emerald-500" />}
            <div>
              <p className="text-sm font-medium text-slate-700">Deposit Status</p>
              <p className={`text-xs ${isReversed ? 'text-red-600' : 'text-emerald-600'}`}>
                {isReversed ? 'Reversed — agent balance restored' : 'Completed — balance cleared'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reversal Modal ─────────────────────────────────────────────────────── */}
      {showReverse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <RotateCcw className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Reverse Agent Deposit</h3>
                <p className="text-xs text-slate-500">
                  {formatCurrency(deposit.amountInPaise)} will be returned to agent's outstanding balance
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-amber-700 font-semibold">⚠️ Day close will be blocked</p>
              <p className="text-xs text-amber-600 mt-0.5">
                After reversal, agent <strong>{deposit.agent?.name}</strong> will have an outstanding
                balance of {formatCurrency(deposit.amountInPaise)} that must be re-deposited.
              </p>
            </div>

            <div className="mb-4">
              <label className="form-label">Reversal Reason <span className="text-red-500">*</span></label>
              <Textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Minimum 5 characters. State the reason clearly..."
                rows={3}
              />
              {reversalReason.length > 0 && reversalReason.length < 5 && (
                <p className="text-xs text-red-500 mt-1">Minimum 5 characters ({5 - reversalReason.length} more)</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowReverse(false); setReversalReason(''); }}
                disabled={reverseMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                isLoading={reverseMutation.isPending}
                disabled={reversalReason.length < 5}
                onClick={() => reverseMutation.mutate()}
              >
                Confirm Reversal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
