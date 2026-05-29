// src/features/agents/AgentDetailPage.tsx
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Pencil, Power, Ban, Undo2, Trash2,
  ShieldCheck, ShieldX, Upload, Eye, EyeOff, User,
  CheckCircle, XCircle, Clock, AlertTriangle,
  FileUp, X, Lock, Key, Phone, ShieldAlert,
} from 'lucide-react';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Input } from '../../components/ui/Input';
import { DetailRow } from '../../components/shared/DetailRow';
import { KycFileRow } from '../../components/shared/KycFileRow';
import { PiiRevealRow } from '../../components/shared/PiiRevealRow';
import { KycSubmitModal } from '../../components/shared/KycSubmitModal';
import { formatDate, formatPhone, bpsToPercent } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { OtpInputDialog } from '../../components/shared/OtpInputDialog';

// ── KYC Status Badge ──────────────────────────────────────────────────────────
const KYC_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  documents_submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  kyc_verified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  kyc_rejected: 'bg-red-100 text-red-700 border-red-200',
};
const KYC_LABELS: Record<string, string> = {
  pending: 'KYC Pending',
  documents_submitted: 'Docs Submitted',
  kyc_verified: 'KYC Verified ✓',
  kyc_rejected: 'KYC Rejected ✗',
};

const AGENT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
  suspended: 'bg-amber-100 text-amber-700',
  terminated: 'bg-red-100 text-red-700',
};

// ── Document Slot Display ──────────────────────────────────────────────────────
type DocSlot = { url?: string; publicId?: string; uploadedAt?: string; verified?: boolean };

function DocItem({ label, slot, onViewClick }: { 
  label: string; 
  slot?: DocSlot; 
  onViewClick?: () => void;
}) {
  const uploaded = !!slot?.url;
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${uploaded ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center gap-2">
        {uploaded ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-slate-300 shrink-0" />}
        <div>
          <p className={`text-sm font-medium ${uploaded ? 'text-slate-800' : 'text-slate-400'}`}>{label}</p>
          {uploaded && slot?.uploadedAt && (
            <p className="text-[10px] text-slate-400">{formatDate(slot.uploadedAt)}</p>
          )}
        </div>
      </div>
      {uploaded && (
        <a href={slot!.url} target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /></Button>
        </a>
      )}
    </div>
  );
}

// KycFileRow → see src/components/shared/KycFileRow.tsx

const KYC_DOCS = [
  { label: 'Aadhaar Front', fieldName: 'aadhaarFront' },
  { label: 'Aadhaar Back', fieldName: 'aadhaarBack' },
  { label: 'PAN Card', fieldName: 'panCard' },
  { label: 'Photograph', fieldName: 'photo' },
  { label: 'Signed Agreement', fieldName: 'signedAgreement' },
];

// Constants for this page only — mirrors backend defaults
const PORTFOLIO_LIMIT = 20;

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdminOrAbove = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // ── Modals/dialogs state ───────────────────────────────────────────────────
  const [statusAction, setStatusAction] = useState<'activate' | 'deactivate' | 'suspend' | 'unsuspend' | 'terminate' | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [kycAction, setKycAction] = useState<'approve' | 'reject' | 'reset' | null>(null);
  const [kycNote, setKycNote] = useState('');
  const [showKycSubmitModal, setShowKycSubmitModal] = useState(false);
  const [editAuth, setEditAuth] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: '', smsEnabled: false });

  // ── Password reset state ───────────────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Phone change state (2-step) ────────────────────────────────────────────
  type PhoneChangeStep = 'idle' | 'enter_phone' | 'enter_otp';
  const [phoneChangeStep, setPhoneChangeStep] = useState<PhoneChangeStep>('idle');
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');

  // ── Creation OTP verify state ──────────────────────────────────────────────
  const [showCreationOtpModal, setShowCreationOtpModal] = useState(false);
  const [creationOtp, setCreationOtp] = useState('');


  // ── Handover state ──────────────────────────────────────────────────────────
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverTarget, setHandoverTarget] = useState('');
  const [transferAll, setTransferAll] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedPigmys, setSelectedPigmys] = useState<string[]>([]);

  // ── Portfolio Pagination ──────────────────────────────────────────────────
  const [cPage, setCPage] = useState(1);
  const [pPage, setPPage] = useState(1);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentApi.getAgent(id!),
    enabled: !!id,
  });

  const { data: portfolioResponse, isLoading: portfolioLoading } = useQuery({
    queryKey: ['agent-portfolio', id, cPage, pPage],
    queryFn: () => agentApi.getPortfolio(id!, { cPage, pPage, limit: PORTFOLIO_LIMIT }),
    enabled: !!id,
  });

  // Query for handover target agents (active + kyc verified)
  const { data: targetAgentsData } = useQuery({
    queryKey: ['agents', 'handover-targets'],
    queryFn: () => agentApi.list({ limit: 100, isActive: true, kycStatus: 'kyc_verified' }),
    enabled: showHandoverModal,
  });

  const agent = data?.data as any;
  const user = agent?.user;
  const profile = agent?.profile;

  const kycStatus: string = profile?.kycStatus || 'pending';
  const agentStatus: string = profile?.status || (user?.isActive ? 'active' : 'inactive');
  const isTerminated = agentStatus === 'terminated';
  const isSuspended = agentStatus === 'suspended';
  const canSubmitKyc = kycStatus === 'pending' || kycStatus === 'kyc_rejected';

  // ── Status mutation ────────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: () => {
      if (statusAction === 'activate' || statusAction === 'deactivate') {
        return agentApi.toggleStatus(id!, {
          isActive: statusAction === 'activate',
          reason: statusReason || undefined,
        });
      }
      return agentApi.changeStatus(id!, {
        action: statusAction as 'suspend' | 'unsuspend' | 'terminate',
        reason: statusReason,
      });
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Status updated');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['reassignment-stats'] });
      setStatusAction(null);
      setStatusReason('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Status change failed'),
  });

  // ── KYC verify/reject ──────────────────────────────────────────────────────
  const kycMutation = useMutation({
    mutationFn: () => agentApi.verifyKyc(id!, { action: kycAction!, note: kycNote || undefined }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'KYC updated');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      queryClient.invalidateQueries({ queryKey: ['agents', 'kyc-pending'] });
      setKycAction(null);
      setKycNote('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'KYC action failed'),
  });

  // ── KYC doc upload (multipart — using shared component) ─────────
  const uploadMutation = useMutation({
    mutationFn: (data: any) => {
      const fd = new FormData();
      if (data.aadhaarNumber) fd.append('aadhaarNumber', data.aadhaarNumber);
      if (data.panNumber) fd.append('panNumber', data.panNumber);
      if (data.aadhaarFront) fd.append('aadhaarFront', data.aadhaarFront);
      if (data.aadhaarBack) fd.append('aadhaarBack', data.aadhaarBack);
      if (data.panCard) fd.append('panCard', data.panCard);
      if (data.photo) fd.append('photo', data.photo);
      if (data.signatureOrAgreement) fd.append('signedAgreement', data.signatureOrAgreement);
      return agentApi.uploadKycDocs(id!, fd);
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || 'KYC documents uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      setShowKycSubmitModal(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Upload failed'),
  });

  // ── Auth fields update ─────────────────────────────────────────────────────
  const authMutation = useMutation({
    mutationFn: () => agentApi.update(id!, {
      name: authForm.name || undefined,
      email: authForm.email || undefined,
      smsEnabled: authForm.smsEnabled,
    }),
    onSuccess: () => {
      toast.success('Agent info updated');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      setEditAuth(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  // ── Password reset ─────────────────────────────────────────────────────────
  const passwordMutation = useMutation({
    mutationFn: () => agentApi.resetPassword(id!, { newPassword }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Password reset. Agent has been logged out.');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Password reset failed'),
  });

  // ── Phone change — step 1: request OTP ────────────────────────────────────
  const requestPhoneMutation = useMutation({
    mutationFn: () => agentApi.requestPhoneChange(id!, { newPhone }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'OTP sent to new number');
      setPhoneChangeStep('enter_otp');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send OTP'),
  });

  // ── Phone change — step 2: verify OTP and commit ──────────────────────────
  const verifyPhoneMutation = useMutation({
    mutationFn: () => agentApi.verifyPhoneChange(id!, { otp: phoneOtp }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Phone changed. Agent has been logged out.');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      setPhoneChangeStep('idle');
      setNewPhone('');
      setPhoneOtp('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'OTP verification failed'),
  });

  // ── Creation OTP: resend ──────────────────────────────────────────────────
  const resendCreationOtpMutation = useMutation({
    mutationFn: () => agentApi.resendCreationOtp(id!),
    onSuccess: (res: any) => toast.success(res?.message || 'OTP resent'),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Resend failed'),
  });

  // ── Creation OTP: verify ──────────────────────────────────────────────────
  const verifyCreationOtpMutation = useMutation({
    mutationFn: () => agentApi.verifyCreationOtp(id!, { otp: creationOtp }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Phone verified');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      setShowCreationOtpModal(false);
      setCreationOtp('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'OTP verification failed'),
  });

  // ── Portfolio Handover ────────────────────────────────────────────────────
  const handoverMutation = useMutation({
    mutationFn: () => agentApi.handoverPortfolio(id!, {
      targetAgentId: handoverTarget,
      transferAll,
      customerIds: selectedCustomers,
      pigmyIds: selectedPigmys,
    }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Portfolio handed over successfully');
      queryClient.invalidateQueries({ queryKey: ['agent-portfolio', id] });
      queryClient.invalidateQueries({ queryKey: ['reassignment-stats'] });
      setShowHandoverModal(false);
      setSelectedCustomers([]);
      setSelectedPigmys([]);
      setHandoverTarget('');
      setTransferAll(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Handover failed'),
  });

  const openStatusDialog = (action: typeof statusAction) => {
    setStatusAction(action);
    setStatusReason('');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }
  if (isError || !agent) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">Failed to load agent details.</p>
        <Button variant="outline" onClick={() => navigate('/agents')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      </div>
    );
  }

  const docs = profile?.documents || {};
  const uploadedCount = KYC_DOCS.filter(d => !!docs[d.fieldName]?.url).length;

  return (
    <div className="animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            {profile?.documents?.photo?.url ? (
              <img src={profile.documents.photo.url} alt="Agent" className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center ring-2 ring-white shadow">
                <User className="h-6 w-6 text-blue-600" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="page-title">{user?.name}</h1>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize border ${AGENT_STATUS_COLORS[agentStatus] || ''}`}>
                  {agentStatus}
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${KYC_COLORS[kycStatus] || ''}`}>
                  {KYC_LABELS[kycStatus] || kycStatus}
                </span>
              </div>
              <p className="page-subtitle font-mono">{user?.agentCode} · {formatPhone(user?.phone)}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setEditAuth(true); setAuthForm({ name: user?.name || '', email: user?.email || '', smsEnabled: user?.smsEnabled ?? false }); }}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Info
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/agents/${id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
          </Button>
          {isAdminOrAbove && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setShowPasswordModal(true); setNewPassword(''); setConfirmPassword(''); }}>
                <Key className="h-3.5 w-3.5 mr-1.5" /> Reset Password
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setPhoneChangeStep('enter_phone'); setNewPhone(''); setPhoneOtp(''); }}>
                <Phone className="h-3.5 w-3.5 mr-1.5" /> Change Phone
              </Button>
              {!user?.phoneVerified && (
                <Button variant="outline" size="sm" className="text-amber-600 border-amber-300" onClick={() => { setShowCreationOtpModal(true); setCreationOtp(''); }}>
                  <ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Verify Phone
                </Button>
              )}
            </>
          )}
          {!isSuspended && !isTerminated && (
            user?.isActive
              ? <Button variant="outline" size="sm" onClick={() => openStatusDialog('deactivate')}><Power className="h-3.5 w-3.5 mr-1 text-red-500" />Deactivate</Button>
              : <Button variant="outline" size="sm" onClick={() => openStatusDialog('activate')}><Power className="h-3.5 w-3.5 mr-1 text-emerald-500" />Activate</Button>
          )}
          {!isTerminated && (
            isSuspended
              ? <Button variant="outline" size="sm" className="text-emerald-600" onClick={() => openStatusDialog('unsuspend')}><Undo2 className="h-3.5 w-3.5 mr-1.5" />Unsuspend</Button>
              : <Button variant="outline" size="sm" className="text-amber-600" onClick={() => openStatusDialog('suspend')}><Ban className="h-3.5 w-3.5 mr-1.5" />Suspend</Button>
          )}
          {!isTerminated && (
            <Button variant="destructive" size="sm" onClick={() => openStatusDialog('terminate')}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Terminate
            </Button>
          )}
        </div>
      </div>

      {/* Terminated warning */}
      {isTerminated && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">This agent has been terminated. All accounts were unassigned and the ledger has been deactivated. No further actions are possible.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Basic Info */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-slate-900">Basic Information</h2></div>
            <div className="card-body">
              <dl>
                <DetailRow label="Full Legal Name" value={profile?.fullName || user?.name} />
                <DetailRow label="Agent Code" value={<span className="font-mono text-blue-600">{user?.agentCode}</span>} />
                <DetailRow label="Phone" value={formatPhone(user?.phone)} />
                <DetailRow label="Email" value={user?.email || '—'} />
                <DetailRow label="SMS Notifications" value={user?.smsEnabled ? '✅ Enabled' : '❌ Disabled'} />
                <DetailRow label="Date of Birth" value={formatDate(profile?.dateOfBirth)} />
                <DetailRow label="Gender" value={profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '—'} />
                <DetailRow label="Father / Spouse" value={profile?.fatherOrSpouseName || '—'} />
                <DetailRow label="Employee ID" value={profile?.employeeId || '—'} />
                <DetailRow label="Joining Date" value={formatDate(profile?.joiningDate)} />
                <DetailRow label="Registered On" value={formatDate(user?.createdAt)} />
              </dl>
            </div>
          </div>

          {/* Address */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-slate-900">Address</h2></div>
            <div className="card-body">
              <dl>
                <DetailRow label="Current" value={
                  profile?.currentAddress
                    ? [profile.currentAddress.street, profile.currentAddress.city, profile.currentAddress.district, profile.currentAddress.state, profile.currentAddress.pincode].filter(Boolean).join(', ')
                    : '—'
                } />
                <DetailRow label="Permanent" value={
                  profile?.isSameAddress ? 'Same as current' :
                  profile?.permanentAddress
                    ? [profile.permanentAddress.street, profile.permanentAddress.city, profile.permanentAddress.district, profile.permanentAddress.state, profile.permanentAddress.pincode].filter(Boolean).join(', ')
                    : '—'
                } />
              </dl>
            </div>
          </div>

          {/* Bank Details */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-slate-900">Bank Details</h2></div>
            <div className="card-body">
              <dl>
                <DetailRow label="Account Holder" value={profile?.bankDetails?.accountHolderName || '—'} />
                <DetailRow label="Bank" value={profile?.bankDetails?.bankName || '—'} />
                <DetailRow label="Account Number" value={profile?.bankDetails?.accountNumberLast4 ? `****${profile.bankDetails.accountNumberLast4}` : '—'} />
                <DetailRow label="IFSC" value={profile?.bankDetails?.ifscCode || '—'} />
                <DetailRow label="Branch" value={profile?.bankDetails?.branchName || '—'} />
              </dl>
            </div>
          </div>

          {/* Commission & Territory */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-slate-900">Commission & Territory</h2></div>
            <div className="card-body">
              <dl>
                <DetailRow label="Commission Type" value={profile?.commissionType || 'None'} />
                {profile?.commissionRateBps != null && profile.commissionType !== 'none' && (
                  <DetailRow label="Commission Rate" value={bpsToPercent(profile.commissionRateBps)} />
                )}
                <DetailRow label="Area / Zone" value={profile?.area || '—'} />
                <DetailRow label="Assigned Pincodes" value={
                  profile?.assignedPincodes?.length > 0
                    ? <div className="flex flex-wrap gap-1">{profile.assignedPincodes.map((p: string) => (
                        <span key={p} className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{p}</span>
                      ))}</div>
                    : '—'
                } />
              </dl>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ──────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* KYC Identity Numbers — shown once submitted */}
          {(profile?.aadhaarLast4 || profile?.panLast4) && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold text-slate-900">KYC Identity</h2>
              </div>
              <div className="card-body">
                <dl>
                  <PiiRevealRow
                    label="Aadhaar"
                    masked={profile?.maskedAadhaar || (profile?.aadhaarLast4 ? `XXXX XXXX ${profile.aadhaarLast4}` : undefined)}
                    fetchFn={() => agentApi.getDecryptedAadhar(id!) as any}
                    isAdminOrAbove={isAdminOrAbove}
                  />
                  <PiiRevealRow
                    label="PAN"
                    masked={profile?.maskedPan || (profile?.panLast4 ? `XXXXXX${profile.panLast4}` : undefined)}
                    fetchFn={() => agentApi.getDecryptedPan(id!) as any}
                    isAdminOrAbove={isAdminOrAbove}
                  />
                </dl>
                {isAdminOrAbove && (
                  <div className="mt-3 flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700">
                      Viewing decrypted PII is audited and logged per compliance policy.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* KYC Documents */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">KYC Documents</h2>
              <span className="text-xs text-slate-500">{uploadedCount}/{KYC_DOCS.length} uploaded</span>
            </div>
            <div className="card-body space-y-2">
              {/* Status banner */}
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-medium ${KYC_COLORS[kycStatus]}`}>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {KYC_LABELS[kycStatus]}
                {profile?.kycVerifiedAt && kycStatus === 'kyc_verified' && (
                  <span className="text-emerald-500 ml-auto">{formatDate(profile.kycVerifiedAt)}</span>
                )}
              </div>

              {profile?.kycRejectionNote && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  <p className="font-medium">Rejection reason:</p>
                  <p>{profile.kycRejectionNote}</p>
                </div>
              )}

              {/* Uploaded doc list */}
              <div className="space-y-2 pt-1">
                {KYC_DOCS.map(d => (
                  <DocItem
                    key={d.fieldName}
                    label={d.label}
                    slot={docs[d.fieldName]}
                  />
                ))}
              </div>

              {/* Primary action: Submit / Resubmit KYC Docs */}
              {canSubmitKyc && (
                <div className="pt-2 border-t border-slate-100">
                  <Button
                    className="w-full"
                    onClick={() => setShowKycSubmitModal(true)}
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    {kycStatus === 'kyc_rejected' ? 'Resubmit KYC Documents' : 'Submit KYC Documents'}
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center mt-2">
                    Aadhaar number, PAN number, and all document photos are collected here.
                  </p>
                </div>
              )}

              {/* Approve / Reject — only when documents_submitted */}
              {kycStatus === 'documents_submitted' && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" className="flex-1" onClick={() => setKycAction('approve')}>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Approve
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={() => setKycAction('reject')}>
                    <ShieldX className="h-3.5 w-3.5 mr-1.5" />Reject
                  </Button>
                </div>
              )}
              {/* Reset KYC — visible when verified or rejected */}
              {(kycStatus === 'kyc_verified' || kycStatus === 'kyc_rejected') && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => setKycAction('reset')}>
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Reset & Revoke KYC
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Account Status */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-slate-900">Account Status</h2></div>
            <div className="card-body space-y-2">
              <dl>
                <DetailRow label="Login" value={user?.isActive ? '✅ Active' : '❌ Disabled'} />
                <DetailRow label="Agent Status" value={<span className={`capitalize font-semibold text-sm ${agentStatus === 'active' ? 'text-emerald-600' : agentStatus === 'suspended' ? 'text-amber-600' : 'text-red-600'}`}>{agentStatus}</span>} />
                {profile?.suspendedAt && <DetailRow label="Suspended On" value={formatDate(profile.suspendedAt)} />}
                {profile?.suspensionReason && <DetailRow label="Suspension Reason" value={profile.suspensionReason} />}
                {profile?.terminatedAt && <DetailRow label="Terminated On" value={formatDate(profile.terminatedAt)} />}
                {profile?.terminationReason && <DetailRow label="Termination Reason" value={profile.terminationReason} />}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* ── PORTFOLIO & HANDOVER SECTION ───────────────────────────────────────── */}
      <div className="mt-6 card border-blue-200">
        <div className="card-header bg-blue-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-blue-900">Portfolio & Handover</h2>
            <p className="text-xs text-blue-700/70 mt-1">
              Manage the customers and accounts assigned to this agent. You can transfer them to another active agent.
            </p>
          </div>
          {isAdminOrAbove && !isTerminated && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white"
                disabled={!selectedCustomers.length && !selectedPigmys.length}
                onClick={() => { setTransferAll(false); setShowHandoverModal(true); }}
              >
                Handover Selected
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setTransferAll(true);
                  setSelectedCustomers([]);
                  setSelectedPigmys([]);
                  setShowHandoverModal(true);
                }}
              >
                Transfer Entire Portfolio
              </Button>
            </div>
          )}
        </div>
        <div className="card-body p-0">
          {portfolioLoading ? (
            <div className="p-6 text-center text-sm text-slate-500">Loading portfolio...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-t">
              {/* Customers List */}
              <div className="p-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Assigned Customers ({portfolioResponse?.data?.cPagination?.total || 0})
                  </h3>
                  {portfolioResponse?.data?.customers?.length > 0 && (
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        if (selectedCustomers.length === portfolioResponse.data.customers.length) {
                          setSelectedCustomers([]);
                        } else {
                          setSelectedCustomers(portfolioResponse.data.customers.map((c: any) => c._id));
                        }
                      }}
                    >
                      {selectedCustomers.length === portfolioResponse?.data?.customers?.length ? 'Deselect Page' : 'Select Page'}
                    </button>
                  )}
                </div>
                {portfolioResponse?.data?.customers?.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No customers assigned.</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 flex-grow">
                      {portfolioResponse?.data?.customers?.map((c: any) => (
                        <div key={c._id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedCustomers.includes(c._id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedCustomers(prev => [...prev, c._id]);
                              else setSelectedCustomers(prev => prev.filter(id => id !== c._id));
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                            <p className="text-xs text-slate-500 truncate">{c.customerCode} • {formatPhone(c.phone)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Customer Pagination */}
                    {portfolioResponse?.data?.cPagination && portfolioResponse.data.cPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={cPage === 1}
                          onClick={() => setCPage(p => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <span className="text-xs text-slate-500">Page {cPage} of {portfolioResponse.data.cPagination.totalPages}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={cPage === portfolioResponse.data.cPagination.totalPages}
                          onClick={() => setCPage(p => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Pigmy Accounts List */}
              <div className="p-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Active Pigmy Accounts ({portfolioResponse?.data?.pPagination?.total || 0})
                  </h3>
                  {portfolioResponse?.data?.pigmyAccounts?.length > 0 && (
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        if (selectedPigmys.length === portfolioResponse.data.pigmyAccounts.length) {
                          setSelectedPigmys([]);
                        } else {
                          setSelectedPigmys(portfolioResponse.data.pigmyAccounts.map((a: any) => a._id));
                        }
                      }}
                    >
                      {selectedPigmys.length === portfolioResponse?.data?.pigmyAccounts?.length ? 'Deselect Page' : 'Select Page'}
                    </button>
                  )}
                </div>
                {portfolioResponse?.data?.pigmyAccounts?.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No active pigmy accounts assigned.</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 flex-grow">
                      {portfolioResponse?.data?.pigmyAccounts?.map((a: any) => (
                        <div key={a._id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedPigmys.includes(a._id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedPigmys(prev => [...prev, a._id]);
                              else setSelectedPigmys(prev => prev.filter(id => id !== a._id));
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{a.accountNumber}</p>
                            <p className="text-xs text-slate-500 truncate">{a.customer?.name} • ₹{(a.dailyDepositAmountInPaise / 100).toFixed(2)}/day</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-emerald-600">₹{(a.balanceInPaise / 100).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Pigmy Pagination */}
                    {portfolioResponse?.data?.pPagination && portfolioResponse.data.pPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={pPage === 1}
                          onClick={() => setPPage(p => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <span className="text-xs text-slate-500">Page {pPage} of {portfolioResponse.data.pPagination.totalPages}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={pPage === portfolioResponse.data.pPagination.totalPages}
                          onClick={() => setPPage(p => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Handover Modal ─────────────────────────────────────────────── */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-blue-50">
              <Undo2 className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Handover Portfolio</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                <p className="text-slate-700">
                  You are about to transfer <strong className="text-slate-900">{transferAll ? 'THE ENTIRE PORTFOLIO' : `${selectedCustomers.length} customers and ${selectedPigmys.length} accounts`}</strong> from <strong>{user?.name}</strong> to a new agent.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  This action takes effect immediately. The new agent will see these accounts in their app instantly.
                </p>
              </div>
              
              <div>
                <label className="form-label">Select Target Agent <span className="text-red-500">*</span></label>
                <select
                  className="input-field"
                  value={handoverTarget}
                  onChange={e => setHandoverTarget(e.target.value)}
                >
                  <option value="">-- Choose an active verified agent --</option>
                  {targetAgentsData?.data?.agents
                    ?.filter((a: any) => a._id !== id) // exclude source agent
                    .map((a: any) => (
                      <option key={a._id} value={a._id}>
                        {a.name} ({a.agentCode}) {a.profile?.area ? `— ${a.profile.area}` : ''}
                      </option>
                    ))}
                </select>
                {!targetAgentsData && <p className="text-xs text-slate-400 mt-1">Loading agents...</p>}
              </div>

            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowHandoverModal(false)}>Cancel</Button>
              <Button
                isLoading={handoverMutation.isPending}
                disabled={!handoverTarget}
                onClick={() => handoverMutation.mutate()}
              >
                Confirm Transfer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── KYC Document Submit Modal (matches CustomerDetailPage pattern) ─── */}
      <KycSubmitModal
        open={showKycSubmitModal}
        onClose={() => setShowKycSubmitModal(false)}
        entityType="agent"
        entityName={user?.name || 'Unknown Agent'}
        isResubmit={kycStatus === 'kyc_rejected'}
        isLoading={uploadMutation.isPending}
        onSubmit={(data) => uploadMutation.mutate(data)}
      />

      {/* ── Edit Auth Fields Modal ─────────────────────────────────── */}
      {editAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Edit Agent Info</h3>
              <p className="text-xs text-slate-500 mt-0.5">Update name, email, and SMS preference</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="form-label">Display Name</label>
                <Input value={authForm.name} onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} placeholder={user?.name} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <Input type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} placeholder={user?.email || 'No email set'} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">SMS Notifications</span>
                <button
                  onClick={() => setAuthForm(f => ({ ...f, smsEnabled: !f.smsEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${authForm.smsEnabled ? 'bg-blue-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${authForm.smsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditAuth(false)}>Cancel</Button>
              <Button isLoading={authMutation.isPending} onClick={() => authMutation.mutate()}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Change Dialog ───────────────────────────────────── */}
      {statusAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className={`px-6 py-4 border-b border-slate-100 flex items-center gap-2 ${statusAction === 'terminate' ? 'bg-red-50' : statusAction === 'suspend' ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <h3 className="font-semibold text-slate-900 capitalize">{statusAction} Agent</h3>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-600">
                {statusAction === 'terminate' && '⚠️ Termination is permanent. All pigmy accounts and customers will be unassigned. The agent ledger will be deactivated. Cannot be reversed.'}
                {statusAction === 'suspend' && 'The agent will be immediately logged out and unable to access the system until unsuspended.'}
                {statusAction === 'unsuspend' && 'The agent will regain access to the system.'}
                {statusAction === 'activate' && 'The agent account will be re-enabled.'}
                {statusAction === 'deactivate' && 'The agent will be immediately logged out.'}
              </p>
              {(statusAction === 'suspend' || statusAction === 'terminate') && (
                <div>
                  <label className="form-label">Reason <span className="text-red-500">* (min 5 chars)</span></label>
                  <Input value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="Enter reason..." />
                </div>
              )}
              {(statusAction === 'activate' || statusAction === 'deactivate' || statusAction === 'unsuspend') && (
                <div>
                  <label className="form-label">Reason (Optional)</label>
                  <Input value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="Optional reason..." />
                </div>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStatusAction(null)}>Cancel</Button>
              <Button
                variant={statusAction === 'terminate' ? 'destructive' : statusAction === 'activate' || statusAction === 'unsuspend' ? 'default' : 'outline'}
                isLoading={statusMutation.isPending}
                onClick={() => {
                  if ((statusAction === 'suspend' || statusAction === 'terminate') && statusReason.trim().length < 5) {
                    toast.error('Reason must be at least 5 characters');
                    return;
                  }
                  statusMutation.mutate();
                }}
              >
                Confirm {statusAction}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── KYC Approve / Reject / Reset Dialog ───────────────────── */}
      {kycAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">{kycAction === 'approve' ? 'Approve KYC' : kycAction === 'reset' ? 'Reset KYC' : 'Reject KYC'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {kycAction === 'approve' ? 'Confirm all documents are valid and verified.' : kycAction === 'reset' ? '⚠️ This will permanently delete all uploaded documents and reset the KYC status to pending.' : 'Provide a clear reason for rejection.'}
              </p>
            </div>
            <div className="px-6 py-5">
              <label className="form-label">Note {(kycAction === 'reject' || kycAction === 'reset') && <span className="text-red-500">*</span>}</label>
              <Textarea
                value={kycNote}
                onChange={e => setKycNote(e.target.value)}
                placeholder={kycAction === 'approve' ? 'Optional verification note' : 'Reason required'}
                rows={3}
              />
            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setKycAction(null)}>Cancel</Button>
              <Button
                variant={kycAction === 'reject' || kycAction === 'reset' ? 'destructive' : 'default'}
                isLoading={kycMutation.isPending}
                onClick={() => {
                  if ((kycAction === 'reject' || kycAction === 'reset') && !kycNote.trim()) { toast.error('Reason is required'); return; }
                  kycMutation.mutate();
                }}
              >
                {kycAction === 'approve' ? <><ShieldCheck className="h-4 w-4 mr-1.5" />Approve KYC</> : kycAction === 'reset' ? <><AlertTriangle className="h-4 w-4 mr-1.5" />Confirm Reset</> : <><ShieldX className="h-4 w-4 mr-1.5" />Reject KYC</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ─────────────────────────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-amber-50">
              <Key className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-slate-900">Reset Agent Password</h3>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-600">
                The agent will be immediately logged out of all devices. They must log in again with the new password.
              </p>
              <div>
                <label className="form-label">New Password <span className="text-red-500">*</span></label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, upper/lower/number/special"
                />
              </div>
              <div>
                <label className="form-label">Confirm Password <span className="text-red-500">*</span></label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Passwords do not match</p>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
              <Button
                isLoading={passwordMutation.isPending}
                disabled={!newPassword || newPassword !== confirmPassword || newPassword.length < 8}
                onClick={() => passwordMutation.mutate()}
              >
                <Key className="h-4 w-4 mr-1.5" /> Reset Password
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Phone Modal (2-step OTP) ─────────────────────────── */}
      {phoneChangeStep !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-blue-50">
              <Phone className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">
                {phoneChangeStep === 'enter_phone' ? 'Change Agent Phone Number' : 'Verify OTP'}
              </h3>
            </div>
            <div className="px-6 py-5 space-y-3">
              {phoneChangeStep === 'enter_phone' ? (
                <>
                  <p className="text-sm text-slate-600">
                    Enter the new phone number. An OTP will be sent to the <strong>new number</strong> to confirm ownership.
                  </p>
                  <div>
                    <label className="form-label">New Phone Number <span className="text-red-500">*</span></label>
                    <Input
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Enter the 6-digit OTP sent to <strong>{newPhone}</strong>.
                  </p>
                  <div>
                    <label className="form-label">OTP <span className="text-red-500">*</span></label>
                    <Input
                      value={phoneOtp}
                      onChange={e => setPhoneOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      maxLength={6}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setPhoneChangeStep('enter_phone')}
                  >
                    ← Change the phone number
                  </button>
                </>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setPhoneChangeStep('idle'); setNewPhone(''); setPhoneOtp(''); }}>Cancel</Button>
              {phoneChangeStep === 'enter_phone' ? (
                <Button
                  isLoading={requestPhoneMutation.isPending}
                  disabled={!/^[6-9]\d{9}$/.test(newPhone)}
                  onClick={() => requestPhoneMutation.mutate()}
                >
                  Send OTP
                </Button>
              ) : (
                <Button
                  isLoading={verifyPhoneMutation.isPending}
                  disabled={phoneOtp.length !== 6}
                  onClick={() => verifyPhoneMutation.mutate()}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" /> Confirm Change
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KYC Submit Modal (shared component) ─────────────────────── */}
      <KycSubmitModal
        open={showKycSubmitModal}
        onClose={() => setShowKycSubmitModal(false)}
        entityType="agent"
        entityName={user?.name || 'Agent'}
        isResubmit={kycStatus === 'kyc_rejected'}
        isLoading={uploadMutation.isPending}
        onSubmit={(data) => uploadMutation.mutate(data)}
      />

      {/* ── Verify Creation OTP Modal ────────────────────────────────── */}
      <OtpInputDialog
        open={showCreationOtpModal}
        onClose={() => { setShowCreationOtpModal(false); setCreationOtp(''); }}
        title="Verify Agent Phone"
        subtitle={`Enter the 6-digit OTP sent to ${user?.phone || 'the agent'} when the agent was created.`}
        isVerifyLoading={verifyCreationOtpMutation.isPending}
        isResendLoading={resendCreationOtpMutation.isPending}
        onResend={() => resendCreationOtpMutation.mutate()}
        onVerify={(otp) => {
          setCreationOtp(otp);
          setTimeout(() => verifyCreationOtpMutation.mutate(), 0);
        }}
      />
    </div>
  );
}
