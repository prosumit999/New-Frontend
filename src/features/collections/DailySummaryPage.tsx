// src/features/collections/DailySummaryPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Calendar, TrendingUp, Users, BarChart3,
  Wallet, ArrowDownCircle, ArrowUpCircle, Download
} from 'lucide-react';
import { collectionApi } from '../../api/collection.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { useEffect } from 'react';
import { exportReportPDF } from '../../utils/reportExport';
import { useSystemStore } from '../../store/system.store';

export default function DailySummaryPage() {
  const navigate = useNavigate();
  const { businessDate: globalBusinessDate } = useBusinessDate();
  const [date, setDate] = useState(globalBusinessDate);
  const branding = useSystemStore(s => s.branding);

  useEffect(() => {
    if (globalBusinessDate && date !== globalBusinessDate) {
      setDate(globalBusinessDate);
    }
  }, [globalBusinessDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['daily-summary', date],
    queryFn: () => collectionApi.getDailySummary({ date }),
  });

  const summary = data?.data as any;
  const breakdown: any[] = summary?.agentBreakdown || [];
  const openingCash  = summary?.openingCashInPaise  ?? null;
  const closingCash  = summary?.closingCashInPaise   ?? null;
  const maxPaise = breakdown.length > 0 ? Math.max(...breakdown.map((b: any) => b.totalInPaise)) : 1;

  const handleExport = async () => {
    exportReportPDF({
      title: 'Daily Collection Summary',
      subtitle: `Business Date: ${date}`,
      dateRange: date,
      orientation: 'landscape',
      filename: `daily_summary_${date}`,
      columns: [
        { header: '#',            dataKey: 'sno',        align: 'center', width: 10 },
        { header: 'Agent',        dataKey: 'agentName',  align: 'left'              },
        { header: 'Agent Code',   dataKey: 'agentCode',  align: 'center'            },
        { header: 'Collections',  dataKey: 'collections',align: 'right'             },
        { header: 'Customers',    dataKey: 'customers',  align: 'right'             },
        { header: 'Amount',       dataKey: 'amount',     align: 'right'             },
      ],
      rows: breakdown.map((a: any, i: number) => ({
        sno:         i + 1,
        agentName:   a.agentName || '—',
        agentCode:   a.agentCode || '—',
        collections: a.totalCollections,
        customers:   a.uniqueCustomers,
        amount:      formatCurrency(a.totalInPaise),
      })),
      summary: [
        ...(openingCash !== null ? [{ label: 'Opening Cash Balance', value: formatCurrency(openingCash) }] : []),
        { label: 'Total Collected',   value: formatCurrency(summary?.totalInPaise || 0) },
        { label: 'Collections Count', value: String(summary?.totalCollections || 0) },
        ...(closingCash !== null ? [{ label: 'Closing Cash Balance',  value: formatCurrency(closingCash) }] : []),
      ],
      branding,
    });
  };

  return (
    <div className="animate-fade-in animate-slide-up space-y-5">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/collections')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Daily Collection Summary</h1>
            <p className="page-subtitle">Agent-wise collection & cash position for the day</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={date}
              max={globalBusinessDate}
              onChange={(e) => setDate(e.target.value)}
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-44"
            />
          </div>
          <Button size="sm" onClick={handleExport} className="gap-2" disabled={breakdown.length === 0}>
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Cash Position Bar */}
      {(openingCash !== null || closingCash !== null) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {openingCash !== null && (
            <div className="card p-5 flex items-center gap-4">
              <div className="bg-blue-50 rounded-xl p-3">
                <ArrowDownCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Opening Cash</p>
                <p className="text-xl font-bold text-blue-700">
                  {isLoading ? '—' : formatCurrency(openingCash)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Start of {date}</p>
              </div>
            </div>
          )}
          <div className="card p-5 flex items-center gap-4">
            <div className="bg-emerald-50 rounded-xl p-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Total Collected</p>
              <p className="text-xl font-bold text-emerald-700">
                {isLoading ? '—' : formatCurrency(summary?.totalInPaise || 0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{summary?.totalCollections || 0} collections</p>
            </div>
          </div>
          {closingCash !== null && (
            <div className="card p-5 flex items-center gap-4">
              <div className="bg-indigo-50 rounded-xl p-3">
                <ArrowUpCircle className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Closing Cash</p>
                <p className="text-xl font-bold text-indigo-700">
                  {isLoading ? '—' : formatCurrency(closingCash)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">End of {date}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards (fallback when no cash data) */}
      {openingCash === null && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="card p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full" />
            <TrendingUp className="h-5 w-5 text-blue-500 mb-3" />
            <p className="text-3xl font-bold text-slate-900 mb-0.5">
              {isLoading ? '—' : formatCurrency(summary?.totalInPaise || 0)}
            </p>
            <p className="text-sm text-slate-500">Total Collected</p>
            <p className="text-xs text-slate-400 mt-0.5">{summary?.date || date}</p>
          </div>
          <div className="card p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full" />
            <BarChart3 className="h-5 w-5 text-emerald-500 mb-3" />
            <p className="text-3xl font-bold text-slate-900 mb-0.5">
              {isLoading ? '—' : (summary?.totalCollections ?? 0)}
            </p>
            <p className="text-sm text-slate-500">Collections Recorded</p>
          </div>
          <div className="card p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-bl-full" />
            <Users className="h-5 w-5 text-indigo-500 mb-3" />
            <p className="text-3xl font-bold text-slate-900 mb-0.5">
              {isLoading ? '—' : breakdown.length}
            </p>
            <p className="text-sm text-slate-500">Active Agents</p>
          </div>
        </div>
      )}

      {/* Agent Breakdown Table */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-900">Agent Breakdown</h2>
          <span className="text-xs text-slate-400 ml-auto">Sorted by amount collected</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Agent</th>
                <th className="text-right">Collections</th>
                <th className="text-right">Customers</th>
                <th className="text-right">Amount</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-14">
                  <div className="flex justify-center items-center gap-2 text-slate-400">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    Loading summary...
                  </div>
                </td></tr>
              ) : breakdown.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-14 text-slate-400">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No collections recorded for {summary?.date || date}
                </td></tr>
              ) : (
                breakdown.map((agent: any, idx: number) => {
                  const pct = Math.round((agent.totalInPaise / maxPaise) * 100);
                  return (
                    <tr key={agent._id || idx} className="hover:bg-blue-50/20 transition-colors">
                      <td className="text-slate-400 font-medium text-sm">#{idx + 1}</td>
                      <td>
                        <p className="font-semibold text-slate-900 text-sm">{agent.agentName || '—'}</p>
                        <p className="text-xs text-slate-400">{agent.agentCode || '—'}</p>
                      </td>
                      <td className="text-right font-medium text-slate-700">{agent.totalCollections}</td>
                      <td className="text-right font-medium text-slate-700">{agent.uniqueCustomers}</td>
                      <td className="text-right">
                        <span className="font-bold text-emerald-700 text-sm">
                          {formatCurrency(agent.totalInPaise)}
                        </span>
                      </td>
                      <td className="w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-2 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && breakdown.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between text-sm text-slate-500">
            <p>
              <span className="font-semibold text-slate-700">{breakdown.length} agents</span>
              {' '}contributed{' '}
              <span className="font-semibold text-emerald-700">{formatCurrency(summary?.totalInPaise || 0)}</span>
            </p>
            <p>{summary?.totalCollections} collection entries</p>
          </div>
        )}
      </div>
    </div>
  );
}
