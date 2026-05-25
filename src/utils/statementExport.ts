// src/utils/statementExport.ts
// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND STATEMENT EXPORT — Single Source of Truth
// Used by: SavingDetailPage, PigmyDetailPage, LoanDetailPage
//
// CSV:  Pure browser Blob — zero dependencies
// PDF:  jsPDF + jspdf-autotable
//
// Institution data is currently placeholder — will be replaced by an
// InstitutionSettings model fetch once that feature is built.
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isCreditTransaction } from './format';
import { sanitizePdfText } from './reportExport';

// ── Institution data is sourced from branding parameter (InstitutionConfig model)
// No more hardcoded placeholder — callers pass branding from useSystemStore.

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (paise: number | undefined | null): string => {
  const val = (paise ?? 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const fmtDate = (d: string | undefined | null): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtDateTime = (d: string | undefined | null): string => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT / DEBIT DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────
// Delegates to the canonical isCreditTransaction() from format.ts.
// The accountType parameter determines the context — same transaction type
// can be credit on one account and debit on another (e.g., transfers).
// See format.ts for the full rules and documentation.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Transaction row type ─────────────────────────────────────────────────────
export interface TxRow {
  _id?: string;
  transactionId?: string;
  type?: string;
  amountInPaise?: number;
  feeInPaise?: number;
  netAmountInPaise?: number;
  balanceAfterInPaise?: number;
  reference?: string;
  note?: string;
  status?: string;
  businessDate?: string;
  createdAt?: string;
  paymentMode?: string;
  utrNumber?: string;
  chequeNumber?: string;
  performedBy?: { name?: string; role?: string };
}

export interface AccountInfo {
  accountNumber?: string;
  balanceInPaise?: number;
  status?: string;
  openedAt?: string;
  createdAt?: string;
  customer?: {
    name?: string;
    customerCode?: string;
    phone?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function exportStatementCSV(
  transactions: TxRow[],
  account: AccountInfo,
  branding: any,
  dateRange?: { from?: string; to?: string },
  accountType: 'saving' | 'pigmy' | 'loan' = 'saving',
): void {
  const headers = [
    'Date',
    'Transaction ID',
    'Type',
    'Account Ref',
    'Payment Mode',
    'Narration',
    'Debit (Dr)',
    'Credit (Cr)',
    'Balance After',
    'Performed By',
  ];

  const rows = transactions.map((tx) => {
    const credit = isCreditTransaction(tx.type ?? '', accountType);
    const debitVal  = !credit ? fmt(tx.amountInPaise) : '';
    const creditVal = credit  ? fmt(tx.amountInPaise) : '';
    // Banking standard: fold fee into narration, not a separate column
    const narration = tx.note
      ? (tx.feeInPaise && tx.feeInPaise > 0 ? `${tx.note} (fee Rs.${fmt(tx.feeInPaise)})` : tx.note)
      : (tx.type ?? '').replace(/_/g, ' ');
    return [
      fmtDate(tx.businessDate ?? tx.createdAt),
      tx.transactionId ?? '',
      (tx.type ?? '').replace(/_/g, ' '),
      tx.reference ?? '',          // Account reference number
      tx.paymentMode ?? '',
      `"${narration.replace(/"/g, '""')}"`,
      debitVal,
      creditVal,
      tx.balanceAfterInPaise != null ? fmt(tx.balanceAfterInPaise) : '',
      tx.performedBy?.name ?? 'System',
    ];
  });

  const metaRows = [
    [`# Account Statement — ${account.accountNumber ?? ''}`],
    [`# Institution: ${branding?.institution?.name || 'Microfinance Institution'}`],
    [`# Customer: ${account.customer?.name ?? '—'} (${account.customer?.customerCode ?? '—'})`],
    [`# Phone: ${account.customer?.phone ?? '—'}`],
    [`# Balance: Rs. ${fmt(account.balanceInPaise)}`],
    [`# Status: ${account.status ?? '—'}`],
    [`# Opened: ${fmtDate(account.openedAt ?? account.createdAt)}`],
    dateRange?.from || dateRange?.to
      ? [`# Period: ${dateRange.from ? fmtDate(dateRange.from) : 'All'} to ${dateRange.to ? fmtDate(dateRange.to) : 'Present'}`]
      : [`# Period: All Transactions`],
    [`# Generated: ${fmtDateTime(new Date().toISOString())}`],
    [],
  ];

  const allRows = [
    ...metaRows.map((r) => r.join(',')),
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ];

  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const csvContent = bom + allRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `Statement_${account.accountNumber}_${new Date().toISOString().split('T')[0]}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function exportStatementPDF(
  transactions: TxRow[],
  account: AccountInfo,
  branding: any,
  dateRange?: { from?: string; to?: string },
  accountType: 'saving' | 'pigmy' | 'loan' = 'saving',
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  // ── Header Banner ──────────────────────────────────────────────────────────
  doc.setFillColor(30, 64, 175); // #1e40af — blue
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  const instName = branding?.institution?.name || 'MICROFINANCE INSTITUTION';
  const instReg = branding?.institution?.registrationNumber ? `Reg: ${branding.institution.registrationNumber}` : '';
  const instPhone = branding?.institution?.contactPhone ? `Ph: ${branding.institution.contactPhone}` : '';
  const instEmail = branding?.institution?.contactEmail ? `Email: ${branding.institution.contactEmail}` : '';
  const addrParts = [
    branding?.institution?.address?.street,
    branding?.institution?.address?.city,
    branding?.institution?.address?.state,
    branding?.institution?.address?.zipCode,
  ].filter(Boolean);
  const instAddr = addrParts.length > 0 ? addrParts.join(', ') : '';

  const bottomHeaderLine = [instReg, instPhone, instEmail].filter(Boolean).join('  |  ');

  // ── Logo (if available) ──
  const logoUrl = branding?.institution?.logoUrl || '';
  let textStartX = 10;
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', 6, 2, 18, 18);
      textStartX = 27;
    } catch { /* skip logo if load fails */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(sanitizePdfText(instName).toUpperCase(), textStartX, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(191, 219, 254); // #bfdbfe
  doc.text(sanitizePdfText(bottomHeaderLine), textStartX, 15);
  if (instAddr) doc.text(sanitizePdfText(instAddr), textStartX, 19.5);

  // ── Sub-header title bar ───────────────────────────────────────────────────
  doc.setFillColor(29, 78, 216); // #1d4ed8
  doc.rect(0, 22, pageWidth, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ACCOUNT STATEMENT', 10, 28.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Generated: ${sanitizePdfText(fmtDateTime(now.toISOString()))}`, pageWidth - 10, 28.5, { align: 'right' });

  // ── Account Info Box ───────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.roundedRect(10, 34, pageWidth - 20, 28, 2, 2, 'FD');

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('ACCOUNT NUMBER', 14, 40);
  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(account.accountNumber ?? '—', 14, 46);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('CURRENT BALANCE', pageWidth / 2, 40);
  doc.setTextColor(21, 128, 61); // green
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Rs. ${fmt(account.balanceInPaise)}`, pageWidth / 2, 46);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const infoLine1 = `Customer: ${account.customer?.name ?? '—'}  |  Code: ${account.customer?.customerCode ?? '—'}  |  Phone: ${account.customer?.phone ?? '—'}`;
  const infoLine2 = `Status: ${(account.status ?? '').toUpperCase()}  |  Opened: ${fmtDate(account.openedAt ?? account.createdAt)}  |  Period: ${dateRange?.from ? fmtDate(dateRange.from) : 'All'} – ${dateRange?.to ? fmtDate(dateRange.to) : 'Present'}`;
  doc.text(sanitizePdfText(infoLine1), 14, 54);
  doc.text(sanitizePdfText(infoLine2), 14, 59);

  // ── Build table rows ───────────────────────────────────────────────────────
  // API returns transactions newest-first. For a proper statement, we read chronologically (oldest-first).
  const chronoTx = [...transactions].reverse();
  const tableBody: string[][] = [];

  if (chronoTx.length > 0) {
    const oldestRow = chronoTx[0];
    if (oldestRow.balanceAfterInPaise != null) {
      const isCredit = isCreditTransaction(oldestRow.type ?? '', accountType);
      // For all account types, Credit INCREASES the tracked balance, so Balance Before = After - Amount.
      // Debit DECREASES the tracked balance, so Balance Before = After + Amount.
      const openBalPaise = isCredit
        ? oldestRow.balanceAfterInPaise - (oldestRow.amountInPaise || 0)
        : oldestRow.balanceAfterInPaise + (oldestRow.amountInPaise || 0);

      tableBody.push([
        '—',
        '—',
        '—',
        'Opening Balance',
        '',
        '',
        `Rs. ${fmt(openBalPaise)}`,
        '—',
      ]);
    }
  }

  chronoTx.forEach((tx) => {
    const credit = isCreditTransaction(tx.type ?? '', accountType);
    // Banking standard: fold feeInPaise into narration
    const narration = tx.note
      ? (tx.feeInPaise && tx.feeInPaise > 0 ? `${tx.note} (fee Rs.${fmt(tx.feeInPaise)})` : tx.note)
      : (tx.type ?? '').replace(/_/g, ' ');
    tableBody.push([
      sanitizePdfText(fmtDate(tx.businessDate ?? tx.createdAt)),
      sanitizePdfText(tx.transactionId ?? '—'),
      sanitizePdfText(tx.reference ?? '—'),          // Account reference
      sanitizePdfText(narration),                      // Narration (note + fee)
      !credit ? `Rs. ${fmt(tx.amountInPaise)}` : '',  // Debit (Dr) column
      credit  ? `Rs. ${fmt(tx.amountInPaise)}` : '',  // Credit (Cr) column
      tx.balanceAfterInPaise != null ? `Rs. ${fmt(tx.balanceAfterInPaise)}` : '—',
      sanitizePdfText(tx.performedBy?.name ?? 'System'),
    ]);
  });

  // ── AutoTable with per-cell color callbacks ────────────────────────────────
  autoTable(doc, {
    startY: 65,
    head: [['Date', 'Txn Reference', 'Account Ref', 'Narration', 'Debit (Dr)', 'Credit (Cr)', 'Bal. After', 'By']],
    body: tableBody.length > 0
      ? tableBody
      : [['—', '—', '—', 'No transactions found for this period', '', '', '', '']],
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [55, 65, 81],
      lineColor: [229, 231, 235],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 18 },          // Date
      1: { cellWidth: 32 },          // Txn ID
      2: { cellWidth: 26 },          // Account Ref
      3: { cellWidth: 40 },          // Narration (widest — human-readable)
      4: { cellWidth: 22, halign: 'right' },  // Debit
      5: { cellWidth: 22, halign: 'right' },  // Credit
      6: { cellWidth: 22, halign: 'right' },  // Balance
      7: { cellWidth: 18 },          // By
    },
    margin: { left: 10, right: 10 },

    // Per-cell text color: Debit = red, Credit = green
    willDrawCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 4 && data.cell.text?.[0]) {
          doc.setTextColor(220, 38, 38); // Debit col (index 4) — red-600
        } else if (data.column.index === 5 && data.cell.text?.[0]) {
          doc.setTextColor(21, 128, 61); // Credit col (index 5) — green-700
        } else {
          doc.setTextColor(55, 65, 81);
        }
      }
    },

    // Page footer on every page
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      const y = pageHeight - 9;
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(156, 163, 175); // gray-400
      const vendorLine = branding?.vendor?.companyName ? `Powered by ${branding.vendor.companyName}` : '';
      const tagline = branding?.institution?.receiptTagline || 'Thank you for banking with us.';
      doc.text(sanitizePdfText(tagline), doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
      if (vendorLine) doc.text(sanitizePdfText(vendorLine), doc.internal.pageSize.getWidth() / 2, y + 5, { align: 'center' });
      doc.text(
        `Page ${data.pageNumber}  |  ${sanitizePdfText(fmtDateTime(now.toISOString()))}`,
        pageWidth - 10, pageHeight - 9,
        { align: 'right' }
      );
    },
  });

  // ── Summary totals bar ─────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 5;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (finalY < pageHeight - 30) {
    const totalCredits = transactions
      .filter((t) => isCreditTransaction(t.type ?? '', accountType))
      .reduce((s, t) => s + (t.amountInPaise ?? 0), 0);
    const totalDebits = transactions
      .filter((t) => !isCreditTransaction(t.type ?? '', accountType))
      .reduce((s, t) => s + (t.amountInPaise ?? 0), 0);

    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(10, finalY, pageWidth - 20, 12, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.setTextColor(55, 65, 81);
    doc.text(`Entries: ${transactions.length}`, 14, finalY + 7.5);

    doc.setTextColor(21, 128, 61); // green
    doc.text(`Total Credits: Rs. ${fmt(totalCredits)}`, 50, finalY + 7.5);

    doc.setTextColor(220, 38, 38); // red
    doc.text(`Total Debits: Rs. ${fmt(totalDebits)}`, 115, finalY + 7.5);

    doc.setTextColor(30, 64, 175); // blue
    doc.text(`Closing Balance: Rs. ${fmt(account.balanceInPaise)}`, 160, finalY + 7.5);
  }

  const fileName = `Statement_${account.accountNumber}_${now.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
