// src/features/customers/CustomerKycPendingPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, ShieldCheck, ShieldX, Eye } from 'lucide-react';
import { customerApi } from '../../api/customer.api';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDate, formatPhone } from '../../utils/format';
import { Customer } from '../../types';

export default function CustomerKycPendingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeAction, setActiveAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', 'kyc-pending'],
    queryFn: () => customerApi.getKycPending({ limit: 50 }),
  });

  const customers: Customer[] = (data?.data as any)?.customers || [];

  const kycMutation = useMutation({
    mutationFn: () => {
      if (!activeAction) throw new Error('No action selected');
      if (activeAction.action === 'approve') {
        return customerApi.verifyKyc(activeAction.id);
      }
      return customerApi.rejectKyc(activeAction.id, reason);
    },
    onSuccess: (res) => {
      toast.success(res?.message || 'KYC updated');
      // Invalidate BOTH the list and the kyc-pending query so the page refreshes
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'kyc-pending'] });
      setActiveAction(null);
      setReason('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'KYC action failed');
    },
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Pending KYC — Customers</h1>
          <p className="page-subtitle">Review and verify customer KYC submissions</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          title="No pending KYC"
          description="All customer KYC applications have been processed."
        />
      ) : (
        <div className="space-y-4">
          {customers.map((customer) => (
            <div key={customer._id} className="card">
              <div className="card-body flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-slate-900">{customer.name}</h3>
                    <StatusBadge status={customer.kycStatus} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {customer.customerCode} · {formatPhone(customer.phone)}
                    {customer.assignedAgent && ` · Agent: ${(customer.assignedAgent as any).name}`}
                  </p>
                  {customer.aadharMasked && (
                    <p className="text-xs text-slate-400 mt-1">
                      Aadhaar: {customer.aadharMasked} · PAN: {customer.panMasked || '—'}
                    </p>
                  )}
                  {customer.kycSubmittedAt && (
                    <p className="text-xs text-slate-400">
                      Submitted: {formatDate(customer.kycSubmittedAt)}
                    </p>
                  )}
                  {/* Agent Attribution — shows which agent/admin registered this customer */}
                  {(customer as any).createdBy && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5">
                      {(customer as any).createdBy.role === 'agent' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[11px] font-semibold">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          Registered by: {(customer as any).createdBy.name}
                          {(customer as any).createdBy.agentCode && ` (${(customer as any).createdBy.agentCode})`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[11px] font-semibold">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          Registered by: Admin
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {activeAction?.id === customer._id ? (
                  <div className="flex flex-col gap-2 min-w-[280px]">
                    {activeAction.action === 'reject' && (
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Rejection reason (min 10 chars)"
                        rows={2}
                        className="text-sm"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setActiveAction(null); setReason(''); }}
                        disabled={kycMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant={activeAction.action === 'reject' ? 'destructive' : 'default'}
                        isLoading={kycMutation.isPending}
                        onClick={() => {
                          if (activeAction.action === 'reject' && reason.trim().length < 10) {
                            toast.error('Reason must be at least 10 characters');
                            return;
                          }
                          kycMutation.mutate();
                        }}
                      >
                        {activeAction.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/customers/${customer._id}`)}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                    <Button size="sm" onClick={() => { setActiveAction({ id: customer._id, action: 'approve' }); setReason(''); }}>
                      <ShieldCheck className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => { setActiveAction({ id: customer._id, action: 'reject' }); setReason(''); }}>
                      <ShieldX className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
