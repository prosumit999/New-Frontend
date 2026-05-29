// src/features/superadmin/SuperadminDayControlPage.tsx
// Superadmin-only Day Control hub.
// Combines: current business day status, the normal open/close actions,
// AND the privileged Backdate Day Open feature — all in one place.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Sun, Moon, Lock, Eye, EyeOff, AlertTriangle, ShieldAlert,
  Calendar, Clock, CheckCircle, XCircle, RefreshCw, BarChart3,
  ArrowRight, History,
} from 'lucide-react';
import { dayControlApi } from '../../api/dayControl.api';
import { Button } from '../../components/ui/Button';
import { useBusinessDate } from '../../hooks/useBusinessDate';

// ─────────────────────────────────────────────────────────────────────────────
// BACKDATE CONFIRMATION MODAL — requires typing "BACKDATE" to confirm
// ─────────────────────────────────────────────────────────────────────────────
function BackdateConfirmModal({
  backdate, onConfirm, onCancel, loading,
}: {
  backdate: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  const [typed, setTyped] = useState('');
  const CONFIRM_WORD = 'BACKDATE';
  const displayDate = backdate
    ? new Date(backdate + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-t-2xl px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <Lock className="h-7 w-7" />
            <div>
              <h2 className="text-lg font-bold">Confirm Backdated Day Open</h2>
              <p className="text-amber-100 text-sm">This is a privileged superadmin action</p>
            </div>
          </div>
        </div>

        {/* Consequences */}
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
          <p className="text-sm font-semibold text-amber-900 mb-2">
            ⚠️  You are opening the business books for a PAST date:
          </p>
          <p className="text-lg font-bold text-amber-800 mb-3">{displayDate}</p>
          <ul className="space-y-1.5">
            {[
              'All transactions entered today will be stamped with this past date',
              'Receipt numbers and ledger entries will use this date',
              'This action is permanently recorded in the audit log',
              'Reports will reflect this backdated activity',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Confirmation input */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">
              Type{' '}
              <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                {CONFIRM_WORD}
              </span>{' '}
              to confirm:
            </label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
              placeholder={`Type ${CONFIRM_WORD} here...`}
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-0"
              disabled={typed !== CONFIRM_WORD || loading}
              isLoading={loading}
              onClick={onConfirm}
            >
              <Lock className="h-4 w-4 mr-1.5" /> Confirm Backdated Open
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SuperadminDayControlPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Backdate form state
  const [backdateValue, setBackdateValue] = useState('');
  const [backdatePassword, setBackdatePassword] = useState('');
  const [catchupMode, setCatchupMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Yesterday as max date for the picker (cannot backdate to today or future)
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  // Live business date status
  const {
    isOpen,
    businessDate,
    serverDate,
    displayDate,
    nextBusinessDate,
    nextBusinessDisplayDate,
    dayGapWarning,
    isLoading,
    isFetching,
    refetch,
    invalidate,
  } = useBusinessDate();

  // Mutation — backdate only (normal open/close is done from Day Control page)
  const backdateMutation = useMutation({
    mutationFn: (payload: { backdate: string; backdatePassword: string; catchupMode: boolean }) =>
      dayControlApi.openDay(payload),
    onSuccess: (res: any) => {
      const data = res?.data?.data ?? res?.data;
      toast.success(
        `✓ Backdated day opened for ${new Date(data?.targetBackdate + 'T00:00:00').toLocaleDateString('en-IN')}`
      );
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['day-collection-summary'] });
      setShowConfirmModal(false);
      setBackdateValue('');
      setBackdatePassword('');
      setCatchupMode(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Backdated open failed');
      setShowConfirmModal(false);
    },
  });

  const canSubmit = !!backdateValue && !!backdatePassword && !isOpen && !backdateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Day Control — Superadmin</h1>
          <p className="page-subtitle">
            Business day management &amp; secure backdating for past-date corrections
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            isFetching ? 'text-amber-500 animate-pulse' : 'text-slate-400 hover:text-amber-600'
          }`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh status
        </button>
      </div>

      {/* ── Current Business Day Status Card ───────────────────────────────── */}
      <div className={`card overflow-hidden ${isOpen ? 'border-emerald-200' : 'border-slate-200'}`}>
        <div className={`px-6 py-5 flex items-center gap-5 ${
          isOpen ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-slate-100 to-slate-50'
        }`}>
          <div className={`h-14 w-14 rounded-full flex items-center justify-center shadow-md ${
            isOpen ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-slate-300 to-slate-400'
          }`}>
            {isOpen ? <Sun className="h-7 w-7 text-white" /> : <Moon className="h-7 w-7 text-white" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className={`text-xl font-bold ${isOpen ? 'text-emerald-800' : 'text-slate-700'}`}>
                Day is {isOpen ? 'OPEN' : 'CLOSED'}
              </h2>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {isOpen ? '● LIVE' : '○ OFFLINE'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Calendar className="h-3.5 w-3.5" />
                <span className="font-medium">Business Date:</span>
                <span className={isOpen ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {displayDate || businessDate || '—'}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-medium">Server Date:</span>
                <span>{serverDate || '—'}</span>
              </span>
            </div>
            {!isOpen && nextBusinessDisplayDate && (
              <p className="mt-1 text-xs text-blue-600">
                Next suggested open: <strong>{nextBusinessDisplayDate}</strong>
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/day-control')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
          >
            Day Control Page <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Day Gap Warning */}
        {dayGapWarning && !isOpen && (
          <div className="px-6 py-4 bg-amber-50 border-t border-amber-200 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Day Gap Detected</p>
              <p className="text-xs text-amber-700 mt-0.5">{dayGapWarning.message}</p>
              <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-amber-700">
                <span>Last closed: <strong>{dayGapWarning.lastClosedDate}</strong></span>
                <span>Suggested next: <strong>{dayGapWarning.suggestedNextDate}</strong></span>
                <span>Gap: <strong>{dayGapWarning.gapDays} day(s)</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Quick status indicators */}
        <div className="px-6 py-3 flex gap-6 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            {isOpen
              ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              : <XCircle className="h-3.5 w-3.5 text-slate-400" />}
            Transactions {isOpen ? 'Permitted' : 'Blocked'}
          </span>
          <span className="flex items-center gap-1.5">
            {isOpen
              ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              : <XCircle className="h-3.5 w-3.5 text-slate-400" />}
            Collections {isOpen ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={() => navigate('/superadmin/audit-logs')}
            className="ml-auto flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            View Audit Trail
          </button>
        </div>
      </div>

      {/* ── Normal Day Control Notice ──────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex gap-3">
        <ShieldAlert className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Normal Day Open / Close</p>
          <p className="text-xs text-blue-700 mt-0.5">
            To open or close the business day for today's date, use the main{' '}
            <button
              onClick={() => navigate('/day-control')}
              className="underline font-semibold hover:text-blue-900"
            >
              Day Control page
            </button>
            . This page is dedicated to the <strong>Backdating</strong> feature for
            past-date corrections only.
          </p>
        </div>
      </div>

      {/* ── Backdating Form ────────────────────────────────────────────────── */}
      <div className={`card overflow-hidden ${isOpen ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Card Header */}
        <div className="card-header bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <Lock className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-amber-900">Backdate Day Open</h2>
            <p className="text-xs text-amber-700">Open books for a past date — requires password re-verification</p>
          </div>
          <span className="ml-auto text-xs font-bold bg-amber-200 text-amber-800 px-2.5 py-1 rounded-full">
            SUPERADMIN ONLY
          </span>
        </div>

        <div className="card-body space-y-5">
          {/* Day-open blocker warning */}
          {isOpen && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-2.5">
              <XCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">
                Day is currently <strong>OPEN</strong>. Close the current day before opening
                a backdated day.
              </p>
            </div>
          )}

          {/* Security notice */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">How this works:</span>{' '}
              Selecting a past date and providing your password opens the business books for
              that date. All subsequent transactions (collections, deposits, loans) will be
              stamped with the selected past date until the day is closed. This action is
              permanently logged in the audit trail with your user ID, IP address, and timestamp.
            </p>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target backdate */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Target Backdate <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 pointer-events-none" />
                <input
                  type="date"
                  max={yesterdayStr}
                  value={backdateValue}
                  onChange={(e) => setBackdateValue(e.target.value)}
                  disabled={isOpen}
                  className="w-full border border-amber-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Select any past date. Today and future dates are blocked.
              </p>
            </div>

            {/* Superadmin password */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Your Superadmin Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={backdatePassword}
                  onChange={(e) => setBackdatePassword(e.target.value)}
                  placeholder="Enter your account password"
                  disabled={isOpen}
                  autoComplete="current-password"
                  className="w-full border border-amber-300 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Re-authentication required. Your live password is verified against the database.
              </p>
            </div>
          </div>

          {/* ── CATCHUP MODE TOGGLE ──────────────────────── */}
          <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-300 mt-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Catch-up Mode</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Enable if this was a genuinely missed business day —
                EOD charges (penalties, missed-day tracking) will run on close.
                Leave OFF for ledger corrections.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                checked={catchupMode}
                onChange={(e) => setCatchupMode(e.target.checked)}
                className="sr-only peer"
                disabled={isOpen}
              />
              <div className={`w-11 h-6 bg-slate-200 rounded-full transition-colors relative
                              after:content-[''] after:absolute after:top-0.5 after:left-0.5
                              after:bg-white after:rounded-full after:h-5 after:w-5
                              after:transition-all ${catchupMode ? 'bg-amber-500 after:translate-x-5' : ''}`} />
            </label>
          </div>
          
          <div className={`rounded-lg p-3 text-xs font-medium ${
            catchupMode
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {catchupMode
              ? '⚠️ CATCH-UP MODE: Full EOD will run on close — penalties will be charged for this date.'
              : 'ℹ️ CORRECTION MODE: EOD skipped on close — ledger correction only, no charges.'}
          </div>

          {/* Preview of what will happen */}
          {backdateValue && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">Preview</p>
              <p className="text-sm text-amber-700">
                Clicking "Open Backdated Day" will set <code className="bg-amber-100 px-1 rounded">CURRENT_BUSINESS_DATE</code> to{' '}
                <strong>
                  {new Date(backdateValue + 'T00:00:00').toLocaleDateString('en-IN', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </strong>
                . All transactions until day-close will carry this date.
              </p>
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white border-0 text-base"
            disabled={!canSubmit}
            isLoading={backdateMutation.isPending}
            onClick={() => setShowConfirmModal(true)}
          >
            <Lock className="h-5 w-5 mr-2" />
            Open Backdated Day
          </Button>
        </div>
      </div>

      {/* ── Security Notes Card ────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Security &amp; Compliance Notes</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
            {[
              { icon: CheckCircle, color: 'text-emerald-500', text: '6-layer server-side validation before any change is made' },
              { icon: CheckCircle, color: 'text-emerald-500', text: 'Password verified live against database using bcrypt — JWT is not trusted for this action' },
              { icon: CheckCircle, color: 'text-emerald-500', text: 'Atomic write — DAY_STATUS and CURRENT_BUSINESS_DATE updated in one MongoDB operation' },
              { icon: CheckCircle, color: 'text-emerald-500', text: 'Audit log entry uses DAY_OPENED_BACKDATED (separate from DAY_OPENED) for compliance querying' },
              { icon: AlertTriangle, color: 'text-amber-500', text: 'Failed password attempts are logged as BACKDATE_AUTH_FAILED for brute-force monitoring' },
              { icon: AlertTriangle, color: 'text-amber-500', text: 'Backdate target must be strictly in the past — today and future dates are blocked at server level' },
            ].map(({ icon: Icon, color, text }, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
            <button
              onClick={() => navigate('/superadmin/audit-logs')}
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              View Backdating Audit Logs
            </button>
            <button
              onClick={() => navigate('/day-control')}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              Go to Day Control Page
            </button>
          </div>
        </div>
      </div>

      {/* ── Confirmation Modal ─────────────────────────────────────────────── */}
      {showConfirmModal && (
        <BackdateConfirmModal
          backdate={backdateValue}
          onConfirm={() =>
            backdateMutation.mutate({ backdate: backdateValue, backdatePassword, catchupMode })
          }
          onCancel={() => setShowConfirmModal(false)}
          loading={backdateMutation.isPending}
        />
      )}
    </div>
  );
}
