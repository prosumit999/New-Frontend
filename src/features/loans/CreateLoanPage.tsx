// src/features/loans/CreateLoanPage.tsx
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Banknote, Eye, CheckCircle, AlertCircle, User, BookOpen, Calculator, X, Phone, Hash, CheckCircle2, AlertTriangle } from 'lucide-react';
import { loanApi, loanPlanApi } from '../../api/loan.api';
import { customerApi } from '../../api/customer.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatCurrency, rupeesToPaise } from '../../utils/format';

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

export default function CreateLoanPage() {

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1); // 1=Customer, 2=Plan, 3=Amount, 4=Confirm
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [principalInput, setPrincipalInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Search customers
  const { data: customerData, isFetching: searchingCustomers } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => customerApi.list({ page: 1, limit: 8, search: customerSearch }),
    enabled: customerSearch.length >= 2 && !selectedCustomer,
  });

  // Fetch full customer detail once selected to get docs
  const { data: customerDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['customer-detail', selectedCustomer?._id],
    queryFn: () => customerApi.getCustomer(selectedCustomer!._id),
    enabled: !!selectedCustomer?._id,
  });
  const fullCustomer: any = customerDetail?.data?.customer ?? selectedCustomer ?? undefined;
  const docs = fullCustomer?.kycDocuments;
  const kycInfo = selectedCustomer ? KYC_INFO[selectedCustomer.kycStatus] ?? KYC_INFO['pending'] : null;

  // Fetch active loan plans
  const { data: planData } = useQuery({
    queryKey: ['loan-plans'],
    queryFn: () => loanPlanApi.list(),
  });

  const customers = (customerData?.data?.customers as any[]) || [];
  const plans = ((planData?.data?.plans || planData?.data?.loanPlans) as any[]) || [];

  // Preview query — fires only when preview triggered
  const principalPaise = rupeesToPaise(principalInput);
  const { data: previewData, isLoading: previewLoading, isError: previewError } = useQuery({
    queryKey: ['loan-preview', selectedPlan?._id, principalPaise],
    queryFn: () => loanApi.preview({ principalAmountInPaise: principalPaise, loanPlanId: selectedPlan?._id }),
    enabled: showPreview && !!selectedPlan?._id && principalPaise >= 100,
    retry: false,
  });

  // Response shape: { success, data: { loanPlan, breakdown }, message }
  const preview = previewData?.data?.breakdown as any;
  const previewPlan = previewData?.data?.loanPlan as any;

  const canPreview = !!selectedPlan?._id && principalPaise >= 100;

  // Create mutation with idempotency
  const createMutation = useMutation({
    mutationFn: () => loanApi.create({
      customerId: selectedCustomer._id,
      loanPlanId: selectedPlan._id,
      principalAmountInPaise: principalPaise,
      requestId: crypto.randomUUID(),
    }),
    onSuccess: (res: any) => {
      // Response shape: { success, data: { loan }, message }
      const loanId = res?.data?.loan?._id;
      const msg = res?.message || `Loan ${res?.data?.loan?.loanAccountNumber} disbursed!`;
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      navigate(loanId ? `/loans/${loanId}` : '/loans');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to disburse loan');
    },
  });

  const handleCustomerSelect = useCallback((c: any) => {
    if (c.kycStatus !== 'kyc_verified') {
      toast.error(`Customer KYC is ${c.kycStatus.replace(/_/g, ' ')}. KYC verification required before loan.`);
      return;
    }
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setStep(2);
  }, []);

  const handlePlanSelect = useCallback((p: any) => {
    setSelectedPlan(p);
    setStep(3);
  }, []);

  const progressPct = (step / 4) * 100;

  return (
    <div className="animate-fade-in animate-slide-up max-w-2xl mx-auto">
      {/* Header */}
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/loans')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">New Loan Disbursement</h1>
          <p className="page-subtitle">Complete all steps to disburse a loan</p>
        </div>
      </div>

      {/* Step Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {['Customer', 'Loan Plan', 'Amount', 'Confirm & Disburse'].map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step > i + 1 ? 'bg-emerald-500 text-white' :
                step === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}>{step > i + 1 ? '✓' : i + 1}</span>
              <span className={`text-xs hidden sm:block ${step === i + 1 ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                {label}
              </span>
              {i < 3 && <div className={`h-px w-4 sm:w-12 ${step > i + 1 ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-5">

          {/* STEP 1 — Customer selection */}
          <div className={`transition-all ${step < 1 ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold text-slate-800">Customer</span>
              {selectedCustomer && <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />}
            </div>

            {selectedCustomer && kycInfo ? (
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
                  <button onClick={() => { setSelectedCustomer(null); setSelectedPlan(null); setPrincipalInput(''); setShowPreview(false); setStep(1); }} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm border p-1 rounded-md">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search by name, phone or code..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {searchingCustomers && <p className="text-xs text-slate-400 mt-1">Searching...</p>}
                {customerSearch.length >= 2 && customers.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    {customers.map((c: any) => (
                      <button
                        key={c._id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
                        onClick={() => handleCustomerSelect(c)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{c.name}</p>
                            <p className="text-xs text-slate-400">{c.customerCode} · {c.phone}</p>
                          </div>
                          {c.kycStatus === 'kyc_verified' ? (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">KYC ✓</span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              {c.kycStatus.replace(/_/g,' ')}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {customerSearch.length >= 2 && !searchingCustomers && customers.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">No matching customers found.</p>
                )}
              </div>
            )}
          </div>

          {/* STEP 2 — Loan Plan */}
          {step >= 2 && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-800">Loan Plan</span>
                {selectedPlan && <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />}
              </div>
              {selectedPlan ? (
                <div className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-blue-900">{selectedPlan.planName}</p>
                    <p className="text-sm text-blue-700">
                      {(selectedPlan.baseInterestRateBps / 100).toFixed(1)}% flat · {selectedPlan.durationMonths} months
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Range: {formatCurrency(selectedPlan.minLoanAmountInPaise)} – {formatCurrency(selectedPlan.maxLoanAmountInPaise)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => { setSelectedPlan(null); setPrincipalInput(''); setShowPreview(false); setStep(2); }}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {plans.length === 0 && <p className="text-sm text-slate-400">Loading plans...</p>}
                  {plans.map((p: any) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => handlePlanSelect(p)}
                      className="w-full text-left p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{p.planName}</p>
                          <p className="text-xs text-slate-500">{(p.baseInterestRateBps / 100).toFixed(1)}% flat · {p.durationMonths} months</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Min: {formatCurrency(p.minLoanAmountInPaise)}</p>
                          <p className="text-xs text-slate-500">Max: {formatCurrency(p.maxLoanAmountInPaise)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Principal Amount */}
          {step >= 3 && (
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-800">Principal Amount</span>
              </div>
              <div className="flex gap-3">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder={`Min ₹${selectedPlan ? (selectedPlan.minLoanAmountInPaise / 100).toFixed(0) : 0}`}
                  value={principalInput}
                  onChange={(e) => { setPrincipalInput(e.target.value); setShowPreview(false); }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  disabled={!canPreview || previewLoading}
                  isLoading={previewLoading}
                >
                  <Eye className="h-4 w-4 mr-1.5" />
                  Preview
                </Button>
              </div>
              {principalInput && selectedPlan && principalPaise < selectedPlan.minLoanAmountInPaise && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Minimum for this plan is {formatCurrency(selectedPlan.minLoanAmountInPaise)}
                </p>
              )}
              {principalInput && selectedPlan && principalPaise > selectedPlan.maxLoanAmountInPaise && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Maximum for this plan is {formatCurrency(selectedPlan.maxLoanAmountInPaise)}
                </p>
              )}
              {previewError && (
                <p className="text-xs text-red-500 mt-1">Preview failed. Check amount range.</p>
              )}

              {/* Preview Result */}
              {preview && showPreview && (
                <div className="mt-4 border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Loan Breakdown Preview
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/70 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(preview.principalAmountInPaise)}</p>
                      <p className="text-xs text-slate-500">Principal</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-emerald-700">{formatCurrency(preview.netDisbursalInPaise)}</p>
                      <p className="text-xs text-slate-500">Net Disbursal</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3 text-center">
                      <p className="text-base font-bold text-amber-700">{formatCurrency(preview.interestInPaise)}</p>
                      <p className="text-xs text-slate-500">Upfront Interest ({preview.annualRatePct}%)</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3 text-center">
                      <p className="text-base font-bold text-slate-600">{formatCurrency(preview.processingFeeInPaise)}</p>
                      <p className="text-xs text-slate-500">Processing Fee ({preview.processingFeePct}%)</p>
                    </div>
                  </div>
                  {preview.dailyRequiredDepositInPaise && (
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-blue-900">Recommended Daily Pigmy</p>
                        <p className="text-xs text-blue-700">Set this in the customer's pigmy account to ensure full repayment by maturity ({previewPlan?.durationMonths * 30} days).</p>
                      </div>
                      <p className="text-lg font-bold text-blue-800 shrink-0">{formatCurrency(preview.dailyRequiredDepositInPaise)} <span className="text-xs font-normal">/ day</span></p>
                    </div>
                  )}
                  <p className="text-xs text-emerald-700 mt-3 text-center font-medium">
                    {previewPlan?.durationMonths}-month flat-rate loan · Full repaid via daily pigmy collections
                  </p>
                  {step < 4 && <Button className="w-full mt-3" onClick={() => setStep(4)}>Continue to Confirm →</Button>}
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Final Confirmation */}
          {step >= 4 && preview && (
            <div className="border-t border-slate-100 pt-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Final Confirmation Required</p>
                <p className="text-xs text-amber-700">
                  Disbursing ₹{(preview.netDisbursalInPaise / 100).toFixed(2)} to <strong>{selectedCustomer?.name}</strong>.
                  This action will create a loan account and deduct fees from the linked saving account.
                  This action <strong>cannot be undone</strong>.
                </p>
              </div>
              <Button
                className="w-full h-12 text-base font-semibold"
                isLoading={createMutation.isPending}
                disabled={!selectedCustomer || !selectedPlan || !preview || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <Banknote className="h-5 w-5 mr-2" />
                Disburse {formatCurrency(preview.netDisbursalInPaise)} to {selectedCustomer?.name}
              </Button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between">
          <Button variant="ghost" onClick={() => navigate('/loans')}>Cancel</Button>
          {step < 4 && step >= 3 && principalInput && !showPreview && (
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!canPreview}
              isLoading={previewLoading}
            >
              <Eye className="h-4 w-4 mr-1.5" /> Preview Terms
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
