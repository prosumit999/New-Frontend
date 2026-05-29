// src/features/reports/DailyTransactionReportPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Daily Transaction Register — mirrors the PDF format shown by the user:
//   • Date picker + Transaction Type filter
//   • Transactions grouped by type (Cash Receipt, Cash Payment, Bank Receipt, Transfer…)
//   • Columns: Txn ID | Type | Customer | Account | Amount | Payment Mode | Status | Performed By | Time
//   • Type-wise totals row + Grand total
//   • PDF export (via jsPDF) and CSV export
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft, FileDown, FileText, RefreshCw, Filter,
  Search, Calendar, ChevronDown, ChevronRight,
  Banknote, CreditCard, ArrowRightLeft, Landmark, TrendingUp,
  TrendingDown, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../../api/report.api';
import { Button } from '../../components/ui/Button';
import { useSystemStore } from '../../store/system.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { ReportInstitutionHeader } from '../../components/shared/ReportInstitutionHeader';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtRup = (v: number | string | undefined | null) => {
  const n = parseFloat(String(v ?? '0'));
  if (isNaN(n)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
  }).format(n);
};

const paise2rup = (p: number) => (p / 100).toFixed(2);

const TRANSACTION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'pigmy_collection', label: 'Cash Receipt (Pigmy)' },
  { value: 'saving_deposit', label: 'Saving Deposit' },
  { value: 'saving_withdrawal', label: 'Cash Payment (Withdrawal)' },
  { value: 'loan_disbursement', label: 'Loan Disbursement' },
  { value: 'loan_repayment', label: 'Loan Repayment' },
  { value: 'agent_deposit', label: 'Agent Deposit' },
  { value: 'cash_payment', label: 'Cash Payment' },
  { value: 'bank_receipt', label: 'Bank Receipt' },
  { value: 'transfer', label: 'Transfer' },
];

// Display group labels (mirrors the PDF headings)
const TYPE_GROUP_LABEL: Record<string, string> = {
  pigmy_collection:   'Cash Receipt (Pigmy Collection)',
  saving_deposit:     'Cash Receipt (Saving Deposit)',
  saving_withdrawal:  'Cash Payment (Saving Withdrawal)',
  loan_disbursement:  'Loan Disbursement',
  loan_repayment:     'Loan Repayment',
  agent_deposit:      'Agent Deposit / Transfer',
  cash_payment:       'Cash Payment',
  bank_receipt:       'Bank Receipt',
  transfer:           'Transfer',
};

const TYPE_COLOR: Record<string, { bg: string; text: string; icon: any }> = {
  pigmy_collection:  { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: Banknote },
  saving_deposit:    { bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-700',    icon: Banknote },
  saving_withdrawal: { bg: 'bg-orange-50 border-orange-200',   text: 'text-orange-700',  icon: TrendingDown },
  loan_disbursement: { bg: 'bg-purple-50 border-purple-200',   text: 'text-purple-700',  icon: Landmark },
  loan_repayment:    { bg: 'bg-teal-50 border-teal-200',       text: 'text-teal-700',    icon: TrendingUp },
  agent_deposit:     { bg: 'bg-indigo-50 border-indigo-200',   text: 'text-indigo-700',  icon: CreditCard },
  cash_payment:      { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     icon: TrendingDown },
  bank_receipt:      { bg: 'bg-cyan-50 border-cyan-200',       text: 'text-cyan-700',    icon: Landmark },
  transfer:          { bg: 'bg-slate-50 border-slate-200',     text: 'text-slate-700',   icon: ArrowRightLeft },
};

const STATUS_BADGE: Record<string, string> = {
  completed:  'bg-emerald-100 text-emerald-700',
  pending:    'bg-amber-100 text-amber-700',
  failed:     'bg-red-100 text-red-700',
  reversed:   'bg-slate-100 text-slate-500 line-through',
};

// ── Resolve account reference (human-readable number stored in t.reference) ──
const resolveRef = (t: any): string =>
  t.reference ||
  t.fromSavingAccount?.accountNumber ||
  t.toSavingAccount?.accountNumber ||
  t.fromPigmyAccount?.accountNumber ||
  t.toPigmyAccount?.accountNumber ||
  t.fromLoanAccount?.loanAccountNumber ||
  t.toLoanAccount?.loanAccountNumber ||
  '—';

// ── Narration builder — folds fee into note (banking standard) ────────────
const buildNarration = (t: any): string => {
  const base = t.note || (TYPE_GROUP_LABEL[t.type] || t.type?.replace(/_/g, ' ') || '—');
  if (t.feeInPaise && t.feeInPaise > 0) {
    return `${base} (incl. fee ₹${paise2rup(t.feeInPaise)})`;
  }
  return base;
};

// ── CSV Export ─────────────────────────────────────────────────────────────
function exportCSV(rows: any[], date: string, institutionName: string) {
  const headers = [
    'Date', 'Txn ID', 'Type', 'Customer', 'Customer Code',
    'Account Ref', 'Payment Mode', 'Narration',
    'Debit (Dr) ₹', 'Credit (Cr) ₹', 'Balance After ₹', 'Status', 'Performed By'
  ];
  const isIncome = (type: string) =>
    ['pigmy_collection', 'saving_deposit', 'loan_repayment', 'agent_deposit',
     'bank_receipt', 'saving_to_pigmy_transfer', 'loan_write_off_reversal',
     'loan_repayment_reversal'].includes(type);

  const csvRows = rows.map(t => {
    const amt = parseFloat(paise2rup(t.amountInPaise));
    const bal = t.balanceAfterInPaise != null ? parseFloat(paise2rup(t.balanceAfterInPaise)) : '';
    const income = isIncome(t.type);
    const narration = buildNarration(t).replace(/,/g, ';');
    return [
      t.businessDate ? format(new Date(t.businessDate), 'dd/MM/yyyy') : '—',
      t.transactionId,
      TYPE_GROUP_LABEL[t.type] || t.type,
      t.customer?.name || '—',
      t.customer?.customerCode || '—',
      resolveRef(t),
      (t.paymentMode || 'cash').toUpperCase(),
      `"${narration}"`,
      income ? '' : amt.toFixed(2),
      income ? amt.toFixed(2) : '',
      bal !== '' ? bal.toFixed(2) : '',
      (t.status || '').toUpperCase(),
      t.performedBy?.name || '—',
    ].join(',');
  });

  const bom = '\uFEFF';
  const csv = bom + [
    `${institutionName}`,
    `Daily Transaction Register — ${date}`,
    `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    '',
    headers.join(','),
    ...csvRows,
  ].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DailyTransactions_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF Export ─────────────────────────────────────────────────────────────
async function exportPDF(groups: Record<string, any[]>, date: string, institutionName: string, institutionAddress: string) {
  // Dynamic import to avoid bundle bloat
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header
  doc.setFontSize(13).setFont('helvetica', 'bold');
  doc.text(institutionName, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(institutionAddress, pageW / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text(`Daily Transaction Report — ${date}`, pageW / 2, y, { align: 'center' });
  y += 8;

  const isIncome = (type: string) =>
    ['pigmy_collection', 'saving_deposit', 'loan_repayment', 'agent_deposit', 'bank_receipt'].includes(type);

  let grandDebit = 0, grandCredit = 0;

  for (const [type, rows] of Object.entries(groups)) {
    if (!rows.length) continue;

    const groupLabel = TYPE_GROUP_LABEL[type] || type;
    let typeDebit = 0, typeCredit = 0;

    const tableRows = rows.map((t, i) => {
      const amt = t.amountInPaise / 100;
      const income = isIncome(t.type);
      const debit = income ? 0 : amt;
      const credit = income ? amt : 0;
      typeDebit += debit;
      typeCredit += credit;
      grandDebit += debit;
      grandCredit += credit;
      const narr = (t.note || TYPE_GROUP_LABEL[t.type] || t.type || '').substring(0, 40) +
        (t.feeInPaise > 0 ? ` (fee Rs.${(t.feeInPaise/100).toFixed(2)})` : '');
      return [
        i + 1,
        t.transactionId,
        t.customer?.name || '-',
        t.customer?.customerCode || '-',
        resolveRef(t),
        (t.paymentMode || 'cash').toUpperCase(),
        narr,
        debit > 0 ? debit.toFixed(2) : '',
        credit > 0 ? credit.toFixed(2) : '',
        t.balanceAfterInPaise != null ? (t.balanceAfterInPaise / 100).toFixed(2) : '-',
        (t.status || '').toUpperCase(),
        t.performedBy?.name || '-',
        t.businessDate ? format(new Date(t.businessDate), 'dd/MM/yy HH:mm') : '-',
      ];
    });

    // Section header
    doc.setFontSize(9).setFont('helvetica', 'bold');
    doc.text(groupLabel, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Txn ID', 'Customer', 'Code', 'Account Ref', 'Mode', 'Narration', 'Debit (Dr) Rs.', 'Credit (Cr) Rs.', 'Bal After Rs.', 'Status', 'By', 'Time']],
      body: [
        ...tableRows,
        ['', '', '', '', '', '', 'Type Total ->', typeDebit.toFixed(2), typeCredit.toFixed(2), '', '', '', ''],
      ],
      headStyles: { fillColor: [0, 0, 0], fontSize: 6.5, textColor: 255 },
      bodyStyles: { fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 6 },
        1: { cellWidth: 24 },
        2: { cellWidth: 28 },
        3: { cellWidth: 14 },
        4: { cellWidth: 22 },
        5: { cellWidth: 12 },
        6: { cellWidth: 30 },
        7: { cellWidth: 18, halign: 'right' },
        8: { cellWidth: 18, halign: 'right' },
        9: { cellWidth: 18, halign: 'right' },
        10: { cellWidth: 14 },
        11: { cellWidth: 18 },
        12: { cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.row.index === tableRows.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 6;
    if (y > 180) { doc.addPage(); y = 14; }
  }

  // Grand total
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text(`Grand Total -- Debit: Rs.${grandDebit.toFixed(2)}   Credit: Rs.${grandCredit.toFixed(2)}`, 14, y);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7).setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}   Printed: ${new Date().toLocaleTimeString('en-IN')}`, 14, doc.internal.pageSize.getHeight() - 6);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  doc.save(`DailyTransactions_${date}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function DailyTransactionReportPage() {
  const navigate = useNavigate();
  const branding = useSystemStore((s) => s.branding);
  const inst = (branding as any)?.institution || {};
  const institutionName = inst.name || 'Microfinance System';
  const institutionAddress = [
    inst?.address?.street || inst?.address?.line1 || '',
    inst?.address?.city || '',
    inst?.address?.state || '',
    inst?.address?.zipCode || inst?.address?.pincode || '',
  ].filter(Boolean).join(', ') || 'Institution Address';

  const { businessDate } = useBusinessDate();
  const today = businessDate || format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['pigmy_collection', 'saving_deposit']));
  const [isPdfExporting, setIsPdfExporting] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['daily-transactions', date, typeFilter],
    queryFn: () => reportApi.getDailyTransactionReport({
      date,
      type: typeFilter || undefined,
      limit: 500, // load all for the report
    }),
    staleTime: 30000,
  });

  const transactions: any[] = (data as any)?.data?.data?.transactions || [];

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(t =>
      t.transactionId?.toLowerCase().includes(q) ||
      t.customer?.name?.toLowerCase().includes(q) ||
      t.customer?.customerCode?.toLowerCase().includes(q) ||
      t.paymentMode?.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  // Group by type
  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const t of filtered) {
      const key = t.type || 'other';
      if (!g[key]) g[key] = [];
      g[key].push(t);
    }
    return g;
  }, [filtered]);

  // Totals
  const isIncomeType = (type: string) =>
    ['pigmy_collection', 'saving_deposit', 'loan_repayment', 'agent_deposit', 'bank_receipt'].includes(type);

  const grandTotals = useMemo(() => {
    let debit = 0, credit = 0, count = 0;
    for (const t of filtered) {
      const amt = t.amountInPaise / 100;
      if (isIncomeType(t.type)) credit += amt;
      else debit += amt;
      count++;
    }
    return { debit, credit, count };
  }, [filtered]);

  const toggleType = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handlePdfExport = async () => {
    setIsPdfExporting(true);
    try {
      await exportPDF(groups, format(new Date(date + 'T00:00:00'), 'dd-MM-yyyy'), institutionName, institutionAddress);
    } finally {
      setIsPdfExporting(false);
    }
  };

  const handleCsvExport = () => {
    exportCSV(filtered, format(new Date(date + 'T00:00:00'), 'dd-MM-yyyy'), institutionName);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <ReportInstitutionHeader
        reportTitle="Daily Transaction Register"
        dateRange={format(new Date(date + 'T00:00:00'), 'dd MMM yyyy')}
        subInfo={`${grandTotals.count} transactions`}
      />

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 page-header mb-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="page-title">Daily Transaction Register</h1>
          <p className="page-subtitle">All transactions for a business day — grouped by type with debit/credit totals</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCsvExport} disabled={!filtered.length}>
            <FileDown className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdfExport} isLoading={isPdfExporting} disabled={!filtered.length}>
            <FileText className="h-4 w-4 mr-1.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* ── Filters Bar ────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-body flex flex-wrap items-center gap-3">
          {/* Date */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Date:</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => setDate(e.target.value)}
              className="form-input py-2 text-sm"
            />
          </div>

          {/* Transaction Type */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="form-input py-2 text-sm"
            >
              {TRANSACTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Txn ID, customer name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input py-2 text-sm flex-1"
            />
          </div>

          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Summary Banner ─────────────────────────────────────────── */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-4 text-white">
            <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">Report Date</p>
            <p className="text-lg font-bold">{format(new Date(date + 'T00:00:00'), 'dd MMM yyyy')}</p>
            <p className="text-xs opacity-60 mt-0.5">{grandTotals.count} transactions</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white">
            <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">Total Credit (Inflow)</p>
            <p className="text-lg font-bold">{fmtRup(grandTotals.credit)}</p>
            <p className="text-xs opacity-60 mt-0.5">Cash & Bank Receipts</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white">
            <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">Total Debit (Outflow)</p>
            <p className="text-lg font-bold">{fmtRup(grandTotals.debit)}</p>
            <p className="text-xs opacity-60 mt-0.5">Payments & Disbursements</p>
          </div>
          <div className={`bg-gradient-to-br rounded-2xl p-4 text-white ${grandTotals.credit - grandTotals.debit >= 0 ? 'from-blue-500 to-indigo-600' : 'from-amber-500 to-orange-600'}`}>
            <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">Net Flow</p>
            <p className="text-lg font-bold">{fmtRup(Math.abs(grandTotals.credit - grandTotals.debit))}</p>
            <p className="text-xs opacity-60 mt-0.5">{grandTotals.credit - grandTotals.debit >= 0 ? 'Net Inflow' : 'Net Outflow'}</p>
          </div>
        </div>
      )}

      {/* ── Transaction Groups ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No transactions found</p>
            <p className="text-sm text-slate-400 mt-1">Try changing the date or removing filters</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([type, rows]) => {
            const groupLabel = TYPE_GROUP_LABEL[type] || type;
            const style = TYPE_COLOR[type] || TYPE_COLOR['transfer'];
            const Icon = style.icon;
            const isExpanded = expandedTypes.has(type);

            // Per-type totals
            let typeDebit = 0, typeCredit = 0;
            for (const t of rows) {
              const amt = t.amountInPaise / 100;
              if (isIncomeType(t.type)) typeCredit += amt;
              else typeDebit += amt;
            }

            return (
              <div key={type} className={`rounded-2xl border ${style.bg} overflow-hidden shadow-sm`}>
                {/* Group Header */}
                <button
                  className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-black/5 transition-colors"
                  onClick={() => toggleType(type)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-white/60`}>
                      <Icon className={`h-4 w-4 ${style.text}`} />
                    </div>
                    <div className="text-left">
                      <p className={`font-bold text-sm ${style.text}`}>{groupLabel}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{rows.length} transactions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {typeCredit > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400">Credit (CR)</p>
                        <p className="font-bold text-emerald-700">{fmtRup(typeCredit)}</p>
                      </div>
                    )}
                    {typeDebit > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400">Debit (DR)</p>
                        <p className="font-bold text-red-700">{fmtRup(typeDebit)}</p>
                      </div>
                    )}
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-slate-400" />
                      : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {/* Group Table */}
                {isExpanded && (
                  <div className="bg-white border-t border-slate-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Txn ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Ref</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Mode</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Narration</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-red-600 uppercase tracking-wider">Debit (Dr)</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider">Credit (Cr)</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Bal After</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">By</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rows.map((t: any, idx: number) => {
                          const amt = t.amountInPaise / 100;
                          const income = isIncomeType(t.type);
                          const isReversed = t.isReversed || t.status === 'reversed';
                          const accountRef = resolveRef(t);
                          const narration = buildNarration(t);
                          return (
                            <tr key={t._id} className={`hover:bg-slate-50 transition-colors ${isReversed ? 'opacity-50 line-through' : ''} ${income ? 'bg-emerald-50/10' : 'bg-red-50/10'}`}>
                              <td className="px-4 py-3 text-center text-xs text-slate-400 font-mono">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                  {t.transactionId || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm font-semibold text-slate-800">{t.customer?.name || '—'}</p>
                                {t.customer?.customerCode && (
                                  <p className="text-[10px] text-slate-400 font-mono">{t.customer.customerCode}</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                  {accountRef}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium uppercase">
                                  {t.paymentMode || 'CASH'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px]">
                                <p className="truncate" title={narration}>{narration}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {!income && (
                                  <span className="font-semibold text-red-600">{fmtRup(amt)}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {income && (
                                  <span className="font-semibold text-emerald-600">{fmtRup(amt)}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-700 font-medium text-sm">
                                {t.balanceAfterInPaise != null ? fmtRup(t.balanceAfterInPaise / 100) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${STATUS_BADGE[t.status] || 'bg-slate-100 text-slate-600'}`}>
                                  {isReversed
                                    ? <><XCircle className="h-3 w-3" />Reversed</>
                                    : t.status === 'completed'
                                      ? <><CheckCircle2 className="h-3 w-3" />Done</>
                                      : t.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600">{t.performedBy?.name || '—'}</td>
                              <td className="px-4 py-3 text-center text-xs text-slate-400 font-medium">
                                {t.businessDate ? format(new Date(t.businessDate), 'HH:mm') : '—'}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Type-wise Total Row */}
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                            {groupLabel} — Type Total
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-700">
                            {typeDebit > 0 ? fmtRup(typeDebit) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                            {typeCredit > 0 ? fmtRup(typeCredit) : '—'}
                          </td>
                          <td colSpan={4} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Grand Total Footer ─────────────────────────────────── */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold opacity-60 uppercase tracking-wider">Grand Total</p>
                <p className="text-sm opacity-70 mt-0.5">{grandTotals.count} transactions · {format(new Date(date + 'T00:00:00'), 'dd MMM yyyy')}</p>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-xs font-semibold opacity-60 uppercase tracking-wider">Total Debit (DR)</p>
                  <p className="text-2xl font-extrabold text-red-400">{fmtRup(grandTotals.debit)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold opacity-60 uppercase tracking-wider">Total Credit (CR)</p>
                  <p className="text-2xl font-extrabold text-emerald-400">{fmtRup(grandTotals.credit)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold opacity-60 uppercase tracking-wider">Net Flow</p>
                  <p className={`text-2xl font-extrabold ${grandTotals.credit - grandTotals.debit >= 0 ? 'text-blue-300' : 'text-amber-400'}`}>
                    {grandTotals.credit - grandTotals.debit >= 0 ? '+' : '-'}{fmtRup(Math.abs(grandTotals.credit - grandTotals.debit))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
