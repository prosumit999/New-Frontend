// src/features/collections/CollectionDetailPage.tsx
// BUG FIX: data?.data?.data?.collection → data?.data?.collection (was triple-nested)
// Added: SMS indicator, Transaction ref, role-gated reversal, receipt-style UI
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, RotateCcw, MessageSquare, Hash, CheckCircle, XCircle, Receipt } from 'lucide-react';
import { collectionApi } from '../../api/collection.api';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { DetailRow } from '../../components/shared/DetailRow';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [showReverse, setShowReverse] = useState(false);
  const [reversalReason, setReversalReason] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => collectionApi.getById(id!),
    enabled: !!id,
  });

  // FIXED: data is already unwrapped (res.data) by api client → path is data.data.collection
  const collection = data?.data?.collection as any;

  const reverseMutation = useMutation({
    mutationFn: () => collectionApi.reverse(id!, { reversalReason }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Collection reversed successfully');
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['daily-sheet'] });
      setShowReverse(false);
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

  if (isError || !collection) return (
    <div className="text-center py-24">
      <XCircle className="h-12 w-12 mx-auto text-red-300 mb-4" />
      <p className="text-red-500 mb-4">Failed to load collection.</p>
      <Button variant="outline" onClick={() => navigate('/collections')}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
    </div>
  );

  const isReversed = collection.isReversed || collection.status === 'missed';

  return (
    <div className="animate-fade-in animate-slide-up max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/collections')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title font-mono tracking-tight">{collection.receiptNumber}</h1>
              {isReversed ? (
                <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">REVERSED</span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">COLLECTED</span>
              )}
            </div>
            <p className="page-subtitle">Collection Receipt Detail</p>
          </div>
        </div>
        {!isReversed && isAdmin && (
          <Button variant="destructive" size="sm" onClick={() => setShowReverse(true)}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reverse Collection
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Receipt card */}
        <div className="md:col-span-2 space-y-5">
          {/* Receipt hero */}
          <div className={`card overflow-hidden ${isReversed ? 'opacity-75' : ''}`}>
            <div className={`p-6 text-center ${isReversed ? 'bg-red-50' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'}`}>
              <Receipt className={`h-8 w-8 mx-auto mb-2 ${isReversed ? 'text-red-400' : 'text-white/80'}`} />
              <p className={`text-4xl font-bold ${isReversed ? 'line-through text-slate-400' : 'text-white'}`}>
                {formatCurrency(collection.amountInPaise)}
              </p>
              <p className={`text-sm mt-1 ${isReversed ? 'text-red-500' : 'text-emerald-100'}`}>
                {isReversed ? 'This collection was reversed' : 'Collection Amount'}
              </p>
            </div>

            {/* Receipt body */}
            <div className="card-body border-t-2 border-dashed border-slate-100">
              <dl>
                <DetailRow label="Receipt Number" value={<span className="font-mono font-bold text-blue-700">{collection.receiptNumber}</span>} />
                <DetailRow label="Collection Date" value={formatDate(collection.collectionDate)} />
                <DetailRow label="Business Date" value={formatDate(collection.businessDate)} />
                <DetailRow label="Balance After" value={<span className="font-bold text-emerald-700">{formatCurrency(collection.balanceAfterInPaise)}</span>} />
                <DetailRow label="Collection Type" value={
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                    collection.collectionType === 'manual'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {(collection.collectionType || 'daily').toUpperCase()}
                  </span>
                } />
                {collection.note && <DetailRow label="Note" value={collection.note} />}
                <DetailRow label="Recorded At" value={formatDateTime(collection.recordedAt || collection.createdAt)} />
              </dl>
            </div>
          </div>

          {/* Reversal info */}
          {isReversed && (
            <div className="card border-l-4 border-l-red-400 bg-red-50/50">
              <div className="card-body">
                <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Reversal Details
                </h3>
                <dl>
                  <DetailRow label="Reversal Reason" value={collection.reversalReason || '—'} />
                  <DetailRow label="Reversed At" value={formatDateTime(collection.reversedAt)} />
                  <DetailRow label="Reversed By" value={collection.reversedBy?.name || '—'} />
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Right: Parties + SMS */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-800">Customer</h2>
            </div>
            <div className="card-body">
              <p className="font-bold text-slate-900">{collection.customer?.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">{collection.customer?.customerCode}</p>
              <p className="text-sm text-slate-500">{collection.customer?.phone}</p>
              <p className="text-xs font-mono text-blue-600 mt-2">
                {collection.pigmyAccount?.accountNumber}
              </p>
            </div>
          </div>

          {/* Agent */}
          {collection.agent && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-slate-800">Collected By</h2>
              </div>
              <div className="card-body">
                <p className="font-medium text-slate-900">{collection.agent?.name}</p>
                <p className="text-sm text-slate-500">{collection.agent?.agentCode}</p>
                {collection.recordedBy && collection.recordedBy._id !== collection.agent._id && (
                  <p className="text-xs text-slate-400 mt-1">Recorded by: {collection.recordedBy?.name}</p>
                )}
              </div>
            </div>
          )}

          {/* SMS Status */}
          <div className={`card p-4 flex items-center gap-3 ${collection.smsSent ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50'}`}>
            <MessageSquare className={`h-5 w-5 ${collection.smsSent ? 'text-emerald-500' : 'text-slate-300'}`} />
            <div>
              <p className="text-sm font-medium text-slate-700">SMS Receipt</p>
              <p className={`text-xs ${collection.smsSent ? 'text-emerald-600' : 'text-slate-400'}`}>
                {collection.smsSent ? '✓ Sent to customer' : 'Not sent'}
              </p>
            </div>
          </div>

          {/* Transaction ref */}
          {collection.transaction && (
            <div className="card p-4">
              <p className="text-xs text-slate-400 mb-1">Transaction Reference</p>
              <p className="font-mono text-xs text-blue-600 break-all">
                {collection.transaction?.transactionId || collection.transaction}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Status: <span className="font-medium text-emerald-600">{collection.transaction?.status || 'completed'}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Reverse Modal ───────────────────────────────────────────────────── */}
      {showReverse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Reverse Collection</h3>
                <p className="text-xs text-slate-500">
                  This will debit {formatCurrency(collection.amountInPaise)} from the pigmy account
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-amber-700 font-semibold">⚠️ This action cannot be undone</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Receipt <strong>{collection.receiptNumber}</strong> will be reversed and
                the pigmy balance will be debited accordingly.
              </p>
            </div>

            <div className="mb-4">
              <label className="form-label">Reversal Reason <span className="text-red-500">*</span></label>
              <Textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Minimum 10 characters. Be specific about the reason for reversal..."
                rows={3}
              />
              {reversalReason.length > 0 && reversalReason.length < 10 && (
                <p className="text-xs text-red-500 mt-1">Minimum 10 characters required ({10 - reversalReason.length} more)</p>
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
                disabled={reversalReason.length < 10}
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
