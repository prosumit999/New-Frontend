// src/features/agents/ReassignmentPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RefreshCw, CheckSquare, Square, ArrowLeft, Users, PiggyBank, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/format';

type TabType = 'pigmy' | 'customers';

export default function ReassignmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>('pigmy');
  const [selected, setSelected] = useState<Record<TabType, string[]>>({ pigmy: [], customers: [] });
  const [targetAgentId, setTargetAgentId] = useState('');

  // ── Stats ──────────────────────────────────────────────────
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['reassignment-stats'],
    queryFn: () => agentApi.getReassignmentStats(),
    staleTime: 0,
    refetchOnMount: true,
  });
  // agentApi.getReassignmentStats() returns res.data (Axios unwrap)
  // res.data = ApiResponse: { statusCode, data: { pendingPigmyAccounts, pendingCustomers, total } }
  const stats = (statsData as any)?.data as any;

  // ── Pigmy Queue ────────────────────────────────────────────
  const { data: pigmyData, isLoading: pigmyLoading } = useQuery({
    queryKey: ['reassignment-queue', 'pigmy'],
    queryFn: () => agentApi.getReassignmentQueue({ type: 'pigmy', limit: 100 }),
  });
  // agentApi.getReassignmentQueue returns res.data (Axios)
  // res.data = ApiResponse: { data: { type, items, pagination } }
  const pigmyItems: any[] = (pigmyData as any)?.data?.items || [];

  // ── Customers Queue ────────────────────────────────────────
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['reassignment-queue', 'customers'],
    queryFn: () => agentApi.getReassignmentQueue({ type: 'customers', limit: 100 }),
  });
  const customerItems: any[] = (customersData as any)?.data?.items || [];

  // ── Active KYC-verified agents (for dropdown) ──────────────
  const { data: agentsData } = useQuery({
    queryKey: ['agents-for-reassign'],
    queryFn: () => agentApi.list({ limit: 200, isActive: 'true', kycStatus: 'kyc_verified' }),
  });
  // agentApi.list returns res.data (Axios) = ApiResponse: { data: { agents, pagination } }
  const eligibleAgents: any[] = (agentsData as any)?.data?.agents || [];

  const currentItems = tab === 'pigmy' ? pigmyItems : customerItems;
  const currentSelected = selected[tab];

  const toggleItem = (id: string) => {
    setSelected(s => ({
      ...s,
      [tab]: s[tab].includes(id) ? s[tab].filter(x => x !== id) : [...s[tab], id],
    }));
  };

  const toggleAll = () => {
    const allIds = currentItems.map((i: any) => i._id);
    const allSelected = allIds.every(id => currentSelected.includes(id));
    setSelected(s => ({ ...s, [tab]: allSelected ? [] : allIds }));
  };

  const reassignMutation = useMutation({
    mutationFn: () => agentApi.reassign({
      entityType: tab,
      entityIds: currentSelected,
      newAgentId: targetAgentId,
    }),
    onSuccess: (res: any) => {
      const result = res?.data as any;
      toast.success(result?.message || `${result?.modifiedCount || 0} records reassigned successfully`);
      setSelected(s => ({ ...s, [tab]: [] }));
      setTargetAgentId('');
      queryClient.invalidateQueries({ queryKey: ['reassignment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['reassignment-queue'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Reassignment failed'),
  });

  const handleReassign = () => {
    if (currentSelected.length === 0) { toast.error('Select at least one record'); return; }
    if (!targetAgentId) { toast.error('Please select a target agent'); return; }
    if (currentSelected.length > 50) { toast.error('Maximum 50 records per reassignment'); return; }
    reassignMutation.mutate();
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Reassignment Queue</h1>
            <p className="page-subtitle">Assign unassigned pigmy accounts and customers to verified agents</p>
          </div>
        </div>
      </div>

      {/* Stats Banner */}
      {!statsLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="card card-body flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <PiggyBank className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Pigmy Accounts</p>
              <p className="text-2xl font-bold text-purple-600">{stats?.pendingPigmyAccounts ?? 0}</p>
            </div>
          </div>
          <div className="card card-body flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Customers</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.pendingCustomers ?? 0}</p>
            </div>
          </div>
          <div className="card card-body flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Pending</p>
              <p className="text-2xl font-bold text-amber-600">{stats?.total ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      {stats?.total === 0 && !statsLoading && (
        <div className="card card-body text-center py-14 text-slate-500">
          <RefreshCw className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">All clear!</p>
          <p className="text-sm mt-1">No records need reassignment at this time.</p>
        </div>
      )}

      {(stats?.total ?? 0) > 0 && (
        <>
          {/* Tab switch */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-4">
            <button
              onClick={() => { setTab('pigmy'); }}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${tab === 'pigmy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <PiggyBank className="h-3.5 w-3.5 inline mr-1.5" />
              Pigmy Accounts {pigmyItems.length > 0 && `(${pigmyItems.length})`}
            </button>
            <button
              onClick={() => { setTab('customers'); }}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${tab === 'customers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users className="h-3.5 w-3.5 inline mr-1.5" />
              Customers {customerItems.length > 0 && `(${customerItems.length})`}
            </button>
          </div>

          <div className="card">
            {/* Selection bar */}
            <div className="card-header bg-slate-50/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600"
                >
                  {currentItems.length > 0 && currentItems.every(i => currentSelected.includes(i._id))
                    ? <CheckSquare className="h-4 w-4 text-blue-500" />
                    : <Square className="h-4 w-4" />}
                  Select All ({currentItems.length})
                </button>
                {currentSelected.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {currentSelected.length} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Max 50 per reassignment</p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  {tab === 'pigmy' ? (
                    <tr><th></th><th>Account No.</th><th>Customer</th><th>Balance</th><th>Daily Deposit</th><th>Last Collection</th><th>Reason</th></tr>
                  ) : (
                    <tr><th></th><th>Customer Code</th><th>Name</th><th>Phone</th><th>City</th><th>KYC Status</th><th>Reason</th></tr>
                  )}
                </thead>
                <tbody>
                  {(tab === 'pigmy' ? pigmyLoading : customersLoading) ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
                  ) : currentItems.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-500">No {tab} accounts need reassignment.</td></tr>
                  ) : tab === 'pigmy' ? (
                    pigmyItems.map(item => (
                      <tr key={item._id} className={currentSelected.includes(item._id) ? 'bg-blue-50' : ''}>
                        <td>
                          <input type="checkbox" checked={currentSelected.includes(item._id)} onChange={() => toggleItem(item._id)} className="rounded border-slate-300" />
                        </td>
                        <td className="font-mono text-xs font-bold text-slate-700">{item.accountNumber}</td>
                        <td>
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{item.customer?.name}</p>
                            <p className="text-xs text-slate-400">{item.customer?.customerCode}</p>
                          </div>
                        </td>
                        <td className="font-semibold text-sm">{formatCurrency(item.balanceInPaise)}</td>
                        <td className="text-sm text-slate-600">{formatCurrency(item.dailyDepositAmountInPaise)}/day</td>
                        <td className="text-sm text-slate-500">{formatDate(item.lastCollectionDate)}</td>
                        <td><span className="text-xs text-red-600 capitalize">{item.reassignmentReason?.replace(/_/g, ' ')}</span></td>
                      </tr>
                    ))
                  ) : (
                    customerItems.map(item => (
                      <tr key={item._id} className={currentSelected.includes(item._id) ? 'bg-blue-50' : ''}>
                        <td>
                          <input type="checkbox" checked={currentSelected.includes(item._id)} onChange={() => toggleItem(item._id)} className="rounded border-slate-300" />
                        </td>
                        <td className="font-mono text-xs font-bold text-slate-700">{item.customerCode}</td>
                        <td className="font-medium text-slate-900 text-sm">{item.name}</td>
                        <td className="text-slate-600">{item.phone}</td>
                        <td className="text-slate-500 text-sm">{item.city || '—'}</td>
                        <td><span className="text-xs capitalize text-blue-600">{item.kycStatus?.replace(/_/g, ' ')}</span></td>
                        <td><span className="text-xs text-red-600 capitalize">{item.reassignmentReason?.replace(/_/g, ' ')}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Assign Action Bar */}
            {currentSelected.length > 0 && (
              <div className="border-t border-blue-200 bg-blue-50 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800">
                    Assign {currentSelected.length} selected {tab} to:
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">Only KYC-verified, active agents are shown below.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <select
                    className="flex-1 sm:w-64 rounded-lg border border-blue-300 py-2 px-3 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={targetAgentId}
                    onChange={e => setTargetAgentId(e.target.value)}
                  >
                    <option value="">Select agent...</option>
                    {eligibleAgents.map(a => (
                      <option key={a._id} value={a._id}>
                        {a.name} ({a.agentCode}) — {a.profile?.area || 'No area'}
                      </option>
                    ))}
                  </select>
                  <Button
                    isLoading={reassignMutation.isPending}
                    disabled={!targetAgentId}
                    onClick={handleReassign}
                  >
                    <RefreshCw className="h-4 w-4 mr-1.5" /> Assign
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
