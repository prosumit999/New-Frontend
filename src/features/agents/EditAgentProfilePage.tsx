// src/features/agents/EditAgentProfilePage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const TABS = ['Personal', 'Address', 'Commission & Territory', 'Bank Details'];

type AddressBlock = { street: string; city: string; district: string; state: string; pincode: string };
const EMPTY_ADDR: AddressBlock = { street: '', city: '', district: '', state: '', pincode: '' };

function AddressForm({ label, value, onChange }: { label: string; value: AddressBlock; onChange: (v: AddressBlock) => void }) {
  const set = (key: keyof AddressBlock, val: string) => onChange({ ...value, [key]: val });
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="form-label">Street</label>
          <Input value={value.street} onChange={e => set('street', e.target.value)} placeholder="Street / Locality" />
        </div>
        <div>
          <label className="form-label">City</label>
          <Input value={value.city} onChange={e => set('city', e.target.value)} placeholder="City" />
        </div>
        <div>
          <label className="form-label">District</label>
          <Input value={value.district} onChange={e => set('district', e.target.value)} placeholder="District" />
        </div>
        <div>
          <label className="form-label">State</label>
          <Input value={value.state} onChange={e => set('state', e.target.value)} placeholder="State" />
        </div>
        <div>
          <label className="form-label">Pincode</label>
          <Input value={value.pincode} onChange={e => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit pincode" maxLength={6} />
        </div>
      </div>
    </div>
  );
}

function PincodeTagInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (/^\d{6}$/.test(v) && !values.includes(v)) { onChange([...values, v]); setInput(''); }
    else if (!/^\d{6}$/.test(v)) toast.error('Invalid 6-digit pincode');
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="6-digit pincode" maxLength={6} />
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map(p => (
            <span key={p} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-mono">
              {p}<button type="button" onClick={() => onChange(values.filter(x => x !== p))} className="hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EditAgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);

  // ── Personal tab ───────────────────────────────────────────
  const [personal, setPersonal] = useState({
    fullName: '', dateOfBirth: '', gender: '',
    fatherOrSpouseName: '', alternatePhone: '', personalEmail: '',
    employeeId: '', joiningDate: '',
  });

  // ── Address tab ───────────────────────────────────────────
  const [currentAddr, setCurrentAddr] = useState<AddressBlock>(EMPTY_ADDR);
  const [permanentAddr, setPermanentAddr] = useState<AddressBlock>(EMPTY_ADDR);
  const [isSameAddress, setIsSameAddress] = useState(false);

  // ── Commission tab ─────────────────────────────────────────
  const [commissionType, setCommissionType] = useState('none');
  const [commissionRatePercent, setCommissionRatePercent] = useState('');
  const [area, setArea] = useState('');
  const [assignedPincodes, setAssignedPincodes] = useState<string[]>([]);

  // ── Bank & ID tab ──────────────────────────────────────────
  const [bank, setBank] = useState({
    accountHolderName: '', bankName: '', accountNumber: '',
    ifscCode: '', branchName: '',
  });

  // ── Fetch existing data ────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentApi.getAgent(id!),
    enabled: !!id,
  });

  useEffect(() => {
    const p = data?.data?.profile;
    const u = data?.data?.user;
    if (!p) return;
    setPersonal({
      fullName: p.fullName || u?.name || '',
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
      gender: p.gender || '',
      fatherOrSpouseName: p.fatherOrSpouseName || '',
      alternatePhone: p.alternatePhone || '',
      personalEmail: p.personalEmail || '',
      employeeId: p.employeeId || '',
      joiningDate: p.joiningDate ? p.joiningDate.slice(0, 10) : '',
    });
    if (p.currentAddress) setCurrentAddr({ ...EMPTY_ADDR, ...p.currentAddress });
    if (p.permanentAddress) setPermanentAddr({ ...EMPTY_ADDR, ...p.permanentAddress });
    setIsSameAddress(p.isSameAddress || false);
    setCommissionType(p.commissionType || 'none');
    setCommissionRatePercent(p.commissionRateBps ? String(p.commissionRateBps / 100) : '');
    setArea(p.area || '');
    setAssignedPincodes(p.assignedPincodes || []);
    if (p.bankDetails) {
      setBank({
        accountHolderName: p.bankDetails.accountHolderName || '',
        bankName: p.bankDetails.bankName || '',
        accountNumber: '',  // never pre-fill encrypted account number
        ifscCode: p.bankDetails.ifscCode || '',
        branchName: p.bankDetails.branchName || '',
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {};
      if (tab === 0) {
        if (personal.fullName) payload.fullName = personal.fullName;
        if (personal.dateOfBirth) payload.dateOfBirth = personal.dateOfBirth;
        if (personal.gender) payload.gender = personal.gender;
        if (personal.fatherOrSpouseName) payload.fatherOrSpouseName = personal.fatherOrSpouseName;
        if (personal.alternatePhone) payload.alternatePhone = personal.alternatePhone;
        if (personal.personalEmail) payload.personalEmail = personal.personalEmail;
        if (personal.employeeId) payload.employeeId = personal.employeeId;
        if (personal.joiningDate) payload.joiningDate = personal.joiningDate;
      } else if (tab === 1) {
        payload.currentAddress = currentAddr;
        payload.isSameAddress = isSameAddress;
        if (!isSameAddress) payload.permanentAddress = permanentAddr;
      } else if (tab === 2) {
        payload.commissionType = commissionType;
        if (commissionType !== 'none' && commissionRatePercent) {
          payload.commissionRateBps = Math.round(parseFloat(commissionRatePercent) * 100);
        }
        payload.area = area;
        payload.assignedPincodes = assignedPincodes;
      } else if (tab === 3) {
        // Only send non-empty bank fields
        const bankPayload: Record<string, any> = {};
        if (bank.accountHolderName) bankPayload.accountHolderName = bank.accountHolderName;
        if (bank.bankName) bankPayload.bankName = bank.bankName;
        if (bank.accountNumber) bankPayload.accountNumber = bank.accountNumber;
        if (bank.ifscCode) bankPayload.ifscCode = bank.ifscCode.toUpperCase();
        if (bank.branchName) bankPayload.branchName = bank.branchName;
        if (Object.keys(bankPayload).length > 0) payload.bankDetails = bankPayload;
      }
      return agentApi.updateProfile(id!, payload);
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Profile updated');
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/agents/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Edit Agent Profile</h1>
          <p className="page-subtitle">Update compliance and profile information — each tab saves independently</p>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-5 overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${tab === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Personal ─────────────────────────────────────── */}
      {tab === 0 && (
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Personal Details</h2></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Legal Name</label>
                <Input value={personal.fullName} onChange={e => setPersonal(p => ({ ...p, fullName: e.target.value }))} placeholder="As per Aadhaar" />
              </div>
              <div>
                <label className="form-label">Date of Birth</label>
                <Input type="date" value={personal.dateOfBirth} onChange={e => setPersonal(p => ({ ...p, dateOfBirth: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Gender</label>
                <select className="form-input w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm" value={personal.gender} onChange={e => setPersonal(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label">Father / Spouse Name</label>
                <Input value={personal.fatherOrSpouseName} onChange={e => setPersonal(p => ({ ...p, fatherOrSpouseName: e.target.value }))} placeholder="As per govt ID" />
              </div>
              <div>
                <label className="form-label">Alternate Phone</label>
                <Input value={personal.alternatePhone} onChange={e => setPersonal(p => ({ ...p, alternatePhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit number" maxLength={10} />
              </div>
              <div>
                <label className="form-label">Personal Email</label>
                <Input type="email" value={personal.personalEmail} onChange={e => setPersonal(p => ({ ...p, personalEmail: e.target.value }))} placeholder="personal@email.com" />
              </div>
              <div>
                <label className="form-label">Employee ID</label>
                <Input value={personal.employeeId} onChange={e => setPersonal(p => ({ ...p, employeeId: e.target.value }))} placeholder="Internal employee ID" />
              </div>
              <div>
                <label className="form-label">Joining Date</label>
                <Input type="date" value={personal.joiningDate} onChange={e => setPersonal(p => ({ ...p, joiningDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="px-6 pb-5 flex justify-end">
            <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}><Save className="h-4 w-4 mr-2" />Save Personal</Button>
          </div>
        </div>
      )}

      {/* ── Tab 1: Address ──────────────────────────────────────── */}
      {tab === 1 && (
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Address Details</h2></div>
          <div className="card-body space-y-6">
            <AddressForm label="Current Address" value={currentAddr} onChange={setCurrentAddr} />
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <span className="text-sm font-medium text-slate-900">Permanent address is same as current</span>
              <button
                onClick={() => setIsSameAddress(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSameAddress ? 'bg-blue-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isSameAddress ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {!isSameAddress && (
              <AddressForm label="Permanent Address" value={permanentAddr} onChange={setPermanentAddr} />
            )}
          </div>
          <div className="px-6 pb-5 flex justify-end">
            <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}><Save className="h-4 w-4 mr-2" />Save Address</Button>
          </div>
        </div>
      )}

      {/* ── Tab 2: Commission & Territory ───────────────────────── */}
      {tab === 2 && (
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Commission & Territory</h2></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Commission Type</label>
                <select className="form-input w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm" value={commissionType} onChange={e => setCommissionType(e.target.value)}>
                  <option value="none">None</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              {commissionType !== 'none' && (
                <div>
                  <label className="form-label">Commission Rate (%)</label>
                  <Input type="number" step="0.01" min="0" max="50" value={commissionRatePercent} onChange={e => setCommissionRatePercent(e.target.value)} placeholder="e.g. 2" />
                  {commissionRatePercent && <p className="text-xs text-slate-400 mt-0.5">= {Math.round(parseFloat(commissionRatePercent) * 100)} BPS</p>}
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Area / Zone</label>
              <Input value={area} onChange={e => setArea(e.target.value)} placeholder="Operating territory" />
            </div>
            <div>
              <label className="form-label">Assigned Pincodes</label>
              <PincodeTagInput values={assignedPincodes} onChange={setAssignedPincodes} />
            </div>
          </div>
          <div className="px-6 pb-5 flex justify-end">
            <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}><Save className="h-4 w-4 mr-2" />Save Commission</Button>
          </div>
        </div>
      )}

      {/* ── Tab 3: Bank Details ──────────────────────────────────── */}
      {tab === 3 && (
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold">Bank Details</h2></div>
          <div className="card-body space-y-4">
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              💡 Aadhaar and PAN numbers are collected during the KYC document upload step — not here. Bank account number is stored encrypted; only the last 4 digits are shown after saving.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="form-label">Account Holder Name</label>
                <Input value={bank.accountHolderName} onChange={e => setBank(b => ({ ...b, accountHolderName: e.target.value }))} placeholder="As per bank records" />
              </div>
              <div>
                <label className="form-label">Bank Name</label>
                <Input value={bank.bankName} onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))} placeholder="e.g. State Bank of India" />
              </div>
              <div>
                <label className="form-label">Account Number</label>
                <Input type="password" value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))} placeholder="Will be stored encrypted" autoComplete="off" />
              </div>
              <div>
                <label className="form-label">IFSC Code</label>
                <Input value={bank.ifscCode} onChange={e => setBank(b => ({ ...b, ifscCode: e.target.value.toUpperCase() }))} placeholder="e.g. SBIN0001234" />
              </div>
              <div>
                <label className="form-label">Branch Name</label>
                <Input value={bank.branchName} onChange={e => setBank(b => ({ ...b, branchName: e.target.value }))} placeholder="Branch name" />
              </div>
            </div>
          </div>
          <div className="px-6 pb-5 flex justify-end">
            <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}><Save className="h-4 w-4 mr-2" />Save Bank Details</Button>
          </div>
        </div>
      )}
    </div>
  );
}
