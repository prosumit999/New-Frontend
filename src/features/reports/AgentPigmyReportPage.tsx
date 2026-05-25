// src/features/reports/AgentPigmyReportPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, PiggyBank, Download, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { agentReportApi } from '../../api/agentReport.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import { exportTableToCsv, exportTableToPdf } from '@/utils/exportUtils';

export default function AgentPigmyReportPage() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-pigmy-report', fromDate, toDate, page],
    queryFn: () => agentReportApi.getPigmyReport({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      page, limit: 50,
    }),
  });

  const res = (data?.data as any)?.data || (data?.data as any) || {};
  const accounts: any[] = res.accounts || [];
  const pagination = res.pagination || {};

  const headers = ['Customer', 'Code', 'Account No', 'Daily Amt', 'Collections', 'Period Collected', 'Balance', 'Status'];
  const rows = accounts.map((a: any) => [
    a.customer?.name || '—',
    a.customer?.customerCode || '—',
    a.accountNumber,
    formatCurrency(a.dailyDepositAmountInPaise),
    a.periodCollections || 0,
    formatCurrency(a.periodCollectedInPaise || 0),
    formatCurrency(a.balanceInPaise),
    a.status,
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/agent/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-blue-600" /> Pigmy Report
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Customer-wise pigmy collection summary</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-header bg-slate-50/50">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">From</label>
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">To</label>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-40" />
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTableToCsv(headers, rows, 'pigmy-report')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportTableToPdf('Pigmy Report', headers, rows)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {headers.map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">No pigmy accounts found</td></tr>
              ) : (
                accounts.map((a: any) => (
                  <tr key={a._id}>
                    <td className="font-medium text-slate-900">{a.customer?.name}</td>
                    <td className="font-mono text-xs text-slate-500">{a.customer?.customerCode}</td>
                    <td className="font-mono text-xs">{a.accountNumber}</td>
                    <td className="text-right font-semibold">{formatCurrency(a.dailyDepositAmountInPaise)}</td>
                    <td className="text-center">{a.periodCollections || 0}</td>
                    <td className="text-right font-semibold text-emerald-700">{formatCurrency(a.periodCollectedInPaise || 0)}</td>
                    <td className="text-right font-bold text-blue-700">{formatCurrency(a.balanceInPaise)}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>{a.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
            <p>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
