// src/utils/exportUtils.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared export utilities for agent and admin report tables.
// CSV: browser-native Blob download
// PDF: uses jspdf + jspdf-autotable (already in project dependencies)
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export a table to CSV and trigger browser download.
 */
export function exportTableToCsv(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell ?? '');
        // Escape commas and quotes
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(','),
    ),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export a table to PDF using jspdf-autotable.
 */
export async function exportTableToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
) {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 15);

    // Date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 14, 22);

    // Table
    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: rows.map((row) => row.map((cell) => String(cell ?? ''))),
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [15, 31, 54], // dark navy matching sidebar
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // slate-50
      },
      margin: { top: 28, left: 14, right: 14 },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 30,
        doc.internal.pageSize.getHeight() - 8,
      );
    }

    doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch {
    // Fallback to CSV if PDF library not available
    console.warn('[Export] jsPDF not available, falling back to CSV');
    exportTableToCsv(headers, rows, title.replace(/\s+/g, '-').toLowerCase());
  }
}
