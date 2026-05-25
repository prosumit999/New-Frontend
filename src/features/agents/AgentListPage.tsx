// src/features/agents/AgentListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, UserCheck, Eye, Edit2, Upload, AlertTriangle, RefreshCw } from 'lucide-react';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../utils/format';

const KYC_STATUSES = [
  { value: '', label: 'All KYC' },
  { value: 'pending', label: '⏳ Pending' },
  { value: 'documents_submitted', label: '📋 Submitted' },
  { value: 'kyc_verified', label: '✅ Verified' },
  { value: 'kyc_rejected', label: '❌ Rejected' },
];

const KYC_BADGE_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  documents_submitted: 'bg-blue-100 text-blue-700',
  kyc_verified: 'bg-emerald-100 text-emerald-700',
  kyc_rejected: 'bg-red-100 text-red-700',
};

const AGENT_STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-600',
  suspended: 'bg-amber-100 text-amber-700',
  terminated: 'bg-red-100 text-red-700',
};

export default function AgentListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [kycFilter, setKycFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agents', page, search, kycFilter, activeFilter],
    queryFn: () => agentApi.list({
      page,
      limit: 15,
      search: search || undefined,
      kycStatus: kycFilter || undefined,
      isActive: activeFilter === '' ? undefined : activeFilter,
    }),
  });

  // Reassignment stats
  const { data: statsData } = useQuery({
    queryKey: ['reassignment-stats'],
    queryFn: () => agentApi.getReassignmentStats(),
    refetchInterval: 60_000,
  });

  const agents = (data?.data?.agents as any[]) || [];
  const pagination = data?.data?.pagination as any;
  const stats = statsData?.data as any;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Agent Management</h1>
          <p className="page-subtitle">Manage field agents, KYC status, and assignments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate('/agents/reassignment')}>
            <RefreshCw className="h-4 w-4 mr-2" /> Reassignment
          </Button>
          <Button variant="outline" onClick={() => navigate('/agents/kyc-pending')}>
            <UserCheck className="h-4 w-4 mr-2" /> Pending KYC
          </Button>
          <Button onClick={() => navigate('/agents/new')}>
            <Plus className="h-4 w-4 mr-2" /> New Agent
          </Button>
        </div>
      </div>

      {/* Reassignment Alert */}
      {stats?.total > 0 && (
        <div
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-4 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate('/agents/reassignment')}
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{stats.total} records need agent reassignment</span>
            {' '}— {stats.pendingPigmyAccounts} pigmy accounts + {stats.pendingCustomers} customers are unassigned.{' '}
            <span className="underline">Click to resolve →</span>
          </p>
        </div>
      )}

      <div className="card">
        {/* Filters */}
        <div className="card-header bg-slate-50/50">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="w-full max-w-sm">
              <Input
                placeholder="Search name, phone, agent code..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
              {(['', 'true', 'false'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => { setActiveFilter(val); setPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeFilter === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {val === '' ? 'All' : val === 'true' ? '🟢 Active' : '🔴 Inactive'}
                </button>
              ))}
            </div>
            <select
              className="text-sm rounded-lg border border-slate-200 py-2 px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={kycFilter}
              onChange={(e) => { setKycFilter(e.target.value); setPage(1); }}
            >
              {KYC_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Phone</th>
                <th>Area</th>
                <th>KYC Status</th>
                <th>Agent Status</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">Loading agents...</td></tr>
              ) : isError ? (
                <tr><td colSpan={7} className="text-center py-10 text-red-500">Failed to load agents.</td></tr>
              ) : agents.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">
                  <UserCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p>No agents found.</p>
                </td></tr>
              ) : (
                agents.map((agent: any) => {
                  const kycStatus = agent.profile?.kycStatus || 'pending';
                  const agentStatus = agent.profile?.status || (agent.isActive ? 'active' : 'inactive');
                  return (
                    <tr
                      key={agent._id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/agents/${agent._id}`)}
                    >
                      <td>
                        <div>
                          <p className="font-medium text-slate-900">{agent.name}</p>
                          <p className="text-xs font-mono text-blue-600">{agent.agentCode}</p>
                        </div>
                      </td>
                      <td className="text-slate-600">{agent.phone}</td>
                      <td className="text-slate-500 text-sm">{agent.profile?.area || '—'}</td>
                      <td>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${KYC_BADGE_COLOR[kycStatus] || 'bg-slate-100 text-slate-500'}`}>
                          {kycStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${AGENT_STATUS_COLOR[agentStatus] || 'bg-slate-100 text-slate-500'}`}>
                          {agentStatus}
                        </span>
                      </td>
                      <td className="text-slate-500 text-sm">{formatDate(agent.createdAt)}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agent._id}`)} title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agent._id}/edit`)} title="Edit Profile">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {kycStatus !== 'kyc_verified' && (
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agent._id}`)} title="Upload KYC">
                              <Upload className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
            <p>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
