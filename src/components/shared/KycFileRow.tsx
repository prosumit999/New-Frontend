// src/components/shared/KycFileRow.tsx
// Reusable file-picker row used in KYC document submission flows.
// Provides a client-side size guard before the file even reaches the network.
// Used by: CustomerDetailPage, AgentDetailPage
import { useRef } from 'react';
import { FileUp, X } from 'lucide-react';

const MAX_DEFAULT_MB = 5;

interface KycFileRowProps {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
  /** Max allowed file size in MB. Defaults to 5. Shows inline error if exceeded. */
  maxSizeMB?: number;
  accept?: string;
}

export function KycFileRow({
  label,
  required = false,
  file,
  onChange,
  maxSizeMB = MAX_DEFAULT_MB,
  accept = 'image/jpeg,image/png,image/webp,application/pdf',
}: KycFileRowProps) {
  const ref = useRef<HTMLInputElement>(null);
  const maxBytes = maxSizeMB * 1024 * 1024;
  const isTooLarge = file !== null && file.size > maxBytes;

  const handleSelect = (selected: File | null) => {
    if (!selected) { onChange(null); return; }
    // Immediate client-side guard — prevents wasted upload attempt
    if (selected.size > maxBytes) {
      // Still set the file so the error message is visible, but parent must
      // block submission when isTooLarge is truthy.
      onChange(selected);
      return;
    }
    onChange(selected);
  };

  return (
    <div>
      <label className="form-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
          ${isTooLarge
            ? 'border-red-400 bg-red-50'
            : file
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-slate-200 hover:border-blue-400 bg-slate-50'}`}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') ref.current?.click(); }}
      >
        <FileUp
          className={`h-4 w-4 shrink-0 ${isTooLarge ? 'text-red-500' : file ? 'text-emerald-600' : 'text-slate-400'}`}
        />
        <span
          className={`text-sm truncate flex-1 ${isTooLarge ? 'text-red-700 font-medium' : file ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}
        >
          {file ? file.name : 'Click to choose file…'}
        </span>

        {file && (
          <button
            type="button"
            aria-label="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              if (ref.current) ref.current.value = '';
            }}
            className="shrink-0 text-slate-400 hover:text-red-500 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0] || null)}
        />
      </div>

      {/* File size info or error */}
      {file && !isTooLarge && (
        <p className="text-xs text-emerald-600 mt-0.5">
          {(file.size / 1024).toFixed(0)} KB — OK
        </p>
      )}
      {isTooLarge && (
        <p className="text-xs text-red-600 mt-0.5 font-medium">
          File too large ({(file.size / 1024 / 1024).toFixed(1)} MB). Max {maxSizeMB} MB allowed.
        </p>
      )}
    </div>
  );
}
