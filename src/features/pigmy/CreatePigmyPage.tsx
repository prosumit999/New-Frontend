// src/features/pigmy/CreatePigmyPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, PiggyBank, AlertTriangle, CheckCircle2, X, User, Hash, Phone, FileText, Eye } from 'lucide-react';
import { pigmyApi } from '../../api/pigmy.api';
import { customerApi } from '../../api/customer.api';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { rupeesToPaise } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import type { Customer } from '../../types';

const KYC_INFO: Record<string, { label: string; color: string; canOpen: boolean; hint: string }> = {
  kyc_verified:        { label: 'KYC Verified', color: 'text-emerald-700 bg-emerald-50', canOpen: true, hint: 'Customer is eligible.' },
  documents_submitted: { label: 'Docs Submitted', color: 'text-amber-700 bg-amber-50', canOpen: false, hint: 'Documents under admin review.' },
  phone_verified:      { label: 'Phone Verified', color: 'text-blue-700 bg-blue-50', canOpen: false, hint: 'Must submit Aadhaar and PAN.' },
  pending:             { label: 'KYC Pending', color: 'text-slate-600 bg-slate-100', canOpen: false, hint: 'Must complete phone OTP.' },
  kyc_rejected:        { label: 'KYC Rejected', color: 'text-red-700 bg-red-50', canOpen: false, hint: 'KYC rejected. Must resubmit.' },
};

const DocChip = ({ present, label, url }: { present: boolean; label: string; url?: string }) => (
  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border
    ${present ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
    {present ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
    {label}
    {present && url && (
      <button 
        type="button" 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(url, '_blank'); }} 
        className="ml-0.5 text-emerald-600 hover:text-emerald-800 transition-colors hover:bg-emerald-100 rounded px-1 -mr-1 py-0.5"
      >
        <Eye className="h-3 w-3" />
      </button>
    )}
  </span>
);

export default function CreatePigmyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === 'agent';

  const [rawSearch, setRawSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dailyAmount, setDailyAmount] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // 400ms debounce
  useEffect(() => {
    const t = setTimeout(() => setCustomerSearch(rawSearch), 400);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // Customer search — agents only see their own customers via backend filtering
  const { data: customerData, isLoading: searchLoading } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => customerApi.list({ page: 1, limit: 10, search: customerSearch }),
    enabled: customerSearch.length >= 2 && !selectedCustomer,
  });

  // Fetch full customer detail once selected to get docs
  const { data: customerDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['customer-detail', selectedCustomer?._id],
    queryFn: () => customerApi.getCustomer(selectedCustomer!._id),
    enabled: !!selectedCustomer?._id,
  });
  const fullCustomer: Customer | undefined = customerDetail?.data?.customer ?? selectedCustomer ?? undefined;
  const docs = (fullCustomer as any)?.kycDocuments;

  // Agents for assignment (only shown for admin/superadmin)
  const { data: agentData } = useQuery({
    queryKey: ['agents-for-assignment'],
    queryFn: () => agentApi.list({ page: 1, limit: 100 } as any),
    enabled: !isAgent, // Agents can't assign to others
  });

  const customers: Customer[] = (customerData?.data?.customers as Customer[]) ?? [];
  const agents: any[] = (agentData?.data?.agents as any[]) ?? [];
  const kycInfo = selectedCustomer ? KYC_INFO[selectedCustomer.kycStatus] ?? KYC_INFO['pending'] : null;

  // Validate amount
  const amountInPaise = dailyAmount ? rupeesToPaise(dailyAmount) : 0;
  const isAmountValid = amountInPaise >= 100 && amountInPaise <= 10_000_00; // ₹1 – ₹1L

  const createMutation = useMutation({
    mutationFn: () => {
      if (amountInPaise < 100) throw new Error('Minimum daily deposit is ₹1');
      return pigmyApi.create({
        customerId: selectedCustomer!._id,
        dailyDepositAmountInPaise: amountInPaise,
        collectionFrequency: 'daily', // weekly blocked by backend
        assignedAgent: selectedAgentId || undefined,
      });
    },
    onSuccess: (res) => {
      toast.success('Pigmy account opened successfully!');
      queryClient.invalidateQueries({ queryKey: ['pigmy-accounts'] });
      const accountNumber = res.data?.account?.accountNumber;
      navigate(accountNumber ? `/pigmy/${accountNumber}` : '/pigmy');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to open pigmy account');
    },
  });

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pigmy')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Open Pigmy Account</h1>
            <p className="page-subtitle">Customer must have KYC verified and an active saving account</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-slate-900">Account Details</h2>
        </div>
        <div className="card-body space-y-5">

          {/* Customer Selection */}
          {!selectedCustomer && (
            <div>
              <label className="form-label">Search Customer *</label>
              <Input
                placeholder="Type customer name, phone, or code (min 2 chars)..."
                value={rawSearch}
                onChange={(e) => { setRawSearch(e.target.value); setSelectedCustomer(null); }}
              />
              {searchLoading && <p className="text-sm text-slate-500 mt-1">Searching...</p>}
            </div>
          )}

          {customerSearch.length >= 2 && customers.length > 0 && !selectedCustomer && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-52 overflow-y-auto">
              {customers.map((c) => {
                const info = KYC_INFO[c.kycStatus] ?? KYC_INFO['pending'];
                return (
                  <button
                    key={c._id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <div>
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.customerCode} · {c.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
                      {info.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedCustomer && kycInfo && (
            <div className={`border rounded-lg p-4 ${kycInfo.canOpen ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="w-full">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 py-2 text-slate-500 text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                      Loading customer details...
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-4">
                        {docs?.photo?.url ? (
                          <img
                            src={docs.photo.url}
                            alt={fullCustomer?.name}
                            className="h-14 w-14 rounded-xl object-cover border-2 border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0">
                            <User className="h-6 w-6 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-base leading-tight block truncate">
                            {fullCustomer?.name}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-slate-500">
                            <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{fullCustomer?.customerCode}</span>
                            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{fullCustomer?.phone}</span>
                          </div>
                          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${kycInfo.color}`}>
                            {kycInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">KYC Documents</p>
                        <div className="flex flex-wrap gap-2">
                          <DocChip label="Aadhaar" present={!!docs?.aadhar?.url} url={docs?.aadhar?.url} />
                          <DocChip label="PAN" present={!!docs?.pan?.url} url={docs?.pan?.url} />
                          <DocChip label="Photo" present={!!docs?.photo?.url} url={docs?.photo?.url} />
                          <DocChip label="Signature" present={!!docs?.signature?.url} url={docs?.signature?.url} />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm border-t border-slate-200 pt-3">
                        <div>
                          <p className="text-slate-500 font-medium text-xs">Address</p>
                          <p className="text-slate-700">{fullCustomer?.address || '—'}, {fullCustomer?.city || ''}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium text-xs">Nominee</p>
                          <p className="text-slate-700">{fullCustomer?.nomineeName || '—'} ({fullCustomer?.nomineeRelation || 'N/A'})</p>
                        </div>
                      </div>

                      {!kycInfo.canOpen && (
                        <div className="mt-3 text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{kycInfo.hint}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button onClick={() => { setSelectedCustomer(null); setRawSearch(''); }} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm border p-1 rounded-md">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Daily Deposit Amount */}
          <div>
            <label className="form-label">Daily Deposit Amount (₹) *</label>
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 100"
              value={dailyAmount}
              onChange={(e) => setDailyAmount(e.target.value)}
            />
            {dailyAmount && (
              <p className="text-xs text-slate-500 mt-1">
                {rupeesToPaise(dailyAmount).toLocaleString()} paise per daily collection
              </p>
            )}
          </div>

          {/* Collection Frequency — Weekly removed (backend blocks it) */}
          <div>
            <label className="form-label">Collection Frequency</label>
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <PiggyBank className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">Daily</p>
                <p className="text-xs text-slate-500">Agent collects every business day</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">Weekly collection is not yet supported by the system.</p>
          </div>

          {/* Agent Assignment — admin/superadmin only */}
          {!isAgent && agents.length > 0 && (
            <div>
              <label className="form-label">Assign Agent (optional)</label>
              <select
                className="form-input w-full py-2 px-3 text-sm rounded-lg border border-slate-200"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
              >
                <option value="">— Use Customer's Assigned Agent —</option>
                {agents.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({a.agentCode || a.profile?.agentCode})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                If not specified, the customer's current assigned agent is used. An agent must exist.
              </p>
            </div>
          )}

          {/* Prerequisites notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Prerequisites</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Customer must be KYC verified</li>
              <li>Customer must have an active saving account</li>
              <li>An agent must be assigned (to customer or specified above)</li>
              <li>Business day must be open</li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/pigmy')}>Cancel</Button>
          <Button
            disabled={!selectedCustomer || !kycInfo?.canOpen || !isAmountValid}
            isLoading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <PiggyBank className="h-4 w-4 mr-2" />
            Open Pigmy Account
          </Button>
        </div>
      </div>
    </div>
  );
}
