// src/features/agents/CreateAgentPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, UserPlus, ChevronRight, ChevronLeft, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ── Password strength ──────────────────────────────────────────────────────────
function checkPwd(pwd: string) {
  const rules = [
    { pass: pwd.length >= 8,              label: '8+ chars' },
    { pass: /[A-Z]/.test(pwd),            label: 'Uppercase' },
    { pass: /[a-z]/.test(pwd),            label: 'Lowercase' },
    { pass: /\d/.test(pwd),               label: 'Number' },
    { pass: /[@$!%*?&#]/.test(pwd),       label: 'Special' },
  ];
  const score = rules.filter(r => r.pass).length;
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const barColors = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'];
  const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];
  return { score, label: labels[score], barColor: barColors[score], width: widths[score], rules };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { score, label, barColor, width, rules } = checkPwd(password);
  if (!password) return null;
  const colors = ['text-red-500', 'text-red-500', 'text-orange-500', 'text-yellow-600', 'text-blue-600', 'text-emerald-600'];
  return (
    <div className="mt-2">
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-300`} style={{ width }} />
      </div>
      <div className="flex flex-wrap gap-x-3 mt-1.5">
        {rules.map(r => (
          <span key={r.label} className={`text-[10px] flex items-center gap-0.5 ${r.pass ? 'text-emerald-600' : 'text-slate-400'}`}>
            {r.pass ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
            {r.label}
          </span>
        ))}
        <span className={`text-[10px] font-semibold ml-auto ${colors[score]}`}>{label}</span>
      </div>
    </div>
  );
}

// ── Pincode tag input ──────────────────────────────────────────────────────────
function PincodeInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (/^\d{6}$/.test(v) && !values.includes(v)) {
      onChange([...values, v]);
      setInput('');
    } else if (!/^\d{6}$/.test(v)) {
      toast.error('Pincode must be exactly 6 digits');
    }
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="6-digit pincode, press Enter"
          maxLength={6}
        />
        <Button type="button" variant="outline" onClick={add} size="sm">Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map(p => (
            <span key={p} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-mono">
              {p}
              <button type="button" onClick={() => onChange(values.filter(x => x !== p))} className="text-blue-400 hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const STEPS = ['Account Setup', 'Profile Details'];

type FormData = {
  // Step 1
  name: string;
  phone: string;
  password: string;
  email: string;
  // Step 2
  fullName: string;
  dateOfBirth: string;
  gender: string;
  area: string;
  assignedPincodes: string[];
  commissionType: 'none' | 'percentage' | 'fixed';
  commissionRatePercent: string;
  joiningDate: string;
};

const EMPTY: FormData = {
  name: '', phone: '', password: '', email: '',
  fullName: '', dateOfBirth: '', gender: '', area: '',
  assignedPincodes: [], commissionType: 'none', commissionRatePercent: '', joiningDate: '',
};

export default function CreateAgentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const set = (key: keyof FormData, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const pwdStrength = checkPwd(form.password);

  const validateStep0 = () => {
    const e: typeof errors = {};
    if (!form.name.trim() || form.name.length < 2) e.name = 'Name must be at least 2 characters';
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number';
    if (pwdStrength.score < 5) e.password = 'Password does not meet all requirements';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.fullName.trim()) payload.fullName = form.fullName.trim();
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (form.gender) payload.gender = form.gender;
      if (form.area.trim()) payload.area = form.area.trim();
      if (form.assignedPincodes.length > 0) payload.assignedPincodes = form.assignedPincodes;
      payload.commissionType = form.commissionType;
      if (form.commissionType !== 'none' && form.commissionRatePercent) {
        payload.commissionRateBps = Math.round(parseFloat(form.commissionRatePercent) * 100);
      }
      if (form.joiningDate) payload.joiningDate = form.joiningDate;
      return agentApi.create(payload as any);
    },
    onSuccess: (res: any) => {
      const agentCode = res?.data?.user?.agentCode || res?.data?.profile?.agentCode;
      const userId = res?.data?.user?._id;
      toast.success(`Agent created successfully! Code: ${agentCode}`);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['reassignment-stats'] });
      navigate(userId ? `/agents/${userId}` : '/agents');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create agent'),
  });

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Create New Agent</h1>
          <p className="page-subtitle">Register a field agent with credentials and profile details</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors ${
              i < step ? 'bg-emerald-500 border-emerald-500 text-white' :
              i === step ? 'bg-blue-600 border-blue-600 text-white' :
              'border-slate-300 text-slate-400'
            }`}>
              {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === step ? 'text-blue-700' : i < step ? 'text-emerald-600' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className={`h-px w-8 ${i < step ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0 — Account Setup */}
      {step === 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900">Login Credentials</h2>
            <p className="text-xs text-slate-400">Used to log into the agent app</p>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Display Name *</label>
                <Input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Name shown in the app"
                />
                {errors.name && <p className="form-error">{errors.name}</p>}
              </div>
              <div>
                <label className="form-label">Phone Number *</label>
                <Input
                  value={form.phone}
                  onChange={e => set('phone', e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile (used as login ID)"
                  maxLength={10}
                />
                {errors.phone && <p className="form-error">{errors.phone}</p>}
              </div>
            </div>

            <div>
              <label className="form-label">Password *</label>
              <div className="relative">
                <Input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min 8 chars, uppercase + number + special"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthBar password={form.password} />
              {errors.password && <p className="form-error mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="form-label">Email (Optional)</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="agent@company.com"
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
          </div>
          <div className="px-6 pb-5 flex justify-end">
            <Button onClick={() => validateStep0() && setStep(1)}>
              Next: Profile Details <ChevronRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 1 — Profile Details */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Personal */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Personal Details</h2>
              <span className="text-xs text-slate-400">Optional — can be completed later</span>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Full Legal Name</label>
                  <Input value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="As per Aadhaar/PAN" />
                </div>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <Input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.gender}
                    onChange={e => set('gender', e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Joining Date</label>
                  <Input type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Territory */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-slate-900">Territory</h2></div>
            <div className="card-body space-y-4">
              <div>
                <label className="form-label">Area / Zone</label>
                <Input value={form.area} onChange={e => set('area', e.target.value)} placeholder="e.g. North Block, Pune" />
              </div>
              <div>
                <label className="form-label">Assigned Pincodes</label>
                <PincodeInput values={form.assignedPincodes} onChange={v => set('assignedPincodes', v)} />
              </div>
            </div>
          </div>

          {/* Commission */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-slate-900">Commission</h2></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Commission Type</label>
                  <select
                    className="form-input w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.commissionType}
                    onChange={e => set('commissionType', e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
                {form.commissionType !== 'none' && (
                  <div>
                    <label className="form-label">
                      Rate (%) <span className="text-slate-400 font-normal">→ stored as BPS</span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="50"
                      value={form.commissionRatePercent}
                      onChange={e => set('commissionRatePercent', e.target.value)}
                      placeholder="e.g. 2 = 2%"
                    />
                    {form.commissionRatePercent && (
                      <p className="text-xs text-slate-400 mt-0.5">= {Math.round(parseFloat(form.commissionRatePercent) * 100)} BPS</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pb-8">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <Button
              isLoading={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex-1 sm:flex-none sm:min-w-[160px]"
            >
              <UserPlus className="h-4 w-4 mr-2" /> Create Agent
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
