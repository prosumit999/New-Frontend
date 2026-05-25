// src/features/collections/RecordCollectionPage.tsx
// Frontend sends `accountId` to match validator and service.
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, Receipt, Search, CalendarDays, AlertCircle } from 'lucide-react';
import { collectionApi } from '../../api/collection.api';
import { pigmyApi } from '../../api/pigmy.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { formatCurrency, rupeesToPaise } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';

export default function RecordCollectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const prefilledAccountId = searchParams.get('accountId');

  const [accountSearch, setAccountSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [collectionType, setCollectionType] = useState<'daily' | 'manual'>('daily');
  const [collectionDate, setCollectionDate] = useState('');
  const [note, setNote] = useState('');
  const [successReceipt, setSuccessReceipt] = useState<any>(null);

  // If navigated with ?accountId=xxx, find the account from search results
  // We fetch the agent's own sheet to find the specific account metadata
  const { data: prefilledData } = useQuery({
    queryKey: ['pigmy-prefill-sheet', prefilledAccountId],
    queryFn: () => collectionApi.getAgentSheet(),
    enabled: !!prefilledAccountId && !selectedAccount,
  });

  useEffect(() => {
    if (!prefilledAccountId || selectedAccount) return;
    const sheetItems: any[] = prefilledData?.data?.sheet || [];
    const match = sheetItems.find((item: any) => item.accountId === prefilledAccountId);
    if (match) {
      const mockAcc = {
        _id: match.accountId,
        accountNumber: match.accountNumber,
        balanceInPaise: match.currentBalanceInPaise,
        dailyDepositAmountInPaise: match.dailyDepositAmountInPaise,
        customer: match.customer,
      };
      setSelectedAccount(mockAcc);
      setAmount(String((match.dailyDepositAmountInPaise || 0) / 100));
    }
  }, [prefilledData, prefilledAccountId, selectedAccount]);

  // Search pigmy accounts
  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ['pigmy-search-record', accountSearch],
    queryFn: () => pigmyApi.list({ page: 1, limit: 10, search: accountSearch, status: 'active' }),
    enabled: accountSearch.length >= 2 && !selectedAccount,
  });

  const searchResults = (searchData?.data?.accounts as any[]) || [];

  const handleSelectAccount = useCallback((acc: any) => {
    setSelectedAccount(acc);
    setAccountSearch(acc.customer?.name || acc.accountNumber);
    setAmount(String((acc.dailyDepositAmountInPaise || 0) / 100));
  }, []);

  const amountPaise = rupeesToPaise(amount);
  const expectedPaise = selectedAccount?.dailyDepositAmountInPaise || 0;
  const isManualAmount = amountPaise !== expectedPaise && amountPaise > 0;

  const { businessDate: globalBusinessDate } = useBusinessDate();


  useEffect(() => {
    if (globalBusinessDate && !collectionDate) {
      setCollectionDate(globalBusinessDate);
    }
  }, [globalBusinessDate, collectionDate]);

  // ── Confirmation state ──────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedAccount) throw new Error('No account selected');
      if (amountPaise < 100) throw new Error('Minimum collection is ₹1');
      return collectionApi.record({
        accountId: selectedAccount._id,
        amountInPaise: amountPaise,
        collectionType: isManualAmount ? 'manual' : 'daily',
        // Agents: never send date (backend uses businessDate)
        // Admin: can backdate within 3-day window
        collectionDate: isAdmin && collectionDate ? collectionDate : undefined,
        note: note || undefined,
      });
    },
    onSuccess: (res: any) => {
      const collection = res?.data?.collection;
      toast.success(`✓ Receipt ${collection?.receiptNumber} recorded!`);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['daily-sheet'] });
      queryClient.invalidateQueries({ queryKey: ['pigmy'] });
      setSuccessReceipt(collection);
      setShowConfirm(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to record collection');
      setShowConfirm(false);
    },
  });

  // Success Receipt Screen
  if (successReceipt) {
    return (
      <div className="animate-fade-in max-w-lg mx-auto">
        <div className="card overflow-hidden">
          {/* Receipt Header */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center text-white">
            <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <p className="text-4xl font-bold mb-1">{formatCurrency(successReceipt.amountInPaise)}</p>
            <p className="text-emerald-100 text-sm">Collection Recorded Successfully</p>
          </div>

          {/* Receipt Body */}
          <div className="p-6 border-b-2 border-dashed border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receipt No.</span>
              <span className="font-mono font-bold text-blue-700 text-lg">{successReceipt.receiptNumber}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer</span>
                <span className="font-medium text-slate-800">{successReceipt.customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account</span>
                <span className="font-mono text-slate-700">{successReceipt.pigmyAccount?.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Balance After</span>
                <span className="font-bold text-emerald-700">{formatCurrency(successReceipt.balanceAfterInPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SMS Sent</span>
                <span className={successReceipt.smsSent ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                  {successReceipt.smsSent ? '✓ Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => {
              setSuccessReceipt(null);
              setSelectedAccount(null);
              setAccountSearch('');
              setAmount('');
              setNote('');
              setCollectionDate('');
            }}>
              Record Another
            </Button>
            <Button className="flex-1" onClick={() => navigate('/collections/sheet')}>
              View My Sheet
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in animate-slide-up max-w-2xl mx-auto">
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/collections')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Record Collection</h1>
          <p className="page-subtitle">Record daily pigmy collection from a customer account</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-6">

          {/* ── Step 1: Account Selection ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-sm font-semibold text-slate-800">Pigmy Account</span>
              {selectedAccount && <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />}
            </div>

            {selectedAccount ? (
              <div className="flex items-start justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div>
                  <p className="font-bold text-emerald-900">{selectedAccount.customer?.name}</p>
                  <p className="text-sm text-emerald-700 mt-0.5">
                    <span className="font-mono">{selectedAccount.accountNumber}</span>
                    {' · '}{selectedAccount.customer?.customerCode}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Daily: <strong>{formatCurrency(selectedAccount.dailyDepositAmountInPaise)}</strong>
                    {' · '} Balance: <strong>{formatCurrency(selectedAccount.balanceInPaise)}</strong>
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-slate-500 shrink-0" onClick={() => { setSelectedAccount(null); setAccountSearch(''); setAmount(''); }}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by customer name, account number, or code..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searching && <p className="text-xs text-slate-400 mt-1 ml-1">Searching...</p>}
                {accountSearch.length >= 2 && searchResults.length > 0 && !selectedAccount && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {searchResults.map((acc: any) => (
                      <button
                        key={acc._id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                        onClick={() => handleSelectAccount(acc)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{acc.customer?.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              <span className="font-mono">{acc.accountNumber}</span>
                              {' · '}{acc.customer?.customerCode}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-sm font-semibold text-emerald-700">{formatCurrency(acc.dailyDepositAmountInPaise)}</p>
                            <p className="text-xs text-slate-400">daily</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {accountSearch.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1 ml-1">No active accounts found.</p>
                )}
              </div>
            )}
          </div>

          {/* ── Step 2: Amount ── */}
          {selectedAccount && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
                <span className="text-sm font-semibold text-slate-800">Collection Amount</span>
              </div>

              <div className="flex gap-3 mb-3">
                {/* Standard amount button */}
                <button
                  type="button"
                  onClick={() => { setAmount(String(expectedPaise / 100)); setCollectionType('daily'); }}
                  className={`flex-1 p-3 border rounded-xl text-sm font-semibold transition-all ${amountPaise === expectedPaise
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                >
                  <p className="text-base font-bold">{formatCurrency(expectedPaise)}</p>
                  <p className="text-xs font-normal opacity-70">Standard Daily</p>
                </button>
                {/* Manual amount button */}
                <button
                  type="button"
                  onClick={() => { setAmount(''); setCollectionType('manual'); }}
                  className={`flex-1 p-3 border rounded-xl text-sm font-semibold transition-all ${collectionType === 'manual' && amountPaise !== expectedPaise
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-200 text-slate-600 hover:border-amber-300'
                    }`}
                >
                  <p className="text-base font-bold">Custom</p>
                  <p className="text-xs font-normal opacity-70">Manual Amount</p>
                </button>
              </div>

              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder={`e.g. ${(expectedPaise / 100).toFixed(2)}`}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  const p = rupeesToPaise(e.target.value);
                  setCollectionType(p !== expectedPaise ? 'manual' : 'daily');
                }}
              />
              {isManualAmount && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Amount differs from daily deposit — will be recorded as <strong>Manual</strong>
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Collection Date ── */}
          {selectedAccount && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">3</div>
                <span className="text-sm font-semibold text-slate-800">Collection Date</span>
                <CalendarDays className="h-4 w-4 text-slate-400" />
              </div>
              {isAdmin ? (
                <>
                  <input
                    type="date"
                    value={collectionDate}
                    max={globalBusinessDate}
                    min={(() => {
                      // Min = max(3 days ago, account openedAt)
                      const threeDaysAgo = new Date(globalBusinessDate);
                      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                      const accountOpen = new Date(selectedAccount.openedAt || selectedAccount.createdAt || globalBusinessDate);
                      const floor = threeDaysAgo > accountOpen ? threeDaysAgo : accountOpen;
                      return floor.toISOString().split('T')[0];
                    })()}
                    onChange={(e) => setCollectionDate(e.target.value)}
                    className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-44"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Admin: back-dating limited to 3 days (or account open date).</p>
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <CalendarDays className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm text-blue-800 font-medium">
                    Locked to business date: <strong>{globalBusinessDate}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Note ── */}
          {selectedAccount && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">4</div>
                <span className="text-sm font-semibold text-slate-800">Note <span className="text-slate-400 font-normal">(optional)</span></span>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional collection note..."
                rows={2}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/collections')}>Cancel</Button>
          <Button
            disabled={!selectedAccount || amountPaise < 100}
            onClick={() => setShowConfirm(true)}
            className="px-6"
          >
            <Receipt className="h-4 w-4 mr-1.5" />
            Record {amount ? formatCurrency(amountPaise) : 'Collection'}
          </Button>
        </div>
      </div>

      {/* ── Confirmation Dialog ─────────────────────────────────────────────── */}
      {showConfirm && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Confirm Collection</h2>
                  <p className="text-blue-200 text-sm mt-0.5">Please verify the details below</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Customer</span>
                <span className="text-sm font-semibold text-slate-900">{selectedAccount.customer?.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Account</span>
                <span className="text-sm font-mono font-semibold text-slate-700">{selectedAccount.accountNumber}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Collection Amount</span>
                <span className="text-lg font-bold text-emerald-700">{formatCurrency(amountPaise)}</span>
              </div>
              {isManualAmount && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-700">
                    Manual amount — differs from daily deposit of {formatCurrency(expectedPaise)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Collection Date</span>
                <span className="text-sm font-medium text-slate-700">{collectionDate || 'Today (business date)'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Type</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isManualAmount ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                }`}>{isManualAmount ? 'Manual' : 'Daily'}</span>
              </div>
              {note && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-slate-500">Note</span>
                  <span className="text-xs text-slate-600 max-w-[200px] truncate">{note}</span>
                </div>
              )}

              {/* Balance info */}
              <div className="bg-slate-50 rounded-xl p-3 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Current Balance</span>
                  <span className="text-sm font-semibold text-blue-700">{formatCurrency(selectedAccount.balanceInPaise)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-slate-500">Balance After</span>
                  <span className="text-sm font-bold text-emerald-700">{formatCurrency(selectedAccount.balanceInPaise + amountPaise)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3 border-t border-slate-100 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)} disabled={mutation.isPending}>
                Go Back
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                isLoading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" /> Confirm & Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
