// src/features/customers/CustomerListPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus, Search, UserCheck, ArchiveRestore, Trash2, Eye, Lock, EyeOff, RefreshCw,
} from 'lucide-react';
import { customerApi } from '../../api/customer.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { Customer } from '../../types';

// ── Restore confirmation dialog ───────────────────────────────────────────────
function RestoreDialog({
  customer,
  onClose,
  onConfirm,
  isLoading,
}: {
  customer: Customer;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isLoading: boolean;
}) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-t-2xl px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ArchiveRestore className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Restore Customer</h2>
              <p className="text-emerald-200 text-sm mt-0.5">{customer.customerCode} — {customer.name}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Info box */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-xs font-semibold text-emerald-700 mb-1">What happens on restore:</p>
            <ul className="text-xs text-emerald-600 space-y-0.5 list-disc list-inside">
              <li>Customer becomes active again</li>
              <li>All existing KYC data is preserved</li>
              <li>No new OTP is required</li>
              <li>Phone, Aadhaar &amp; PAN uniqueness is verified first</li>
            </ul>
          </div>

          {/* Password field */}
          <div>
            <label className="form-label mb-1.5">
              <Lock className="h-3.5 w-3.5 inline mr-1 text-slate-500" />
              Confirm with your admin password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your admin password to authorize"
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Verified server-side via bcrypt. Never stored or logged.</p>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            isLoading={isLoading}
            disabled={password.trim().length < 6}
            onClick={() => {
              if (!password.trim()) { toast.error('Admin password is required'); return; }
              onConfirm(password);
            }}
          >
            <ArchiveRestore className="h-4 w-4 mr-1.5" /> Restore Customer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdminOrAbove = user?.role === 'admin' || user?.role === 'superadmin';

  // Active | Deleted archive tab
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Restore dialog state
  const [restoreTarget, setRestoreTarget] = useState<Customer | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page on tab switch
  useEffect(() => {
    setPage(1);
    setSearchInput('');
    setSearchTerm('');
  }, [activeTab]);

  const showDeleted = activeTab === 'deleted';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', activeTab, page, searchTerm],
    queryFn: () =>
      customerApi.list({
        page,
        limit: 10,
        search: searchTerm || undefined,
        isDeleted: showDeleted ? 'true' : undefined,
      }),
  });

  const customers = (data?.data?.customers as Customer[]) || [];
  const pagination = data?.data?.pagination as any;

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      customerApi.restoreCustomer(id, password),
    onSuccess: (res) => {
      toast.success(res.message || 'Customer restored successfully');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setRestoreTarget(null);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Restore failed'),
  });

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Customer Directory</h1>
          <p className="page-subtitle">Manage customer accounts and KYC documents</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdminOrAbove && (
            <Button
              variant="outline"
              className="hidden sm:flex"
              onClick={() => navigate('/customers/kyc-pending')}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Pending KYC
            </Button>
          )}
          <Button onClick={() => navigate('/customers/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Customer
          </Button>
        </div>
      </div>

      <div className="card">
        {/* ── Tab switcher (admin only) ─────────────────────────────────── */}
        {isAdminOrAbove && (
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'active'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Active Customers
            </button>
            <button
              onClick={() => setActiveTab('deleted')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'deleted'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Deleted Archive
            </button>
          </div>
        )}

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div className="card-header bg-slate-50/50">
          <div className="flex items-center gap-3 flex-wrap w-full">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <Input
                placeholder={
                  showDeleted
                    ? 'Search deleted by name, phone, or ID...'
                    : 'Search by name, phone, or ID...'
                }
                icon={<Search className="h-4 w-4" />}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            {showDeleted && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <ArchiveRestore className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">
                  Admin archive — restore any customer from here
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Info</th>
                <th>Contact</th>
                {!showDeleted && <th>Agent</th>}
                <th>KYC Status</th>
                {showDeleted ? <th>Deleted On</th> : <th>Joined</th>}
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    Loading customers...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-red-500">
                    Failed to load customers.
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    {showDeleted ? (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <ArchiveRestore className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No deleted customers — archive is clean</p>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No customers found.</p>
                    )}
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer._id}
                    className={`${showDeleted ? 'opacity-70' : 'cursor-pointer'}`}
                    onClick={() => !showDeleted && navigate(`/customers/${customer._id}`)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        {showDeleted && (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-slate-900">{customer.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{customer.customerCode}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="text-slate-700">{customer.phone}</p>
                    </td>
                    {!showDeleted && (
                      <td>
                        <p className="text-slate-700">{(customer as any).assignedAgent?.name || 'Unassigned'}</p>
                        {(customer as any).assignedAgent && (
                          <p className="text-xs text-slate-500">{(customer as any).assignedAgent.agentCode}</p>
                        )}
                      </td>
                    )}
                    <td>
                      <StatusBadge status={customer.kycStatus} />
                    </td>
                    <td className="text-slate-500">
                      {showDeleted
                        ? formatDate((customer as any).deletedAt || customer.createdAt)
                        : formatDate(customer.createdAt)}
                    </td>
                    <td
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => setRestoreTarget(customer)}
                        >
                          <ArchiveRestore className="h-4 w-4 mr-1.5" /> Restore
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/customers/${customer._id}`)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
            <p>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Restore dialog ────────────────────────────────────────────────── */}
      {restoreTarget && (
        <RestoreDialog
          customer={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          isLoading={restoreMutation.isPending}
          onConfirm={(password) =>
            restoreMutation.mutate({ id: restoreTarget._id, password })
          }
        />
      )}
    </div>
  );
}
