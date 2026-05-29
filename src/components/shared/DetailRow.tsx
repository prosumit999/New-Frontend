// src/components/shared/DetailRow.tsx
import { cn } from '../../utils/cn';

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function DetailRow({ label, value, className }: DetailRowProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center gap-1 py-2.5 border-b border-slate-50', className)}>
      <dt className="text-sm font-medium text-slate-500 sm:w-44 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-900">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
