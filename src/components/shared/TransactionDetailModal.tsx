// src/components/shared/TransactionDetailModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable transaction detail popup — used by SavingDetailPage, PigmyDetailPage,
// LoanDetailPage. Click any Txn ID in a statement table to open this.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { X, Copy, CheckCircle2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Hash, Calendar, User, Banknote, FileText, CreditCard, Building2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateTime, isCreditTransaction } from '../../utils/format';
import { ledgerApi } from '../../api/ledger.api';
import toast from 'react-hot-toast';

interface Transaction {
  _id?: string;
  transactionId?: string;
  type?: string;
  amountInPaise?: number;
  netAmountInPaise?: number;
  feeInPaise?: number;
  balanceAfterInPaise?: number;
  note?: string;
  status?: string;
  businessDate?: string;
  createdAt?: string;
  paymentMode?: string;
  utrNumber?: string;
  chequeNumber?: string;
  bankName?: string;
  performedBy?: { _id?: string; name?: string; role?: string };
  reversalOf?: string;
}

interface TransactionDetailModalProps {
  tx: Transaction | null;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const txLabel = (type: string) => type?.replace(/_/g, ' ') ?? '—';

const txColorClass = (type: string) =>
  isCreditTransaction(type)
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : 'bg-red-100 text-red-700 border-red-200';

const paymentModeLabel: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_cheque: 'Bank Cheque',
  online: 'Online / UPI',
  bank_online: 'Bank Online / UPI',
  bank_transfer: 'NEFT / RTGS',
  internal: 'Internal Transfer',
};

// ─── Row ──────────────────────────────────────────────────────────────────────
function Row({ icon: Icon, label, value, mono = false, children }: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 leading-none mb-0.5">{label}</p>
        {children ?? (
          <p className={`text-sm text-slate-900 font-medium break-all ${mono ? 'font-mono text-xs' : ''}`}>
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TransactionDetailModal({ tx, onClose }: TransactionDetailModalProps) {
  const [showLedger, setShowLedger] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<any>(null);

  if (!tx) return null;

  const credit = isCreditTransaction(tx.type ?? '');
  const amount = tx.amountInPaise ?? 0;

  const fetchLedgerTrail = async () => {
    if (!tx.transactionId) return;
    if (showLedger) {
      setShowLedger(false);
      return;
    }
    setShowLedger(true);
    if (ledgerData) return; // already loaded

    try {
      setLedgerLoading(true);
      const res = await ledgerApi.getTransactionTrail(tx.transactionId);
      setLedgerData(res?.data?.entries || []);
    } catch (err: any) {
      toast.error('Failed to load ledger trail');
      setShowLedger(false);
    } finally {
      setLedgerLoading(false);
    }
  };

  const copyTxnId = () => {
    if (tx.transactionId) {
      navigator.clipboard.writeText(tx.transactionId).then(() =>
        toast.success('Transaction ID copied')
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* ── Header ── */}
        <div className={`flex items-start justify-between p-5 rounded-t-2xl ${credit ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              {credit
                ? <ArrowDownCircle className="w-5 h-5 text-white" />
                : <ArrowUpCircle className="w-5 h-5 text-white" />}
            </div>
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
                {credit ? 'Credit Transaction' : 'Debit Transaction'}
              </p>
              <p className="text-white text-2xl font-bold mt-0.5">
                {credit ? '+' : '-'}{formatCurrency(Math.abs(amount))}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── Status badge ── */}
        <div className="px-5 py-2 flex items-center justify-between bg-slate-50 border-b border-slate-100">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${txColorClass(tx.type ?? '')}`}>
            {txLabel(tx.type ?? '')}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            tx.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {tx.status ?? 'completed'}
          </span>
        </div>

        {/* ── Details ── */}
        <div className="px-5 py-2 divide-y divide-slate-50">
          {/* Txn ID with copy */}
          <div className="flex items-start gap-3 py-2.5 border-b border-slate-100">
            <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Hash className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 leading-none mb-0.5">Transaction ID</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-slate-900 font-medium break-all">{tx.transactionId || '—'}</p>
                {tx.transactionId && (
                  <button
                    onClick={copyTxnId}
                    className="flex-shrink-0 w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    title="Copy Transaction ID"
                  >
                    <Copy className="w-3 h-3 text-slate-500" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <Row icon={Calendar} label="Business Date"
            value={tx.businessDate ? new Date(tx.businessDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />

          <Row icon={Calendar} label="Posted At"
            value={formatDateTime(tx.createdAt)} />

          {/* Amount breakdown */}
          {(tx.feeInPaise != null && tx.feeInPaise > 0) && (
            <>
              <Row icon={Banknote} label="Gross Amount" value={formatCurrency(amount)} />
              <Row icon={Banknote} label="Processing Fee" value={`- ${formatCurrency(tx.feeInPaise)}`} />
              <Row icon={Banknote} label="Net Amount" value={formatCurrency(tx.netAmountInPaise ?? 0)} />
            </>
          )}

          {tx.balanceAfterInPaise != null && (
            <Row icon={CheckCircle2} label="Balance After Transaction"
              value={formatCurrency(tx.balanceAfterInPaise)} />
          )}

          {/* Payment mode */}
          {tx.paymentMode && (
            <Row icon={CreditCard} label="Payment Mode"
              value={paymentModeLabel[tx.paymentMode] ?? tx.paymentMode} />
          )}

          {tx.chequeNumber && (
            <Row icon={FileText} label="Cheque Number" value={tx.chequeNumber} mono />
          )}

          {tx.utrNumber && (
            <Row icon={Building2} label="UTR / Reference Number" value={tx.utrNumber} mono />
          )}

          {tx.bankName && (
            <Row icon={Building2} label="Bank" value={tx.bankName} />
          )}

          {tx.note && (
            <Row icon={FileText} label="Narration / Note" value={tx.note} />
          )}

          {tx.performedBy && (
            <Row icon={User} label="Performed By"
              value={`${tx.performedBy.name ?? '—'} ${tx.performedBy.role ? `(${tx.performedBy.role})` : ''}`} />
          )}

          {tx.reversalOf && (
            <Row icon={ArrowLeftRight} label="Reversal of Transaction" value={tx.reversalOf} mono />
          )}
        </div>

        {/* ── Ledger Trail Accordion ── */}
        <div className="border-t border-slate-100">
          <button
            onClick={fetchLedgerTrail}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span>View Ledger Trail (Double-Entry)</span>
            {showLedger ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          
          {showLedger && (
            <div className="px-5 pb-5 bg-slate-50">
              {ledgerLoading ? (
                <div className="flex items-center justify-center py-6 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Loading ledger entries...</span>
                </div>
              ) : ledgerData && ledgerData.length > 0 ? (
                <div className="space-y-3">
                  {ledgerData.map((entry: any, i: number) => (
                    <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded ${entry.side === 'DR' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {entry.side}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{entry.account?.name}</p>
                          <p className="text-[10px] font-mono text-slate-500">GL: {entry.account?.code}</p>
                        </div>
                      </div>
                      <span className="text-sm font-mono font-bold text-slate-700">
                        {formatCurrency(entry.amountInPaise)}
                      </span>
                    </div>
                  ))}
                  <p className="text-xs text-center text-slate-400 mt-2">
                    Industry standard dual-entry ledger logic guarantees atomicity.
                  </p>
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-slate-500">
                  No ledger trail available for this record.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <p className="text-xs text-slate-400 text-center">
            This record is system-generated and immutable. For disputes, contact your branch.
          </p>
          <button
            onClick={onClose}
            className="mt-3 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
