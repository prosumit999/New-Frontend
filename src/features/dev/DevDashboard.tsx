// src/features/dev/DevDashboard.tsx
// Dev user landing page — system health overview and quick navigation.

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Calendar, ShieldCheck, Database, Settings, AlertTriangle,
  CheckCircle2, XCircle, ArrowRight, Code2, RefreshCw, FileText, Lock,
} from 'lucide-react';
import { devPanelApi } from '../../api/devPanel.api';
import { dayControlApi } from '../../api/dayControl.api';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue:   'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
    green:  'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
    amber:  'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
    red:    'from-red-500/20 to-rose-500/10 border-red-500/30 text-red-400',
    purple: 'from-purple-500/20 to-violet-500/10 border-purple-500/30 text-purple-400',
    slate:  'from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-400',
  };

  return (
    <div
      onClick={onClick}
      className={`relative bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-xl font-bold text-white leading-tight">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-white/5 shrink-0`}>
          <Icon className={`h-5 w-5 ${colorMap[color].split(' ').pop()}`} />
        </div>
      </div>
      {onClick && (
        <ArrowRight className="h-3.5 w-3.5 text-slate-500 absolute bottom-4 right-4" />
      )}
    </div>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────
function QuickAction({
  icon: Icon,
  title,
  description,
  href,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  badge?: { text: string; color: string };
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(href)}
      className="group w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 transition-all duration-200 hover:border-white/20"
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
          <Icon className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                {badge.text}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DevDashboard() {
  const navigate = useNavigate();

  const { data: instData, isLoading: instLoading, refetch } = useQuery({
    queryKey: ['dev-institution'],
    queryFn: () => devPanelApi.getInstitution(),
    staleTime: 30_000,
  });

  const { data: dayData } = useQuery({
    queryKey: ['day-status'],
    queryFn: () => dayControlApi.getStatus(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const institution = (instData as any)?.data?.data?.institution;
  const dayStatus = (dayData as any)?.data?.data;

  const isConfigured = institution?.isConfigured;
  const genesisDate = institution?.systemGenesisDate
    ? new Date(institution.systemGenesisDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : 'Not Set';

  const dayIsOpen = dayStatus?.isOpen;

  return (
    <div className="min-h-screen animate-fade-in space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Code2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Dev Control Center</h1>
              <p className="text-sm text-slate-400">Software vendor administration panel</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors mt-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${instLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Not Configured Banner ─────────────────────────────────────────── */}
      {!instLoading && !isConfigured && (
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/40 rounded-2xl p-5 flex gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-300">Institution Not Yet Configured</p>
            <p className="text-xs text-amber-400/80 mt-1">
              The institution master record is missing critical fields. Please configure the
              institution name, genesis date, and contact details before going live.
            </p>
          </div>
          <button
            onClick={() => navigate('/dev/panel')}
            className="shrink-0 flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold px-4 py-2 rounded-xl border border-amber-500/30 transition-colors"
          >
            Configure Now <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Stats Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Institution"
          value={institution?.shortName || institution?.name || '—'}
          sub={isConfigured ? 'Configured' : 'Not Configured'}
          color={isConfigured ? 'green' : 'amber'}
          onClick={() => navigate('/dev/panel')}
        />
        <StatCard
          icon={Calendar}
          label="Genesis Date"
          value={genesisDate}
          sub="System installation date"
          color="purple"
          onClick={() => navigate('/dev/panel')}
        />
        <StatCard
          icon={dayIsOpen ? ShieldCheck : Lock}
          label="Business Day"
          value={dayIsOpen ? 'OPEN' : 'CLOSED'}
          sub={dayStatus?.businessDate || 'No date set'}
          color={dayIsOpen ? 'green' : 'slate'}
        />
        <StatCard
          icon={Database}
          label="System"
          value="Operational"
          sub="All services running"
          color="blue"
          onClick={() => navigate('/dev/panel?tab=audit')}
        />
      </div>

      {/* ── Institution Summary ───────────────────────────────────────────── */}
      {institution?.name && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-white">Institution Summary</h2>
            <button
              onClick={() => navigate('/dev/panel')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              Edit <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Full Name', value: institution.name },
              { label: 'Short Name', value: institution.shortName || '—' },
              { label: 'Reg. Number', value: institution.registrationNumber || '—' },
              { label: 'GST Number', value: institution.gstNumber || '—' },
              { label: 'Phone', value: institution.phone || '—' },
              { label: 'Email', value: institution.email || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-medium text-white mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Legal Docs Status */}
          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-3 gap-3">
            {[
              { label: 'Privacy Policy', value: institution.privacyPolicy, updated: institution.privacyUpdatedAt },
              { label: 'Microfinance Rules', value: institution.microfinanceRules, updated: institution.rulesUpdatedAt },
              { label: 'Terms & Conditions', value: institution.termsAndConditions, updated: institution.termsUpdatedAt },
            ].map(({ label, value, updated }) => (
              <div key={label} className="flex items-center gap-2">
                {value ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-600 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-medium text-slate-300">{label}</p>
                  {updated && (
                    <p className="text-[10px] text-slate-500">
                      Updated {new Date(updated).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <QuickAction
            icon={Building2}
            title="Institution Configuration"
            description="Name, address, registration, branding, and contact details"
            href="/dev/panel"
          />
          <QuickAction
            icon={Calendar}
            title="System Genesis Date"
            description="Set the software installation date — controls backdate limits"
            href="/dev/panel?tab=genesis"
            badge={{ text: 'Critical', color: 'bg-red-500/20 text-red-400' }}
          />
          <QuickAction
            icon={FileText}
            title="Legal Documents"
            description="Privacy policy, microfinance rules, and terms & conditions"
            href="/dev/panel?tab=legal"
          />
          <QuickAction
            icon={Database}
            title="AppConfig Audit"
            description="View all operational config keys and their current values"
            href="/dev/panel?tab=audit"
          />
          <QuickAction
            icon={Lock}
            title="Change Dev Password"
            description="Update your software vendor account password"
            href="/dev/panel?tab=security"
          />
          <QuickAction
            icon={Settings}
            title="System Branding"
            description="Logo URL, primary color, and application tagline"
            href="/dev/panel?tab=branding"
          />
        </div>
      </div>
    </div>
  );
}
