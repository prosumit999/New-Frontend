// src/features/collections/MissedCollectionsPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Calendar, ChevronRight, CheckCircle } from 'lucide-react';
import { collectionApi } from '../../api/collection.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { useEffect } from 'react';

export default function MissedCollectionsPage() {
  const navigate = useNavigate();
  const { businessDate: globalBusinessDate } = useBusinessDate();
  const [date, setDate] = useState(globalBusinessDate);

  useEffect(() => {
    if (globalBusinessDate && date !== globalBusinessDate) {
       setDate(globalBusinessDate);
    }
  }, [globalBusinessDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['missed-collections', date],
    queryFn: () => collectionApi.getMissedCollections({ date }),
  });

  // Root-level fields, no nested summary object
  // Backend: { date, missedCount, totalMissedInPaise, totalMissedInRupees, missed: [...] }
  const result = data?.data as any;
  const missed: any[] = result?.missed || [];
  const missedCount: number = result?.missedCount ?? missed.length;
  const totalMissedInPaise: number = result?.totalMissedInPaise ?? 0;

  return (
    <div className="animate-fade-in animate-slide-up">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/collections')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Missed Collections</h1>
            <p className="page-subtitle">Pigmy accounts with no collection recorded for the selected date</p>
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

      {/* Summary Banner */}
      {!isLoading && (
        missedCount === 0 ? (
          <div className="card mb-6 p-6 flex items-center gap-4 border-l-4 border-l-emerald-500 bg-emerald-50/50">
            <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-emerald-800">All Clear!</p>
              <p className="text-sm text-emerald-600">All collections have been recorded for {result?.date || date}.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="card p-5 border-l-4 border-l-red-500 bg-red-50/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{missedCount}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Missed Accounts</p>
                </div>
              </div>
            </div>
            <div className="card p-5 border-l-4 border-l-amber-500 bg-amber-50/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-lg">₹</span>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-700">{formatCurrency(totalMissedInPaise)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Expected Revenue Missed</p>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Missed accounts table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account No.</th>
                <th>Customer</th>
                <th>Phone</th>
                <th className="text-right">Daily Amount</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-14">
                    <div className="flex justify-center items-center gap-2 text-slate-400">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      Checking missed accounts...
                    </div>
                  </td>
                </tr>
              ) : missed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-emerald-600">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
                    All collections completed for this date.
                  </td>
                </tr>
              ) : (
                missed.map((m: any, idx: number) => (
                  <tr key={m.accountNumber + idx} className="hover:bg-red-50/20 transition-colors">
                    <td>
                      <span className="font-mono text-sm font-semibold text-blue-600">
                        {m.accountNumber}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-slate-900 text-sm">{m.customer?.name}</p>
                      <p className="text-xs text-slate-400">{m.customer?.customerCode}</p>
                    </td>
                    <td className="text-sm text-slate-500">{m.customer?.phone || '—'}</td>
                    <td className="text-right font-semibold text-slate-700 text-sm">
                      {formatCurrency(m.dailyDepositAmountInPaise)}
                    </td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => navigate(`/collections/new?accountId=${m._id || m.accountNumber}`)}
                      >
                        Collect Now <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && missed.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 text-sm text-slate-500">
            <p>
              <span className="font-semibold text-red-600">{missedCount} accounts</span>
              {' '}missed collection — estimated loss:{' '}
              <span className="font-semibold text-amber-700">{formatCurrency(totalMissedInPaise)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
