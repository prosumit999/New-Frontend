// src/features/dev/DevPanelPage.tsx
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Building2, Palette, Calendar, FileText, ShieldAlert,
  BarChart2, Save, Info, Eye, EyeOff, RefreshCw,
  CheckCircle2, ChevronRight, ChevronLeft, Lock, Upload, ImageOff, UserCog,
} from 'lucide-react';
import { devPanelApi, Institution } from '../../api/devPanel.api';
import { Button } from '../../components/ui/Button';

// ── Styles ────────────────────────────────────────────────────────────────────
const inp =
  'w-full bg-white/5 border border-violet-400/20 rounded-xl px-4 py-2.5 text-sm text-white ' +
  'placeholder:text-slate-600 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/60 ' +
  'outline-none transition-all disabled:opacity-40';
const ta = inp + ' resize-none';

// ── Field wrapper ─────────────────────────────────────────────────────────────
function F({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-violet-300/80 mb-1.5">{label}</label>
      {children}
      {help && <p className="text-[11px] text-slate-500 mt-1">{help}</p>}
    </div>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'identity',        label: 'Institution Identity', icon: Building2  },
  { id: 'branding',        label: 'Branding',              icon: Palette    },
  { id: 'genesis',         label: 'Genesis Date',          icon: Calendar   },
  { id: 'legal',           label: 'Legal Documents',       icon: FileText   },
  { id: 'security',        label: 'Dev Password',          icon: Lock       },
  { id: 'superadmin-pw',   label: 'Superadmin Password',   icon: UserCog    },
  { id: 'audit',           label: 'Config Audit',          icon: BarChart2  },
] as const;
type NavId = typeof NAV[number]['id'];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DevPanelPage() {
  const qc = useQueryClient();
  const [active, setActive] = useState<NavId>('identity');

  const { data: instData, isLoading } = useQuery({
    queryKey: ['dev-institution'],
    queryFn: () => devPanelApi.getInstitution(),
    staleTime: 30_000,
  });

  const institution: Institution = (instData as any)?.data?.data?.institution ?? {} as Institution;

  const save = useMutation({
    mutationFn: (data: Partial<Institution>) => devPanelApi.updateInstitution(data),
    onSuccess: (_, vars) => {
      toast.success(`Saved: ${Object.keys(vars).join(', ')}`);
      qc.invalidateQueries({ queryKey: ['dev-institution'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const activeIdx = NAV.findIndex(n => n.id === active);

  const go = (id: NavId) => setActive(id);
  const prev = () => activeIdx > 0 && go(NAV[activeIdx - 1].id);
  const next = () => activeIdx < NAV.length - 1 && go(NAV[activeIdx + 1].id);

  if (isLoading) return (
    <div className="flex justify-center items-center py-32">
      <div className="h-10 w-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0b1a] text-white pb-12">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 border-b border-violet-500/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              Dev Panel
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Vendor-level system configuration</p>
          </div>
          {institution.isConfigured && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" /> Configured
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 flex gap-6">
        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="w-56 shrink-0">
          <div className="bg-white/[0.03] border border-violet-500/10 rounded-2xl p-2 space-y-1 sticky top-6">
            {NAV.map((item, idx) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={[
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left group',
                    isActive
                      ? 'bg-gradient-to-r from-violet-600/80 to-fuchsia-600/60 text-white shadow-lg shadow-violet-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-white/5',
                  ].join(' ')}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-violet-400'}`} />
                  <span className="leading-tight">{item.label}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-60" />}
                </button>
              );
            })}

            {/* Step progress */}
            <div className="pt-3 px-3 pb-1">
              <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                <span>Step {activeIdx + 1} of {NAV.length}</span>
                <span>{Math.round(((activeIdx + 1) / NAV.length) * 100)}%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500"
                  style={{ width: `${((activeIdx + 1) / NAV.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* ── Content Panel ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          <div className="bg-white/[0.03] border border-violet-500/10 rounded-2xl p-6 min-h-[520px] flex flex-col">
            {/* Section title */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-violet-500/10">
              {(() => { const Icon = NAV[activeIdx].icon; return <Icon className="h-5 w-5 text-violet-400" />; })()}
              <h2 className="text-base font-bold text-white">{NAV[activeIdx].label}</h2>
            </div>

            {/* Panels */}
            <div className="flex-1">
              {active === 'identity'      && <IdentityPanel      institution={institution} save={save} />}
              {active === 'branding'        && <BrandingPanel      institution={institution} save={save} />}
              {active === 'genesis'         && <GenesisPanel       institution={institution} save={save} />}
              {active === 'legal'           && <LegalPanel         institution={institution} save={save} />}
              {active === 'security'        && <SecurityPanel />}
              {active === 'superadmin-pw'   && <SuperadminPasswordPanel />}
              {active === 'audit'           && <AuditPanel />}
            </div>

            {/* Prev / Next */}
            <div className="flex justify-between items-center pt-6 mt-6 border-t border-violet-500/10">
              <button
                onClick={prev}
                disabled={activeIdx === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-xs text-slate-600">{NAV[activeIdx].label}</span>
              <button
                onClick={next}
                disabled={activeIdx === NAV.length - 1}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Identity Panel ────────────────────────────────────────────────────────────
function IdentityPanel({ institution, save }: any) {
  const [f, setF] = useState({
    name: institution.name || '',
    shortName: institution.shortName || '',
    registrationNumber: institution.registrationNumber || '',
    gstNumber: institution.gstNumber || '',
    smsFooter: institution.smsFooter || '',
    phone: institution.phone || '',
    email: institution.email || '',
    website: institution.website || '',
    address: {
      line1: institution.address?.line1 || '',
      line2: institution.address?.line2 || '',
      city: institution.address?.city || '',
      district: institution.address?.district || '',
      state: institution.address?.state || '',
      pincode: institution.address?.pincode || '',
    },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const setA = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, address: { ...p.address, [k]: e.target.value } }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <F label="Full Name *"><input className={inp} value={f.name} onChange={set('name')} placeholder="ABHISHEK FINANCE" /></F>
        <F label="Short Name"><input className={inp} value={f.shortName} onChange={set('shortName')} placeholder="ABHISHEK" /></F>
        <F label="Registration No." help="RBI NBFC / MCA CIN / State Reg."><input className={inp} value={f.registrationNumber} onChange={set('registrationNumber')} placeholder="U65929MH2020PTC000001" /></F>
        <F label="GST Number"><input className={inp} value={f.gstNumber} onChange={set('gstNumber')} placeholder="27AABCS1429B1ZB" maxLength={15} /></F>
        <F label="SMS Footer" help="Brand name in DLT SMS templates (max 60 chars)"><input className={inp} value={f.smsFooter} onChange={set('smsFooter')} placeholder="ABHISHEK FINANCE" maxLength={60} /></F>
        <F label="Phone"><input className={inp} value={f.phone} onChange={set('phone')} placeholder="9876543210" maxLength={10} /></F>
        <F label="Email"><input className={inp} type="email" value={f.email} onChange={set('email')} placeholder="info@abhishekfinance.com" /></F>
        <F label="Website"><input className={inp} value={f.website} onChange={set('website')} placeholder="https://abhishekfinance.com" /></F>
      </div>

      <div className="border-t border-violet-500/10 pt-4">
        <p className="text-[11px] font-bold text-violet-400/60 uppercase tracking-wider mb-3">Address</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="Line 1"><input className={inp} value={f.address.line1} onChange={setA('line1')} placeholder="123, Main Street" /></F>
          <F label="Line 2"><input className={inp} value={f.address.line2} onChange={setA('line2')} placeholder="Near XYZ Landmark" /></F>
          <F label="City"><input className={inp} value={f.address.city} onChange={setA('city')} placeholder="Mumbai" /></F>
          <F label="District"><input className={inp} value={f.address.district} onChange={setA('district')} placeholder="Mumbai Suburban" /></F>
          <F label="State"><input className={inp} value={f.address.state} onChange={setA('state')} placeholder="Maharashtra" /></F>
          <F label="Pincode"><input className={inp} value={f.address.pincode} onChange={setA('pincode')} placeholder="400001" maxLength={6} /></F>
        </div>
      </div>

      <Button onClick={() => save.mutate(f)} isLoading={save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white border-0">
        <Save className="h-4 w-4 mr-2" /> Save Identity
      </Button>
    </div>
  );
}

// ── Branding Panel ──────────────────────────────────────────────────────────────
function BrandingPanel({ institution, save }: any) {
  const [f, setF] = useState({
    primaryColor: institution.primaryColor || '#7c3aed',
    tagline: institution.tagline || '',
    receiptTagline: institution.receiptTagline || 'Thank you for banking with us.',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  // Logo upload state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(institution.logoUrl || null);
  const [uploadedLogo, setUploadedLogo] = useState<{ url: string; publicId: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
    setUploadedLogo(null);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const res = await devPanelApi.uploadLogo(pendingFile);
      const data = (res as any)?.data?.data ?? res;
      setUploadedLogo({ url: data.logoUrl, publicId: data.publicId });
      setPreview(data.logoUrl);
      toast.success('Logo uploaded! Click "Save Branding" to apply.');
    } catch {
      toast.error('Logo upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    save.mutate({
      ...f,
      ...(uploadedLogo ? { logo: { url: uploadedLogo.url, publicId: uploadedLogo.publicId } } : {}),
    });
    setUploadedLogo(null);
    setPendingFile(null);
  };

  return (
    <div className="space-y-6">
      {/* ── Logo Upload — Centered Hero ────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-semibold text-violet-300/80 mb-4">Institution Logo</label>

        {/* Centered preview card */}
        <div className="flex flex-col items-center gap-5">

          {/* Thumbnail — centered, large, premium */}
          <div className="relative group">
            {/* Glow ring when logo is present */}
            {preview && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 blur-xl scale-110 opacity-60 pointer-events-none" />
            )}
            <div
              className={[
                'relative w-44 h-44 rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-300',
                preview
                  ? 'bg-white border-2 border-violet-500/40 shadow-2xl shadow-violet-900/50'
                  : 'bg-white/5 border-2 border-dashed border-violet-500/30 hover:border-violet-400/60 hover:bg-white/[0.07]',
              ].join(' ')}
            >
              {preview ? (
                <>
                  <img
                    src={preview}
                    alt="Institution Logo"
                    className="w-full h-full object-contain p-4 transition-all duration-300 group-hover:scale-105"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                    <label className="cursor-pointer flex flex-col items-center gap-1.5 text-white">
                      <Upload className="h-6 w-6" />
                      <span className="text-xs font-semibold">Change Logo</span>
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                    </label>
                  </div>
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-3 p-6 w-full h-full justify-center">
                  <div className="w-14 h-14 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <ImageOff className="h-7 w-7 text-slate-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-violet-300">Click to upload</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">No logo set</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
              )}

              {/* Uploaded badge */}
              {uploadedLogo && (
                <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1 shadow-lg">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Caption & status */}
          <div className="text-center space-y-1">
            <p className="text-xs text-slate-400">PNG, JPG or SVG · Max 2 MB</p>
            <p className="text-[11px] text-slate-600">Appears in sidebar, login screen and exported PDFs</p>
          </div>

          {/* Action buttons — centered row */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {!preview && (
              <label className="cursor-pointer inline-flex items-center gap-2 text-xs font-semibold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg px-5 py-2.5 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                Choose Logo File
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </label>
            )}
            {pendingFile && !uploadedLogo && (
              <Button type="button" size="sm" onClick={handleUpload} isLoading={uploading}
                className="bg-violet-600 hover:bg-violet-700 text-white border-0 text-xs px-5">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {uploading ? 'Uploading…' : 'Upload to Cloud'}
              </Button>
            )}
            {uploadedLogo && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded — click Save to apply
              </span>
            )}
          </div>

          {/* Status hint */}
          {pendingFile && (
            <p className="text-[11px] text-amber-400/80 text-center">
              {uploadedLogo
                ? `✅ ${pendingFile.name} — uploaded. Click Save Branding below.`
                : `⚠️ ${pendingFile.name} selected — click "Upload to Cloud" first.`}
            </p>
          )}
        </div>
      </div>

      <F label="Primary Color" help="Hex color for UI accents and PDF reports">
        <div className="flex gap-3">
          <input type="color" value={f.primaryColor} onChange={set('primaryColor')} className="h-10 w-12 rounded-lg border border-violet-500/20 bg-white/5 cursor-pointer p-1 shrink-0" />
          <input className={inp} value={f.primaryColor} onChange={set('primaryColor')} placeholder="#7c3aed" />
        </div>
      </F>
      <F label="Tagline" help="Short motto shown on login page">
        <input className={inp} value={f.tagline} onChange={set('tagline')} placeholder="Empowering Communities Through Finance" maxLength={200} />
      </F>
      <F label="Receipt Tagline" help="Printed at the bottom of every receipt">
        <input className={inp} value={f.receiptTagline} onChange={set('receiptTagline')} placeholder="Thank you for banking with us." maxLength={200} />
      </F>
      <Button onClick={handleSave} isLoading={save.isPending} className="bg-violet-600 hover:bg-violet-700 text-white border-0">
        <Save className="h-4 w-4 mr-2" /> Save Branding
      </Button>
    </div>
  );
}

// ── Genesis Panel ─────────────────────────────────────────────────────────────
function GenesisPanel({ institution, save }: any) {
  const current = institution.systemGenesisDate
    ? new Date(institution.systemGenesisDate).toISOString().split('T')[0] : '';
  const [date, setDate] = useState(current);
  const [confirmed, setConfirmed] = useState(false);
  const hasChanged = date !== current;

  return (
    <div className="space-y-4 max-w-md">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
        <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
        <p className="text-xs text-red-300">Critical setting — no backdating can go before this date. Only modify during initial setup or data migration.</p>
      </div>
      <F label="Genesis Date" help="The calendar date the software was first installed.">
        <input type="date" value={date} max={new Date().toISOString().split('T')[0]}
          onChange={e => { setDate(e.target.value); setConfirmed(false); }}
          className="w-full bg-white/5 border border-violet-400/20 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition-all" />
      </F>
      {current && (
        <p className="text-xs text-slate-500">
          Current: <strong className="text-slate-300">{new Date(current + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
        </p>
      )}
      {hasChanged && (
        <label className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-violet-500" />
          <span className="text-xs text-amber-300">I confirm I want to change the genesis date. I understand this affects all backdating limits.</span>
        </label>
      )}
      <Button onClick={() => save.mutate({ systemGenesisDate: new Date(date + 'T00:00:00') as any })}
        isLoading={save.isPending} disabled={!date || (hasChanged && !confirmed)}
        className="bg-red-600 hover:bg-red-700 text-white border-0">
        <Save className="h-4 w-4 mr-2" /> Save Genesis Date
      </Button>
    </div>
  );
}

// ── Legal Panel ───────────────────────────────────────────────────────────────
function LegalPanel({ institution, save }: any) {
  const DOCS = [
    { id: 'privacyPolicy' as const,     label: 'Privacy Policy' },
    { id: 'microfinanceRules' as const,  label: 'Microfinance Rules' },
    { id: 'termsAndConditions' as const, label: 'Terms & Conditions' },
  ];
  const [activeDoc, setActiveDoc] = useState<typeof DOCS[number]['id']>('privacyPolicy');
  const [docs, setDocs] = useState({
    privacyPolicy: institution.privacyPolicy || '',
    microfinanceRules: institution.microfinanceRules || '',
    termsAndConditions: institution.termsAndConditions || '',
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {DOCS.map(d => (
          <button key={d.id} onClick={() => setActiveDoc(d.id)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeDoc === d.id
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-900/40'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}>
            {d.label}
            {docs[d.id] && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">Plain text or Markdown. Max 100KB.</p>
      <textarea className={ta} rows={14} value={docs[activeDoc]}
        onChange={e => setDocs(p => ({ ...p, [activeDoc]: e.target.value }))}
        placeholder={`Enter ${DOCS.find(d => d.id === activeDoc)?.label} here...`} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{(docs[activeDoc].length / 1024).toFixed(1)} KB</p>
        <Button onClick={() => save.mutate({ [activeDoc]: docs[activeDoc] })} isLoading={save.isPending}
          className="bg-violet-600 hover:bg-violet-700 text-white border-0">
          <Save className="h-4 w-4 mr-2" /> Save {DOCS.find(d => d.id === activeDoc)?.label}
        </Button>
      </div>
    </div>
  );
}

// ── Security Panel ────────────────────────────────────────────────────────────
function SecurityPanel() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState(false);
  const mut = useMutation({
    mutationFn: () => devPanelApi.changePassword(f),
    onSuccess: () => { toast.success('Password changed. Please log in again.'); setF({ currentPassword: '', newPassword: '', confirmPassword: '' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Password change failed'),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="max-w-md space-y-4">
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 flex gap-2">
        <Info className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-xs text-violet-300">All active sessions will be invalidated after password change.</p>
      </div>
      {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map(key => (
        <F key={key} label={key === 'currentPassword' ? 'Current Password' : key === 'newPassword' ? 'New Password' : 'Confirm New Password'}>
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={f[key]} onChange={set(key)}
              className={inp + ' pr-10'} placeholder="••••••••" autoComplete="off" />
            <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-400 transition-colors">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </F>
      ))}
      <p className="text-xs text-slate-500">Min 8 chars — uppercase, lowercase, number, special character.</p>
      <Button onClick={() => mut.mutate()} isLoading={mut.isPending}
        disabled={!f.currentPassword || !f.newPassword || f.newPassword !== f.confirmPassword}
        className="bg-red-600 hover:bg-red-700 text-white border-0">
        <ShieldAlert className="h-4 w-4 mr-2" /> Change Password
      </Button>
    </div>
  );
}

// ── Superadmin Password Panel ───────────────────────────────────────────────────
function SuperadminPasswordPanel() {
  const [f, setF] = useState({ newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState(false);
  const mut = useMutation({
    mutationFn: () => devPanelApi.resetSuperadminPassword(f),
    onSuccess: () => {
      toast.success('Superadmin password reset. Their sessions are now invalidated.');
      setF({ newPassword: '', confirmPassword: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Reset failed'),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="max-w-md space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-300">Privileged Action</p>
          <p className="text-xs text-amber-300/80 mt-0.5">
            This resets the superadmin password without requiring their current password.
            All superadmin sessions will be invalidated immediately.
          </p>
        </div>
      </div>
      {(['newPassword', 'confirmPassword'] as const).map(key => (
        <F key={key} label={key === 'newPassword' ? 'New Superadmin Password' : 'Confirm Password'}>
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={f[key]} onChange={set(key)}
              className={inp + ' pr-10'} placeholder="••••••••" autoComplete="off" />
            <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </F>
      ))}
      <p className="text-xs text-slate-500">Min 8 chars — uppercase, lowercase, number, special character.</p>
      {f.newPassword && f.confirmPassword && f.newPassword !== f.confirmPassword && (
        <p className="text-xs text-red-400">Passwords do not match.</p>
      )}
      <Button onClick={() => mut.mutate()} isLoading={mut.isPending}
        disabled={!f.newPassword || f.newPassword !== f.confirmPassword}
        className="bg-amber-600 hover:bg-amber-700 text-white border-0">
        <UserCog className="h-4 w-4 mr-2" /> Reset Superadmin Password
      </Button>
    </div>
  );
}

// ── Audit Panel ───────────────────────────────────────────────────────────────
function AuditPanel() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dev-config-audit'],
    queryFn: () => devPanelApi.getConfigAudit(),
    staleTime: 30_000,
  });
  const audit = (data as any)?.data?.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs text-slate-400">
          <span>Total: <strong className="text-white">{audit?.totalKeys ?? '—'}</strong></span>
          <span>Configurable: <strong className="text-emerald-400">{audit?.updatableKeys ?? '—'}</strong></span>
          <span>Deprecated: <strong className="text-amber-400">{audit?.deprecatedKeys ?? '—'}</strong></span>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-400 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {isLoading && <div className="flex justify-center py-8"><div className="h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>}
      {audit?.groups && Object.entries(audit.groups).map(([cat, keys]: any) => (
        <div key={cat}>
          <p className="text-[11px] font-bold text-violet-400/60 uppercase tracking-wider mb-2">{cat}</p>
          <div className="space-y-1.5">
            {keys.map((cfg: any) => (
              <div key={cfg.key} className={`flex items-center justify-between p-3 rounded-xl border text-xs ${cfg.isDeprecated ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-violet-500/10'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-violet-300">{cfg.key}</code>
                  {cfg.isDeprecated && <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-[10px]">DEPRECATED</span>}
                  {cfg.isSystemInternal && <span className="bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded text-[10px]">INTERNAL</span>}
                  {cfg.isUpdatable && <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[10px]">CONFIGURABLE</span>}
                </div>
                <code className="font-mono text-white ml-4 shrink-0">{JSON.stringify(cfg.value)}</code>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
