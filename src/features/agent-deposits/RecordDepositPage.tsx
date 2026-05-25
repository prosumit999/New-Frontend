// src/features/agent-deposits/RecordDepositPage.tsx
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Banknote, CheckCircle, AlertTriangle, User, TrendingDown } from 'lucide-react';
import { agentDepositApi } from '../../api/agentDeposit.api';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { rupeesToPaise, formatCurrency } from '../../utils/format';

export default function RecordDepositPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [successDeposit, setSuccessDeposit] = useState<any>(null);

  // List active agents for dropdown
  const { data: agentData } = useQuery({
    queryKey: ['agents-for-deposit'],
    queryFn: () => agentApi.list({ page: 1, limit: 100, isActive: 'true' as any }),
  });

  const agents = (agentData?.data?.agents as any[]) || [];
  const selectedAgent = agents.find((a: any) => a._id === selectedAgentId);

  // Fetch real-time cash balance for selected agent
  const { data: balanceData, isFetching: balanceFetching } = useQuery({
    queryKey: ['agent-cash-balance', selectedAgentId],
    queryFn: () => agentDepositApi.getCashBalance(selectedAgentId),
    enabled: !!selectedAgentId,
    refetchInterval: false,
  });

  const cashBalance = (balanceData as any)?.data?.data?.balance as any;
  const outstandingPaise: number = cashBalance?.balanceInPaise ?? 0;
  const isClear = outstandingPaise === 0;
  const todayDeposits = cashBalance?.todayDeposits;

  const amountPaise = rupeesToPaise(amount);
  const isOverDeposit = amountPaise > outstandingPaise && outstandingPaise > 0;

  const fillFullAmount = useCallback(() => {
    if (outstandingPaise > 0) {
      setAmount(String(outstandingPaise / 100));
    }
  }, [outstandingPaise]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedAgentId) throw new Error('Select an agent');
      if (amountPaise < 100) throw new Error('Minimum deposit is ₹1');
      if (amountPaise > outstandingPaise)
        throw new Error(`Cannot deposit more than outstanding balance ₹${(outstandingPaise / 100).toFixed(2)}`);
      // API client now sends Idempotency-Key header automatically
      return agentDepositApi.record({
        agentId: selectedAgentId,
        amountInPaise: amountPaise,
        note: note || undefined,
      });
    },
    onSuccess: (res: any) => {
      const deposit = res?.data?.deposit;
      toast.success(`✓ Deposit ${deposit?.depositId} recorded!`);
      queryClient.invalidateQueries({ queryKey: ['agent-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['agent-cash-balance'] });
      setSuccessDeposit(deposit);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Deposit failed');
    },
  });

  // ── Success Receipt Screen ─────────────────────────────────────────────────
  if (successDeposit) {
    const remaining = outstandingPaise - successDeposit.amountInPaise;
    return (
      <div className="animate-fade-in max-w-lg mx-auto">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white">
            <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <p className="text-4xl font-bold mb-1">{formatCurrency(successDeposit.amountInPaise)}</p>
            <p className="text-blue-200 text-sm">Agent Deposit Recorded</p>
          </div>

          <div className="p-6 border-b-2 border-dashed border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deposit ID</span>
              <span className="font-mono font-bold text-blue-700 text-lg">{successDeposit.depositId}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt No.</span>
                <span className="font-mono text-slate-700">{successDeposit.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agent</span>
                <span className="font-medium text-slate-800">{successDeposit.agent?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agent Code</span>
                <span className="font-mono text-slate-600">{successDeposit.agent?.agentCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Ref</span>
                <span className="font-mono text-xs text-blue-600">{successDeposit.transaction?.transactionId}</span>
              </div>
              {remaining === 0 ? (
                <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                  <p className="text-xs font-semibold text-emerald-700">✓ Agent balance fully cleared — Day close allowed</p>
                </div>
              ) : (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <p className="text-xs font-semibold text-amber-700">
                    Remaining balance: {formatCurrency(remaining)} — Day close still blocked
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => {
              setSuccessDeposit(null);
              setSelectedAgentId('');
              setAmount('');
              setNote('');
            }}>
              Record Another
            </Button>
            <Button className="flex-1" onClick={() => navigate('/agent-deposits')}>
              View All Deposits
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in animate-slide-up max-w-2xl mx-auto">
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/agent-deposits')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Record Agent Deposit</h1>
          <p className="page-subtitle">Record cash handover from a field agent to the office vault</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-6">

          {/* Step 1: Select Agent */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-sm font-semibold text-slate-800">Select Agent</span>
              {selectedAgentId && <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />}
            </div>
            <select
              className="form-input w-full py-2.5 px-3 text-sm rounded-xl border border-slate-200 bg-white"
              value={selectedAgentId}
              onChange={(e) => { setSelectedAgentId(e.target.value); setAmount(''); }}
            >
              <option value="">— Select agent to record deposit for —</option>
              {agents.map((a: any) => (
                <option key={a._id} value={a._id}>
                  {a.name} · {a.agentCode || a.profile?.agentCode}
                </option>
              ))}
            </select>
          </div>

          {/* Agent Cash Balance Card */}
          {selectedAgentId && (
            <div className={`border rounded-xl p-4 transition-all ${balanceFetching ? 'animate-pulse bg-slate-50' :
                isClear ? 'bg-emerald-50 border-emerald-200' :
                  'bg-amber-50 border-amber-200'
              }`}>
              {balanceFetching ? (
                <p className="text-sm text-slate-400 text-center">Fetching balance...</p>
              ) : cashBalance ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500" />
                      <p className="font-bold text-slate-900">{cashBalance.agentName}</p>
                      <span className="font-mono text-xs text-slate-500">{cashBalance.agentCode}</span>
                    </div>
                    {isClear ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">✓ CLEAR</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">OUTSTANDING</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Outstanding Balance</p>
                      <p className={`text-xl font-bold ${isClear ? 'text-emerald-700' : 'text-amber-800'}`}>
                        {formatCurrency(outstandingPaise)}
                      </p>
                    </div>
                    {todayDeposits && (
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Today's Deposits</p>
                        <p className="text-xl font-bold text-blue-700">{formatCurrency(todayDeposits.totalInPaise)}</p>
                        <p className="text-xs text-slate-400">{todayDeposits.count} deposit{todayDeposits.count !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                  </div>

                  {isClear && (
                    <div className="mt-3 p-2 bg-emerald-100 rounded-lg">
                      <p className="text-xs text-emerald-700 font-medium text-center">
                        Agent has no outstanding cash. Nothing to deposit.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Step 2: Amount */}
          {selectedAgentId && !isClear && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
                <span className="text-sm font-semibold text-slate-800">Deposit Amount</span>
              </div>

              {outstandingPaise > 0 && (
                <button
                  type="button"
                  onClick={fillFullAmount}
                  className="w-full mb-3 p-3 border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-all text-center"
                >
                  <p className="text-sm text-blue-700 font-semibold">
                    Deposit Full Amount — {formatCurrency(outstandingPaise)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Click to auto-fill outstanding balance</p>
                </button>
              )}

              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder={`Max: ₹${(outstandingPaise / 100).toFixed(2)}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              {isOverDeposit && (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Deposit amount exceeds outstanding balance of {formatCurrency(outstandingPaise)}
                </p>
              )}
              {amount && !isOverDeposit && amountPaise >= 100 && (
                <p className="text-xs text-slate-400 mt-1.5">
                  Remaining after this deposit: {formatCurrency(outstandingPaise - amountPaise)}
                  {outstandingPaise === amountPaise ? ' (fully cleared ✓)' : ''}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Note */}
          {selectedAgentId && !isClear && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">3</div>
                <span className="text-sm font-semibold text-slate-800">Note <span className="text-slate-400 font-normal">(optional)</span></span>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Cash received at counter, all denominations verified..."
                rows={2}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/agent-deposits')}>Cancel</Button>
          {selectedAgentId && isClear ? (
            <p className="text-sm text-slate-400 italic">No outstanding balance to deposit</p>
          ) : (
            <Button
              disabled={!selectedAgentId || amountPaise < 100 || isOverDeposit || mutation.isPending}
              isLoading={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="px-6"
            >
              <Banknote className="h-4 w-4 mr-1.5" />
              Record {amount ? formatCurrency(amountPaise) : 'Deposit'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
