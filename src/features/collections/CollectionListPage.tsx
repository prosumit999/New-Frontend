// src/features/collections/CollectionListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Wallet, Calendar, AlertTriangle, BarChart3, Users } from 'lucide-react';
import { collectionApi } from '../../api/collection.api';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';

export default function CollectionListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin      = user?.role === 'admin';
  const isSuperadmin = user?.role === 'superadmin';
  const canViewExtra = isAdmin || isSuperadmin; // Daily Summary, Agent Report, Missed

  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['collections', page, fromDate, toDate, statusFilter],
    queryFn: () => collectionApi.list({
      page,
      limit: 20,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      status: statusFilter || undefined,
    }),
  });

  const collections = (data?.data?.collections as any[]) || [];
  const pagination = data?.data?.pagination as any;

  const clearFilters = () => { setFromDate(''); setToDate(''); setStatusFilter(''); setPage(1); };
  const hasFilters = fromDate || toDate || statusFilter;

  return (
    <div className="animate-fade-in animate-slide-up">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Pigmy Collections</h1>
          <p className="page-subtitle">Daily collection history across all agents and customers</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewExtra && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/collections/daily-summary')}>
                <BarChart3 className="h-4 w-4 mr-1.5" /> Daily Summary
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/collections/agent-report')}>
                <Users className="h-4 w-4 mr-1.5" /> Agent Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => navigate('/collections/missed')}
              >
                <AlertTriangle className="h-4 w-4 mr-1.5" /> Missed
              </Button>
            </>
          )}

          {isAdmin && (
            <Button onClick={() => navigate('/collections/new')}>
              <Plus className="h-4 w-4 mr-1.5" /> Record Collection
            </Button>
          )}
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="card-header bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-40"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-40"
            />
          </div>
          <select
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-40"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="collected">Collected</option>
            <option value="missed">Missed / Reversed</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
              ✕ Clear filters
            </button>
          )}
          {pagination && (
            <span className="ml-auto text-xs text-slate-400">{pagination.total} records</span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Customer</th>
                <th>Pigmy Account</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance After</th>
                <th>Agent</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-14">
                    <div className="flex justify-center items-center gap-2 text-slate-400">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      Loading collections...
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-red-500">
                    Failed to load collections. Please try again.
                  </td>
                </tr>
              ) : collections.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-slate-400">
                    <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No collections found</p>
                    <p className="text-xs mt-1">
                      {hasFilters ? 'Try adjusting your filters.' : 'Start by recording a collection.'}
                    </p>
                  </td>
                </tr>
              ) : (
                collections.map((c: any) => (
                  <tr
                    key={c._id}
                    className={`cursor-pointer transition-colors ${c.isReversed ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-blue-50/30'
                      }`}
                    onClick={() => navigate(`/collections/${c._id}`)}
                  >
                    <td>
                      <span className={`font-mono text-sm font-semibold ${c.isReversed ? 'line-through text-slate-400' : 'text-blue-600'}`}>
                        {c.receiptNumber}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-slate-900 text-sm">{c.customer?.name}</p>
                      <p className="text-xs text-slate-400">{c.customer?.customerCode}</p>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-slate-600">
                        {c.pigmyAccount?.accountNumber || '—'}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={`font-semibold text-sm ${c.isReversed ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                        {formatCurrency(c.amountInPaise)}
                      </span>
                    </td>
                    <td className="text-right text-sm text-slate-600">
                      {formatCurrency(c.balanceAfterInPaise)}
                    </td>
                    <td className="text-sm text-slate-500">{c.agent?.name || '—'}</td>
                    <td className="text-sm text-slate-500">{formatDate(c.collectionDate)}</td>
                    <td>
                      {c.isReversed ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                          Reversed
                        </span>
                      ) : (
                        <StatusBadge status={c.status} />
                      )}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/collections/${c._id}`); }}
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
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                ← Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
