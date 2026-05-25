// src/features/transactions/CashBankPayment.tsx
// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED TRANSACTION HUB
// Tab 1: Debit / Credit   → Deposit or Withdraw cash/bank from a customer account
//    ↳ Cash Denomination Panel: Indian note breakdown (2000, 500, 200, 100, 50, 20, 10, 5, 2, 1)
//    ↳ Two-step customer lookup: search returns list → select → show accounts
// Tab 2: Internal Transfer → Move funds between a customer's own accounts
// Tab 3: Journal Voucher   → Direct GL-to-GL admin posting (redirect)
//
// Post-transaction: fully resets customer lookup + denomination panel + form fields
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { customerApi } from '../../api/customer.api';
import { ledgerApi } from '../../api/ledger.api';
import { savingApi } from '../../api/saving.api';
import { pigmyApi } from '../../api/pigmy.api';
import toast from 'react-hot-toast';
import TransactionDetailModal from '../../components/shared/TransactionDetailModal';
import {
  Search, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  BookOpen, Info, CheckCircle, XCircle, Loader2,
  Building2, Hash, ChevronRight, AlertTriangle, IndianRupee,
  Banknote, RotateCcw, Users, Phone, TrendingUp,
} from 'lucide-react';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const debitCreditSchema = z.object({
  paymentMode: z.enum(['cash', 'cheque', 'online', 'bank_transfer']),
  amount: z.coerce.number().min(1, 'Amount must be at least ₹1'),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().optional(),
  utrNumber: z.string().optional(),
  bankLedgerCode: z.string().min(1, 'GL Code is required'),
  note: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMode === 'cheque') {
    if (!data.chequeNumber?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['chequeNumber'], message: 'Cheque number is required' });
    }
    if (!data.chequeDate) {
      ctx.addIssue({ code: 'custom', path: ['chequeDate'], message: 'Cheque date is required' });
    }
  }
});

const transferSchema = z.object({
  amount: z.coerce.number().min(1, 'Amount must be at least ₹1'),
  fromAccountId: z.string().min(1, 'Select a source account'),
  toAccountId: z.string().min(1, 'Select a destination account'),
  transferType: z.enum(['saving_to_pigmy', 'pigmy_to_saving', 'saving_to_loan', 'pigmy_to_loan']),
  note: z.string().optional(),
});

type DebitCreditValues = z.infer<typeof debitCreditSchema>;
type TransferValues = z.infer<typeof transferSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'debit_credit' | 'transfer' | 'journal' | 'capital';
type TxnDirection = 'deposit' | 'withdrawal';
type AccountModule = 'saving' | 'pigmy' | 'loan';

interface LookupAccount {
  _id: string;
  accountNumber?: string;
  loanAccountNumber?: string;
  balanceInPaise?: number;
  outstandingBalanceInPaise?: number;
  status: string;
}
interface LookupResult {
  customer: any;
  accounts: { savings: LookupAccount[]; pigmys: LookupAccount[]; loans: LookupAccount[] };
}

// ─── Indian Currency Denominations ───────────────────────────────────────────
const DENOMINATIONS = [
  { value: 2000, label: '₹2000', color: 'bg-yellow-50 border-yellow-200 text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
  { value: 500, label: '₹500', color: 'bg-purple-50 border-purple-200 text-purple-800', badge: 'bg-purple-100 text-purple-700' },
  { value: 200, label: '₹200', color: 'bg-orange-50 border-orange-200 text-orange-800', badge: 'bg-orange-100 text-orange-700' },
  { value: 100, label: '₹100', color: 'bg-blue-50 border-blue-200 text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  { value: 50, label: '₹50', color: 'bg-pink-50 border-pink-200 text-pink-800', badge: 'bg-pink-100 text-pink-700' },
  { value: 20, label: '₹20', color: 'bg-green-50 border-green-200 text-green-800', badge: 'bg-green-100 text-green-700' },
  { value: 10, label: '₹10', color: 'bg-teal-50 border-teal-200 text-teal-800', badge: 'bg-teal-100 text-teal-700' },
  { value: 5, label: '₹5', color: 'bg-cyan-50 border-cyan-200 text-cyan-800', badge: 'bg-cyan-100 text-cyan-700' },
  { value: 2, label: '₹2', color: 'bg-gray-50 border-gray-200 text-gray-700', badge: 'bg-gray-100 text-gray-600' },
  { value: 1, label: '₹1', color: 'bg-slate-50 border-slate-200 text-slate-700', badge: 'bg-slate-100 text-slate-600' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (paise?: number) =>
  `₹${((paise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const accNum = (acc: LookupAccount) => acc.accountNumber || acc.loanAccountNumber || acc._id;
const accBal = (acc: LookupAccount, module: AccountModule) =>
  module === 'loan'
    ? `Outstanding: ${fmt(acc.outstandingBalanceInPaise)}`
    : `Balance: ${fmt(acc.balanceInPaise)}`;

// ─── Cash Denomination Panel ──────────────────────────────────────────────────

interface CashDenomPanelProps {
  onTotalChange: (total: number) => void;
}

function CashDenomPanel({ onTotalChange }: CashDenomPanelProps) {
  const [counts, setCounts] = useState<Record<number, number>>(
    Object.fromEntries(DENOMINATIONS.map(d => [d.value, 0]))
  );

  const breakdown = useMemo(() =>
    DENOMINATIONS
      .map(d => ({ ...d, count: counts[d.value], subtotal: d.value * counts[d.value] }))
      .filter(d => d.count > 0),
    [counts]
  );

  const total = useMemo(() =>
    DENOMINATIONS.reduce((sum, d) => sum + d.value * counts[d.value], 0),
    [counts]
  );

  useEffect(() => { onTotalChange(total); }, [total, onTotalChange]);

  const update = (val: number, raw: string) => {
    const n = Math.max(0, parseInt(raw, 10) || 0);
    setCounts(prev => ({ ...prev, [val]: n }));
  };

  const reset = () => {
    setCounts(Object.fromEntries(DENOMINATIONS.map(d => [d.value, 0])));
  };

  return (
    <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Banknote className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Cash Denomination Counter</p>
            <p className="text-xs text-gray-500">Enter number of each note/coin</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors border border-gray-200 hover:border-red-200 rounded-lg px-2 py-1"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Denomination grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-2">
        {DENOMINATIONS.map(d => (
          <div
            key={d.value}
            className={`border rounded-lg px-3 py-2.5 flex items-center gap-2 transition-all ${counts[d.value] > 0 ? d.color : 'bg-white border-gray-200'
              }`}
          >
            <span className={`text-xs font-bold w-10 shrink-0 px-1.5 py-0.5 rounded text-center ${counts[d.value] > 0 ? d.badge : 'bg-gray-100 text-gray-600'
              }`}>
              {d.label}
            </span>
            <span className="text-gray-400 text-xs">×</span>
            <input
              type="number"
              min="0"
              value={counts[d.value] || ''}
              placeholder="0"
              onChange={e => update(d.value, e.target.value)}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-semibold text-gray-700 placeholder:text-gray-300 text-center"
            />
            {counts[d.value] > 0 && (
              <span className="text-xs text-gray-500 shrink-0">
                ={' '}
                <span className="font-semibold text-gray-700">
                  ₹{(d.value * counts[d.value]).toLocaleString('en-IN')}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Breakdown + Total */}
      {breakdown.length > 0 && (
        <div className="bg-white/70 rounded-lg border border-emerald-100 divide-y divide-gray-100">
          {breakdown.map(d => (
            <div key={d.value} className="flex justify-between items-center px-3 py-1.5 text-xs">
              <span className="text-gray-500">{d.label} × {d.count}</span>
              <span className="font-semibold text-gray-700">₹{d.subtotal.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grand Total Bar */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${total > 0
          ? 'bg-emerald-600 border-emerald-700 text-white'
          : 'bg-gray-100 border-gray-200 text-gray-400'
        }`}>
        <div className="flex items-center gap-2">
          <IndianRupee className="w-4 h-4" />
          <span className="text-sm font-semibold">Total Cash Collected</span>
        </div>
        <span className="text-lg font-bold tracking-tight">
          ₹{total.toLocaleString('en-IN')}.00
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPITAL INFUSION PANEL (standalone — no customer lookup)
// DR Cash (1001) | CR Owner's Capital (5002)
// ─────────────────────────────────────────────────────────────────────────────
function CapitalInfusionPanel() {
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxnId, setLastTxnId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0) { toast.error('Enter a valid amount'); return; }
    setIsSubmitting(true);
    try {
      // Use the same axios instance for auth token injection
      const { api } = await import('../../api/client');
      const res = await api.post('/capital-infusion', {
        amountInRupees: amtNum, paymentMode, note: note || undefined,
      });
      const txnId = (res as any)?.data?.data?.transactionId;
      setLastTxnId(txnId || 'SUCCESS');
      setAmount(''); setNote('');
      toast.success(`Capital infusion recorded! ${txnId ? `· ${txnId}` : ''}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to record capital infusion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const amtDisplay = amount
    ? `₹${parseFloat(amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '₹ —';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600" /> Record Capital Infusion
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Owner injects cash into the institution ·{' '}
          <strong className="text-indigo-700">DR Cash (1001) | CR Owner's Capital (5002)</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Live GL preview */}
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm">
          <p className="font-semibold text-indigo-800 mb-2 text-xs uppercase tracking-wide">Double-Entry Preview</p>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-indigo-600">DR Cash in Hand (GL 1001)</span>
              <span className="font-bold text-blue-700">{amtDisplay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-indigo-600">CR Owner's Capital (GL 5002)</span>
              <span className="font-bold text-purple-700">{amtDisplay}</span>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Amount Injected (₹) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number" min="1" step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00" required
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Payment Mode */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Payment Mode</label>
          <select
            value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
            <option value="cheque">Cheque / DD</option>
          </select>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Note / Reference</label>
          <input
            type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="e.g. Initial owner capital, Q2 infusion, FY 2026 contribution..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Last txn success badge */}
        {lastTxnId && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Recorded: <strong className="font-mono">{lastTxnId}</strong></span>
          </div>
        )}

        {/* Safety warning */}
        <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Capital entries <strong>increase Cash-in-Hand balance</strong> and allow new loans to be disbursed.
            Business day must be open. To correct errors, post a reverse JV from
            {' '}<a href="/ledger" className="text-blue-600 underline">Ledger → Post Journal Voucher</a>.
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <button
            id="btn-submit-capital"
            type="submit"
            disabled={isSubmitting || !amount}
            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-40"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
              : <><TrendingUp className="w-4 h-4" /> Record Capital Infusion</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CashBankPayment() {
  const [activeTab, setActiveTab] = useState<Tab>('debit_credit');
  const [direction, setDirection] = useState<TxnDirection>('deposit');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedModule, setSelectedModule] = useState<AccountModule>('saving');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [denomTotal, setDenomTotal] = useState(0);
  const [denomResetKey, setDenomResetKey] = useState(0);
  // Full tx-like object so TransactionDetailModal can render all details
  const [receiptTx, setReceiptTx] = useState<any | null>(null);

  // ── URL deep-link: ?account=SAV-2026-00001 from detail pages ────────────
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Debit/Credit form ───────────────────────────────────────────────────
  const {
    register: regDC, handleSubmit: hsDC, watch: watchDC, reset: resetDC, setValue: setValDC,
    formState: { errors: errDC },
  } = useForm<DebitCreditValues>({
    resolver: zodResolver(debitCreditSchema),
    defaultValues: { paymentMode: 'cash', bankLedgerCode: '1001', amount: '' as any },
  });

  // ── Transfer form ────────────────────────────────────────────────────────
  const {
    register: regTF, handleSubmit: hsTF, watch: watchTF, reset: resetTF,
    setValue: setTFValue,
    formState: { errors: errTF },
  } = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { transferType: 'saving_to_pigmy' },
  });

  const paymentMode = watchDC('paymentMode');
  const ledgerCode = watchDC('bankLedgerCode');
  const transferType = watchTF('transferType');

  // Sync denomination total → amount field when cash mode is active
  useEffect(() => {
    if (paymentMode === 'cash' && direction === 'deposit' && denomTotal > 0) {
      setValDC('amount', denomTotal as any);
    }
  }, [denomTotal, paymentMode, direction, setValDC]);

  // ── GL Code live lookup ──────────────────────────────────────────────────
  const { data: glData, isLoading: isGLLoading } = useQuery({
    queryKey: ['gl', ledgerCode],
    queryFn: () => ledgerApi.getAccountByCode(ledgerCode.trim()),
    enabled: ledgerCode.trim().length >= 4,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const glAccount = (glData as any)?.data;

  // ── Select a customer from the search results list ───────────────────────
  const selectCustomerById = useCallback(async (customer: any) => {
    setIsLoadingAccounts(true);
    setSelectedCustomer(customer); // Temporary — replaced below with full profile
    setSearchResults([]);
    setSelectedAccountId('');
    try {
      const res = await customerApi.lookup(customer.customerCode);
      // Axios response: res.data = ApiResponse body = { success, data: { customer, accounts } }
      const payload = (res as any)?.data;   // { customer, accounts }
      if (payload?.customer) setSelectedCustomer(payload.customer); // Full profile WITH kycDocuments
      setLookupResult(payload);
    } catch {
      try {
        const res2 = await customerApi.lookup(customer.phone);
        const payload2 = (res2 as any)?.data;
        if (payload2?.customer) setSelectedCustomer(payload2.customer);
        setLookupResult(payload2);
      } catch {
        toast.error('Failed to load accounts for this customer');
        setSelectedCustomer(null);
      }
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  // ── Core search logic (shared by debounce + form submit) ─────────────────
  const runSearch = useCallback(async (term: string) => {
    if (!term.trim() || term.trim().length < 2) return;
    setIsSearching(true);
    setSearchResults([]);
    setSelectedCustomer(null);
    setLookupResult(null);
    setSelectedAccountId('');
    try {
      const isLikelyExact = /^\d{10}$/.test(term.trim())
        || /^CUST-/i.test(term.trim())
        || /^(SAV|PGM|LON)-/i.test(term.trim());

      if (isLikelyExact) {
        const res = await customerApi.lookup(term.trim());
        // Axios response: res.data = ApiResponse body = { success, data: { customer, accounts } }
        const payload = (res as any)?.data;   // { customer, accounts }
        if (payload?.customer) {
          setSelectedCustomer(payload.customer); // Full profile WITH kycDocuments
          setLookupResult(payload);
        }
      } else {
        const res = await customerApi.search(term.trim());
        const customers = (res as any)?.data?.customers || [];
        
        if (customers.length > 0) {
          setSearchResults(customers);
        } else {
          toast.error('No customers found matching "' + term.trim() + '"');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No customer found');
    } finally {
      setIsSearching(false);
    }
  }, [selectCustomerById]);

  // ── Debounced auto-search on input change ────────────────────────────────
  useEffect(() => {
    // Don't auto-search if a customer is already selected
    if (selectedCustomer || lookupResult) return;
    if (!search.trim() || search.trim().length < 2) return;
    const timer = setTimeout(() => { runSearch(search); }, 400);
    return () => clearTimeout(timer);
  }, [search]); // intentionally omit runSearch/selectedCustomer to avoid re-firing on state changes

  // ── Customer search (form submit — still works) ──────────────────────────
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(search);
  }, [search, runSearch]);

  // ── Auto-lookup from URL param: ?account=SAV-2026-00001 ─────────────────
  // Triggered when detail pages click the "Transaction Counter" button.
  // Reads the account number, populates the search field, and auto-runs lookup.
  useEffect(() => {
    const accountParam = searchParams.get('account');
    if (!accountParam) return;
    // Populate search field and auto-run
    setSearch(accountParam);
    // Clear the param from the URL immediately (keeps URL clean)
    setSearchParams({}, { replace: true });
    // Run lookup after a short tick so runSearch sees the updated search state
    setTimeout(() => {
      runSearch(accountParam);
    }, 100);
  }, []); // Only on mount — intentional empty deps

  // ── Full reset ────────────────────────────────────────────────────────────
  const fullReset = useCallback(() => {
    setSearch('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setLookupResult(null);
    setSelectedAccountId('');
    setSelectedModule('saving');
    setDenomTotal(0);
    setDenomResetKey(k => k + 1);
    
    // Explicitly reset all react-hook-form fields to avoid retaining previous amounts
    resetDC({ paymentMode: 'cash', bankLedgerCode: '1001', amount: '' as any, note: '', chequeNumber: '', chequeDate: '', utrNumber: '' });
    resetTF({ transferType: 'saving_to_pigmy', amount: '' as any, note: '' });

    // Scroll to the top of the page for the next transaction
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resetDC, resetTF]);

  // Reset account selection when tab changes
  useEffect(() => {
    setSelectedAccountId('');
    resetDC({ paymentMode: 'cash', bankLedgerCode: '1001', amount: '' as any });
    resetTF({ transferType: 'saving_to_pigmy' });
  }, [activeTab]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const depositSaving = useMutation({
    mutationFn: (d: { id: string; payload: any }) =>
      savingApi.deposit(d.id, d.payload, crypto.randomUUID()),
    onSuccess: (res: any, vars: any) => {
      // Backend returns: { accountNumber, transactionRef, amountInRupees, newBalanceInRupees }
      const d = (res as any)?.data;  // ApiResponse.data payload
      setReceiptTx({
        transactionId: d?.transactionRef || '—',
        type: 'saving_deposit',
        amountInPaise: vars.payload.amountInPaise,
        netAmountInPaise: vars.payload.amountInPaise,
        feeInPaise: 0,
        balanceAfterInPaise: d?.newBalanceInRupees ? Math.round(parseFloat(d.newBalanceInRupees) * 100) : undefined,
        paymentMode: vars.payload.paymentMode,
        chequeNumber: vars.payload.chequeNumber,
        utrNumber: vars.payload.utrNumber,
        note: vars.payload.note,
        status: 'completed',
        businessDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Deposit failed'),
  });

  const withdrawSaving = useMutation({
    mutationFn: (d: { id: string; payload: any }) =>
      savingApi.withdraw(d.id, d.payload, crypto.randomUUID()),
    onSuccess: (res: any, vars: any) => {
      const d = (res as any)?.data;
      setReceiptTx({
        transactionId: d?.transactionRef || '—',
        type: 'saving_withdrawal',
        amountInPaise: vars.payload.amountInPaise,
        netAmountInPaise: vars.payload.amountInPaise,
        feeInPaise: 0,
        paymentMode: vars.payload.paymentMode,
        chequeNumber: vars.payload.chequeNumber,
        utrNumber: vars.payload.utrNumber,
        note: vars.payload.note,
        status: 'completed',
        businessDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Withdrawal failed'),
  });

  const savingToPigmy = useMutation({
    mutationFn: (d: { id: string; payload: any }) => savingApi.transferToPigmy(d.id, d.payload),
    onSuccess: (res: any, vars: any) => {
      const d = (res as any)?.data;
      setReceiptTx({
        transactionId: d?.transactionRef || d?.transaction?.transactionId || '—',
        type: 'saving_to_pigmy_transfer',
        amountInPaise: vars.payload.amountInPaise,
        netAmountInPaise: vars.payload.amountInPaise,
        feeInPaise: 0,
        note: vars.payload.note,
        status: 'completed',
        businessDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Transfer failed'),
  });

  const pigmyToSaving = useMutation({
    mutationFn: (d: { id: string; payload: any }) => pigmyApi.transferToSaving(d.id, d.payload),
    onSuccess: (res: any, vars: any) => {
      const d = (res as any)?.data;
      setReceiptTx({
        transactionId: d?.transactionRef || d?.transaction?.transactionId || '—',
        type: 'pigmy_to_saving_transfer',
        amountInPaise: vars.payload.amountInPaise,
        netAmountInPaise: vars.payload.amountInPaise,
        feeInPaise: 0,
        note: vars.payload.note,
        status: 'completed',
        businessDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Transfer failed'),
  });

  const savingToLoan = useMutation({
    mutationFn: (d: { id: string; payload: any }) =>
      savingApi.repayLoan(d.id, d.payload, crypto.randomUUID()),
    onSuccess: (res: any, vars: any) => {
      const d = (res as any)?.data;
      setReceiptTx({
        transactionId: d?.transactionRef || d?.loanTransactionRef || '—',
        type: 'loan_repayment',
        amountInPaise: vars.payload.amountInPaise,
        netAmountInPaise: vars.payload.amountInPaise,
        feeInPaise: 0,
        note: vars.payload.note,
        status: 'completed',
        businessDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Repayment failed'),
  });

  const isDebitCreditPending = depositSaving.isPending || withdrawSaving.isPending;
  const isTransferPending = savingToPigmy.isPending || pigmyToSaving.isPending || savingToLoan.isPending;

  // ── Submit: Debit/Credit ────────────────────────────────────────────────
  const onSubmitDC = (data: DebitCreditValues) => {
    if (!selectedAccountId) return toast.error('Please select an account first');

    const payload = {
      amountInPaise: Math.round(data.amount * 100),
      paymentMode: data.paymentMode,
      bankLedgerCode: data.bankLedgerCode.trim(),
      note: data.note || undefined,
      ...(data.paymentMode === 'cheque' && {
        chequeNumber: data.chequeNumber,
        chequeDate: data.chequeDate ? new Date(data.chequeDate).toISOString() : undefined,
      }),
      ...((data.paymentMode === 'online' || data.paymentMode === 'bank_transfer') && {
        utrNumber: data.utrNumber || undefined,
      }),
    };

    if (selectedModule === 'saving') {
      if (direction === 'deposit') depositSaving.mutate({ id: selectedAccountId, payload });
      else withdrawSaving.mutate({ id: selectedAccountId, payload });
    } else {
      toast.error(`${direction} for ${selectedModule} accounts not yet available in this hub.`);
    }
  };

  // ── Submit: Transfer ────────────────────────────────────────────────────
  const onSubmitTF = (data: TransferValues) => {
    const paise = Math.round(data.amount * 100);
    const note = data.note || undefined;

    if (data.transferType === 'saving_to_pigmy') {
      savingToPigmy.mutate({ id: data.fromAccountId, payload: { pigmyAccountId: data.toAccountId, amountInPaise: paise, note } });
    } else if (data.transferType === 'pigmy_to_saving') {
      pigmyToSaving.mutate({ id: data.fromAccountId, payload: { savingAccountId: data.toAccountId, amountInPaise: paise, note } });
    } else if (data.transferType === 'saving_to_loan') {
      savingToLoan.mutate({ id: data.fromAccountId, payload: { loanAccountId: data.toAccountId, amountInPaise: paise, note } });
    } else {
      toast.error('This transfer type is not yet available.');
    }
  };

  // ─── Derived account lists ─────────────────────────────────────────────
  const savings = lookupResult?.accounts?.savings ?? [];
  const pigmys = lookupResult?.accounts?.pigmys ?? [];
  const loans = lookupResult?.accounts?.loans ?? [];

  const fromAccounts = transferType === 'saving_to_pigmy' || transferType === 'saving_to_loan'
    ? savings.map(a => ({ ...a, module: 'saving' as AccountModule }))
    : pigmys.map(a => ({ ...a, module: 'pigmy' as AccountModule }));

  const toAccounts = transferType === 'saving_to_pigmy'
    ? pigmys.map(a => ({ ...a, module: 'pigmy' as AccountModule }))
    : transferType === 'pigmy_to_saving'
      ? savings.map(a => ({ ...a, module: 'saving' as AccountModule }))
      : loans.map(a => ({ ...a, module: 'loan' as AccountModule }));

  const showDenomPanel = paymentMode === 'cash' && direction === 'deposit';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5" id="transaction-hub">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Transaction Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">All entries are double-entry and atomic — cannot be partially posted</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <CheckCircle className="w-3.5 h-3.5" /> Double-Entry Enforced
          </span>
          {lookupResult && (
            <button
              type="button"
              onClick={fullReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-full transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> New Transaction
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ─── LEFT: Search + Customer card ──────────────────────────────── */}
        <div className="xl:col-span-4 space-y-4">
          {/* Search box */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-sm text-gray-800">Customer / Account Lookup</h2>
            </div>
            <div className="p-4">
              <form onSubmit={handleSearch}>
                {/* Input with inline spinner + clear button */}
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    id="hub-search"
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Type name, phone, account no…"
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 pl-9 pr-16 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                  />
                  {/* Inline spinner or clear button */}
                  <div className="absolute right-2 flex items-center gap-1">
                    {isSearching && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                    {search && !isSearching && (
                      <button
                        type="button"
                        onClick={() => { setSearch(''); setSearchResults([]); setSelectedCustomer(null); setLookupResult(null); setSelectedAccountId(''); }}
                        className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                        title="Clear search"
                      >
                        <XCircle className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <Search className="w-3 h-3" />
                  Results appear automatically as you type
                </p>
              </form>

              {/* ── Multi-customer search results list ─── */}
              {searchResults.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    {searchResults.length} customers found. Select one to view accounts.
                  </p>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {searchResults.map((c: any) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => selectCustomerById(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                          {c.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.customerCode} · {c.phone}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-auto shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Loading accounts spinner ─── */}
              {isLoadingAccounts && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
                </div>
              )}

              {/* ── Selected customer card ─── */}
              {selectedCustomer && !isLoadingAccounts && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-start gap-4">
                    {selectedCustomer.kycDocuments?.photo?.url ? (
                      <a
                        href={selectedCustomer.kycDocuments.photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Click to view full photo"
                        className="shrink-0 block ring-2 ring-transparent hover:ring-blue-400 rounded-md transition-all"
                      >
                        <img src={selectedCustomer.kycDocuments.photo.url} alt="Photo" className="w-16 h-16 rounded-md object-cover bg-white border border-blue-200 cursor-pointer" />
                      </a>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                        {selectedCustomer.name?.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-base mb-1 truncate">{selectedCustomer.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Hash className="w-3 h-3 text-blue-500" />{selectedCustomer.customerCode}
                        <span className="mx-1">·</span>
                        <Phone className="w-3 h-3 text-emerald-500" />{selectedCustomer.phone}
                      </p>
                      {selectedCustomer.kycDocuments?.signature?.url && (
                        <div className="mt-3 inline-block">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Verify Signature</p>
                          <a
                            href={selectedCustomer.kycDocuments.signature.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Click to view full signature"
                            className="block ring-2 ring-transparent hover:ring-blue-400 rounded transition-all"
                          >
                            <img src={selectedCustomer.kycDocuments.signature.url} alt="Signature" className="h-10 object-contain max-w-[150px] bg-white p-1 rounded border border-gray-200 cursor-pointer" />
                          </a>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={fullReset}
                      title="Clear customer"
                      className="shrink-0 w-8 h-8 rounded-full bg-white hover:bg-blue-100 flex items-center justify-center text-blue-500 hover:text-blue-700 transition-colors shadow-sm"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account list */}
          {lookupResult && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-sm text-gray-800">Select Account</h2>
                <p className="text-xs text-gray-400 mt-0.5">Active accounts only</p>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {[
                  { label: 'Savings', list: savings, module: 'saving' as AccountModule },
                  { label: 'Pigmy', list: pigmys, module: 'pigmy' as AccountModule },
                  { label: 'Loans', list: loans, module: 'loan' as AccountModule },
                ].map(({ label, list, module: mod }) =>
                  list.length > 0 && (
                    <div key={label}>
                      <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">{label}</p>
                      {list.map(acc => (
                        <button
                          key={acc._id}
                          id={`acc-${acc._id}`}
                          type="button"
                          onClick={() => { setSelectedAccountId(acc._id); setSelectedModule(mod); }}
                          className={`w-full text-left px-4 py-3 flex justify-between items-center transition-colors text-sm ${selectedAccountId === acc._id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                          <div>
                            <p className="font-mono font-medium">{accNum(acc)}</p>
                            <p className="text-xs text-gray-500">{accBal(acc, mod)}</p>
                          </div>
                          {selectedAccountId === acc._id && <ChevronRight className="w-4 h-4 text-blue-500" />}
                        </button>
                      ))}
                    </div>
                  )
                )}
                {savings.length + pigmys.length + loans.length === 0 && (
                  <p className="px-4 py-6 text-sm text-gray-400 text-center">No active accounts found</p>
                )}
              </div>
            </div>
          )}

          {/* Selected account summary badge */}
          {selectedAccountId && lookupResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs text-emerald-600 font-medium">Account Selected</p>
                <p className="text-sm font-bold text-emerald-800 font-mono">
                  {accNum(
                    [...(lookupResult?.accounts?.savings ?? []), ...(lookupResult?.accounts?.pigmys ?? []), ...(lookupResult?.accounts?.loans ?? [])].find(a => a._id === selectedAccountId)!
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Transaction forms ──────────────────────────────────── */}
        <div className="xl:col-span-8">
          {/* Tab bar */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
            {([
              { id: 'debit_credit', label: 'Debit / Credit',      icon: ArrowDownCircle, desc: 'Deposit or Withdraw' },
              { id: 'transfer',    label: 'Internal Transfer',    icon: ArrowLeftRight,  desc: 'Between accounts' },
              { id: 'capital',     label: 'Capital Infusion',     icon: TrendingUp,      desc: 'DR Cash | CR Equity' },
              { id: 'journal',     label: 'Journal Voucher',      icon: BookOpen,        desc: 'GL-to-GL posting' },
            ] as { id: Tab; label: string; icon: any; desc: string }[]).map(tab => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="text-xs font-normal opacity-70">{tab.desc}</span>
              </button>
            ))}
          </div>

          {/* ── TAB 1: Debit / Credit ─────────────────────────────────────── */}
          {activeTab === 'debit_credit' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-5 border-b border-gray-100">
                {/* Direction toggle */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    id="btn-deposit"
                    type="button"
                    onClick={() => setDirection('deposit')}
                    className={`flex-1 py-2.5 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-all ${direction === 'deposit' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    <ArrowDownCircle className="w-4 h-4" /> Deposit (Receipt)
                  </button>
                  <button
                    id="btn-withdrawal"
                    type="button"
                    onClick={() => setDirection('withdrawal')}
                    className={`flex-1 py-2.5 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-all ${direction === 'withdrawal' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" /> Withdrawal (Payment)
                  </button>
                </div>

                {!selectedAccountId && (
                  <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Search for a customer and select an account on the left first
                  </div>
                )}

                {/* Warn when a non-saving account is selected — only saving supports direct deposit/withdrawal */}
                {selectedAccountId && selectedModule === 'pigmy' && (
                  <div className="mt-3 flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">Pigmy accounts cannot be directly deposited here.</p>
                      <p className="mt-0.5 text-amber-700">Pigmy collections are recorded through the <strong>Collections</strong> module (agent daily rounds). To move funds between Pigmy and Saving, use the <strong>Internal Transfer</strong> tab above.</p>
                    </div>
                  </div>
                )}
                {selectedAccountId && selectedModule === 'loan' && (
                  <div className="mt-3 flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">Loan accounts do not support direct deposit/withdrawal.</p>
                      <p className="mt-0.5 text-amber-700">To repay a loan, first select the customer's <strong>Saving account</strong>, then use the <strong>Internal Transfer → Saving → Loan Repayment</strong> tab.</p>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={hsDC(onSubmitDC)} className="p-5 space-y-5">

                {/* ── Cash Denomination Panel ─────────────────────────────── */}
                {showDenomPanel && (
                  <CashDenomPanel key={denomResetKey} onTotalChange={setDenomTotal} />
                )}

                {/* Amount + Mode */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Amount (₹) *
                      {showDenomPanel && denomTotal > 0 && (
                        <span className="ml-2 text-emerald-600 font-normal">(auto from denomination)</span>
                      )}
                    </label>
                    <input
                      id="dc-amount"
                      type="number"
                      step="1"
                      min="1"
                      {...regDC('amount')}
                      readOnly={showDenomPanel && denomTotal > 0}
                      className={`w-full h-11 rounded-lg border px-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${showDenomPanel && denomTotal > 0
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 cursor-not-allowed'
                          : 'border-gray-300'
                        }`}
                    />
                    {errDC.amount && <p className="mt-1 text-xs text-red-500">{errDC.amount.message}</p>}
                    {showDenomPanel && denomTotal === 0 && (
                      <p className="mt-1 text-xs text-gray-400">Enter note counts above, or type amount directly</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Mode *</label>
                    <select
                      id="dc-payment-mode"
                      {...regDC('paymentMode')}
                      className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="online">Online / UPI</option>
                      <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                    </select>
                  </div>
                </div>

                {/* Cheque fields */}
                {paymentMode === 'cheque' && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cheque Number *</label>
                      <input
                        id="dc-cheque-number"
                        type="text"
                        {...regDC('chequeNumber')}
                        className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {errDC.chequeNumber && <p className="mt-1 text-xs text-red-500">{errDC.chequeNumber.message}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cheque Date *</label>
                      <input
                        id="dc-cheque-date"
                        type="date"
                        {...regDC('chequeDate')}
                        className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {errDC.chequeDate && <p className="mt-1 text-xs text-red-500">{errDC.chequeDate.message}</p>}
                    </div>
                  </div>
                )}

                {/* UTR field */}
                {(paymentMode === 'online' || paymentMode === 'bank_transfer') && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">UTR / Reference Number (optional)</label>
                    <input
                      id="dc-utr"
                      type="text"
                      {...regDC('utrNumber')}
                      placeholder="e.g. NEFT12345678 or UPI ref"
                      className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* GL Code lookup */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Target Bank / Cash GL Account
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Enter GL Code *</label>
                      <input
                        id="dc-gl-code"
                        type="text"
                        {...regDC('bankLedgerCode')}
                        placeholder="e.g. 1001, 1003"
                        className="w-full h-10 rounded-lg border border-gray-300 px-3 font-mono text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {errDC.bankLedgerCode && <p className="mt-1 text-xs text-red-500">{errDC.bankLedgerCode.message}</p>}
                    </div>
                    <div className="flex flex-col justify-end">
                      {isGLLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 h-10 px-3 bg-gray-100 rounded-lg">
                          <Loader2 className="w-4 h-4 animate-spin" /> Looking up…
                        </div>
                      ) : glAccount ? (
                        <div className="flex items-center justify-between h-10 px-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-sm font-semibold text-emerald-800 truncate">{glAccount.name}</span>
                          </div>
                          <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded ml-2 flex-shrink-0 capitalize">{glAccount.type}</span>
                        </div>
                      ) : ledgerCode.trim().length >= 4 ? (
                        <div className="flex items-center gap-2 h-10 px-3 bg-red-50 border border-red-200 rounded-lg">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600">Invalid GL code</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 h-10 px-3 bg-gray-100 rounded-lg">
                          <Info className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-400">Enter code to verify account</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    This is the bank or cash GL account that will be debited (deposit) or credited (withdrawal). Must exist in your Chart of Accounts.
                  </p>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Narration / Note</label>
                  <input
                    id="dc-note"
                    type="text"
                    {...regDC('note')}
                    placeholder="Optional transaction description"
                    className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Transaction summary preview */}
                {selectedAccountId && glAccount && (
                  <div className={`p-4 rounded-xl border-2 ${direction === 'deposit' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${direction === 'deposit' ? 'text-emerald-700' : 'text-red-700'}`}>
                      Transaction Preview
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-semibold capitalize">{direction} — {paymentMode.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Account:</span>
                      <span className="font-mono font-semibold">
                        {accNum([...savings, ...pigmys, ...loans].find(a => a._id === selectedAccountId)!)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">GL Account:</span>
                      <span className="font-semibold">{glAccount.name} ({ledgerCode})</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={fullReset}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear All
                  </button>
                  <button
                    id="btn-submit-dc"
                    type="submit"
                    disabled={isDebitCreditPending || !selectedAccountId || !glAccount || selectedModule !== 'saving'}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-40 ${direction === 'deposit'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-red-600 hover:bg-red-700'
                      }`}
                  >
                    {isDebitCreditPending
                      ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing…</span>
                      : `Confirm ${direction === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── TAB 2: Internal Transfer ──────────────────────────────────── */}
          {activeTab === 'transfer' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Internal Account Transfer</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Moves funds between a customer's own accounts. No cash/bank GL is touched — only liability accounts are adjusted.
                </p>
                {!lookupResult && (
                  <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Search and select a customer on the left to see their accounts
                  </div>
                )}
              </div>

              <form onSubmit={hsTF(onSubmitTF)} className="p-5 space-y-5">
                {/* Transfer type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Transfer Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'saving_to_pigmy', label: 'Saving → Pigmy', desc: 'DR Saving Liability, CR Pigmy Liability' },
                      { value: 'pigmy_to_saving', label: 'Pigmy → Saving', desc: 'DR Pigmy Liability, CR Saving Liability' },
                      { value: 'saving_to_loan', label: 'Saving → Loan', desc: 'DR Saving Liability, CR Loans Receivable (asset)' },
                      { value: 'pigmy_to_loan', label: 'Pigmy → Loan', desc: 'Use "Apply Pigmy to Loan" in Loan Detail page' },
                    ] as { value: TransferValues['transferType']; label: string; desc: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        id={`transfer-type-${opt.value}`}
                        type="button"
                        disabled={opt.value === 'pigmy_to_loan'}
                        onClick={() => { setTFValue('transferType', opt.value); setTFValue('fromAccountId', ''); setTFValue('toAccountId', ''); }}
                        className={`text-left p-3 rounded-lg border text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${transferType === opt.value
                            ? 'border-blue-400 bg-blue-50 text-blue-800'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                          }`}
                      >
                        <p className="font-semibold">{opt.label}</p>
                        <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* From / To selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">From Account *</label>
                    <select
                      id="tf-from-account"
                      {...regTF('fromAccountId')}
                      className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select —</option>
                      {fromAccounts.map(acc => (
                        <option key={acc._id} value={acc._id}>
                          {accNum(acc)} ({accBal(acc, acc.module)})
                        </option>
                      ))}
                    </select>
                    {errTF.fromAccountId && <p className="mt-1 text-xs text-red-500">{errTF.fromAccountId.message}</p>}
                    {fromAccounts.length === 0 && lookupResult && (
                      <p className="mt-1 text-xs text-amber-600">No eligible source accounts found for this transfer type</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">To Account *</label>
                    <select
                      id="tf-to-account"
                      {...regTF('toAccountId')}
                      className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select —</option>
                      {toAccounts.map(acc => (
                        <option key={acc._id} value={acc._id}>
                          {accNum(acc)} ({accBal(acc, acc.module)})
                        </option>
                      ))}
                    </select>
                    {errTF.toAccountId && <p className="mt-1 text-xs text-red-500">{errTF.toAccountId.message}</p>}
                    {toAccounts.length === 0 && lookupResult && (
                      <p className="mt-1 text-xs text-amber-600">No eligible destination accounts found for this transfer type</p>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Transfer Amount (₹) *</label>
                  <input
                    id="tf-amount"
                    type="number"
                    step="1"
                    min="1"
                    {...regTF('amount')}
                    className="w-full h-11 rounded-lg border border-gray-300 px-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errTF.amount && <p className="mt-1 text-xs text-red-500">{errTF.amount.message}</p>}
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Narration / Note</label>
                  <input
                    id="tf-note"
                    type="text"
                    {...regTF('note')}
                    placeholder="Optional description"
                    className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Ledger explanation */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 space-y-1">
                  <p className="font-semibold text-gray-700">How this posts to the ledger:</p>
                  {transferType === 'saving_to_pigmy' && <p>DR Customer Saving Deposits (2001) → CR Customer Pigmy Deposits (2002)</p>}
                  {transferType === 'pigmy_to_saving' && <p>DR Customer Pigmy Deposits (2002) → CR Customer Saving Deposits (2001)</p>}
                  {transferType === 'saving_to_loan' && <p>DR Customer Saving Deposits (2001) → CR Loans Receivable (1002) — outstanding reduces</p>}
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={fullReset}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear All
                  </button>
                  <button
                    id="btn-submit-transfer"
                    type="submit"
                    disabled={isTransferPending || !lookupResult}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-40"
                  >
                    {isTransferPending
                      ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing…</span>
                      : 'Confirm Transfer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── TAB 3: Journal Voucher ──────────────────────────────────────── */}
          {activeTab === 'journal' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" /> Manual Journal Voucher
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Direct GL-to-GL posting. For bank charges, adjustments, and corrections.</p>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Use the Ledger Journal Voucher page</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm">
                      Multi-leg JV entries are available under{' '}
                      <a href="/ledger" className="text-blue-600 hover:underline font-medium">Ledger → Post Journal Voucher</a>.
                      That page provides a full multi-row entry form with live balance preview.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ── TAB 4: Capital Infusion ───────────────────────────────────── */}
          {activeTab === 'capital' && (
            <CapitalInfusionPanel />
          )}
        </div>
      </div>

      {/* ── Transaction success: full detail modal ─────────────────────────── */}
      {receiptTx && (
        <>
          {/* TransactionDetailModal provides the full rich detail view */}
          <TransactionDetailModal
            tx={receiptTx}
            onClose={() => {
              setReceiptTx(null);
              fullReset();
            }}
          />
          {/* Sticky "Next Transaction" button injected above the modal footer */}
          <div className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none flex justify-center pb-6">
            <button
              type="button"
              autoFocus
              onClick={() => {
                setReceiptTx(null);
                fullReset();
              }}
              className="pointer-events-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-2xl transition-colors focus:ring-4 focus:ring-emerald-300 outline-none flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" /> Done — Next Transaction
            </button>
          </div>
        </>
      )}

    </div>
  );
}
