// src/features/loans/LoanListPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Banknote, TrendingDown, ShieldAlert, LayoutDashboard, Search } from 'lucide-react';
import { loanApi } from '../../api/loan.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';

export default function LoanListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [rawSearch, setRawSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 400ms debounce

  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(rawSearch); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['loans', page, statusFilter, searchTerm],
    queryFn: () => loanApi.list({ page, limit: 20, status: statusFilter || undefined, search: searchTerm || undefined }),
  });

  // Backend response: { success, data: { loans, pagination }, message }
  // After api client unwrap (res.data): { success, data: { loans, pagination }, message }
  const loans = (data?.data?.loans as any[]) || [];
  const pagination = data?.data?.pagination as any;

  const statusCounts: Record<string, number> = loans.reduce((acc: any, l: any) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  const isAdmin           = user?.role === 'admin';
  const isAdminOrSuperadmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <div className="animate-fade-in animate-slide-up">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Loan Accounts</h1>
          <p className="page-subtitle">Manage disbursements, repayments, penalties and closures</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdminOrSuperadmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/loans/repayments')}>
                <LayoutDashboard className="h-4 w-4 mr-1.5" />
                Repayment Risk
              </Button>
            </>
          )}
          {isAdmin && (
            <Button onClick={() => navigate('/loans/new')}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Loan
            </Button>
          )}
        </div>
      </div>



      <div className="card">
        <div className="card-header bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="w-full max-w-sm">
              <Input
                placeholder="Search by loan number or customer..."
                icon={<Search className="h-4 w-4" />}
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
              />
            </div>
            <select
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-full sm:w-44"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="overdue">Overdue</option>
              <option value="closed">Closed</option>
              <option value="written_off">Written Off</option>
            </select>
          </div>
          {pagination && (
            <span className="text-xs text-slate-500 whitespace-nowrap">{pagination.total} loans total</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loan #</th>
                <th>Customer</th>
                <th>Plan</th>
                <th className="text-right">Principal</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
                <th>Maturity</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-14">
                    <div className="flex justify-center items-center gap-2 text-slate-400">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      Loading loans...
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-red-500">
                    <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Failed to load loans. Try refreshing.
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-slate-400">
                    <Banknote className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No loans found</p>
                    <p className="text-xs mt-1">
                      {statusFilter ? `No ${statusFilter} loans.` : 'Start by disbursing a new loan.'}
                    </p>
                  </td>
                </tr>
              ) : (
                loans.map((loan: any) => (
                  <tr
                    key={loan._id}
                    className="cursor-pointer hover:bg-blue-50/30 transition-colors"
                    onClick={() => navigate(`/loans/${loan._id}`)}
                  >
                    <td>
                      <span className="font-mono text-sm font-semibold text-blue-600">
                        {loan.loanAccountNumber}
                      </span>
                    </td>
                    <td>
                      <p className="font-medium text-slate-900 text-sm">{loan.customer?.name}</p>
                      <p className="text-xs text-slate-400">{loan.customer?.customerCode}</p>
                    </td>
                    <td className="text-sm text-slate-500">{loan.loanPlan?.planName || `${loan.durationMonths}M`}</td>
                    <td className="text-right font-medium text-slate-700 text-sm">
                      {formatCurrency(loan.principalAmountInPaise)}
                    </td>
                    <td className="text-right">
                      <span className={`font-semibold text-sm ${
                        loan.outstandingBalanceInPaise > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {formatCurrency(loan.outstandingBalanceInPaise)}
                      </span>
                      {loan.isOverdue && (
                        <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold">OVERDUE</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={loan.status} />
                    </td>
                    <td className="text-sm text-slate-500">{formatDate(loan.maturityDate)}</td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/loans/${loan._id}`); }}
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

        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <p>Page {pagination.page} of {pagination.totalPages} &mdash; {pagination.total} total loans</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                ← Previous
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
