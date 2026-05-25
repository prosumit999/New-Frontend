// src/components/shared/PiiRevealRow.tsx
// Reusable component for displaying masked PII (Aadhaar/PAN) with a controlled
// "View" flow that requires explicit confirmation before decrypting.
// Every successful decrypt is recorded in the AuditLog by the backend.
// Used by: CustomerDetailPage, AgentDetailPage
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { DetailRow } from './DetailRow';

interface PiiRevealRowProps {
  label: string;
  /** Masked value shown by default (e.g. "XXXX-XXXX-1234" or "XXXXXF123A") */
  masked?: string;
  /**
   * Async function that calls the backend to decrypt the value.
   * Must return { data: { aadhaar?: string; pan?: string; masked: string } }
   */
  fetchFn: () => Promise<{ data: { aadhaar?: string; pan?: string; masked: string } }>;
  /** Only admins and superadmins can reveal PII */
  isAdminOrAbove: boolean;
}

export function PiiRevealRow({ label, masked, fetchFn, isAdminOrAbove }: PiiRevealRowProps) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Two-step confirmation: first click shows "Access logged. Confirm?" prompt.
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // No masked value means no data was ever submitted
  if (!masked) return <DetailRow label={label} value="—" />;

  const handleReveal = async () => {
    if (!needsConfirmation) {
      // First click — show confirmation prompt, do NOT fetch yet
      setNeedsConfirmation(true);
      return;
    }
    // Second click — user confirmed, perform the audited fetch
    setIsLoading(true);
    setNeedsConfirmation(false);
    try {
      const res = await fetchFn();
      const value = res.data.aadhaar ?? res.data.pan ?? '—';
      setRevealed(value);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to decrypt. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHide = () => setRevealed(null);
  const handleCancel = () => setNeedsConfirmation(false);

  return (
    <div className="py-2 flex items-center justify-between gap-3 border-b border-slate-100 last:border-b-0">
      <dt className="text-xs font-medium text-slate-500 min-w-[80px]">{label}</dt>

      <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
        {/* The value: masked or revealed */}
        <dd className="text-sm font-mono text-slate-700">
          {revealed ?? masked}
        </dd>

        {/* Admin controls */}
        {isAdminOrAbove && !revealed && (
          needsConfirmation ? (
            /* Confirmation step */
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-amber-600 font-medium">
                Access will be logged. Confirm?
              </span>
              <button
                onClick={handleReveal}
                disabled={isLoading}
                className="text-xs px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? '…' : 'Yes, view'}
              </button>
              <button
                onClick={handleCancel}
                className="text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Initial "View" button */
            <button
              onClick={handleReveal}
              className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
              title="View decrypted value (access will be audit-logged)"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </button>
          )
        )}

        {/* Hide button once revealed */}
        {revealed && (
          <button
            onClick={handleHide}
            className="text-xs flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <EyeOff className="h-3.5 w-3.5" /> Hide
          </button>
        )}
      </div>
    </div>
  );
}
