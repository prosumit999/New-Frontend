// src/features/reports/AgentCollectionReportPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Receipt, Download, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { agentReportApi } from '../../api/agentReport.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/format';
import { exportTableToCsv, exportTableToPdf } from '../../utils/exportUtils';

export default function AgentCollectionReportPage() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-collection-report', fromDate, toDate, page],
    queryFn: () => agentReportApi.getCollectionReport({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      page, limit: 50,
    }),
  });

  const res = (data?.data as any)?.data || (data?.data as any) || {};
  const collections: any[] = res.collections || [];
  const summary = res.summary || {};
  const pagination = res.pagination || {};

  const headers = ['Date', 'Receipt No', 'Customer', 'Account No', 'Amount', 'Type', 'Status'];
  const rows = collections.map((c: any) => [
    formatDate(c.collectionDate),
    c.receiptNumber,
    c.customer?.name || '—',
    c.pigmyAccount?.accountNumber || '—',
    formatCurrency(c.amountInPaise),
    c.collectionType || 'daily',
    c.status,
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/agent/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-600" /> Collection Report
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Date-wise collection register</p>
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

            {/* Summary chips */}
            {(summary.totalInPaise > 0) && (
              <div className="flex items-center gap-2 ml-2">
                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                  Total: {formatCurrency(summary.totalInPaise)}
                </span>
                <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                  {summary.totalCount} entries
                </span>
              </div>
            )}

            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTableToCsv(headers, rows, 'collection-report')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportTableToPdf('Collection Report', headers, rows)}>
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
              ) : collections.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No collections found for this period</td></tr>
              ) : (
                collections.map((c: any) => (
                  <tr key={c._id}>
                    <td className="text-slate-600">{formatDate(c.collectionDate)}</td>
                    <td className="font-mono text-xs font-semibold text-blue-700">{c.receiptNumber}</td>
                    <td className="font-medium text-slate-900">{c.customer?.name}</td>
                    <td className="font-mono text-xs text-slate-500">{c.pigmyAccount?.accountNumber}</td>
                    <td className="text-right font-bold text-emerald-700">{formatCurrency(c.amountInPaise)}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.collectionType === 'daily' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>{c.collectionType || 'daily'}</span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.status === 'collected' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>{c.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Grand Total row */}
        {summary.totalInPaise > 0 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Grand Total</span>
            <span className="text-lg font-bold text-emerald-700">{formatCurrency(summary.totalInPaise)}</span>
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
