// src/components/shared/ReportInstitutionHeader.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable institution header banner for all report pages.
// Shows centered logo thumbnail + institution name + contact/address details.
// Reads branding data from the system store (Cloudinary-sourced).
// ─────────────────────────────────────────────────────────────────────────────
import { useSystemStore } from '../../store/system.store';
import { Building2 } from 'lucide-react';

interface ReportInstitutionHeaderProps {
  /** Optional subtitle below institution name (e.g. "Daily Transaction Report") */
  reportTitle?: string;
  /** Optional date range string shown in the right column */
  dateRange?: string;
  /** Optional additional info shown below date range */
  subInfo?: string;
}

export function ReportInstitutionHeader({
  reportTitle,
  dateRange,
  subInfo,
}: ReportInstitutionHeaderProps) {
  const branding = useSystemStore((s) => s.branding);
  const inst = (branding as any)?.institution || {};

  const logoUrl: string = inst.logoUrl || '';
  const name: string = inst.name || 'Microfinance Institution';
  const regNo: string = inst.registrationNumber || inst.gstNumber || '';
  const phone: string = inst.contactPhone || inst.phone || '';
  const email: string = inst.contactEmail || inst.email || '';

  const addrParts: string[] = [
    inst.address?.street || inst.address?.line1 || '',
    inst.address?.city || '',
    inst.address?.state || '',
    inst.address?.zipCode || inst.address?.pincode || '',
  ].filter(Boolean);
  const address = addrParts.join(', ');

  return (
    <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-lg mb-2">
      <div className="flex items-center gap-5 px-6 py-5">

        {/* ── Logo (centered vertically) ───────────────────────────── */}
        <div className="shrink-0 flex items-center justify-center">
          <div className={`w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center border-2 shadow-xl ${
            logoUrl ? 'bg-white border-white/30' : 'bg-white/10 border-white/10'
          }`}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${name} logo`}
                className="w-full h-full object-contain p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Building2 className="h-7 w-7 text-white/40" />
            )}
          </div>
        </div>

        {/* ── Institution Details (center) ─────────────────────────── */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold text-white tracking-wide leading-tight truncate">
            {name.toUpperCase()}
          </h2>
          {regNo && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">Reg: {regNo}</p>
          )}
          {address && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{address}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-1">
            {phone && (
              <span className="text-xs text-slate-400">📞 {phone}</span>
            )}
            {email && (
              <span className="text-xs text-slate-400">✉ {email}</span>
            )}
          </div>
        </div>

        {/* ── Report Title / Date (right column) ───────────────────── */}
        {(reportTitle || dateRange) && (
          <div className="shrink-0 text-right border-l border-white/10 pl-5">
            {reportTitle && (
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">
                {reportTitle}
              </p>
            )}
            {dateRange && (
              <p className="text-sm font-semibold text-white">{dateRange}</p>
            )}
            {subInfo && (
              <p className="text-xs text-slate-400 mt-0.5">{subInfo}</p>
            )}
          </div>
        )}
      </div>

      {/* Bottom accent strip */}
      <div className="h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500" />
    </div>
  );
}

export default ReportInstitutionHeader;
