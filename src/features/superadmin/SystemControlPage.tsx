// src/features/superadmin/SystemControlPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Lock, Unlock, MessageSquare, MessageSquareOff,
  Settings, Save, AlertTriangle, CheckCircle, Edit3, X,
} from 'lucide-react';
import { superadminApi } from '../../api/superadmin.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ── Config key metadata — labels + units for human-readable display ──────────
const CONFIG_META: Record<string, { label: string; unit?: string; helpText?: string; isRupees?: boolean; isBps?: boolean }> = {
  SAVINGS_OPENING_CHARGE:     { label: 'Savings Account Opening Charge', unit: '₹', helpText: 'Fee charged when opening a saving account', isRupees: true },
  PROCESSING_FEE_BPS:         { label: 'Default Processing Fee', unit: '%', helpText: 'Default loan processing fee in BPS (100 BPS = 1%)', isBps: true },
  DEFAULT_INTEREST_RATE_BPS:  { label: 'Default Interest Rate', unit: '%', helpText: 'Default annual loan interest rate in BPS', isBps: true },
  PENALTY_EXTRA_RATE_BPS:     { label: 'Penalty Extra Rate', unit: '%', helpText: 'Additional interest rate for overdue loans in BPS', isBps: true },
  LATE_PENALTY_EXTRA_BPS:     { label: 'Late Penalty Extra Rate', unit: '%', helpText: 'Extra BPS applied for pigmy late days', isBps: true },
  MAX_ALLOWED_LEAVES_PER_MONTH: { label: 'Max Allowed Leaves / Month', unit: 'days', helpText: 'Maximum missed collection days before penalty applies' },
  PENALTY_AMOUNT_PER_MISSED_DAY: { label: 'Penalty Per Missed Day', unit: '₹', helpText: 'Fixed penalty amount per missed pigmy collection day', isRupees: true },
  MAX_LOGIN_ATTEMPTS:         { label: 'Max Login Attempts', unit: 'attempts', helpText: 'Consecutive failures before account is locked' },
  LOCK_DURATION_MINUTES:      { label: 'Account Lock Duration', unit: 'minutes', helpText: 'How long an account stays locked after max failed logins' },
};

function toDisplayValue(key: string, raw: number): string {
  const meta = CONFIG_META[key];
  if (!meta) return String(raw);
  if (meta.isRupees) return String(raw / 100);
  if (meta.isBps) return String(raw / 100); // BPS → %
  return String(raw);
}

function toStorageValue(key: string, display: string): number {
  const meta = CONFIG_META[key];
  const num = parseFloat(display);
  if (!meta || isNaN(num)) return num;
  if (meta.isRupees) return Math.round(num * 100); // ₹ → paise
  if (meta.isBps) return Math.round(num * 100); // % → BPS
  return Math.round(num);
}

export default function SystemControlPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmLock, setConfirmLock] = useState(false);

  // Load dashboard (system status)
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['sa-dashboard'],
    queryFn: () => superadminApi.getDashboard(),
  });

  // Load config
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['sa-config'],
    queryFn: () => superadminApi.getConfig(),
  });

  const system = dashData?.data?.data?.system as any;
  const configs: any[] = configData?.data?.data?.configs || [];

  const isLocked = system?.isLocked;
  const smsEnabled = system?.smsEnabled;

  // Lock / Unlock
  const lockMutation = useMutation({
    mutationFn: () => isLocked ? superadminApi.unlockSystem() : superadminApi.lockSystem(),
    onSuccess: (res: any) => {
      toast.success(res?.data?.data?.message || res?.data?.message || (isLocked ? 'System unlocked' : 'System locked'));
      queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
      setConfirmLock(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Action failed'),
  });

  // SMS toggle
  const smsMutation = useMutation({
    mutationFn: () => superadminApi.toggleSms({ enabled: !smsEnabled }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.data?.message || res?.data?.message || 'SMS updated');
      queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Action failed'),
  });

  // Config update
  const configMutation = useMutation({
    mutationFn: (vars: { key: string; value: number }) => superadminApi.updateConfig(vars),
    onSuccess: (res: any) => {
      toast.success(res?.data?.data?.message || res?.data?.message || 'Config updated');
      queryClient.invalidateQueries({ queryKey: ['sa-config'] });
      setEditingKey(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  const startEdit = (cfg: any) => {
    setEditingKey(cfg.key);
    setEditValue(toDisplayValue(cfg.key, cfg.value));
  };

  const saveEdit = (key: string) => {
    const storageVal = toStorageValue(key, editValue);
    if (isNaN(storageVal)) {
      toast.error('Please enter a valid number');
      return;
    }
    configMutation.mutate({ key, value: storageVal });
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">System Control</h1>
        <p className="page-subtitle">Manage system lock, global SMS, and business configuration</p>
      </div>

      {/* ── System Lock Card ─────────────────────────────────── */}
      <div className={`card overflow-hidden ${isLocked ? 'border-red-200' : 'border-emerald-200'}`}>
        <div className={`px-6 py-4 flex items-center gap-3 ${isLocked ? 'bg-red-50' : 'bg-emerald-50'}`}>
          {isLocked
            ? <Lock className="h-5 w-5 text-red-600" />
            : <Unlock className="h-5 w-5 text-emerald-600" />}
          <h2 className="font-semibold text-slate-900">System Lock</h2>
          <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${
            isLocked ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'
          }`}>
            {dashLoading ? '...' : isLocked ? 'LOCKED' : 'OPERATIONAL'}
          </span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-5">
            {isLocked
              ? '⚠️ System is currently locked. All admin banking operations (deposits, loans, collections, accounts) are blocked. Only superadmin can unlock.'
              : 'System is operational. Locking freezes all admin operations without affecting read-only views.'}
          </p>
          {!confirmLock ? (
            <Button
              variant={isLocked ? 'default' : 'destructive'}
              onClick={() => setConfirmLock(true)}
              disabled={dashLoading}
              className="w-full sm:w-auto"
            >
              {isLocked ? <><Unlock className="h-4 w-4 mr-2" />Unlock System</> : <><Lock className="h-4 w-4 mr-2" />Lock System</>}
            </Button>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 font-medium">
                  {isLocked
                    ? 'Confirm unlock? This will restore all admin operations.'
                    : 'Confirm lock? This will immediately block ALL admin operations!'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={isLocked ? 'default' : 'destructive'}
                  size="sm"
                  isLoading={lockMutation.isPending}
                  onClick={() => lockMutation.mutate()}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Yes, {isLocked ? 'Unlock' : 'Lock'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmLock(false)}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SMS Toggle Card ───────────────────────────────────── */}
      <div className="card">
        <div className={`px-6 py-4 flex items-center gap-3 ${smsEnabled ? 'bg-blue-50' : 'bg-slate-50'}`}>
          {smsEnabled
            ? <MessageSquare className="h-5 w-5 text-blue-600" />
            : <MessageSquareOff className="h-5 w-5 text-slate-400" />}
          <h2 className="font-semibold text-slate-900">Global SMS Notifications</h2>
          <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${
            smsEnabled ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {dashLoading ? '...' : smsEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-5">
            {smsEnabled
              ? 'SMS is active. Customers will receive OTP verification, deposit confirmations, and account alerts.'
              : 'SMS is disabled globally. No SMS will be sent regardless of individual account settings.'}
          </p>
          <Button
            variant={smsEnabled ? 'destructive' : 'default'}
            isLoading={smsMutation.isPending}
            disabled={dashLoading}
            onClick={() => smsMutation.mutate()}
          >
            {smsEnabled
              ? <><MessageSquareOff className="h-4 w-4 mr-2" />Disable SMS</>
              : <><MessageSquare className="h-4 w-4 mr-2" />Enable SMS</>}
          </Button>
        </div>
      </div>

      {/* ── System Config Card ────────────────────────────────── */}
      <div className="card">
        <div className="px-6 py-4 bg-slate-50 flex items-center gap-3">
          <Settings className="h-5 w-5 text-slate-600" />
          <h2 className="font-semibold text-slate-900">Business Configuration</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {configLoading ? (
            <div className="px-6 py-8 text-center text-slate-500">Loading config...</div>
          ) : configs.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">No editable config keys found.</div>
          ) : (
            configs.map((cfg) => {
              const meta = CONFIG_META[cfg.key];
              const label = meta?.label || cfg.key.replace(/_/g, ' ');
              const displayValue = toDisplayValue(cfg.key, cfg.value);
              const isEditing = editingKey === cfg.key;

              return (
                <div key={cfg.key} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{label}</p>
                      {meta?.helpText && (
                        <p className="text-xs text-slate-500 mt-0.5">{meta.helpText}</p>
                      )}
                      {!isEditing && (
                        <p className="text-sm font-semibold text-blue-600 mt-1">
                          {meta?.unit === '₹' ? `₹${displayValue}` : meta?.unit === '%' ? `${displayValue}%` : `${displayValue}${meta?.unit ? ` ${meta.unit}` : ''}`}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {!isEditing ? (
                        <Button variant="ghost" size="sm" onClick={() => startEdit(cfg)}>
                          <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Edit
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setEditingKey(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          type="number"
                          step="any"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={`Enter value in ${meta?.unit || 'units'}`}
                          autoFocus
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          {meta?.isRupees && 'Enter amount in ₹ (will be stored as paise)'}
                          {meta?.isBps && 'Enter as % (e.g. 2 = 2%, will be stored as 200 BPS)'}
                          {!meta?.isRupees && !meta?.isBps && `Enter value in ${meta?.unit || 'base units'}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        isLoading={configMutation.isPending && editingKey === cfg.key}
                        onClick={() => saveEdit(cfg.key)}
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" /> Save
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
