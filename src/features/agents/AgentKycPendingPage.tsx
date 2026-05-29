// src/features/agents/AgentKycPendingPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ShieldCheck, ShieldX, Eye, CheckCircle, XCircle, Clock, FileText,
} from 'lucide-react';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { formatDate, formatPhone, formatRelative } from '../../utils/format';

const KYC_DOCS_LABELS: Record<string, string> = {
  aadhaarFront: 'Aadhaar Front',
  aadhaarBack: 'Aadhaar Back',
  panCard: 'PAN Card',
  photo: 'Photograph',
  signedAgreement: 'Signed Agreement',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  documents_submitted: 'bg-blue-100 text-blue-700',
};

export default function AgentKycPendingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['agents', 'kyc-pending'],
    queryFn: () => agentApi.getKycPending({ limit: 50 }),
  });

  const profiles: any[] = data?.data?.profiles || [];
  const pagination = data?.data?.pagination as any;

  const kycMutation = useMutation({
    mutationFn: ({ agentId }: { agentId: string }) =>
      agentApi.verifyKyc(agentId, { action: action!, note: note || undefined }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'KYC updated');
      queryClient.invalidateQueries({ queryKey: ['agents', 'kyc-pending'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setExpandedId(null);
      setAction(null);
      setNote('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'KYC action failed'),
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">KYC Pending — Agents</h1>
          <p className="page-subtitle">Review and verify agent KYC documents before granting account assignments</p>
        </div>
        {pagination?.total > 0 && (
          <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full">
            {pagination.total} pending
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : profiles.length === 0 ? (
        <div className="card card-body text-center py-16 text-slate-500">
          <ShieldCheck className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">All clear!</p>
          <p className="text-sm mt-1">No agents are awaiting KYC review right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile: any) => {
            const agentId = profile.user?._id || profile._id;
            const isExpanded = expandedId === agentId;
            const docs = profile.documents || {};
            const uploadedDocs = Object.entries(KYC_DOCS_LABELS).filter(([key]) => !!docs[key]?.url);
            const isSubmitted = profile.kycStatus === 'documents_submitted';

            return (
              <div key={agentId} className={`card transition-all ${isExpanded ? 'ring-2 ring-blue-200' : ''}`}>
                {/* Card Header */}
                <div className="card-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {profile.documents?.photo?.url ? (
                      <img src={profile.documents.photo.url} alt={profile.user?.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{profile.user?.name}</h3>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[profile.kycStatus] || 'bg-slate-100 text-slate-500'}`}>
                          {profile.kycStatus === 'documents_submitted' ? 'Docs Submitted' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {profile.user?.agentCode} · {formatPhone(profile.user?.phone)} · Area: {profile.area || '—'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {uploadedDocs.length}/{Object.keys(KYC_DOCS_LABELS).length} docs uploaded
                        {profile.kycSubmittedAt && ` · Submitted ${formatRelative(profile.kycSubmittedAt)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agentId}`)}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" />View
                    </Button>
                    {isSubmitted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setExpandedId(isExpanded ? null : agentId); setAction(null); setNote(''); }}
                      >
                        {isExpanded ? 'Close' : 'Review'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Review Panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-6 py-5 space-y-5">
                    {/* Documents Grid */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Documents</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(KYC_DOCS_LABELS).map(([key, label]) => {
                          const doc = docs[key];
                          const uploaded = !!doc?.url;
                          return (
                            <div
                              key={key}
                              className={`border rounded-lg p-3 flex flex-col gap-2 ${uploaded ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
                            >
                              <div className="flex items-center gap-1.5">
                                {uploaded ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-slate-300" />}
                                <span className="text-xs font-medium text-slate-700">{label}</span>
                              </div>
                              {uploaded ? (
                                <a href={doc.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline">
                                  View document ↗
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400">Not uploaded</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action selector */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAction('approve')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${action === 'approve' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                      >
                        <ShieldCheck className="h-4 w-4" /> Approve KYC
                      </button>
                      <button
                        onClick={() => setAction('reject')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${action === 'reject' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-red-300'}`}
                      >
                        <ShieldX className="h-4 w-4" /> Reject KYC
                      </button>
                    </div>

                    {action && (
                      <div>
                        <label className="form-label">
                          {action === 'approve' ? 'Verification Note (Optional)' : 'Rejection Reason *'}
                        </label>
                        <Textarea
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder={action === 'reject' ? 'Document quality issue, mismatch, etc.' : 'All documents verified and match.'}
                          rows={2}
                        />
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" onClick={() => { setAction(null); setNote(''); }}>Cancel</Button>
                          <Button
                            size="sm"
                            variant={action === 'reject' ? 'destructive' : 'default'}
                            isLoading={kycMutation.isPending}
                            onClick={() => {
                              if (action === 'reject' && !note.trim()) { toast.error('Rejection reason is required'); return; }
                              kycMutation.mutate({ agentId });
                            }}
                          >
                            {action === 'approve' ? <><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Confirm Approve</> : <><ShieldX className="h-3.5 w-3.5 mr-1.5" />Confirm Reject</>}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
