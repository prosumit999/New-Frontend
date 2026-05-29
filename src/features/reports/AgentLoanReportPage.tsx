// src/features/reports/AgentLoanReportPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Download, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { agentReportApi } from '../../api/agentReport.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import { exportTableToCsv, exportTableToPdf } from '@/utils/exportUtils';

export default function AgentLoanReportPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-loan-report', page],
    queryFn: () => agentReportApi.getLoanReport({ page, limit: 50 }),
  });

  const res = (data?.data as any)?.data || (data?.data as any) || {};
  const loans: any[] = res.loans || [];
  const pagination = res.pagination || {};

  const headers = ['Customer', 'Code', 'Loan No', 'Principal', 'Outstanding', 'Total Paid', 'Status', 'Overdue'];
  const rows = loans.map((l: any) => [
    l.customer?.name || '—',
    l.customer?.customerCode || '—',
    l.loanAccountNumber,
    formatCurrency(l.principalAmountInPaise),
    formatCurrency(l.outstandingBalanceInPaise),
    formatCurrency(l.totalPaidInPaise || 0),
    l.status,
    l.overdueCount || 0,
  ]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-emerald-50 text-emerald-700';
      case 'overdue': return 'bg-red-50 text-red-700';
      case 'closed': return 'bg-slate-100 text-slate-500';
      default: return 'bg-amber-50 text-amber-700';
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/agent/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-amber-600" /> Loan Report
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Loan status for your assigned customers</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-slate-50/50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              {pagination.total || 0} loans found
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportTableToCsv(headers, rows, 'loan-report')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportTableToPdf('Loan Report', headers, rows)}>
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
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">No loans found for your assigned customers</td></tr>
              ) : (
                loans.map((l: any) => (
                  <tr key={l._id}>
                    <td className="font-medium text-slate-900">{l.customer?.name}</td>
                    <td className="font-mono text-xs text-slate-500">{l.customer?.customerCode}</td>
                    <td className="font-mono text-xs">{l.loanAccountNumber}</td>
                    <td className="text-right">{formatCurrency(l.principalAmountInPaise)}</td>
                    <td className="text-right font-bold text-red-700">{formatCurrency(l.outstandingBalanceInPaise)}</td>
                    <td className="text-right text-emerald-700">{formatCurrency(l.totalPaidInPaise || 0)}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(l.status)}`}>{l.status}</span>
                    </td>
                    <td className={`text-center font-semibold ${(l.overdueCount || 0) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {l.overdueCount || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
