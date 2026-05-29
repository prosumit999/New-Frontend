// src/features/agent-deposits/AgentDepositListPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Banknote, Calendar, BarChart3, AlertTriangle } from 'lucide-react';
import { agentDepositApi } from '../../api/agentDeposit.api';
import { dayControlApi } from '../../api/dayControl.api';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { useSystemStore } from '../../store/system.store';
import { parseISO, format } from 'date-fns';
import { agentApi } from '../../api/agent.api';
import { exportReportCSV, exportReportPDF } from '../../utils/reportExport';
import { Download } from 'lucide-react';

export default function AgentDepositListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agentIdFilter, setAgentIdFilter] = useState('');
  const [isDateInitialized, setIsDateInitialized] = useState(false);
  const branding = useSystemStore(s => s.branding);

  // 1. Fetch current business date FIRST
  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['day-control-status'],
    queryFn: () => dayControlApi.getStatus(),
    staleTime: 60000,
  });

  useEffect(() => {
    if (statusData && !isDateInitialized) {
      const rawDate = (statusData as any).data?.data?.businessDate;
      if (rawDate) {
        const localDateString = format(parseISO(rawDate), 'yyyy-MM-dd');
        setFromDate(localDateString);
        setToDate(localDateString);
      }
      setIsDateInitialized(true);
    }
  }, [statusData, isDateInitialized]);

  // 2. Fetch deposits ONLY after date is initialized
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agent-deposits', page, fromDate, toDate, statusFilter, agentIdFilter],
    queryFn: () => agentDepositApi.list({
      page,
      limit: 20,
      agentId: agentIdFilter || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      status: (statusFilter as 'completed' | 'reversed') || undefined,
    }),
    enabled: isDateInitialized,
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents-list-all'],
    queryFn: () => agentApi.list({ limit: 100 }),
    enabled: isAdmin,
  });
  const agentsList = (agentsData as any)?.data?.agents || [];

  // FIXED: Properly unwrapping Axios and ApiResponse nested properties
  const rawData = (data as any)?.data?.data;
  const deposits = (rawData?.deposits as any[]) || [];
  const pagination = rawData?.pagination as any;

  const rawBDate = (statusData as any)?.data?.data?.businessDate;
  const bDate = rawBDate ? format(parseISO(rawBDate), 'yyyy-MM-dd') : '';
  const clearFilters = () => { setFromDate(bDate); setToDate(bDate); setStatusFilter(''); setAgentIdFilter(''); setPage(1); };
  const hasFilters = statusFilter !== '' || agentIdFilter !== '' || fromDate !== bDate || toDate !== bDate;

  const handleExport = async (fmt: 'pdf' | 'csv') => {
    try {
      const exportData = await agentDepositApi.list({
        page: 1, limit: 10000,
        agentId: agentIdFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        status: (statusFilter as 'completed' | 'reversed') || undefined,
      });
      const exportRows = (exportData as any)?.data?.data?.deposits || [];
      if (!exportRows.length) return;

      const rows = exportRows.map((d: any) => ({
        depositId: d.depositId || d._id?.slice(-8),
        receipt: d.receiptNumber || '—',
        agent: `${d.agent?.name || '—'} (${d.agent?.agentCode || '—'})`,
        amount: `Rs. ${parseFloat((d.amountInPaise / 100).toString()).toFixed(2)}`,
        status: d.isReversed ? 'REVERSED' : 'COMPLETED',
        date: formatDate(d.businessDate)
      }));

      const cols = [
        { header: 'Deposit ID', dataKey: 'depositId', width: 25 },
        { header: 'Receipt No', dataKey: 'receipt', width: 25 },
        { header: 'Agent', dataKey: 'agent' },
        { header: 'Amount', dataKey: 'amount', align: 'right' as const, width: 25 },
        { header: 'Status', dataKey: 'status', width: 20 },
        { header: 'Date', dataKey: 'date', width: 25 },
      ];

      const opts = {
        title: 'Agent Deposits Report',
        subtitle: `Period: ${fromDate} to ${toDate}`,
        filename: 'agent_deposits',
        columns: cols, rows, branding,
      };

      if (fmt === 'pdf') exportReportPDF({ ...opts, orientation: 'portrait' });
      else exportReportCSV(opts);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  return (
    <div className="animate-fade-in animate-slide-up">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Agent Deposits</h1>
          <p className="page-subtitle">Cash handover records from field agents to the office vault</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/agent-deposits/balances')}>
                <BarChart3 className="h-4 w-4 mr-1.5" /> Agent Balances
              </Button>
              <Button onClick={() => navigate('/agent-deposits/new')}>
                <Plus className="h-4 w-4 mr-1.5" /> Record Deposit
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="card-header bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-38"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-38"
            />
          </div>
          <select
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-36"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="reversed">Reversed</option>
          </select>
          {isAdmin && (
            <select
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-48"
              value={agentIdFilter}
              onChange={(e) => { setAgentIdFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Agents</option>
              {agentsList.map((a: any) => (
                <option key={a._id} value={a._id}>{a.name} ({a.agentCode})</option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
              ✕ Clear
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={deposits.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button size="sm" onClick={() => handleExport('pdf')} disabled={deposits.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> PDF
            </Button>
            {pagination && (
              <span className="text-xs text-slate-400 ml-2">{pagination.total} records</span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Deposit ID</th>
                <th>Receipt</th>
                <th>Agent</th>
                <th className="text-right">Amount</th>
                <th>Received By</th>
                <th>Business Date</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || isLoadingStatus || !isDateInitialized ? (
                <tr>
                  <td colSpan={8} className="text-center py-14">
                    <div className="flex justify-center items-center gap-2 text-slate-400">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      Loading deposits...
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-red-500">
                    Failed to load deposits. Please try again.
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-slate-400">
                    <Banknote className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No agent deposits found</p>
                    <p className="text-xs mt-1">
                      {hasFilters ? 'Try adjusting your filters.' : isAdmin ? 'Record the first deposit.' : 'No deposits recorded yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                deposits.map((d: any) => (
                  <tr
                    key={d._id}
                    className={`cursor-pointer transition-colors ${
                      d.isReversed ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-blue-50/20'
                    }`}
                    onClick={() => navigate(`/agent-deposits/${d._id}`)}
                  >
                    <td>
                      <span className={`font-mono text-sm font-semibold ${d.isReversed ? 'line-through text-slate-400' : 'text-blue-700'}`}>
                        {d.depositId || d._id?.slice(-8)}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-slate-500">{d.receiptNumber || '—'}</span>
                    </td>
                    <td>
                      <p className="font-medium text-slate-900 text-sm">{d.agent?.name}</p>
                      <p className="text-xs text-slate-400">{d.agent?.agentCode}</p>
                    </td>
                    <td className="text-right">
                      <span className={`font-bold text-sm ${d.isReversed ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                        {formatCurrency(d.amountInPaise)}
                      </span>
                    </td>
                    <td className="text-sm text-slate-500">
                      {d.receivedBy?.name || '—'}
                    </td>
                    <td className="text-sm text-slate-500">
                      {formatDate(d.businessDate)}
                    </td>
                    <td>
                      {d.isReversed ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">Reversed</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">Completed</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/agent-deposits/${d._id}`); }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <p>Page {pagination.page} of {pagination.totalPages} — {pagination.total} records</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
