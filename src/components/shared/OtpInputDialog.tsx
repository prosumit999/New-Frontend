// src/components/shared/OtpInputDialog.tsx
// Reusable OTP entry modal with cooldown timer and resend support.
// Used by: CustomerDetailPage (phone verify, phone change), AgentDetailPage (same flows)
import { useEffect, useRef, useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface OtpInputDialogProps {
  /** Controls visibility */
  open: boolean;
  onClose: () => void;

  /** Text shown in the modal header */
  title: string;
  /** Subtitle / hint text (e.g. "Enter the 6-digit OTP sent to +91 98765 43210") */
  subtitle?: string;

  /** Called when the user clicks Verify with a valid 6-digit code */
  onVerify: (otp: string) => void;
  /** Called when the user clicks Resend */
  onResend?: () => void;

  /** Whether the verify action is in-flight */
  isVerifyLoading?: boolean;
  /** Whether the resend action is in-flight */
  isResendLoading?: boolean;

  /** Cooldown in seconds before Resend becomes available. 0 = available immediately. */
  initialCooldown?: number;
}

export function OtpInputDialog({
  open,
  onClose,
  title,
  subtitle,
  onVerify,
  onResend,
  isVerifyLoading = false,
  isResendLoading = false,
  initialCooldown = 30,
}: OtpInputDialogProps) {
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(initialCooldown);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state whenever the dialog opens
  useEffect(() => {
    if (open) {
      setOtp('');
      setCooldown(initialCooldown);
      // Auto-focus the input a tick after mount
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, initialCooldown]);

  // Countdown timer
  useEffect(() => {
    if (!open || cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [open, cooldown]);

  const handleResend = () => {
    onResend?.();
    setCooldown(initialCooldown);
  };

  const handleVerify = () => {
    if (otp.length !== 6) return;
    onVerify(otp);
  };

  // Dismiss on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-dialog-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 w-full max-w-sm">
        {/* Header */}
        <h3 id="otp-dialog-title" className="text-lg font-semibold text-slate-900 mb-1">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-slate-500 mb-5">{subtitle}</p>
        )}

        {/* OTP input */}
        <Input
          ref={inputRef}
          value={otp}
          inputMode="numeric"
          pattern="[0-9]*"
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
          }
          placeholder="······"
          maxLength={6}
          className="text-center text-2xl tracking-[0.6em] font-mono mb-5"
        />

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isVerifyLoading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            isLoading={isVerifyLoading}
            disabled={otp.length !== 6}
            onClick={handleVerify}
          >
            <Send className="h-4 w-4 mr-1.5" /> Verify
          </Button>
        </div>

        {/* Resend link with cooldown */}
        {onResend && (
          <p className="text-xs text-center text-slate-400 mt-3">
            {cooldown > 0 ? (
              <span>Resend available in {cooldown}s</span>
            ) : (
              <>
                Didn&apos;t get it?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                  disabled={isResendLoading}
                  onClick={handleResend}
                >
                  {isResendLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
                  Resend OTP
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
