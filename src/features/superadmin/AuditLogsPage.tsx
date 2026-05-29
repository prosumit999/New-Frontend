// src/features/superadmin/AuditLogsPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { superadminApi } from '../../api/superadmin.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatDateTime } from '../../utils/format';

const AUDIT_STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'success', label: '✅ Success' },
  { value: 'failure', label: '❌ Failure' },
];

const ACTION_BADGE_COLOR: Record<string, string> = {
  LOGIN_SUCCESS: 'bg-emerald-100 text-emerald-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  SYSTEM_LOCKED: 'bg-red-100 text-red-700',
  SYSTEM_UNLOCKED: 'bg-emerald-100 text-emerald-700',
  SMS_DISABLED: 'bg-orange-100 text-orange-700',
  SMS_ENABLED: 'bg-blue-100 text-blue-700',
  ADMIN_CREATED: 'bg-blue-100 text-blue-700',
  ADMIN_STATUS_CHANGED: 'bg-amber-100 text-amber-700',
  ADMIN_PASSWORD_RESET: 'bg-amber-100 text-amber-700',
  CONFIG_UPDATED: 'bg-purple-100 text-purple-700',
  LOAN_PLAN_CREATED: 'bg-emerald-100 text-emerald-700',
  LOAN_PLAN_UPDATED: 'bg-blue-100 text-blue-700',
  LEDGER_ACCOUNT_CREATED: 'bg-purple-100 text-purple-700',
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_BADGE_COLOR[action] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function JSONViewer({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  if (!data || Object.keys(data).length === 0) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? 'Hide' : 'View'}
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-slate-900 text-emerald-300 text-[11px] rounded-lg overflow-x-auto max-w-xs max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, action, entity, status, from, to],
    queryFn: () => superadminApi.getAuditLogs({
      page,
      limit: 30,
      action: action.trim().toUpperCase() || undefined,
      entity: entity.trim() || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    placeholderData: (prev) => prev,
  });

  const logs = (data?.data?.data?.logs as any[]) || [];
  const pagination = data?.data?.data?.pagination as any;

  const clearFilters = () => {
    setAction(''); setEntity(''); setStatus(''); setFrom(''); setTo(''); setPage(1);
  };

  const hasFilters = action || entity || status || from || to;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Audit Logs</h1>
        <p className="page-subtitle">Complete system-wide activity and security trail</p>
      </div>

      {/* Filter Bar */}
      <div className="card mb-4">
        <div className="card-header bg-slate-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
            <Input
              placeholder="Action (e.g. LOGIN_FAILED)"
              value={action}
              onChange={(e) => { setAction(e.target.value.toUpperCase()); setPage(1); }}
              icon={<Search className="h-3.5 w-3.5" />}
            />
            <Input
              placeholder="Entity (e.g. User)"
              value={entity}
              onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            />
            <select
              className="form-input text-sm rounded-lg border border-slate-200 py-2 px-3"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              {AUDIT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              placeholder="From date"
            />
            <div className="flex gap-2">
              <Input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setPage(1); }}
                placeholder="To date"
              />
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Performed By</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Status</th>
                <th>Old Data</th>
                <th>New Data</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-500">Loading audit logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">
                  <ClipboardList className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium">No audit logs found.</p>
                  {hasFilters && <p className="text-xs mt-1">Try adjusting your filters.</p>}
                </td></tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log._id}
                    className={
                      log.status === 'failure' ? 'bg-red-50/50' :
                      ['SYSTEM_LOCKED', 'SMS_DISABLED'].includes(log.action) ? 'bg-amber-50/30' :
                      ''
                    }
                  >
                    <td className="text-slate-500 whitespace-nowrap text-xs">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{log.performedBy?.name || '—'}</p>
                        <p className="text-[11px] text-slate-400 capitalize">{log.performedBy?.role}</p>
                        {log.performedBy?.adminCode && (
                          <span className="font-mono text-[10px] text-blue-500">{log.performedBy.adminCode}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <ActionBadge action={log.action || '—'} />
                    </td>
                    <td>
                      <div>
                        <p className="text-sm text-slate-700">{log.entity || '—'}</p>
                        {log.entityId && (
                          <p className="font-mono text-[10px] text-slate-400 truncate max-w-[100px]">{String(log.entityId)}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td><JSONViewer data={log.oldData} /></td>
                    <td><JSONViewer data={log.newData} /></td>
                    <td className="font-mono text-[11px] text-slate-400">{log.ipAddress || '—'}</td>
                  </tr>
                ))
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
