// src/features/customers/CustomerDetailPage.tsx
// BACKEND FLOW:
//   Create -> status:pending (OTP sent)
//   Verify OTP -> status:phone_verified
//   Submit KYC Docs (requires phoneVerified) -> status:documents_submitted
//   Admin Approve -> status:kyc_verified
//   Admin Reject -> status:kyc_rejected (can resubmit)
import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Pencil,
  ShieldCheck,
  ShieldX,
  Phone,
  UserCog,
  Send,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  FileUp,
  X,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { customerApi } from '../../api/customer.api';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DetailRow } from '../../components/shared/DetailRow';
import { OtpInputDialog } from '../../components/shared/OtpInputDialog';
import { KycSubmitModal } from '../../components/shared/KycSubmitModal';
import { PiiRevealRow } from '../../components/shared/PiiRevealRow';
import { formatDate, formatPhone } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { AgentProfile, Customer, KycStatus } from '../../types';

// -- KYC Status Step Indicator -------------------------------------------------
function KycStatusSteps({ status }: { status: KycStatus }) {
  const steps = [
    { key: 'pending', label: 'Created', icon: Clock },
    { key: 'phone_verified', label: 'Phone Verified', icon: Phone },
    { key: 'documents_submitted', label: 'Docs Submitted', icon: FileText },
    { key: 'kyc_verified', label: 'KYC Approved', icon: CheckCircle2 },
  ];

  const statusOrder: Record<KycStatus, number> = {
    pending: 0,
    phone_verified: 1,
    documents_submitted: 2,
    kyc_verified: 3,
    kyc_rejected: 2, // maps to docs_submitted step visually
  };

  const currentStep = statusOrder[status] ?? 0;
  const isRejected = status === 'kyc_rejected';

  return (
    <div className="flex items-center gap-0 mb-4">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const done = idx < currentStep;
        const active = idx === currentStep && !isRejected;
        const rejected = isRejected && idx === 2;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className={`flex flex-col items-center gap-1`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                ${done ? 'bg-emerald-500 border-emerald-500 text-white' :
                  rejected ? 'bg-red-500 border-red-500 text-white' :
                    active ? 'bg-blue-600 border-blue-600 text-white' :
                      'bg-slate-100 border-slate-300 text-slate-400'}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> :
                  rejected ? <XCircle className="h-4 w-4" /> :
                    <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] text-center leading-tight font-medium
                ${done ? 'text-emerald-600' :
                  rejected ? 'text-red-500' :
                    active ? 'text-blue-600' :
                      'text-slate-400'}`}>
                {rejected ? 'Rejected' : step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 mx-1 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// -- Document Viewer Modal ------------------------------------------------------
function DocViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('/pdf');
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        {isPdf ? (
          <iframe
            src={url}
            className="w-full h-[85vh] rounded-xl bg-white shadow-2xl"
            title="Document Viewer"
          />
        ) : (
          <img
            src={url}
            alt="Document"
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
          />
        )}
        <p className="mt-3 text-white/70 text-xs">Click outside or ✕ to close</p>
      </div>
    </div>
  );
}

function useOtpCooldown(initialSeconds = 60) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setSeconds(initialSeconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [initialSeconds]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { seconds, canResend: seconds === 0, startCooldown };
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // -- Role-based access -----------------------------------------------------
  const user = useAuthStore((s) => s.user);
  const isAdminOrAbove = user?.role === 'admin' || user?.role === 'superadmin';
  const canManageKyc = isAdminOrAbove; // MANAGE_CUSTOMER_KYC
  const canAssignAgent = isAdminOrAbove; // ASSIGN_AGENT
  const canEditDelete = isAdminOrAbove; // UPDATE_CUSTOMER / DELETE_CUSTOMER

  // -- Dialog visibility -----------------------------------------------------
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [showKycSubmitDialog, setShowKycSubmitDialog] = useState(false);
  const [showKycAdminDialog, setShowKycAdminDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [docViewerUrl, setDocViewerUrl] = useState<string | null>(null);

  // -- OTP state -------------------------------------------------------------
  const [otpValue, setOtpValue] = useState('');
  const { seconds: otpCooldown, canResend, startCooldown } = useOtpCooldown(60);

  // -- KYC admin action state -------------------------------------------------
  const [kycAction, setKycAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // -- Agent assignment state -------------------------------------------------
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // -- Phone change state (2-step OTP) --------------------------------------
  const [showPhoneChangeDialog, setShowPhoneChangeDialog] = useState(false);
  const [phoneChangeStep, setPhoneChangeStep] = useState<1 | 2>(1);
  const [newPhone, setNewPhone] = useState('');
  const [phoneChangeOtp, setPhoneChangeOtp] = useState('');
  const [pendingMaskedPhone, setPendingMaskedPhone] = useState('');
  const { seconds: phoneCooldown, canResend: canPhoneResend, startCooldown: startPhoneCooldown } = useOtpCooldown(60);

  // -- Delete password confirmation -----------------------------------------
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordVisible, setDeletePasswordVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // -------------------------------------------------------------------------
  // QUERIES
  // -------------------------------------------------------------------------
  const { data, isLoading, isError } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getCustomer(id!),
    enabled: !!id,
  });
  const customer = data?.data?.customer as Customer | undefined;

  const { data: agentsData } = useQuery({
    queryKey: ['agents', 'for-assignment'],
    queryFn: () => agentApi.list({ limit: 100, isActive: 'true', kycStatus: 'kyc_verified' }),
    enabled: showAssignDialog,
  });
  const agents: AgentProfile[] = (agentsData?.data as any)?.agents || [];

  // -------------------------------------------------------------------------
  // MUTATIONS
  // -------------------------------------------------------------------------

  // Resend OTP - FIX: sends OTP first, then opens dialog + starts cooldown
  const resendOtpMutation = useMutation({
    mutationFn: () => customerApi.resendOtp(id!),
    onSuccess: (res) => {
      toast.success(res.message || 'OTP sent to customer phone');
      startCooldown();
      setShowOtpDialog(true); // Open dialog only after OTP is successfully sent
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send OTP'),
  });

  // Verify OTP
  const verifyOtpMutation = useMutation({
    mutationFn: () => customerApi.verifyOtp(id!, otpValue),
    onSuccess: (res) => {
      toast.success(res.message || 'Phone verified successfully!');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setShowOtpDialog(false);
      setOtpValue('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'OTP verification failed'),
  });

  // Submit KYC Documents (multipart/form-data)
  const submitKycMutation = useMutation({
    mutationFn: (data: any) => {
      const fd = new FormData();
      fd.append('aadharRaw', data.aadhaarNumber);
      fd.append('panRaw', data.panNumber);
      if (data.aadhaarFront) fd.append('aadhaarFront', data.aadhaarFront);
      if (data.aadhaarBack) fd.append('aadhaarBack', data.aadhaarBack);
      if (data.panCard) fd.append('panCard', data.panCard);
      if (data.photo) fd.append('photo', data.photo);
      if (data.signatureOrAgreement) fd.append('signature', data.signatureOrAgreement);
      return customerApi.submitKyc(id!, fd);
    },
    onSuccess: (res) => {
      toast.success(res.message || 'KYC documents submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setShowKycSubmitDialog(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'KYC submission failed'),
  });

  // Admin: Approve / Reject KYC
  const kycAdminMutation = useMutation({
    mutationFn: () => {
      if (kycAction === 'approve') return customerApi.verifyKyc(id!);
      return customerApi.rejectKyc(id!, rejectReason);
    },
    onSuccess: (res) => {
      toast.success(res.message || 'KYC action completed');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'kyc-pending'] });
      setShowKycAdminDialog(false);
      setRejectReason('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Action failed'),
  });

  // Assign Agent
  const assignMutation = useMutation({
    mutationFn: () => customerApi.assignAgent(id!, selectedAgentId),
    onSuccess: () => {
      toast.success('Agent assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setShowAssignDialog(false);
      setSelectedAgentId('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Assignment failed'),
  });

  // Delete Customer (password-protected)
  const deleteMutation = useMutation({
    mutationFn: () => customerApi.deleteCustomer(id!, deletePassword, deleteReason),
    onSuccess: () => {
      toast.success('Customer deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
    onSettled: () => {
       setDeletePassword('');
       setDeleteReason('');
    },
  });

  // Phone Change - Step 1: Request OTP to new number
  const requestPhoneChangeMutation = useMutation({
    mutationFn: () => customerApi.requestPhoneChange(id!, newPhone),
    onSuccess: (res) => {
      const masked = res.data?.pendingPhone || newPhone.replace(/.(?=.{4})/g, '*');
      setPendingMaskedPhone(masked);
      setPhoneChangeStep(2);
      startPhoneCooldown();
      toast.success(res.message || `OTP sent to ${masked}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send OTP'),
  });

  // Phone Change - Step 2: Verify OTP and commit
  const verifyPhoneChangeMutation = useMutation({
    mutationFn: () => customerApi.verifyPhoneChange(id!, phoneChangeOtp),
    onSuccess: (res) => {
      toast.success(res.message || 'Phone number changed successfully!');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowPhoneChangeDialog(false);
      setPhoneChangeStep(1);
      setNewPhone('');
      setPhoneChangeOtp('');
      setPendingMaskedPhone('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'OTP verification failed'),
  });

  // -------------------------------------------------------------------------
  // LOADING / ERROR
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">Failed to load customer details.</p>
        <Button variant="outline" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Customers
        </Button>
      </div>
    );
  }

  const docs = customer.kycDocuments;
  const hasPhoto = !!docs?.photo?.url;
  const hasSign = !!docs?.signature?.url;

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="animate-fade-in space-y-6">
      {/* -- Header ----------------------------------------------------------- */}
      <div className="page-header flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Avatar - always show from photo if available */}
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              {hasPhoto ? (
                <img
                  src={docs!.photo!.url!}
                  alt={customer.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setDocViewerUrl(docs!.photo!.url!)}
                  title="Click to enlarge"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-2 border-slate-200">
                  <span className="text-2xl font-bold text-blue-600">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="page-title">{customer.name}</h1>
                <StatusBadge status={customer.isActive ? 'active' : 'inactive'} />
              </div>
              <p className="page-subtitle mt-0.5">
                {customer.customerCode} · {formatPhone(customer.phone)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {customer.phoneVerified ? '✓ Phone verified' : '✗ Phone not verified'}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons - role gated */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEditDelete && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          )}
          {canEditDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPhoneChangeStep(1);
                setNewPhone('');
                setPhoneChangeOtp('');
                setPendingMaskedPhone('');
                setShowPhoneChangeDialog(true);
              }}
            >
              <Phone className="h-4 w-4 mr-1.5" /> Change Phone
            </Button>
          )}
          {canAssignAgent && (
            <Button variant="outline" size="sm" onClick={() => setShowAssignDialog(true)}>
              <UserCog className="h-4 w-4 mr-1.5" /> {customer.assignedAgent ? 'Change Agent' : 'Assign Agent'}
            </Button>
          )}
          {/* OTP buttons - send OTP first, then verify */}
          {!customer.phoneVerified && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resendOtpMutation.mutate()}
                isLoading={resendOtpMutation.isPending}
              >
                <Phone className="h-4 w-4 mr-1.5" /> Send OTP
              </Button>
              <Button variant="default" size="sm" onClick={() => setShowOtpDialog(true)}>
                <ShieldCheck className="h-4 w-4 mr-1.5" /> Verify OTP
              </Button>
            </>
          )}
          {canEditDelete && (
            <Button variant="destructive" size="sm" onClick={() => { setDeletePassword(''); setShowDeleteDialog(true); }}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* -- Main Grid -------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* -- LEFT: Personal Info ------------------------------------------- */}
        <div className="lg:col-span-2 space-y-6">

          {/* Personal Information */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Personal Information</h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Full Name" value={customer.name} />
                <DetailRow label="Customer Code" value={customer.customerCode} />
                <DetailRow label="Phone" value={formatPhone(customer.phone)} />
                <DetailRow
                  label="Phone Status"
                  value={
                    customer.phoneVerified
                      ? <span className="text-emerald-600 font-medium">✓ Verified</span>
                      : <span className="text-amber-600 font-medium">✗ Not Verified</span>
                  }
                />
                <DetailRow label="Alternate Phone" value={formatPhone(customer.alternatePhone)} />
                <DetailRow
                  label="SMS Alerts"
                  value={
                    customer.smsEnabled !== false
                      ? <span className="text-emerald-600 font-medium">Enabled</span>
                      : <span className="text-slate-400">Disabled</span>
                  }
                />
                <DetailRow label="Member Since" value={formatDate(customer.createdAt)} />
              </dl>
            </div>
          </div>

          {/* Address */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Address</h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Address" value={customer.address} />
                <DetailRow label="City" value={customer.city} />
                <DetailRow label="Pincode" value={customer.pincode} />
              </dl>
            </div>
          </div>

          {/* Nominee */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Nominee</h2>
            </div>
            <div className="card-body">
              <dl>
                <DetailRow label="Nominee Name" value={customer.nomineeName} />
                <DetailRow label="Relationship" value={customer.nomineeRelation} />
              </dl>
            </div>
          </div>

          {/* Photo & Signature - always visible when available */}
          {(hasPhoto || hasSign) && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-slate-900">Photo & Signature</h2>
              </div>
              <div className="card-body">
                <div className="flex gap-6 flex-wrap">
                  {hasPhoto && (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={docs!.photo!.url!}
                        alt="Customer Photo"
                        className="w-28 h-36 object-cover rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setDocViewerUrl(docs!.photo!.url!)}
                      />
                      <span className="text-xs font-medium text-slate-500">Photo</span>
                      <Button variant="outline" size="sm" onClick={() => setDocViewerUrl(docs!.photo!.url!)}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                    </div>
                  )}
                  {hasSign && (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={docs!.signature!.url!}
                        alt="Customer Signature"
                        className="w-40 h-24 object-contain rounded-lg border border-slate-200 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow p-2"
                        onClick={() => setDocViewerUrl(docs!.signature!.url!)}
                      />
                      <span className="text-xs font-medium text-slate-500">Signature</span>
                      <Button variant="outline" size="sm" onClick={() => setDocViewerUrl(docs!.signature!.url!)}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* -- RIGHT: KYC & Agent    */}
        <div className="space-y-6">

          {/* KYC Status Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">KYC Status</h2>
              <StatusBadge status={customer.kycStatus} />
            </div>
            <div className="card-body space-y-4">
              {/* Step Indicator */}
              <KycStatusSteps status={customer.kycStatus} />

              {/* Masked PII - with decrypt option for admin/superadmin */}
              <dl>
                <PiiRevealRow
                  label="Aadhaar"
                  masked={customer.aadharMasked}
                  fetchFn={() => customerApi.getDecryptedAadhar(id!) as any}
                  isAdminOrAbove={isAdminOrAbove}
                />
                <PiiRevealRow
                  label="PAN"
                  masked={customer.panMasked}
                  fetchFn={() => customerApi.getDecryptedPan(id!) as any}
                  isAdminOrAbove={isAdminOrAbove}
                />
                {customer.kycSubmittedAt && (
                  <DetailRow label="Submitted" value={formatDate(customer.kycSubmittedAt)} />
                )}
                {customer.kycVerifiedAt && (
                  <DetailRow label="Verified" value={formatDate(customer.kycVerifiedAt)} />
                )}
                {customer.kycVerifiedBy && (
                  <DetailRow label="Verified By" value={customer.kycVerifiedBy.name} />
                )}
                {customer.kycRejectedReason && (
                  <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-600 mb-1">Rejection Reason:</p>
                    <p className="text-xs text-red-700">{customer.kycRejectedReason}</p>
                  </div>
                )}
              </dl>

              {/* PII audit notice for admin */}
              {isAdminOrAbove && (customer.aadharMasked || customer.panMasked) && (
                <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700">
                    Viewing decrypted PII is audited and logged per compliance policy.
                  </p>
                </div>
              )}

              {/* KYC Document Buttons (click to view) */}
              {docs && (docs.aadhaarFront?.url || docs.aadhaarBack?.url || docs.panCard?.url) && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">View Documents</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {docs.aadhaarFront?.url && (
                      <button
                        onClick={() => setDocViewerUrl(docs.aadhaarFront!.url!)}
                        className="flex items-center gap-2 text-sm text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-colors"
                      >
                        <Eye className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="text-slate-700">Aadhaar Front</span>
                      </button>
                    )}
                    {docs.aadhaarBack?.url && (
                      <button
                        onClick={() => setDocViewerUrl(docs.aadhaarBack!.url!)}
                        className="flex items-center gap-2 text-sm text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-colors"
                      >
                        <Eye className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="text-slate-700">Aadhaar Back</span>
                      </button>
                    )}
                    {docs.panCard?.url && (
                      <button
                        onClick={() => setDocViewerUrl(docs.panCard!.url!)}
                        className="flex items-center gap-2 text-sm text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-colors"
                      >
                        <Eye className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="text-slate-700">PAN Card</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons based on KYC status - role gated */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                {/* Step 2: Phone verified -> Show Submit KYC Docs */}
                {(customer.kycStatus === 'phone_verified' || customer.kycStatus === 'kyc_rejected') && (
                  <Button className="w-full" onClick={() => setShowKycSubmitDialog(true)}>
                    <FileUp className="h-4 w-4 mr-1.5" />
                    {customer.kycStatus === 'kyc_rejected' ? 'Resubmit KYC Documents' : 'Submit KYC Documents'}
                  </Button>
                )}

                {/* Step 3: Documents submitted -> Admin can Approve or Reject */}
                {customer.kycStatus === 'documents_submitted' && canManageKyc && (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => { setKycAction('approve'); setShowKycAdminDialog(true); }}
                    >
                      <ShieldCheck className="h-4 w-4 mr-1.5" /> Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => { setKycAction('reject'); setShowKycAdminDialog(true); }}
                    >
                      <ShieldX className="h-4 w-4 mr-1.5" /> Reject
                    </Button>
                  </div>
                )}

                {/* Pending review message for non-admin */}
                {customer.kycStatus === 'documents_submitted' && !canManageKyc && (
                  <p className="text-xs text-center text-slate-400 py-1">KYC under admin review</p>
                )}

                {customer.kycStatus === 'kyc_verified' && (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium justify-center py-1">
                    <CheckCircle2 className="h-4 w-4" /> KYC Fully Verified
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Agent */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Assigned Agent</h2>
            </div>
            <div className="card-body">
              {customer.assignedAgent ? (
                <dl>
                  <DetailRow label="Name" value={customer.assignedAgent.name} />
                  <DetailRow label="Code" value={customer.assignedAgent.agentCode} />
                  {customer.assignedAgent.phone && (
                    <DetailRow label="Phone" value={formatPhone(customer.assignedAgent.phone)} />
                  )}
                </dl>
              ) : (
                <p className="text-sm text-slate-400">No agent assigned</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  */}
      {/* MODALS                                                               */}
      {/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  */}

      {/* ── OTP Verify Dialog (shared component) ───────────────────────── */}
      <OtpInputDialog
        open={showOtpDialog}
        onClose={() => { setShowOtpDialog(false); setOtpValue(''); }}
        title="Verify Phone OTP"
        subtitle={`Enter the 6-digit OTP sent to ${formatPhone(customer.phone)}`}
        onVerify={(otp) => { setOtpValue(otp); setTimeout(() => verifyOtpMutation.mutate(), 0); }}
        onResend={() => resendOtpMutation.mutate()}
        isVerifyLoading={verifyOtpMutation.isPending}
        isResendLoading={resendOtpMutation.isPending}
        initialCooldown={60}
      />

      {/* ── KYC Document Submit Dialog ───────────────────────────────────── */}
      <KycSubmitModal
        open={showKycSubmitDialog}
        onClose={() => setShowKycSubmitDialog(false)}
        entityType="customer"
        entityName={customer.name}
        isResubmit={customer.kycStatus === 'kyc_rejected'}
        isLoading={submitKycMutation.isPending}
        onSubmit={(data) => submitKycMutation.mutate(data)}
      />

      {/*  KYC Admin Action Dialog (Approve / Reject)  */}
      {showKycAdminDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {kycAction === 'approve' ? 'Approve KYC' : 'Reject KYC'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {kycAction === 'approve'
                ? 'Confirm all submitted documents are valid. The customer will be notified via SMS.'
                : 'Provide a clear rejection reason. The customer must resubmit correct documents.'}
            </p>
            {kycAction === 'reject' && (
              <div className="mb-4">
                <label className="form-label">Rejection Reason <span className="text-red-500">*</span></label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Min 10 characters - explain what was wrong"
                  rows={3}
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                disabled={kycAdminMutation.isPending}
                onClick={() => { setShowKycAdminDialog(false); setRejectReason(''); }}
              >
                Cancel
              </Button>
              <Button
                variant={kycAction === 'reject' ? 'destructive' : 'default'}
                isLoading={kycAdminMutation.isPending}
                onClick={() => {
                  if (kycAction === 'reject' && rejectReason.trim().length < 10) {
                    toast.error('Rejection reason must be at least 10 characters'); return;
                  }
                  kycAdminMutation.mutate();
                }}
              >
                {kycAction === 'approve' ? (
                  <><ShieldCheck className="h-4 w-4 mr-1.5" /> Approve KYC</>
                ) : (
                  <><ShieldX className="h-4 w-4 mr-1.5" /> Reject KYC</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* -- Assign Agent Dialog ---------------------------------------------- */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{customer.assignedAgent ? 'Change Agent' : 'Assign Agent'}</h3>
            <p className="text-sm text-slate-500 mb-4">Select an active agent to assign to this customer.</p>
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg mb-4">
              {agents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No active agents found</p>
              ) : (
                agents.map((agent) => (
                  <label
                    key={agent._id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors ${selectedAgentId === agent._id ? 'bg-blue-50' : ''
                      }`}
                  >
                    <input
                      type="radio"
                      name="agent"
                      value={agent._id}
                      checked={selectedAgentId === agent._id}
                      onChange={() => setSelectedAgentId(agent._id)}
                      className="accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{agent.name}</p>
                      <p className="text-xs text-slate-500">{agent.agentCode} · {formatPhone(agent.phone)}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowAssignDialog(false); setSelectedAgentId(''); }}>
                Cancel
              </Button>
              <Button
                isLoading={assignMutation.isPending}
                disabled={!selectedAgentId}
                onClick={() => assignMutation.mutate()}
              >
                {customer.assignedAgent ? 'Change' : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* -- Delete Confirmation (Password-Protected) ----------------------------------------------- */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete Customer</h3>
                <p className="text-sm text-slate-500 mt-0.5">This is a highly sensitive, audited operation.</p>
              </div>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-xs font-semibold text-red-700 mb-1">{String.fromCharCode(9888) + ' What will happen:'}</p>
              <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside">
                <li>Customer record will be soft-deleted</li>
                <li>All linked accounts must already be closed</li>
                <li>This action is permanently audited</li>
              </ul>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-blue-600">{customer.name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
                <p className="text-xs text-slate-500">{customer.customerCode} {String.fromCharCode(183)} {formatPhone(customer.phone)}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label mb-1.5">
                Deletion Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Briefly explain why this customer is being deleted"
                className="resize-none"
                rows={2}
              />
            </div>

            <div className="mb-5">
              <label className="form-label mb-1.5">
                <Lock className="h-3.5 w-3.5 inline mr-1 text-slate-500" />
                Confirm with your admin password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={deletePasswordVisible ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your admin password to authorize"
                  className="pr-10"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setDeletePasswordVisible((v) => !v)}>
                  {deletePasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Verified server-side via bcrypt. Never stored or logged.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => { setShowDeleteDialog(false); setDeletePassword(''); setDeleteReason(''); }}>Cancel</Button>
              <Button variant="destructive" isLoading={deleteMutation.isPending} disabled={deletePassword.trim().length < 6 || deleteReason.trim().length === 0} onClick={() => { if (!deletePassword.trim() || !deleteReason.trim()) { toast.error('Both password and reason are required'); return; } deleteMutation.mutate(); }}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* -- Phone Change Modal (2-step OTP) -------------------------------------------------------- */}
      {showPhoneChangeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${phoneChangeStep >= 1 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>1</div>
              <div className={`flex-1 h-0.5 ${phoneChangeStep === 2 ? 'bg-blue-400' : 'bg-slate-200'}`} />
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${phoneChangeStep === 2 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>2</div>
            </div>
            {phoneChangeStep === 1 ? (
              <>
                <h3 className="text-base font-semibold text-slate-900 mb-1">Change Phone Number</h3>
                <p className="text-sm text-slate-500 mb-1">Current: <span className="font-mono font-semibold">{formatPhone(customer.phone)}</span></p>
                <p className="text-xs text-slate-400 mb-4">OTP will be sent to new number. Change is committed only after verification.</p>
                <label className="form-label">New Phone Number <span className="text-red-500">*</span></label>
                <Input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit Indian mobile number" maxLength={10} className="mb-1" autoFocus />
                {newPhone.length > 0 && !/^[6-9]\d{9}$/.test(newPhone) && (<p className="text-xs text-amber-600 mb-3">Enter a valid 10-digit Indian mobile number</p>)}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" disabled={requestPhoneChangeMutation.isPending} onClick={() => { setShowPhoneChangeDialog(false); setNewPhone(''); }}>Cancel</Button>
                  <Button className="flex-1" isLoading={requestPhoneChangeMutation.isPending} disabled={!/^[6-9]\d{9}$/.test(newPhone)} onClick={() => requestPhoneChangeMutation.mutate()}>
                    <Send className="h-4 w-4 mr-1.5" /> Send OTP
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-slate-900 mb-1">Verify New Number</h3>
                <p className="text-sm text-slate-500 mb-4">Enter OTP sent to <span className="font-mono font-semibold">{pendingMaskedPhone}</span></p>
                <Input value={phoneChangeOtp} onChange={(e) => setPhoneChangeOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="......" maxLength={6} className="text-center text-2xl tracking-[0.6em] font-mono mb-4" autoFocus />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" disabled={verifyPhoneChangeMutation.isPending} onClick={() => { setPhoneChangeStep(1); setPhoneChangeOtp(''); }}>Back</Button>
                  <Button className="flex-1" isLoading={verifyPhoneChangeMutation.isPending} disabled={phoneChangeOtp.length !== 6} onClick={() => { if (phoneChangeOtp.length !== 6) { toast.error('OTP must be 6 digits'); return; } verifyPhoneChangeMutation.mutate(); }}>
                    <ShieldCheck className="h-4 w-4 mr-1.5" /> Confirm Change
                  </Button>
                </div>
                <p className="text-xs text-center text-slate-400 mt-3">
                  {canPhoneResend ? (<>Didn't receive it?{' '}<button className="text-blue-600 hover:underline" onClick={() => requestPhoneChangeMutation.mutate()}>Resend OTP</button></>) : <span>Resend in {phoneCooldown}s</span>}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* -- Document Viewer -------------------------------------------------- */}
      {docViewerUrl && <DocViewer url={docViewerUrl} onClose={() => setDocViewerUrl(null)} />}
    </div>
  );
}



