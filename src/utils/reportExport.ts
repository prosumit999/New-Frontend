// src/utils/reportExport.ts
// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED REPORT EXPORT ENGINE — Single Source of Truth
// Used by ALL report pages for PDF and CSV export.
//
// Every export includes:
//   • Institution name, registration number, address (from branding store)
//   • Diagonal watermark on every PDF page
//   • Consistent header/footer matching the savings statement style
//
// Two export types:
//   1. exportReportPDF()   — for tabular reports (trial balance, loan portfolio etc)
//   2. exportReportCSV()   — for tabular reports as CSV
//   3. exportStatementPDF / exportStatementCSV — in statementExport.ts (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReportColumn {
  header: string;
  dataKey: string;
  align?: 'left' | 'right' | 'center';
  width?: number;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface BrandingInfo {
  institution?: {
    name?: string;
    logoUrl?: string | null;
    registrationNumber?: string;
    contactPhone?: string;
    contactEmail?: string;
    receiptTagline?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
  };
  vendor?: { companyName?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDateTime = (d: Date): string =>
  d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const sanitizePdfText = (text: string | number | null | undefined): string => {
  if (text == null) return '';
  return String(text).replace(/₹/g, 'Rs. ');
};

function buildAddressLine(branding: BrandingInfo | null): string {
  const addr = branding?.institution?.address;
  if (!addr) return '';
  const parts = [addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean);
  return parts.join(', ');
}

// ─── Draw watermark on a page ────────────────────────────────────────────────
function drawWatermark(doc: jsPDF, text: string) {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  (doc as any).setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(42);
  doc.setTextColor(0, 0, 0);
  doc.text(text, pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45,
    baseline: 'middle',
  });
  doc.restoreGraphicsState();
}

// ─── Draw standard header on a page ──────────────────────────────────────────
function drawPageHeader(
  doc: jsPDF,
  branding: BrandingInfo | null,
  reportTitle: string,
  reportSubtitle: string,
  dateRange: string,
  now: Date,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const instName = branding?.institution?.name || 'MICROFINANCE INSTITUTION';
  const regNum   = branding?.institution?.registrationNumber
    ? `Reg No: ${branding.institution.registrationNumber}` : '';
  const phone    = branding?.institution?.contactPhone
    ? `Ph: ${branding.institution.contactPhone}` : '';
  const addrLine = buildAddressLine(branding);

  // ── Logo (if available) ──
  const logoUrl = branding?.institution?.logoUrl || '';
  let textStartX = 10;
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', 6, 3, 20, 20);
      textStartX = 29;
    } catch { /* skip logo if load fails */ }
  }

  // ── Institution name ──
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(instName.toUpperCase(), textStartX, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  const infoLine = [regNum, phone].filter(Boolean).join('  |  ');
  if (infoLine) doc.text(infoLine, textStartX, 16);
  if (addrLine) doc.text(addrLine, textStartX, 21);

  // ── Divider line ──
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(10, 25, pageWidth - 10, 25);

  // ── Report title ──
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(sanitizePdfText(reportTitle).toUpperCase(), 10, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  if (reportSubtitle) doc.text(sanitizePdfText(reportSubtitle), 10, 37);
  doc.text(`Generated: ${fmtDateTime(now)}`, pageWidth - 10, 32, { align: 'right' });
  if (dateRange) doc.text(sanitizePdfText(dateRange), pageWidth - 10, 37, { align: 'right' });

  // ── Second divider ──
  doc.setDrawColor(180, 180, 180);
  doc.line(10, 40, pageWidth - 10, 40);

  return 44; // Y position after header
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: exportReportPDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportReportPDF(options: {
  title: string;
  subtitle?: string;
  dateRange?: string;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary?: ReportSummaryItem[];
  branding?: BrandingInfo | null;
}): void {
  const {
    title, subtitle = '', dateRange = '', filename,
    orientation = 'landscape', columns, rows, summary = [], branding = null,
  } = options;

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();

  const instShortName = branding?.institution?.name || 'MICROFINANCE';

  const startY = drawPageHeader(doc, branding, title, subtitle, dateRange, now);
  drawWatermark(doc, instShortName);

  // ── Build table body ──
  const head  = [columns.map(c => sanitizePdfText(c.header))];
  const body  = rows.map(row => columns.map(c => sanitizePdfText(row[c.dataKey])));
  const colStyles: Record<number, any> = {};
  columns.forEach((c, i) => {
    colStyles[i] = { halign: c.align || 'left' };
    if (c.width) colStyles[i].cellWidth = c.width;
  });

  autoTable(doc, {
    startY,
    head,
    body: body.length > 0 ? body : [columns.map(() => '—')],
    styles: {
      fontSize: 8, cellPadding: 2.5,
      textColor: [0, 0, 0], lineColor: [200, 200, 200], lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [255, 255, 255], textColor: [0, 0, 0],
      fontStyle: 'bold', fontSize: 8.5,
      lineColor: [150, 150, 150], lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: colStyles,
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      drawWatermark(doc, instShortName);
      // Footer
      const y = pageHeight - 9;
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.3);
      doc.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      const tagline = branding?.institution?.receiptTagline || 'Confidential — For Internal Use Only';
      doc.text(tagline, pageWidth / 2, y, { align: 'center' });
      const vendor = branding?.vendor?.companyName ? `Powered by ${branding.vendor.companyName}` : '';
      if (vendor) doc.text(vendor, pageWidth / 2, y + 4, { align: 'center' });
      doc.text(`Page ${data.pageNumber}  |  ${fmtDateTime(now)}`, pageWidth - 10, y, { align: 'right' });
    },
  });

  // ── Summary box ──
  if (summary.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 6;
    if (finalY < pageHeight - 35) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(180, 180, 180);
      doc.roundedRect(10, finalY, pageWidth - 20, 14, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const colWidth = (pageWidth - 20) / summary.length;
      summary.forEach((s, i) => {
        const x = 14 + i * colWidth;
        doc.setTextColor(80, 80, 80);
        doc.text(sanitizePdfText(s.label), x, finalY + 5.5);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.text(sanitizePdfText(s.value), x, finalY + 11);
        doc.setFontSize(7);
      });
    }
  }

  const safeName = (filename || title.toLowerCase().replace(/\s+/g, '_'));
  doc.save(`${safeName}_${now.toISOString().split('T')[0]}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: exportReportCSV
// ─────────────────────────────────────────────────────────────────────────────
export function exportReportCSV(options: {
  title: string;
  subtitle?: string;
  dateRange?: string;
  filename?: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary?: ReportSummaryItem[];
  branding?: BrandingInfo | null;
}): void {
  const { title, subtitle = '', dateRange = '', filename, columns, rows, summary = [], branding = null } = options;
  const now = new Date();
  const instName = branding?.institution?.name || 'Microfinance Institution';
  const regNum   = branding?.institution?.registrationNumber || '';

  const metaLines = [
    `# ${title}`,
    `# Institution: ${instName}${regNum ? ` | Reg: ${regNum}` : ''}`,
    subtitle ? `# ${subtitle}` : '',
    dateRange ? `# Period: ${dateRange}` : '',
    `# Generated: ${fmtDateTime(now)}`,
    '',
  ].filter(l => l !== undefined);

  const headerLine = columns.map(c => `"${c.header}"`).join(',');
  const dataLines  = rows.map(row =>
    columns.map(c => `"${String(row[c.dataKey] ?? '').replace(/"/g, '""')}"`).join(',')
  );

  const summaryLines = summary.length > 0
    ? ['', '# SUMMARY', ...summary.map(s => `"${s.label}","${s.value}"`)]
    : [];

  const bom = '\uFEFF';
  const csv = bom + [...metaLines, headerLine, ...dataLines, ...summaryLines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (filename || title.toLowerCase().replace(/\s+/g, '_'));
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeName}_${now.toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
