// src/features/reports/CustomerAccountReportsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Customer-wise Account Statement Hub
// Accessible via /reports/customer-accounts?customerId=X&tab=saving|pigmy|loan|overview
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Search, Users, Wallet, PiggyBank, CreditCard,
  Download, RefreshCw, ChevronRight, Calendar, TrendingUp,
  ArrowUpCircle, ArrowDownCircle, Info
} from 'lucide-react';
import { savingApi } from '../../api/saving.api';
import { pigmyApi } from '../../api/pigmy.api';
import { loanApi } from '../../api/loan.api';
import { customerApi } from '../../api/customer.api';
import { Button } from '../../components/ui/Button';
import { formatCurrency, isCreditTransaction } from '../../utils/format';
import { calculateOpeningBalance, calculateClosingBalance } from '../../utils/balanceHelpers';
import { exportStatementPDF } from '../../utils/statementExport';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { useSystemStore } from '../../store/system.store';
import TransactionDetailModal from '../../components/shared/TransactionDetailModal';
import { ReportInstitutionHeader } from '../../components/shared/ReportInstitutionHeader';
import { format } from 'date-fns';

type MainTab = 'overview' | 'saving' | 'pigmy' | 'loan';

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const cls = s === 'active'   ? 'bg-emerald-100 text-emerald-700'
            : s === 'closed'   ? 'bg-slate-100 text-slate-600'
            : s === 'frozen'   ? 'bg-blue-100 text-blue-700'
            : s === 'overdue'  ? 'bg-red-100 text-red-700'
            : 'bg-yellow-100 text-yellow-700';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cls}`}>{status}</span>;
}

// ── Customer Search ────────────────────────────────────────
function CustomerSearch({ onSelect }: { onSelect: (c: any) => void }) {
  const [search, setSearch] = useState('');
  const { data: res, isLoading } = useQuery({
    queryKey: ['cust-search-stmt', search],
    queryFn: () => customerApi.list({ search, limit: 10 }),
    enabled: search.length >= 2,
  });
  const customers: any[] = (res as any)?.data?.customers || (res as any)?.customers || [];

  return (
    <div className="max-w-xl mx-auto py-16 text-center">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Search className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Customer Account Lookup</h2>
      <p className="text-slate-400 mb-8">Search for a customer to view their saving, pigmy, and loan account statements.</p>
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          id="stmt-customer-search"
          type="text"
          placeholder="Search by name, phone, or customer code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          autoFocus
        />
      </div>
      {isLoading && <p className="text-slate-400 text-sm">Searching...</p>}
      {search.length >= 2 && !isLoading && customers.length === 0 && (
        <p className="text-slate-400 text-sm">No customers found for "{search}"</p>
      )}
      <div className="space-y-2 text-left mt-2">
        {customers.map((c: any) => (
          <button
            key={c._id}
            onClick={() => onSelect(c)}
            className="flex items-center gap-4 w-full bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md rounded-xl px-4 py-3 transition-all text-left"
          >
            <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {c.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">{c.name}</p>
              <p className="text-xs text-slate-400">{c.customerCode} · {c.phone}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Saving Statement ────────────────────────────────────────
function SavingStatement({ customerId, accounts, customer }: { customerId: string; accounts: any[]; customer: any }) {
  const { businessDate } = useBusinessDate();
  const today = businessDate || format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1), 'yyyy-MM-dd');
  const [selAccount, setSelAccount] = useState(accounts[0]?._id || '');
  const [fromDate, setFromDate]   = useState(monthStart);
  const [toDate,   setToDate]     = useState(today);
  const [page, setPage]           = useState(1);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['saving-stmt', selAccount, fromDate, toDate, page],
    queryFn: () => savingApi.getStatement(selAccount, {
      fromDate, toDate, page, limit: 50
    }),
    enabled: !!selAccount,
  });

  const stmt   = (data as any)?.data;
  const rows   = stmt?.transactions || [];
  const pg     = stmt?.pagination || { totalPages: 1, page: 1, total: rows.length };
  const acct   = Array.isArray(accounts) ? accounts.find(a => a._id === selAccount) : undefined;

  // Robust opening/closing balance — handles legacy txns with missing balance snapshots
  const openBal = calculateOpeningBalance(rows, 'saving');
  const closBal = calculateClosingBalance(rows);

  const totalDr = rows.reduce((acc: number, r: any) => !isCreditTransaction(r.type, 'saving') ? acc + (r.amountInPaise || 0) : acc, 0);
  const totalCr = rows.reduce((acc: number, r: any) =>  isCreditTransaction(r.type, 'saving') ? acc + (r.amountInPaise || 0) : acc, 0);

  const branding = useSystemStore(s => s.branding);
  const handleExport = async () => {
    if (!acct) return;
    const enrichedAccount = { ...acct, customer: { name: customer?.name, customerCode: customer?.customerCode, phone: customer?.phone } };
    exportStatementPDF(rows, enrichedAccount, branding, { from: fromDate, to: toDate }, 'saving');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">Account</label>
          <select
            value={selAccount}
            onChange={e => { setSelAccount(e.target.value); setPage(1); }}
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 min-w-[200px]"
          >
            {accounts.map((a: any) => (
              <option key={a._id} value={a._id}>
                {a.accountNumber} ({a.status})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">From Date</label>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-36" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">To Date</label>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-36" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          <Button size="sm" onClick={handleExport} disabled={rows.length === 0} className="gap-1.5"><Download className="h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      {/* Balance bar */}
      {acct && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-1">Opening Balance</p>
            <p className="text-lg font-bold text-blue-700">{openBal !== undefined ? formatCurrency(openBal) : '—'}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Current Balance</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(acct.balanceInPaise)}</p>
            <p className="text-xs text-slate-400 mt-0.5"><StatusBadge status={acct.status} /></p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="text-xs text-emerald-400 font-medium uppercase tracking-wide mb-1">Closing Balance</p>
            <p className="text-lg font-bold text-emerald-700">{closBal !== undefined ? formatCurrency(closBal) : '—'}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-8">#</th>
                <th>Date</th>
                <th>Txn ID</th>
                <th>Narration</th>
                <th className="text-right">Dr (₹)</th>
                <th className="text-right">Cr (₹)</th>
                <th className="text-right">Balance (₹)</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">No transactions found</td></tr>
              ) : (
                <>
                  {/* Banking Format - Opening Balance Row */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={6} className="text-right py-3 text-sm font-semibold text-slate-600">Opening Balance on Page</td>
                    <td className="text-right py-3 font-bold text-slate-800">{openBal !== undefined ? formatCurrency(openBal) : '—'}</td>
                    <td></td>
                  </tr>
                  
                  {rows.map((r: any, i: number) => {
                    const credit = isCreditTransaction(r.type, 'saving');
                    return (
                <tr key={r._id || i} className={`hover:bg-slate-50 transition-colors ${!credit ? 'bg-red-50/20' : 'bg-emerald-50/20'}`}>
                  <td className="text-center text-xs text-slate-400">{(page - 1) * 50 + i + 1}</td>
                  <td className="text-sm whitespace-nowrap">{new Date(r.businessDate || r.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button type="button" onClick={() => setSelectedTx(r)} className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                      {r.transactionId || '—'}
                    </button>
                  </td>
                  <td className="text-sm text-slate-600 max-w-xs">{r.note || r.type?.replace(/_/g, ' ')}</td>
                  <td className="text-right font-medium text-red-600">
                    {!credit ? formatCurrency(r.amountInPaise) : '—'}
                  </td>
                  <td className="text-right font-medium text-emerald-600">
                    {credit ? formatCurrency(r.amountInPaise) : '—'}
                  </td>
                  <td className="text-right font-bold text-slate-800">{r.balanceAfterInPaise !== undefined ? formatCurrency(r.balanceAfterInPaise) : '—'}</td>
                  <td className="text-xs capitalize text-slate-400">{r.type}</td>
                </tr>
              )})}
                  
                  {/* Banking Format - Grand Total Footer */}
                  <tr className="bg-slate-100/80 border-t border-slate-200">
                    <td colSpan={4} className="text-right py-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Page Total</td>
                    <td className="text-right py-3 font-bold text-red-600">{formatCurrency(totalDr)}</td>
                    <td className="text-right py-3 font-bold text-emerald-600">{formatCurrency(totalCr)}</td>
                    <td className="text-right py-3 font-bold text-slate-800">{closBal !== undefined ? formatCurrency(closBal) : '—'}</td>
                    <td></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pg.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
            <span>{pg.total} entries · Page {pg.page} of {pg.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pg.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}

// ── Pigmy Statement ────────────────────────────────────────
function PigmyStatement({ customerId, accounts, customer }: { customerId: string; accounts: any[]; customer: any }) {
  const { businessDate } = useBusinessDate();
  const today = businessDate || format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1), 'yyyy-MM-dd');
  const [selAccount, setSelAccount] = useState(accounts[0]?._id || '');
  const [fromDate, setFromDate]     = useState(monthStart);
  const [toDate,   setToDate]       = useState(today);
  const [page, setPage]             = useState(1);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pigmy-stmt', selAccount, fromDate, toDate, page],
    queryFn: () => pigmyApi.getStatement(selAccount, {
      fromDate, toDate, page, limit: 50
    }),
    enabled: !!selAccount,
  });

  const stmt  = (data as any)?.data;
  const rows  = stmt?.transactions || [];
  const pg    = stmt?.pagination || { totalPages: 1, page: 1, total: rows.length };
  const acct  = Array.isArray(accounts) ? accounts.find(a => a._id === selAccount) : undefined;

  // Robust opening/closing balance — handles legacy pigmy txns with missing balance snapshots
  const openBal = calculateOpeningBalance(rows, 'pigmy');
  const closBal = calculateClosingBalance(rows);

  const totalDr = rows.reduce((acc: number, r: any) => !isCreditTransaction(r.type, 'pigmy') ? acc + (r.amountInPaise || 0) : acc, 0);
  const totalCr = rows.reduce((acc: number, r: any) =>  isCreditTransaction(r.type, 'pigmy') ? acc + (r.amountInPaise || 0) : acc, 0);

  const branding = useSystemStore(s => s.branding);
  const handleExport = async () => {
    if (!acct) return;
    const enrichedAccount = { ...acct, customer: { name: customer?.name, customerCode: customer?.customerCode, phone: customer?.phone } };
    exportStatementPDF(rows, enrichedAccount, branding, { from: fromDate, to: toDate }, 'pigmy');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">Account</label>
          <select value={selAccount} onChange={e => { setSelAccount(e.target.value); setPage(1); }}
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 min-w-[200px]">
            {accounts.map((a: any) => (
              <option key={a._id} value={a._id}>{a.accountNumber} ({a.status})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">From Date</label>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-36" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">To Date</label>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 w-36" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          <Button size="sm" onClick={handleExport} disabled={rows.length === 0} className="gap-1.5"><Download className="h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      {/* Summary bar */}
      {acct && (() => {
        const periodCollected = rows.reduce((acc: number, r: any) =>
          isCreditTransaction(r.type, 'pigmy') ? acc + (r.amountInPaise || 0) : acc, 0);
        const uniqueDays = new Set(rows.map((r: any) =>
          (r.businessDate || r.createdAt || '').substring(0, 10))).size;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-violet-50 rounded-xl p-3 text-center">
              <p className="text-xs text-violet-400 uppercase tracking-wide font-medium">Balance</p>
              <p className="text-base font-bold text-violet-700">{formatCurrency(acct.balanceInPaise)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Daily Target</p>
              <p className="text-base font-bold text-slate-700">{formatCurrency(acct.dailyDepositAmountInPaise)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium">Period Collected</p>
              <p className="text-base font-bold text-emerald-700">{rows.length > 0 ? formatCurrency(periodCollected) : '—'}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-400 uppercase tracking-wide font-medium">Days in Period</p>
              <p className="text-base font-bold text-blue-700">{rows.length > 0 ? uniqueDays : '—'}</p>
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-8">#</th>
                <th>Date</th>
                <th>Txn ID</th>
                <th>Type</th>
                <th className="text-right">Dr (₹)</th>
                <th className="text-right">Cr (₹)</th>
                <th className="text-right">Balance (₹)</th>
                <th>Agent</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">No collections found</td></tr>
              ) : (
                <>
                  {/* Banking Format - Opening Balance Row */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={6} className="text-right py-3 text-sm font-semibold text-slate-600">Opening Balance on Page</td>
                    <td className="text-right py-3 font-bold text-slate-800">{openBal !== undefined ? formatCurrency(openBal) : '—'}</td>
                    <td></td>
                  </tr>
                  
                  {rows.map((r: any, i: number) => {
                    const credit = isCreditTransaction(r.type, 'pigmy');
                    return (
                <tr key={r._id || i} className={`hover:bg-slate-50 transition-colors ${!credit ? 'bg-red-50/20' : 'bg-emerald-50/20'}`}>
                  <td className="text-center text-xs text-slate-400">{(page - 1) * 50 + i + 1}</td>
                  <td className="text-sm whitespace-nowrap">{new Date(r.businessDate || r.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button type="button" onClick={() => setSelectedTx(r)} className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                      {r.transactionId || r.receiptNumber || '—'}
                    </button>
                  </td>
                  <td className="text-xs text-slate-500 font-mono">{r.type?.replace(/_/g, ' ')}</td>
                  <td className="text-right font-medium text-red-600">
                    {!credit ? formatCurrency(r.amountInPaise) : '—'}
                  </td>
                  <td className="text-right font-medium text-emerald-600">
                    {credit ? formatCurrency(r.amountInPaise) : '—'}
                  </td>
                  <td className="text-right font-bold text-slate-800">{r.balanceAfterInPaise !== undefined && r.balanceAfterInPaise !== null ? formatCurrency(r.balanceAfterInPaise) : '—'}</td>
                  <td className="text-xs text-slate-500">{r.performedBy?.name || '—'}</td>
                </tr>
              )})}
                  
                  {/* Banking Format - Grand Total Footer */}
                  <tr className="bg-slate-100/80 border-t border-slate-200">
                    <td colSpan={4} className="text-right py-3 text-sm font-semibold text-slate-600 uppercase tracking-wider">Page Total</td>
                    <td className="text-right py-3 font-bold text-red-600">{formatCurrency(totalDr)}</td>
                    <td className="text-right py-3 font-bold text-emerald-600">{formatCurrency(totalCr)}</td>
                    <td className="text-right py-3 font-bold text-slate-800">{closBal !== undefined ? formatCurrency(closBal) : '—'}</td>
                    <td></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        {pg.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
            <span>{pg.total} entries · Page {pg.page} of {pg.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pg.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}

// ── Loan Statement ─────────────────────────────────────────
function LoanStatement({ customerId, accounts, customer }: { customerId: string; accounts: any[]; customer: any }) {
  const [selAccount, setSelAccount] = useState(accounts[0]?._id || '');
  const [page, setPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['loan-stmt', selAccount, page],
    queryFn: () => loanApi.getStatement(selAccount, { page, limit: 50 }),
    enabled: !!selAccount,
  });

  const stmt = (data as any)?.data;
  const loan = Array.isArray(accounts) ? accounts.find(a => a._id === selAccount) : undefined;
  const rows = stmt?.transactions || [];
  const pg   = stmt?.pagination || { totalPages: 1, page: 1, total: rows.length };

  // Robust opening/closing balance — handles legacy loan txns with missing balance snapshots
  const openBal = calculateOpeningBalance(rows, 'loan');
  const closBal = calculateClosingBalance(rows);

  const totalDr = rows.reduce((acc: number, r: any) => !isCreditTransaction(r.type, 'loan') ? acc + (r.amountInPaise || 0) : acc, 0);
  const totalCr = rows.reduce((acc: number, r: any) =>  isCreditTransaction(r.type, 'loan') ? acc + (r.amountInPaise || 0) : acc, 0);

  const branding = useSystemStore(s => s.branding);
  const handleExport = async () => {
    if (!loan) return;
    const accountInfo = {
      accountNumber: loan.loanAccountNumber,
      balanceInPaise: loan.outstandingBalanceInPaise,
      status: loan.status,
      openedAt: loan.disbursedAt || loan.createdAt,
      customer: { name: customer?.name, customerCode: customer?.customerCode, phone: customer?.phone },
    };
    exportStatementPDF(rows, accountInfo, branding, { from: '', to: '' }, 'loan');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-slate-400 font-medium">Loan Account</label>
          <select value={selAccount} onChange={e => { setSelAccount(e.target.value); setPage(1); }}
            className="form-input py-2 px-3 text-sm rounded-lg border border-slate-200 min-w-[240px]">
            {accounts.map((a: any) => (
              <option key={a._id} value={a._id}>
                {a.loanAccountNumber} — {a.status} — ₹{((a.principalAmountInPaise || 0) / 100).toLocaleString('en-IN')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          <Button size="sm" onClick={handleExport} disabled={rows.length === 0} className="gap-1.5"><Download className="h-3.5 w-3.5" />PDF</Button>
        </div>
      </div>

      {/* Loan summary cards */}
      {loan && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Principal</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(loan.principalAmountInPaise)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-400 uppercase tracking-wide font-medium mb-1">Outstanding</p>
              <p className="text-lg font-bold text-amber-700">{formatCurrency(loan.outstandingBalanceInPaise)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium mb-1">Total Repaid</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(loan.totalPaidInPaise)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-xs text-red-400 uppercase tracking-wide font-medium mb-1">Penalty</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(loan.penaltyAmountInPaise)}</p>
            </div>
          </div>
          {/* Progress bar */}
          {loan.progressPct !== undefined && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all ${loan.outstandingBalanceInPaise > 0 ? 'bg-gradient-to-r from-blue-500 to-emerald-500' : 'bg-emerald-500'}`}
                  style={{ width: `${loan.progressPct}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-600 w-10 flex-shrink-0">{loan.progressPct}%</span>
              <span className="text-xs text-slate-400">{loan.daysElapsed}/{loan.totalDays} days</span>
              <StatusBadge status={loan.status} />
            </div>
          )}
        </>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center w-8">#</th>
                <th>Date</th>
                <th>Txn ID</th>
                <th>Narration / Type</th>
                <th className="text-right text-red-600">Dr (₹)</th>
                <th className="text-right text-emerald-600">Cr (₹)</th>
                <th className="text-right">Outstanding (₹)</th>
                <th>Done By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">No transactions found</td></tr>
              ) : (
                <>
                  {/* Banking Format - Opening Balance Row */}
                  <tr className="bg-blue-50/60">
                    <td colSpan={6} className="text-right py-3 pr-4 text-sm font-semibold text-blue-700">Opening Outstanding on Page</td>
                    <td className="text-right py-3 font-bold text-blue-800">{openBal !== undefined ? formatCurrency(openBal) : '—'}</td>
                    <td></td>
                  </tr>

                  {rows.map((r: any, i: number) => {
                    const isCredit = isCreditTransaction(r.type, 'loan');
                    return (
                    <tr key={r._id || i} className={`hover:bg-slate-50/80 transition-colors ${isCredit ? 'bg-emerald-50/20' : 'bg-red-50/20'}`}>
                      <td className="text-center text-xs text-slate-400">{(page - 1) * 50 + i + 1}</td>
                      <td className="text-sm whitespace-nowrap">{new Date(r.businessDate || r.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button type="button" onClick={() => setSelectedTx(r)} className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                          {r.transactionId || '—'}
                        </button>
                      </td>
                      <td>
                        <p className="text-xs font-medium text-slate-700">{r.note || r.type?.replace(/_/g, ' ') || '—'}</p>
                        <span className="text-[10px] text-slate-400 font-mono capitalize">{r.type?.replace(/_/g, ' ')}</span>
                      </td>
                      {/* Dr column — repayments, write-offs, closures (reduce outstanding) */}
                      <td className="text-right font-semibold text-red-600">
                        {!isCredit ? formatCurrency(r.amountInPaise) : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Cr column — disbursements, penalties, reversals (increase outstanding) */}
                      <td className="text-right font-semibold text-emerald-600">
                        {isCredit ? formatCurrency(r.amountInPaise) : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Running outstanding balance after this transaction */}
                      <td className="text-right font-bold text-amber-700">
                        {r.balanceAfterInPaise !== undefined && r.balanceAfterInPaise !== null
                          ? formatCurrency(r.balanceAfterInPaise)
                          : '—'}
                      </td>
                      <td className="text-xs text-slate-500">{r.performedBy?.name || '—'}</td>
                    </tr>
                  );})}

                  {/* Banking Format - Grand Total Footer */}
                  <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold">
                    <td colSpan={4} className="text-right py-3 pr-4 text-sm text-slate-600 uppercase tracking-wider">Page Total</td>
                    <td className="text-right py-3 text-red-700">{formatCurrency(totalDr)}</td>
                    <td className="text-right py-3 text-emerald-700">{formatCurrency(totalCr)}</td>
                    <td className="text-right py-3 text-amber-800">{closBal !== undefined ? formatCurrency(closBal) : '—'}</td>
                    <td></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        {pg.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
            <span>{pg.total} entries · Page {pg.page} of {pg.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pg.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────
export default function CustomerAccountReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customer, setCustomer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<MainTab>((searchParams.get('tab') as MainTab) || 'overview');

  const preCustomerId = searchParams.get('customerId');

  // Autofetch customer if ID is in URL
  const { data: custRes } = useQuery({
    queryKey: ['cust-lookup', preCustomerId],
    queryFn: () => customerApi.getCustomer(preCustomerId!),
    enabled: !!preCustomerId && !customer,
  });
  useEffect(() => {
    const c = (custRes as any)?.data?.customer;
    if (c && !customer) setCustomer(c);
  }, [custRes]);

  // Full overview query (for account lists)
  const customerId = customer?._id || '';
  const { data: fullOverview, isLoading: loadingOverview } = useQuery({
    queryKey: ['cust-full-overview', customerId],
    queryFn: async () => {
      const [savingsRes, pigmysRes, loansRes] = await Promise.all([
        savingApi.getByCustomer(customerId),
        pigmyApi.getByCustomer(customerId),
        loanApi.getByCustomer(customerId)
      ]);
      // savingApi.getByCustomer returns res.data = ApiResponse<SavingAccount[]>
      // so .data is SavingAccount[]
      const savingAccounts = Array.isArray((savingsRes as any)?.data)
        ? (savingsRes as any).data
        : Array.isArray(savingsRes) ? savingsRes : [];
      const pigmyAccounts = Array.isArray((pigmysRes as any)?.data)
        ? (pigmysRes as any).data
        : Array.isArray(pigmysRes) ? pigmysRes : [];
      // loanApi.getByCustomer returns res.data = ApiResponse<{loans:[]}>
      // backend may return array directly or wrapped
      const loanData = (loansRes as any);
      const loanAccounts = Array.isArray(loanData?.data)
        ? loanData.data
        : Array.isArray(loanData?.data?.loans)
        ? loanData.data.loans
        : Array.isArray(loanData?.loans)
        ? loanData.loans
        : Array.isArray(loanData)
        ? loanData
        : [];
      return { savingAccounts, pigmyAccounts, loanAccounts, recentTxns: [] };
    },
    enabled: !!customerId,
  });
  const ov           = fullOverview;
  const savingAccts  = ov?.savingAccounts || [];
  const pigmyAccts   = ov?.pigmyAccounts  || [];
  const loanAccts    = ov?.loanAccounts   || [];
  const recentTxns   = ov?.recentTxns     || [];

  const handleSelect = (c: any) => {
    setCustomer(c);
    setSearchParams({ customerId: c._id, tab: activeTab });
  };

  const TABS: { key: MainTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'overview', label: 'Overview',         icon: Users,     count: undefined       },
    { key: 'saving',   label: 'Saving Statement', icon: Wallet,    count: savingAccts.length },
    { key: 'pigmy',    label: 'Pigmy Statement',  icon: PiggyBank, count: pigmyAccts.length  },
    { key: 'loan',     label: 'Loan Statement',   icon: CreditCard,count: loanAccts.length   },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Institution Header with Logo Thumbnail */}
      <ReportInstitutionHeader
        reportTitle="Customer Account Reports"
        dateRange={customer ? customer.name : undefined}
        subInfo={customer ? `${customer.customerCode} · ${customer.phone}` : 'Saving passbook · Pigmy register · Loan statement'}
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Customer Account Reports</h1>
          <p className="page-subtitle">Saving passbook · Pigmy collection register · Loan statement</p>
        </div>
      </div>

      {/* No customer selected */}
      {!customer && <CustomerSearch onSelect={handleSelect} />}

      {/* Customer loaded */}
      {customer && (
        <div className="space-y-5">
          {/* Customer profile bar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {customer.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-lg font-bold text-slate-900">{customer.name}</p>
                <StatusBadge status={customer.kycStatus || 'pending'} />
              </div>
              <p className="text-sm text-slate-400">{customer.customerCode} · {customer.phone}</p>
              {customer.assignedAgent && (
                <p className="text-xs text-slate-400 mt-0.5">Agent: {customer.assignedAgent.name} ({customer.assignedAgent.agentCode})</p>
              )}
            </div>
            <div className="flex gap-3 text-center">
              <div className="bg-slate-50 rounded-xl px-4 py-2">
                <p className="text-lg font-bold text-slate-800">{savingAccts.length}</p>
                <p className="text-xs text-slate-400">Saving</p>
              </div>
              <div className="bg-violet-50 rounded-xl px-4 py-2">
                <p className="text-lg font-bold text-violet-700">{pigmyAccts.length}</p>
                <p className="text-xs text-slate-400">Pigmy</p>
              </div>
              <div className="bg-amber-50 rounded-xl px-4 py-2">
                <p className="text-lg font-bold text-amber-700">{loanAccts.length}</p>
                <p className="text-xs text-slate-400">Loans</p>
              </div>
            </div>
            <button
              onClick={() => { setCustomer(null); setSearchParams({}); }}
              className="text-slate-400 hover:text-slate-600 text-sm px-3 py-1.5 border border-slate-200 rounded-lg"
            >
              Change Customer
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSearchParams({ customerId, tab: t.key }); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon className={`h-4 w-4 ${activeTab === t.key ? 'text-blue-600' : ''}`} />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Account summaries */}
              {savingAccts.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-500" />Saving Accounts</h3>
                  {savingAccts.map((a: any) => (
                    <div key={a._id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                      <div><p className="font-mono text-sm">{a.accountNumber}</p><StatusBadge status={a.status} /></div>
                      <p className="font-bold text-slate-800">{formatCurrency(a.balanceInPaise)}</p>
                    </div>
                  ))}
                </div>
              )}
              {pigmyAccts.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><PiggyBank className="h-4 w-4 text-violet-500" />Pigmy Accounts</h3>
                  {pigmyAccts.map((a: any) => (
                    <div key={a._id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                      <div><p className="font-mono text-sm">{a.accountNumber}</p><StatusBadge status={a.status} /></div>
                      <div className="text-right">
                        <p className="font-bold text-violet-700">{formatCurrency(a.balanceInPaise)}</p>
                        <p className="text-xs text-slate-400">{formatCurrency(a.dailyDepositAmountInPaise)}/day</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {loanAccts.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-500" />Loan Accounts</h3>
                  {loanAccts.map((a: any) => (
                    <div key={a._id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                      <div><p className="font-mono text-sm">{a.loanAccountNumber}</p><StatusBadge status={a.status} /></div>
                      <div className="text-right">
                        <p className="font-bold text-amber-700">{formatCurrency(a.outstandingBalanceInPaise)}</p>
                        <p className="text-xs text-slate-400">O/S of {formatCurrency(a.principalAmountInPaise)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Recent Transactions */}
              {recentTxns.length > 0 && (
                <div className="card p-5 lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" />Recent Transactions</h3>
                  <div className="space-y-2">
                    {recentTxns.map((t: any) => (
                      <div key={t._id || t.transactionId} className="flex justify-between items-start py-2 border-b border-slate-50 last:border-0">
                        <div>
                          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize">{t.type?.replace(/_/g, ' ')}</span>
                          <p className="text-xs text-slate-400 mt-0.5">{t.transactionId} · {new Date(t.businessDate).toLocaleDateString('en-IN')}</p>
                        </div>
                        <p className="font-bold text-slate-800">{formatCurrency(t.amountInPaise)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'saving' && (
            savingAccts.length === 0
              ? <div className="text-center py-12 text-slate-400"><Wallet className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>No saving accounts for this customer</p></div>
              : <SavingStatement customerId={customerId} accounts={savingAccts} customer={customer} />
          )}
          {activeTab === 'pigmy' && (
            pigmyAccts.length === 0
              ? <div className="text-center py-12 text-slate-400"><PiggyBank className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>No pigmy accounts for this customer</p></div>
              : <PigmyStatement customerId={customerId} accounts={pigmyAccts} customer={customer} />
          )}
          {activeTab === 'loan' && (
            loanAccts.length === 0
              ? <div className="text-center py-12 text-slate-400"><CreditCard className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>No loan accounts for this customer</p></div>
              : <LoanStatement customerId={customerId} accounts={loanAccts} customer={customer} />
          )}
        </div>
      )}
    </div>
  );
}
