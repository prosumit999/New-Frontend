// src/features/reports/AgentDepositReportPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Download, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { agentReportApi } from '../../api/agentReport.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/format';
import { exportTableToCsv, exportTableToPdf } from '@/utils/exportUtils';

export default function AgentDepositReportPage() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-deposit-report', fromDate, toDate, page],
    queryFn: () => agentReportApi.getDepositReport({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      page, limit: 50,
    }),
  });

  const res = (data?.data as any)?.data || (data?.data as any) || {};
  const deposits: any[] = res.deposits || [];
  const summary = res.summary || {};
  const pagination = res.pagination || {};

  const headers = ['Date', 'Receipt No', 'Amount', 'Payment Mode', 'Verified By', 'Status', 'Note'];
  const rows = deposits.map((d: any) => [
    formatDate(d.depositDate),
    d.receiptNumber || '—',
    formatCurrency(d.amountInPaise),
    d.paymentMode || 'cash',
    d.verifiedBy?.name || '—',
    d.status,
    d.note || '—',
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/agent/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Banknote className="h-6 w-6 text-violet-600" /> Deposit Report
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Your cash deposit history at office</p>
        </div>
      </div>

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

            {(summary.totalInPaise > 0) && (
              <span className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold ml-2">
                Total Deposited: {formatCurrency(summary.totalInPaise)}
              </span>
            )}

            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTableToCsv(headers, rows, 'deposit-report')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportTableToPdf('Deposit Report', headers, rows)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {headers.map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">Loading...</td></tr>
              ) : deposits.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No deposit records found</td></tr>
              ) : (
                deposits.map((d: any) => (
                  <tr key={d._id}>
                    <td className="text-slate-600">{formatDate(d.depositDate)}</td>
                    <td className="font-mono text-xs font-semibold text-blue-700">{d.receiptNumber || '—'}</td>
                    <td className="text-right font-bold text-violet-700">{formatCurrency(d.amountInPaise)}</td>
                    <td className="capitalize text-slate-600">{(d.paymentMode || 'cash').replace(/_/g, ' ')}</td>
                    <td className="text-slate-700">{d.verifiedBy?.name || '—'}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        d.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {d.status === 'completed' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {d.status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400 max-w-[150px] truncate">{d.note || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {summary.totalInPaise > 0 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Grand Total Deposited</span>
            <span className="text-lg font-bold text-violet-700">{formatCurrency(summary.totalInPaise)}</span>
          </div>
        )}

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
