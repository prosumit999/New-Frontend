// src/features/collections/DailySheetPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, CheckCircle2, Clock, ChevronRight, BarChart2, AlertTriangle } from 'lucide-react';
import { collectionApi } from '../../api/collection.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';

export default function DailySheetPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { businessDate: globalBusinessDate } = useBusinessDate();
  const [date, setDate] = useState(globalBusinessDate);

  useEffect(() => {
    if (globalBusinessDate && date !== globalBusinessDate) {
      setDate(globalBusinessDate);
    }
  }, [globalBusinessDate]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'collected'>('all');

  // Agent always views own sheet; admin views own sheet here (admin-by-agent is in Admin Summary)
  const { data, isLoading } = useQuery({
    queryKey: ['daily-sheet', date],
    queryFn: () => collectionApi.getAgentSheet({ date }),
  });

  // Backend returns { date, agentId, summary, sheet: [...] }
  const sheetData = data?.data as any;
  const sheetItems: any[] = sheetData?.sheet || [];          // ← FIXED (was sheet?.collections)
  const summary = sheetData?.summary || {};

  const filteredItems = sheetItems.filter((item: any) => {
    if (filter === 'collected') return item.collectionStatus === 'collected';
    if (filter === 'pending') return item.collectionStatus === 'pending';
    return true;
  });

  const collectionRate = summary.totalAccounts > 0
    ? Math.round((summary.collectedCount / summary.totalAccounts) * 100)
    : 0;

  const circumference = 2 * Math.PI * 36; // r=36
  const progressStroke = circumference - (collectionRate / 100) * circumference;

  return (
    <div className="animate-fade-in animate-slide-up">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/collections')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Daily Collection Sheet</h1>
            <p className="page-subtitle">{isAdmin ? 'Your' : 'Agent'} collection progress for the selected date</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={date}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDate(e.target.value)}
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-44"
          />
        </div>
      </div>

      {/* Summary Hero: Progress ring + stats */}
      {!isLoading && sheetData && (
        <div className="card mb-6 overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Progress ring */}
            <div className="flex items-center justify-center p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white md:w-56 shrink-0">
              <div className="relative">
                <svg width="88" height="88" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                  <circle
                    cx="44" cy="44" r="36"
                    fill="none"
                    stroke="white"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={progressStroke}
                    strokeLinecap="round"
                    transform="rotate(-90 44 44)"
                    style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold">{collectionRate}%</p>
                  <p className="text-[10px] text-blue-200">Done</p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 flex-1 divide-x divide-y sm:divide-y-0 divide-slate-100">
              <div className="p-5 text-center">
                <p className="text-2xl font-bold text-slate-800">{summary.totalAccounts || 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total Accounts</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-2xl font-bold text-emerald-600">{summary.collectedCount || 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Collected</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-2xl font-bold text-amber-500">{summary.pendingCount || 0}</p>
                <p className="text-xs text-slate-400 mt-0.5">Pending</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-xl font-bold text-blue-700">{formatCurrency(summary.totalCollectedInPaise || 0)}</p>
                <p className="text-xs text-slate-400 mt-0.5">Collected</p>
                <p className="text-xs text-slate-300">of {formatCurrency(summary.expectedTotalInPaise || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
        {(['all', 'collected', 'pending'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {f === 'all' ? `All (${sheetItems.length})` :
              f === 'collected' ? `Collected (${summary.collectedCount || 0})` :
                `Pending (${summary.pendingCount || 0})`}
          </button>
        ))}
      </div>

      {/* Sheet table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Customer</th>
                <th className="text-right">Daily Amount</th>
                <th className="text-right">Pigmy Balance</th>
                <th className="text-center">Status</th>
                <th>Receipt</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-14">
                    <div className="flex justify-center items-center gap-2 text-slate-400">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      Loading sheet...
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-400">
                    {filter === 'pending'
                      ? <span className="text-emerald-600">✨ All collections done for this date!</span>
                      : 'No accounts found for this date.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item: any) => {
                  const isDone = item.collectionStatus === 'collected';
                  return (
                    <tr
                      key={item.accountId}
                      className={`transition-colors ${isDone ? 'bg-emerald-50/30' : 'hover:bg-amber-50/30'}`}
                    >
                      <td>
                        <span className="font-mono text-sm font-medium text-blue-600">
                          {item.accountNumber}
                        </span>
                      </td>
                      <td>
                        <p className="font-medium text-slate-900 text-sm">{item.customer?.name}</p>
                        <p className="text-xs text-slate-400">{item.customer?.customerCode}</p>
                        {item.customer?.address && (
                          <p className="text-[10px] text-slate-300 truncate max-w-[180px]">{item.customer.address}</p>
                        )}
                      </td>
                      <td className="text-right font-semibold text-slate-700 text-sm">
                        {formatCurrency(item.dailyDepositAmountInPaise)}
                      </td>
                      <td className="text-right text-sm text-slate-500">
                        {formatCurrency(item.currentBalanceInPaise)}
                      </td>
                      <td className="text-center">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td>
                        {item.receiptNumber ? (
                          <span className="font-mono text-xs text-blue-600">{item.receiptNumber}</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {isDone ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400"
                            onClick={() => navigate(`/collections?accountId=${item.accountId}`)}
                          >
                            View
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => navigate(`/collections/new?accountId=${item.accountId}`)}
                          >
                            Collect <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
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

        {/* Footer */}
        {!isLoading && sheetItems.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50/50">
            <p>
              <span className="font-semibold text-emerald-600">{formatCurrency(summary.totalCollectedInPaise || 0)}</span>
              {' '}collected of{' '}
              <span className="font-semibold text-slate-700">{formatCurrency(summary.expectedTotalInPaise || 0)}</span>
              {' '}expected
            </p>
            {(summary.pendingCount || 0) > 0 && (
              <p className="text-amber-600 font-medium">
                <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                {summary.pendingCount} accounts still pending
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
