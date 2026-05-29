// src/features/superadmin/LedgerAccountsPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, BookOpen, Lock, Edit2, Power, TrendingUp, TrendingDown, DollarSign, Banknote, Shield } from 'lucide-react';
import { superadminApi } from '../../api/superadmin.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatCurrency } from '../../utils/format';

const ACCOUNT_TYPES = ['asset', 'liability', 'income', 'expense', 'equity'] as const;

const TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string; normalBalance: string }> = {
  asset:     { label: 'Asset',     icon: DollarSign,   color: 'text-blue-700',    bg: 'bg-blue-100',    normalBalance: 'Debit' },
  liability: { label: 'Liability', icon: TrendingDown,  color: 'text-red-700',     bg: 'bg-red-100',     normalBalance: 'Credit' },
  income:    { label: 'Income',    icon: TrendingUp,    color: 'text-emerald-700', bg: 'bg-emerald-100', normalBalance: 'Credit' },
  expense:   { label: 'Expense',   icon: Banknote,      color: 'text-amber-700',   bg: 'bg-amber-100',   normalBalance: 'Debit' },
  equity:    { label: 'Equity',    icon: Shield,        color: 'text-indigo-700',  bg: 'bg-indigo-100',  normalBalance: 'Credit' },
};

type LedgerForm = {
  code: string;
  name: string;
  type: typeof ACCOUNT_TYPES[number] | '';
  description: string;
};

const EMPTY_FORM: LedgerForm = { code: '', name: '', type: '', description: '' };

export default function LedgerAccountsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<typeof ACCOUNT_TYPES[number] | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [form, setForm] = useState<LedgerForm>(EMPTY_FORM);
  const [editDesc, setEditDesc] = useState('');
  const [editActive, setEditActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['ledger-accounts', typeFilter],
    queryFn: () => superadminApi.listLedgerAccounts({
      limit: 200,
      type: typeFilter === 'all' ? undefined : typeFilter,
    }),
  });

  const accounts = (data?.data?.data?.accounts as any[]) || [];

  const resetForm = () => { setForm(EMPTY_FORM); setShowForm(false); };

  const openEdit = (acc: any) => {
    setEditTarget(acc);
    setEditDesc(acc.description || '');
    setEditActive(acc.isActive);
  };

  // Create
  const createMutation = useMutation({
    mutationFn: () => superadminApi.createLedgerAccount({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      type: form.type as typeof ACCOUNT_TYPES[number],
      description: form.description.trim() || undefined,
    }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Ledger account created');
      queryClient.invalidateQueries({ queryKey: ['ledger-accounts'] });
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: () => superadminApi.updateLedgerAccount(editTarget._id, {
      name: editTarget.isSystem ? undefined : form.name || editTarget.name,
      description: editDesc || undefined,
      isActive: editActive,
    }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Account updated');
      queryClient.invalidateQueries({ queryKey: ['ledger-accounts'] });
      setEditTarget(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  const formValid = form.code.trim().length >= 1 && form.name.trim().length >= 2 && form.type !== '';

  // Group by type for display
  const allTypes = typeFilter === 'all' ? ACCOUNT_TYPES : [typeFilter];

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Ledger Accounts</h1>
          <p className="page-subtitle">Manage the chart of accounts for double-entry bookkeeping</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Account
        </Button>
      </div>

      {/* Type Filter */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6 flex-wrap">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
            typeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          All Types
        </button>
        {ACCOUNT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              typeFilter === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      {/* Accounts Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Normal Balance</th>
                <th className="text-right">Running Balance</th>
                <th>Flags</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-500">Loading ledger accounts...</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">
                  <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium">No ledger accounts found.</p>
                </td></tr>
              ) : (
                accounts.map((acc) => {
                  const meta = TYPE_META[acc.type] || TYPE_META.asset;
                  const Icon = meta.icon;
                  return (
                    <tr key={acc._id} className={acc.isActive ? '' : 'opacity-50'}>
                      <td>
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {acc.code}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center justify-center w-6 h-6 rounded ${meta.bg}`}>
                            <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                          </div>
                          <span className="font-medium text-slate-900 text-sm">{acc.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${meta.bg} ${meta.color}`}>
                          {acc.type}
                        </span>
                      </td>
                      <td>
                        <span className={`text-xs font-medium capitalize ${acc.normalBalance === 'debit' ? 'text-blue-600' : 'text-purple-600'}`}>
                          {acc.normalBalance}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-sm">
                        {formatCurrency(acc.runningBalanceInPaise || 0)}
                      </td>
                      <td>
                        {acc.isSystem && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Lock className="h-3 w-3" /> System
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acc.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {acc.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(acc)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-slate-900">Create Ledger Account</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="form-label">Account Code * <span className="text-slate-400 font-normal text-xs">(auto-uppercased)</span></label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. CASH-001"
                  className="font-mono"
                />
              </div>
              <div>
                <label className="form-label">Account Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cash on Hand"
                />
              </div>
              <div>
                <label className="form-label">Account Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCOUNT_TYPES.map((t) => {
                    const meta = TYPE_META[t];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all ${
                          form.type === t ? `border-blue-500 ${meta.bg}` : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${form.type === t ? meta.color : 'text-slate-400'}`} />
                        <div>
                          <p className={`text-sm font-medium ${form.type === t ? meta.color : 'text-slate-700'}`}>{meta.label}</p>
                          <p className="text-[10px] text-slate-400">{meta.normalBalance} side</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {form.type && (
                  <p className="text-xs text-slate-500 mt-2">
                    Normal balance will be automatically set to <strong>{TYPE_META[form.type].normalBalance}</strong> (derived by backend).
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">Description (Optional)</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this account"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm} disabled={createMutation.isPending}>Cancel</Button>
              <Button
                isLoading={createMutation.isPending}
                onClick={() => createMutation.mutate()}
                disabled={!formValid || createMutation.isPending}
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Edit Ledger Account</h3>
              {editTarget.isSystem && (
                <span className="ml-auto flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                  <Lock className="h-3 w-3" /> System Account
                </span>
              )}
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Read-only display */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Code</p>
                  <p className="font-mono font-bold text-slate-800">{editTarget.code}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Type</p>
                  <p className="capitalize font-medium text-slate-800">{editTarget.type}</p>
                </div>
              </div>

              {editTarget.isSystem ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">This is a system account. Only Description and Active status can be edited.</p>
                </div>
              ) : (
                <div>
                  <label className="form-label">Account Name</label>
                  <Input
                    value={form.name || editTarget.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="form-label">Description</label>
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Brief description..."
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">Account Status</p>
                  <p className="text-xs text-slate-500">{editActive ? 'Active — in use' : 'Inactive — disabled'}</p>
                </div>
                <button
                  onClick={() => setEditActive(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${editActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditTarget(null)} disabled={updateMutation.isPending}>Cancel</Button>
              <Button
                isLoading={updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
