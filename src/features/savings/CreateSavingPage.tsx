// src/features/savings/CreateSavingPage.tsx
// Industry-standard saving account opening flow:
//  1. Search and select a KYC-verified customer
//  2. Full customer detail panel is shown after selection
//  3. Admin reviews and clicks "Open Account"
//  4. Confirmation dialog shows the exact opening charge from AppConfig
//  5. On confirm → API call → navigate to new account detail page
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Wallet, AlertTriangle, CheckCircle2,
  X, User, Phone, Hash, FileText, ShieldCheck,
  ShieldX, ShieldAlert, Clock, IndianRupee, Eye,
} from 'lucide-react';
import { savingApi } from '../../api/saving.api';
import { customerApi } from '../../api/customer.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useDebounce } from '../../hooks/useDebounce';
import { formatCurrency } from '../../utils/format';
import type { Customer } from '../../types';

// ── KYC status metadata ────────────────────────────────────────────────────────
const KYC_META: Record<string, { label: string; color: string; icon: React.ReactNode; canOpen: boolean; hint: string }> = {
  kyc_verified: {
    label: 'KYC Verified',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
    canOpen: true,
    hint: 'This customer is KYC-verified and eligible to open a saving account.',
  },
  documents_submitted: {
    label: 'Documents Submitted',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: <ShieldAlert className="h-4 w-4 text-amber-600" />,
    canOpen: false,
    hint: 'KYC documents are under admin review. Account cannot be opened yet.',
  },
  phone_verified: {
    label: 'Phone Verified',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    icon: <ShieldAlert className="h-4 w-4 text-blue-600" />,
    canOpen: false,
    hint: 'Customer must submit Aadhaar and PAN documents before opening an account.',
  },
  pending: {
    label: 'KYC Pending',
    color: 'text-slate-600 bg-slate-50 border-slate-200',
    icon: <Clock className="h-4 w-4 text-slate-500" />,
    canOpen: false,
    hint: 'Customer must complete phone OTP verification first.',
  },
  kyc_rejected: {
    label: 'KYC Rejected',
    color: 'text-red-700 bg-red-50 border-red-200',
    icon: <ShieldX className="h-4 w-4 text-red-600" />,
    canOpen: false,
    hint: 'KYC was rejected. Customer must resubmit correct documents.',
  },
};

const getKycMeta = (status: string) =>
  KYC_META[status] ?? KYC_META['pending'];

// ── KYC document status chip ───────────────────────────────────────────────────
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

// ── Confirmation Modal ─────────────────────────────────────────────────────────
interface ConfirmModalProps {
  customer: Customer;
  openingChargeInPaise: number;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function OpenAccountConfirmModal({ customer, openingChargeInPaise, isLoading, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-100">
            <Wallet className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Confirm Account Opening</h3>
            <p className="text-sm text-slate-500">Review the details before confirming</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Customer</span>
            <span className="font-semibold text-slate-900">{customer.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Customer Code</span>
            <span className="font-mono text-slate-700">{customer.customerCode}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Phone</span>
            <span className="text-slate-700">{customer.phone}</span>
          </div>
          <div className="border-t border-slate-200 my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Account Type</span>
            <span className="font-medium text-slate-900">Saving Account</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Opening Charge</span>
            <div className="flex items-center gap-1">
              <IndianRupee className="h-4 w-4 text-amber-600" />
              <span className="font-bold text-amber-700 text-base">
                {openingChargeInPaise > 0
                  ? `${(openingChargeInPaise / 100).toFixed(0)} (collected as cash)`
                  : 'Free'}
              </span>
            </div>
          </div>
        </div>

        {openingChargeInPaise > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>{formatCurrency(openingChargeInPaise)}</strong> will be collected from the customer in cash
              and recorded as a deposit then deducted as the opening charge fee.
              Ensure you have received this amount before confirming.
            </span>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} isLoading={isLoading}>
            <Wallet className="h-4 w-4 mr-2" />
            Confirm & Open Account
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CreateSavingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [rawSearch, setRawSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const customerSearch = useDebounce(rawSearch, 400);

  // Search customers
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => customerApi.list({ page: 1, limit: 10, search: customerSearch }),
    enabled: customerSearch.length >= 2 && !selectedCustomer,
  });
  const customers: Customer[] = (searchData?.data?.customers as Customer[]) ?? [];

  // Fetch full customer detail once selected
  const { data: customerDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['customer-detail', selectedCustomer?._id],
    queryFn: () => customerApi.getCustomer(selectedCustomer!._id),
    enabled: !!selectedCustomer?._id,
  });
  const fullCustomer: Customer | undefined = customerDetail?.data?.customer ?? selectedCustomer ?? undefined;

  // Fetch opening charge from backend config
  const { data: chargeData } = useQuery({
    queryKey: ['saving-opening-charge'],
    queryFn: () => savingApi.getOpeningCharge(),
    staleTime: 5 * 60 * 1000, // cache 5 min — config rarely changes
  });
  const openingChargeInPaise = chargeData?.data?.openingChargeInPaise ?? 0;

  const kycMeta = selectedCustomer ? getKycMeta(selectedCustomer.kycStatus) : null;

  // Fetch existing saving accounts for selected customer
  const { data: existingAccountsData } = useQuery({
    queryKey: ['customer-savings', selectedCustomer?._id],
    queryFn: () => savingApi.getByCustomer(selectedCustomer!._id),
    enabled: !!selectedCustomer?._id,
  });
  const existingAccounts: any[] = (existingAccountsData?.data as any) ?? [];
  const hasActiveAccount = existingAccounts.some((a) => a.status === 'active');

  const createMutation = useMutation({
    mutationFn: () => savingApi.create({ customerId: selectedCustomer!._id }),
    onSuccess: (res) => {
      toast.success('Saving account opened successfully!');
      queryClient.invalidateQueries({ queryKey: ['savings'] });
      queryClient.invalidateQueries({ queryKey: ['customer-savings', selectedCustomer?._id] });
      const accountNumber = res.data?.account?.accountNumber;
      navigate(accountNumber ? `/savings/${accountNumber}` : '/savings');
    },
    onError: (err: any) => {
      setShowConfirm(false);
      toast.error(err?.response?.data?.message || 'Failed to open saving account');
    },
  });

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setRawSearch('');
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setRawSearch('');
  };

  const docs = (fullCustomer as any)?.kycDocuments;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/savings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Open Saving Account</h1>
            <p className="page-subtitle">Customer must be KYC-verified · Business day must be open</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Step 1 — Search & Select Customer */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              Step 1 — Select Customer
            </h2>
          </div>
          <div className="card-body space-y-3">
            {!selectedCustomer && (
              <div>
                <label className="form-label">Search Customer</label>
                <Input
                  placeholder="Type customer name, phone, or code (min 2 chars)..."
                  value={rawSearch}
                  onChange={(e) => setRawSearch(e.target.value)}
                  autoFocus
                />
                {searchLoading && <p className="text-sm text-slate-500 mt-1">Searching...</p>}
              </div>
            )}

            {/* Search results dropdown */}
            {customerSearch.length >= 2 && customers.length > 0 && !selectedCustomer && (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto shadow-sm">
                {customers.map((c) => {
                  const meta = getKycMeta(c.kycStatus);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3"
                      onClick={() => handleSelectCustomer(c)}
                    >
                      <div>
                        <p className="font-medium text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.customerCode} · {c.phone}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border shrink-0 ${meta.color}`}>
                        {meta.icon && <span className="inline mr-1">{meta.icon}</span>}
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {customerSearch.length >= 2 && !searchLoading && customers.length === 0 && !selectedCustomer && (
              <p className="text-sm text-slate-500">No customers found for "{customerSearch}".</p>
            )}

            {/* Selected customer badge */}
            {selectedCustomer && kycMeta && (
              <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${kycMeta.canOpen ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  {kycMeta.icon}
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{selectedCustomer.name}</p>
                    <p className="text-xs text-slate-500">{selectedCustomer.customerCode} · {selectedCustomer.phone}</p>
                  </div>
                </div>
                <button
                  onClick={handleClearCustomer}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-white/60"
                  title="Select a different customer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step 2 — Customer Detail Panel (shown after selection) */}
        {selectedCustomer && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Step 2 — Review Customer Details
              </h2>
            </div>
            <div className="card-body space-y-4">
              {detailLoading ? (
                <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  Loading customer details...
                </div>
              ) : (
                <>
                  {/* Customer Info */}
                  <div className="flex items-start gap-4">
                    {docs?.photo?.url ? (
                      <img
                        src={docs.photo.url}
                        alt={fullCustomer?.name}
                        className="h-16 w-16 rounded-xl object-cover border-2 border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0">
                        <User className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/customers/${fullCustomer?._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-base leading-tight block truncate"
                      >
                        {fullCustomer?.name}
                      </Link>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{fullCustomer?.customerCode}</span>
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{fullCustomer?.phone}</span>
                      </div>
                      <div className="mt-2">
                        {kycMeta && (
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${kycMeta.color}`}>
                            {kycMeta.icon} {kycMeta.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KYC documents checklist */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">KYC Documents</p>
                    <div className="flex flex-wrap gap-2">
                      <DocChip label="Aadhaar" present={!!docs?.aadhar?.url} url={docs?.aadhar?.url} />
                      <DocChip label="PAN" present={!!docs?.pan?.url} url={docs?.pan?.url} />
                      <DocChip label="Photo" present={!!docs?.photo?.url} url={docs?.photo?.url} />
                      <DocChip label="Signature" present={!!docs?.signature?.url} url={docs?.signature?.url} />
                    </div>
                  </div>

                  {/* KYC status hint */}
                  <div className={`text-sm rounded-xl border px-3 py-2.5 flex items-start gap-2
                    ${kycMeta?.canOpen ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    {kycMeta?.canOpen
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                    {kycMeta?.hint}
                  </div>

                  {/* Existing accounts warning */}
                  {existingAccounts.length > 0 && (
                    <div className={`text-sm rounded-xl border px-3 py-2.5 flex items-start gap-2
                      ${hasActiveAccount ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        {hasActiveAccount
                          ? `This customer already has an ACTIVE saving account. The server will reject this request.`
                          : `This customer has ${existingAccounts.length} prior saving account(s) — all closed.`}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Opening Charge Summary + Action */}
        {selectedCustomer && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-slate-400" />
                Step 3 — Opening Charge
              </h2>
            </div>
            <div className="card-body">
              <div className="flex items-center justify-between py-2 px-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <p className="text-sm text-slate-600">Configured opening charge</p>
                  <p className="text-xs text-slate-400">Set by admin in AppConfig · collected as cash at counter</p>
                </div>
                <span className="text-2xl font-bold text-amber-600">
                  {openingChargeInPaise > 0 ? formatCurrency(openingChargeInPaise) : 'Free'}
                </span>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => navigate('/savings')}>Cancel</Button>
              <Button
                disabled={!kycMeta?.canOpen || hasActiveAccount || detailLoading}
                onClick={() => setShowConfirm(true)}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Open Account
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && selectedCustomer && (
        <OpenAccountConfirmModal
          customer={selectedCustomer}
          openingChargeInPaise={openingChargeInPaise}
          isLoading={createMutation.isPending}
          onConfirm={() => createMutation.mutate()}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
