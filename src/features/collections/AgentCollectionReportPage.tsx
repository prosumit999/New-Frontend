// src/features/collections/AgentCollectionReportPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Agent Collection Transaction Report
// Shows every individual pigmy collection transaction in the selected date range,
// filterable by agent. Full PDF & CSV export like Saving/Loan/Pigmy statements.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Calendar, Search, Download, FileText,
  Wallet, Users, Receipt, AlertCircle, CheckCircle, XCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collectionApi } from '../../api/collection.api';
import { agentApi } from '../../api/agent.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { useSystemStore } from '../../store/system.store';

// ── Format helpers ────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const fmtPaise = (p: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format((p ?? 0) / 100);
const fmtDateStr = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtNow = () =>
  new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(collections: any[], fromDate: string, toDate: string, agentName: string) {
  const headers = [
    'Receipt No.', 'Date', 'Customer Name', 'Customer Code', 'Pigmy Account',
    'Agent', 'Amount (Rs)', 'Balance After (Rs)', 'Status', 'Type', 'Note'
  ];
  const rows = collections.map((c) => [
    c.receiptNumber ?? '—',
    fmtDateStr(c.collectionDate ?? c.createdAt),
    c.customer?.name ?? '—',
    c.customer?.customerCode ?? '—',
    c.pigmyAccount?.accountNumber ?? '—',
    c.agent?.name ?? '—',
    fmtPaise(c.amountInPaise),
    c.balanceAfterInPaise != null ? fmtPaise(c.balanceAfterInPaise) : '—',
    c.isReversed ? 'Reversed' : (c.status ?? ''),
    c.collectionType ?? 'daily',
    `"${(c.note ?? '').replace(/"/g, '""')}"`,
  ]);

  const meta = [
    ['# Pigmy Collection Report'],
    [`# Period: ${fmtDateStr(fromDate)} to ${fmtDateStr(toDate)}`],
    agentName ? [`# Agent: ${agentName}`] : ['# Agent: All Agents'],
    [`# Total Transactions: ${collections.length}`],
    [`# Total Amount: Rs. ${fmtPaise(collections.reduce((s, c) => s + (c.isReversed ? 0 : c.amountInPaise ?? 0), 0))}`],
    [`# Generated: ${fmtNow()}`],
    [],
  ];

  const bom = '\uFEFF';
  const content = bom + [
    ...meta.map(r => r.join(',')),
    headers.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CollectionReport_${fromDate}_to_${toDate}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── PDF Export ────────────────────────────────────────────────────────────────
function exportPDF(collections: any[], fromDate: string, toDate: string, agentName: string, branding: any) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const instName = branding?.institution?.name || 'MICROFINANCE INSTITUTION';
  const totalAmt = collections.reduce((s, c) => s + (c.isReversed ? 0 : c.amountInPaise ?? 0), 0);

  // Black header
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(instName.toUpperCase(), 10, 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  const sub = [
    branding?.institution?.registrationNumber && `Reg: ${branding.institution.registrationNumber}`,
    branding?.institution?.contactPhone && `Ph: ${branding.institution.contactPhone}`,
  ].filter(Boolean).join('  |  ');
  if (sub) doc.text(sub, 10, 17);

  // Sub-header
  doc.setFillColor(60, 60, 60);
  doc.rect(0, 22, pw, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('PIGMY COLLECTION REPORT', 10, 28.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.text(`Generated: ${fmtNow()}`, pw - 10, 28.5, { align: 'right' });

  // Info box
  doc.setFillColor(245, 245, 245); doc.setDrawColor(180, 180, 180);
  doc.roundedRect(10, 34, pw - 20, 14, 2, 2, 'FD');
  doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.text('PERIOD', 14, 40); doc.text('AGENT', 80, 40); doc.text('RECORDS', 160, 40); doc.text('TOTAL COLLECTED', 200, 40);
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text(`${fmtDateStr(fromDate)} – ${fmtDateStr(toDate)}`, 14, 46);
  doc.setTextColor(0, 0, 0);
  doc.text(agentName || 'All Agents', 80, 46);
  doc.text(`${collections.length}`, 160, 46);
  doc.setTextColor(0, 0, 0);
  doc.text(`Rs. ${fmtPaise(totalAmt)}`, 200, 46);

  // Table rows
  const body = collections.map((c, i) => [
    i + 1,
    c.receiptNumber ?? '—',
    fmtDateStr(c.collectionDate ?? c.createdAt),
    `${c.customer?.name ?? '—'}\n${c.customer?.customerCode ?? ''}`,
    c.pigmyAccount?.accountNumber ?? '—',
    c.agent?.name ?? '—',
    `Rs. ${fmtPaise(c.amountInPaise)}`,
    c.balanceAfterInPaise != null ? `Rs. ${fmtPaise(c.balanceAfterInPaise)}` : '—',
    c.isReversed ? 'Reversed' : (c.status ?? 'collected'),
  ]);

  autoTable(doc, {
    startY: 52,
    head: [['#', 'Receipt No.', 'Date', 'Customer', 'Pigmy Account', 'Agent', 'Amount', 'Bal. After', 'Status']],
    body: body.length > 0 ? body : [['—', '—', '—', 'No transactions found', '', '', '', '', '']],
    styles: { fontSize: 7, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 22 },
      3: { cellWidth: 45 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 25, halign: 'right' },
      8: { cellWidth: 20, halign: 'center' },
    },
    margin: { left: 10, right: 10 },
    willDrawCell: (data) => {
      if (data.section === 'body') {
        // All cells black
        doc.setTextColor(0, 0, 0);
      }
    },
    didDrawPage: (data) => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setDrawColor(150, 150, 150);
      doc.line(10, ph - 14, pw - 10, ph - 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100, 100, 100);
      const tagline = branding?.institution?.receiptTagline || 'Thank you for banking with us.';
      doc.text(tagline, pw / 2, ph - 9, { align: 'center' });
      doc.text(`Page ${data.pageNumber}  |  ${fmtNow()}`, pw - 10, ph - 9, { align: 'right' });
    },
  });

  // Summary bar
  const finalY = (doc as any).lastAutoTable.finalY + 5;
  const ph = doc.internal.pageSize.getHeight();
  if (finalY < ph - 20) {
    doc.setFillColor(240, 240, 240); doc.setDrawColor(180, 180, 180);
    doc.roundedRect(10, finalY, pw - 20, 10, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0, 0, 0);
    doc.text(`Total Records: ${collections.length}`, 14, finalY + 6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Collected: Rs. ${fmtPaise(totalAmt)}`, 80, finalY + 6.5);
    const reversedCount = collections.filter(c => c.isReversed).length;
    doc.setTextColor(0, 0, 0);
    doc.text(`Reversed: ${reversedCount}`, 180, finalY + 6.5);
  }

  doc.save(`CollectionReport_${fromDate}_to_${toDate}.pdf`);
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusChip({ isReversed, status }: { isReversed: boolean; status: string }) {
  if (isReversed)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full"><XCircle className="w-3 h-3" /> Reversed</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full"><CheckCircle className="w-3 h-3" /> Collected</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AgentCollectionReportPage() {
  const navigate = useNavigate();
  const branding = useSystemStore((s) => s.branding);

  const [fromDate, setFromDate] = useState(thisMonthStart());
  const [toDate, setToDate] = useState(todayStr());
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('collected');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // All agents for dropdown
  const { data: agentsData } = useQuery({
    queryKey: ['agents-for-collection-report'],
    queryFn: () => agentApi.list({ limit: 200, isActive: true }),
  });
  const agents = (agentsData?.data?.agents as any[]) || [];
  const selectedAgentName = agents.find((a: any) => a._id === agentFilter)?.name || '';

  // Fetch ALL collection transactions matching filters
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['collection-report-txns', fromDate, toDate, agentFilter, statusFilter, page],
    queryFn: () =>
      collectionApi.list({
        fromDate,
        toDate,
        agentId: agentFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: 100,
      }),
    enabled: !!(fromDate && toDate),
  });

  const collections: any[] = (data?.data?.collections as any[]) || [];
  const pagination = data?.data?.pagination as any;

  // Client-side search (within the page's results)
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter((c) =>
      c.customer?.name?.toLowerCase().includes(q) ||
      c.customer?.customerCode?.toLowerCase().includes(q) ||
      c.receiptNumber?.toLowerCase().includes(q) ||
      c.pigmyAccount?.accountNumber?.toLowerCase().includes(q) ||
      c.agent?.name?.toLowerCase().includes(q),
    );
  }, [collections, searchQuery]);

  const totalAmt = filtered.reduce((s, c) => s + (c.isReversed ? 0 : c.amountInPaise ?? 0), 0);
  const reversedCount = filtered.filter((c) => c.isReversed).length;

  return (
    <div className="animate-fade-in animate-slide-up space-y-5">
      {/* ── Header ── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/collections')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Collection Transaction Report</h1>
            <p className="page-subtitle">All pigmy collections in the selected period — filterable by agent &amp; date</p>
          </div>
        </div>
        {collections.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, fromDate, toDate, selectedAgentName)}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm"
              className="text-red-700 border-red-200 hover:bg-red-50"
              onClick={() => exportPDF(filtered, fromDate, toDate, selectedAgentName, branding)}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="card">
        <div className="card-header bg-slate-50/70">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input type="date" value={fromDate} max={toDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-38" />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" value={toDate} min={fromDate} max={todayStr()}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-38" />
            </div>

            {/* Agent filter */}
            <select
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-48"
              value={agentFilter}
              onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Agents</option>
              {agents.map((a: any) => (
                <option key={a._id} value={a._id}>{a.name} ({a.agentCode})</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-40"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Status</option>
              <option value="collected">Collected</option>
              <option value="reversed">Reversed</option>
            </select>

            {/* Quick presets */}
            <div className="flex gap-1 ml-auto">
              {[
                { label: 'Today', from: todayStr(), to: todayStr() },
                { label: 'This Month', from: thisMonthStart(), to: todayStr() },
                { label: 'Last 7d', from: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })(), to: todayStr() },
              ].map((p) => (
                <button key={p.label}
                  onClick={() => { setFromDate(p.from); setToDate(p.to); setPage(1); }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    fromDate === p.from && toDate === p.to
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Summary strip ── */}
        {!isLoading && collections.length > 0 && (
          <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-wrap gap-6 text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <Receipt className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-slate-900">{pagination?.total ?? filtered.length}</span> transactions
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <Wallet className="w-4 h-4 text-emerald-500" />
              Total: <span className="font-semibold text-emerald-700">{formatCurrency(totalAmt)}</span>
            </span>
            {reversedCount > 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <XCircle className="w-4 h-4" />
                <span className="font-semibold">{reversedCount}</span> reversed
              </span>
            )}
            {selectedAgentName && (
              <span className="flex items-center gap-1.5 text-slate-600">
                <Users className="w-4 h-4 text-indigo-500" /> {selectedAgentName}
              </span>
            )}
          </div>
        )}

        {/* ── Search within page ── */}
        {collections.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search receipt, customer, account, agent…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 w-full"
              />
            </div>
          </div>
        )}

        {/* ── Transaction Table ── */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Receipt No.</th>
                <th>Date &amp; Time</th>
                <th>Customer</th>
                <th>Pigmy Account</th>
                <th>Agent</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance After</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-16">
                    <div className="flex justify-center items-center gap-2 text-slate-400">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      Loading transactions…
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-red-500">
                      <AlertCircle className="w-10 h-10 opacity-50" />
                      <p>Failed to load. Check your filters and try again.</p>
                      <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No transactions found</p>
                    <p className="text-xs mt-1">Try adjusting your date range or filters.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((c: any, idx: number) => (
                  <tr
                    key={c._id}
                    className={`cursor-pointer transition-colors ${c.isReversed ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-blue-50/30'}`}
                    onClick={() => navigate(`/collections/${c._id}`)}
                  >
                    <td className="text-slate-400 font-mono text-xs text-center">
                      {(page - 1) * 100 + idx + 1}
                    </td>
                    {/* Receipt No. = clickable transaction ID */}
                    <td>
                      <span className={`font-mono text-sm font-semibold ${c.isReversed ? 'line-through text-slate-400' : 'text-blue-600'}`}>
                        {c.receiptNumber}
                      </span>
                    </td>
                    {/* Date */}
                    <td>
                      <p className="text-sm text-slate-700">{formatDate(c.collectionDate)}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(c.createdAt)}</p>
                    </td>
                    {/* Customer */}
                    <td>
                      <p className="font-medium text-slate-900 text-sm">{c.customer?.name || '—'}</p>
                      <p className="text-xs text-slate-400 font-mono">{c.customer?.customerCode || '—'}</p>
                    </td>
                    {/* Pigmy account */}
                    <td>
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {c.pigmyAccount?.accountNumber || '—'}
                      </span>
                    </td>
                    {/* Agent */}
                    <td className="text-sm text-slate-600">{c.agent?.name || '—'}</td>
                    {/* Amount */}
                    <td className="text-right">
                      <span className={`font-semibold text-sm ${c.isReversed ? 'line-through text-slate-400' : 'text-emerald-700'}`}>
                        {formatCurrency(c.amountInPaise)}
                      </span>
                    </td>
                    {/* Balance after */}
                    <td className="text-right text-sm text-slate-600">
                      {c.balanceAfterInPaise != null ? formatCurrency(c.balanceAfterInPaise) : '—'}
                    </td>
                    {/* Status */}
                    <td>
                      <StatusChip isReversed={c.isReversed} status={c.status} />
                    </td>
                    {/* Action */}
                    <td>
                      <Button variant="ghost" size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/collections/${c._id}`); }}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <p>Page {pagination.page} of {pagination.totalPages} — {pagination.total} total transactions</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
