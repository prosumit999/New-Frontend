// src/features/superadmin/LoanPlansPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Edit2, TrendingUp, Lock, Power } from 'lucide-react';
import { superadminApi } from '../../api/superadmin.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { formatCurrency } from '../../utils/format';

const DURATION_OPTIONS = [3, 6, 12, 18, 24];

type PlanForm = {
  planName: string;
  description: string;
  durationMonths: string;
  interestRatePercent: string;
  processingFeePercent: string;
  minAmountRupees: string;
  maxAmountRupees: string;
};

const EMPTY_FORM: PlanForm = {
  planName: '',
  description: '',
  durationMonths: '',
  interestRatePercent: '',
  processingFeePercent: '2',
  minAmountRupees: '1000',
  maxAmountRupees: '',
};

export default function LoanPlansPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['loan-plans', statusFilter],
    queryFn: () => superadminApi.listLoanPlans({
      limit: 100,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
    }),
  });

  const plans = (data?.data?.data?.plans as any[]) || [];

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (plan: any) => {
    setForm({
      planName: plan.planName || '',
      description: plan.description || '',
      durationMonths: String(plan.durationMonths || ''),
      interestRatePercent: String((plan.baseInterestRateBps || 0) / 100),
      processingFeePercent: String((plan.processingFeeBps || 200) / 100),
      minAmountRupees: String((plan.minLoanAmountInPaise || 100000) / 100),
      maxAmountRupees: String((plan.maxLoanAmountInPaise || 0) / 100),
    });
    setEditingId(plan._id);
    setShowForm(true);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () => superadminApi.createLoanPlan({
      planName: form.planName.trim(),
      description: form.description.trim() || undefined,
      durationMonths: parseInt(form.durationMonths),
      baseInterestRateBps: Math.round(parseFloat(form.interestRatePercent) * 100),
      processingFeeBps: Math.round(parseFloat(form.processingFeePercent || '2') * 100),
      minLoanAmountInPaise: Math.round(parseFloat(form.minAmountRupees || '1000') * 100),
      maxLoanAmountInPaise: Math.round(parseFloat(form.maxAmountRupees) * 100),
    }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Loan plan created');
      queryClient.invalidateQueries({ queryKey: ['loan-plans'] });
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: () => superadminApi.updateLoanPlan(editingId!, {
      planName: form.planName.trim(),
      description: form.description.trim() || undefined,
      baseInterestRateBps: Math.round(parseFloat(form.interestRatePercent) * 100),
      processingFeeBps: Math.round(parseFloat(form.processingFeePercent || '2') * 100),
      minLoanAmountInPaise: Math.round(parseFloat(form.minAmountRupees || '1000') * 100),
      maxLoanAmountInPaise: Math.round(parseFloat(form.maxAmountRupees) * 100),
    }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Loan plan updated');
      queryClient.invalidateQueries({ queryKey: ['loan-plans'] });
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  // Toggle active/inactive
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      superadminApi.updateLoanPlan(id, { isActive }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Plan status updated');
      queryClient.invalidateQueries({ queryKey: ['loan-plans'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const formValid =
    form.planName.trim().length >= 2 &&
    DURATION_OPTIONS.includes(parseInt(form.durationMonths)) &&
    parseFloat(form.interestRatePercent) > 0 &&
    parseFloat(form.maxAmountRupees) > 0;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Loan Plans</h1>
          <p className="page-subtitle">Configure loan products available to customers</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Plan
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              statusFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f === 'all' ? 'All Plans' : f === 'active' ? '🟢 Active' : '🔴 Inactive'}
          </button>
        ))}
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-52 animate-pulse bg-slate-50" />
          ))
        ) : plans.length === 0 ? (
          <div className="col-span-full card card-body text-center py-14 text-slate-500">
            <TrendingUp className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium">No loan plans found.</p>
            <p className="text-xs mt-1">Create your first loan plan to get started.</p>
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan._id}
              className={`card hover:shadow-md transition-all ${plan.isActive ? '' : 'opacity-60'}`}
            >
              <div className={`px-5 py-3 flex items-center justify-between border-b ${plan.isActive ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{plan.planName}</p>
                  <p className="text-xs font-mono text-blue-600">{plan.planCode}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${plan.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="card-body space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Duration</p>
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-slate-800">{plan.durationMonths} months</p>
                      <span title="Cannot be changed after creation"><Lock className="h-3 w-3 text-slate-300" /></span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Interest Rate</p>
                    <p className="font-semibold text-slate-800">{((plan.baseInterestRateBps || 0) / 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Processing Fee</p>
                    <p className="font-semibold text-slate-800">{((plan.processingFeeBps || 0) / 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Min Amount</p>
                    <p className="font-semibold text-slate-800">{formatCurrency(plan.minLoanAmountInPaise)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">Max Amount</p>
                    <p className="font-semibold text-slate-800">{formatCurrency(plan.maxLoanAmountInPaise)}</p>
                  </div>
                </div>
                {plan.description && (
                  <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2 line-clamp-2">{plan.description}</p>
                )}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(plan)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={toggleMutation.isPending}
                    title={plan.isActive ? 'Deactivate plan' : 'Activate plan'}
                    onClick={() => toggleMutation.mutate({ id: plan._id, isActive: !plan.isActive })}
                  >
                    <Power className={`h-3.5 w-3.5 ${plan.isActive ? 'text-red-500' : 'text-emerald-500'}`} />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Loan Plan' : 'Create Loan Plan'}</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="form-label">Plan Name *</label>
                <Input
                  value={form.planName}
                  onChange={(e) => setForm(f => ({ ...f, planName: e.target.value }))}
                  placeholder="e.g. Gold Loan 12M"
                />
              </div>

              {/* Duration — read-only in edit mode */}
              <div>
                <label className="form-label flex items-center gap-1.5">
                  Duration (months) *
                  {editingId && <span className="flex items-center gap-1 text-xs text-slate-400 font-normal"><Lock className="h-3 w-3" /> Read-only after creation</span>}
                </label>
                {!editingId ? (
                  <div className="flex gap-2 flex-wrap">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, durationMonths: String(d) }))}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.durationMonths === String(d)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-slate-200 text-slate-700 hover:border-blue-400'
                        }`}
                      >
                        {d}M
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2.5 bg-slate-100 rounded-lg text-slate-500 text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {form.durationMonths} months (cannot be changed)
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Interest Rate (%) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={form.interestRatePercent}
                    onChange={(e) => setForm(f => ({ ...f, interestRatePercent: e.target.value }))}
                    placeholder="e.g. 15"
                  />
                  {form.interestRatePercent && (
                    <p className="text-xs text-slate-400 mt-0.5">= {Math.round(parseFloat(form.interestRatePercent) * 100)} BPS</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Processing Fee (%) </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="20"
                    value={form.processingFeePercent}
                    onChange={(e) => setForm(f => ({ ...f, processingFeePercent: e.target.value }))}
                    placeholder="e.g. 2"
                  />
                  {form.processingFeePercent && (
                    <p className="text-xs text-slate-400 mt-0.5">= {Math.round(parseFloat(form.processingFeePercent) * 100)} BPS</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Min Loan Amount (₹)</label>
                  <Input
                    type="number"
                    min="1"
                    value={form.minAmountRupees}
                    onChange={(e) => setForm(f => ({ ...f, minAmountRupees: e.target.value }))}
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="form-label">Max Loan Amount (₹) *</label>
                  <Input
                    type="number"
                    min="1"
                    value={form.maxAmountRupees}
                    onChange={(e) => setForm(f => ({ ...f, maxAmountRupees: e.target.value }))}
                    placeholder="e.g. 100000"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional plan description..."
                  rows={2}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
              <Button
                isLoading={isSubmitting}
                onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
                disabled={!formValid || isSubmitting}
              >
                {editingId ? 'Update Plan' : 'Create Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
