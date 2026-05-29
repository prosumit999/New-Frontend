// src/features/savings/SavingListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Wallet, TrendingUp } from 'lucide-react';
import { savingApi } from '../../api/saving.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { useDebounce } from '../../hooks/useDebounce';
import type { SavingAccount } from '../../types';

export default function SavingListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin'; // CREATE_SAVING_ACCOUNT is admin-only

  const [rawSearch, setRawSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const searchTerm = useDebounce(rawSearch, 400);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['savings', page, searchTerm, statusFilter],
    queryFn: () =>
      savingApi.list({ page, limit: 20, search: searchTerm || undefined, status: statusFilter || undefined }),
  });

  const accounts: SavingAccount[] = data?.data?.accounts ?? [];
  const pagination = data?.data?.pagination;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Saving Accounts</h1>
          <p className="page-subtitle">Manage customer saving accounts, deposits, and statements</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate('/savings/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Open Account
          </Button>
        )}
      </div>

      <div className="card">
        <div className="card-header bg-slate-50/50">
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
                <th>Balance</th>
                <th>Opening Charge</th>
                <th>Status</th>
                <th>Opened</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                </td></tr>
              ) : isError ? (
                <tr><td colSpan={7} className="text-center py-10 text-red-500">Failed to load accounts.</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Wallet className="h-8 w-8 text-slate-300" />
                    <span>No saving accounts found.</span>
                  </div>
                </td></tr>
              ) : (
                accounts.map((acc) => (
                  <tr
                    key={acc._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/savings/${acc.accountNumber}`)}
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
                      <span className="font-semibold text-emerald-700">{formatCurrency(acc.balanceInPaise)}</span>
                    </td>
                    <td>
                      <span className="text-slate-600 text-sm">{formatCurrency(acc.openingChargeInPaise)}</span>
                    </td>
                    <td><StatusBadge status={acc.status} /></td>
                    <td className="text-slate-500">{formatDate(acc.openedAt || acc.createdAt)}</td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/savings/${acc.accountNumber}`); }}
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
