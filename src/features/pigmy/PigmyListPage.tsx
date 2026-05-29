// src/features/pigmy/PigmyListPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, PiggyBank, TrendingUp } from 'lucide-react';
import { pigmyApi } from '../../api/pigmy.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import type { PigmyAccount } from '../../types';

export default function PigmyListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canCreate = ['superadmin', 'admin', 'agent'].includes(user?.role ?? '');

  const [rawSearch, setRawSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);

  // 400ms debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(rawSearch); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pigmy-accounts', page, searchTerm, statusFilter, showDeleted],
    queryFn: () =>
      pigmyApi.list({ 
        page, 
        limit: 20, 
        search: searchTerm || undefined, 
        status: statusFilter || undefined,
        isDeleted: showDeleted 
      }),
  });

  const accounts: PigmyAccount[] = data?.data?.accounts ?? [];
  const pagination = data?.data?.pagination;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Pigmy Accounts</h1>
          <p className="page-subtitle">Daily deposit accounts with agent collection tracking</p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/pigmy/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Open Pigmy
          </Button>
        )}
      </div>

      <div className="card">
        <div className="card-header bg-slate-50/50">
          <div className="flex border-b border-slate-200 mb-4 cursor-pointer">
            <div 
              className={`pb-2 px-4 font-medium text-sm transition-colors ${!showDeleted ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setShowDeleted(false); setPage(1); }}
            >
              Active Accounts
            </div>
            <div 
              className={`pb-2 px-4 font-medium text-sm transition-colors ${showDeleted ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setShowDeleted(true); setPage(1); }}
            >
              Deleted Archive
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="w-full max-w-sm">
              <Input
                placeholder="Search by account number..."
                icon={<Search className="h-4 w-4" />}
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
              />
            </div>
            <select
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account No.</th>
                <th>Customer</th>
                <th>Daily Deposit</th>
                <th>Balance</th>
                <th>Agent</th>
                <th>Days</th>
                <th>Status</th>
                <th>Opened</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                </td></tr>
              ) : isError ? (
                <tr><td colSpan={9} className="text-center py-10 text-red-500">Failed to load accounts.</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <PiggyBank className="h-8 w-8 text-slate-300" />
                    <span>No pigmy accounts found.</span>
                  </div>
                </td></tr>
              ) : (
                accounts.map((acc) => (
                  <tr
                    key={acc._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/pigmy/${acc.accountNumber}`)}
                  >
                    <td>
                      <span className="font-mono text-sm font-medium text-blue-600">{acc.accountNumber}</span>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium text-slate-900">{acc.customer?.name}</p>
                        <p className="text-xs text-slate-500">{acc.customer?.customerCode}</p>
                      </div>
                    </td>
                    <td>
                      <span className="font-medium text-slate-700">{formatCurrency(acc.dailyDepositAmountInPaise)}/day</span>
                    </td>
                    <td>
                      <span className="font-semibold text-emerald-700">{formatCurrency(acc.balanceInPaise)}</span>
                    </td>
                    <td>
                      <span className="text-sm text-slate-600">{acc.assignedAgent?.name || '—'}</span>
                    </td>
                    <td>
                      <span className="text-sm text-slate-600">{acc.totalCollectionDays ?? 0}</span>
                    </td>
                    <td><StatusBadge status={acc.status} /></td>
                    <td className="text-slate-500">{formatDate(acc.openedAt || acc.createdAt)}</td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/pigmy/${acc.accountNumber}`); }}
                      >
                        <TrendingUp className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </td>
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
