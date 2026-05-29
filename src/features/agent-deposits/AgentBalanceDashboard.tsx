// src/features/agent-deposits/AgentBalanceDashboard.tsx — NEW PAGE (Admin only)
// GET /agent-deposits/cash-balance/:agentId for each active agent
// Shows all agents' outstanding cash balances — critical for day-close management
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Banknote, CheckCircle, AlertTriangle, ChevronRight, BarChart2, TrendingDown } from 'lucide-react';
import { agentDepositApi } from '../../api/agentDeposit.api';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';

interface AgentBalance {
  agentId: string;
  agentName: string;
  agentCode: string;
  balanceInPaise: number;
  depositStatus: 'clear' | 'outstanding';
  todayDeposits: { count: number; totalInPaise: number };
}

export default function AgentBalanceDashboard() {
  const navigate = useNavigate();

  // 1. Fetch all active agents
  const { data: agentData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents-active-list'],
    queryFn: () => agentApi.list({ page: 1, limit: 200, isActive: 'true' as any }),
  });

  const agents = (agentData?.data?.agents as any[]) || [];

  // 2. Fetch balance for each agent in parallel
  const balanceQueries = useQuery({
    queryKey: ['all-agent-balances', agents.map((a: any) => a._id).join(',')],
    queryFn: async () => {
      if (agents.length === 0) return [];
      const results = await Promise.allSettled(
        agents.map((a: any) =>
          agentDepositApi.getCashBalance(a._id).then((res: any) => ({
            agentId: a._id,
            ...res.data?.data?.balance,
          }))
        )
      );
      return results
        .filter((r): r is PromiseFulfilledResult<AgentBalance> => r.status === 'fulfilled')
        .map((r) => r.value);
    },
    enabled: agents.length > 0,
  });

  const balances: AgentBalance[] = balanceQueries.data || [];
  const isLoading = agentsLoading || balanceQueries.isLoading;

  // Summary metrics
  const outstanding = balances.filter((b) => b.depositStatus === 'outstanding');
  const cleared = balances.filter((b) => b.depositStatus === 'clear');
  const totalOutstandingPaise = outstanding.reduce((sum, b) => sum + b.balanceInPaise, 0);
  const totalDepositedTodayPaise = balances.reduce(
    (sum, b) => sum + (b.todayDeposits?.totalInPaise || 0), 0
  );

  const maxBalance = outstanding.length > 0 ? Math.max(...outstanding.map((b) => b.balanceInPaise)) : 1;

  return (
    <div className="animate-fade-in animate-slide-up">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agent-deposits')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Agent Cash Balances</h1>
            <p className="page-subtitle">Outstanding cash held by each field agent — must be ₹0 for day close</p>
          </div>
        </div>
        <Button onClick={() => navigate('/agent-deposits/new')}>
          <Banknote className="h-4 w-4 mr-1.5" /> Record Deposit
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-6">
        <div className="card p-5 overflow-hidden relative border-l-4 border-l-red-400">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full" />
          <AlertTriangle className="h-5 w-5 text-red-500 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{outstanding.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Outstanding Agents</p>
        </div>
        <div className="card p-5 overflow-hidden relative border-l-4 border-l-emerald-400">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full" />
          <CheckCircle className="h-5 w-5 text-emerald-500 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{cleared.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Agents Cleared</p>
        </div>
        <div className="card p-5 overflow-hidden relative border-l-4 border-l-amber-400">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-full" />
          <TrendingDown className="h-5 w-5 text-amber-500 mb-2" />
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalOutstandingPaise)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Outstanding</p>
        </div>
        <div className="card p-5 overflow-hidden relative border-l-4 border-l-blue-400">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full" />
          <BarChart2 className="h-5 w-5 text-blue-500 mb-2" />
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalDepositedTodayPaise)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Deposited Today</p>
        </div>
      </div>

      {/* Day Close Status Banner */}
      {!isLoading && (
        outstanding.length === 0 ? (
          <div className="card mb-5 p-5 flex items-center gap-4 border-l-4 border-l-emerald-500 bg-emerald-50/50">
            <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-emerald-800">All Agents Cleared ✓</p>
              <p className="text-sm text-emerald-600">All agent cash balances are ₹0. Day close is permitted.</p>
            </div>
          </div>
        ) : (
          <div className="card mb-5 p-5 flex items-center gap-4 border-l-4 border-l-red-500 bg-red-50/40">
            <AlertTriangle className="h-8 w-8 text-red-500 shrink-0" />
            <div>
              <p className="font-bold text-red-800">Day Close Blocked</p>
              <p className="text-sm text-red-600">
                <strong>{outstanding.length} agent{outstanding.length > 1 ? 's' : ''}</strong> still
                {' '}holding <strong>{formatCurrency(totalOutstandingPaise)}</strong> in cash.
                All balances must be deposited before day close.
              </p>
            </div>
          </div>
        )
      )}

      {/* Agent Balance Table */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-900">All Agent Balances</h2>
          <span className="text-xs text-slate-400 ml-auto">{balances.length} agents</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Ledger Account</th>
                <th className="text-right">Outstanding Balance</th>
                <th className="text-right">Today's Deposits</th>
                <th>Status</th>
                <th>Bar</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-14">
                    <div className="flex justify-center items-center gap-2 text-slate-400">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      Loading agent balances...
                    </div>
                  </td>
                </tr>
              ) : balances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-400">
                    No active agents found.
                  </td>
                </tr>
              ) : (
                // Sort: outstanding agents first (highest balance), then cleared
                [...balances]
                  .sort((a, b) => b.balanceInPaise - a.balanceInPaise)
                  .map((b) => {
                    const isOutstanding = b.depositStatus === 'outstanding';
                    const pct = outstanding.length > 0 ? Math.round((b.balanceInPaise / maxBalance) * 100) : 0;
                    return (
                      <tr
                        key={b.agentId}
                        className={`transition-colors ${isOutstanding ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-emerald-50/20'}`}
                      >
                        <td>
                          <p className="font-semibold text-slate-900 text-sm">{b.agentName}</p>
                          <p className="text-xs text-slate-400">{b.agentCode}</p>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-slate-500">AGNT-{b.agentCode}</span>
                        </td>
                        <td className="text-right">
                          <span className={`font-bold text-sm ${isOutstanding ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(b.balanceInPaise)}
                          </span>
                        </td>
                        <td className="text-right">
                          <p className="text-sm font-medium text-blue-700">
                            {formatCurrency(b.todayDeposits?.totalInPaise || 0)}
                          </p>
                          <p className="text-xs text-slate-400">{b.todayDeposits?.count || 0} deposits</p>
                        </td>
                        <td>
                          {isOutstanding ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                              <AlertTriangle className="h-3 w-3" /> Outstanding
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                              <CheckCircle className="h-3 w-3" /> Clear
                            </span>
                          )}
                        </td>
                        <td className="w-28">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-700 ${
                                  isOutstanding ? 'bg-red-400' : 'bg-emerald-400'
                                }`}
                                style={{ width: `${Math.max(pct, isOutstanding ? 5 : 0)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-right">
                          {isOutstanding ? (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => navigate(`/agent-deposits/new?agentId=${b.agentId}`)}
                            >
                              Deposit <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-slate-400">
                              Cleared
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && balances.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between text-sm text-slate-500">
            <p>
              <span className="font-semibold text-red-600">{outstanding.length} outstanding</span>
              {' '}· <span className="font-semibold text-emerald-600">{cleared.length} cleared</span>
            </p>
            <p>Total outstanding: <span className="font-semibold text-red-700">{formatCurrency(totalOutstandingPaise)}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
