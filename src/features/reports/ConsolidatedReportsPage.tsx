// src/features/reports/ConsolidatedReportsPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, PiggyBank, Wallet, CreditCard, Users,
  Download, RefreshCw, BarChart3
} from 'lucide-react';
import { reportApi } from '../../api/report.api';
import { exportReportPDF, exportReportCSV } from '../../utils/reportExport';
import { useSystemStore } from '../../store/system.store';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import { ReportInstitutionHeader } from '../../components/shared/ReportInstitutionHeader';

type TabKey = 'pigmy' | 'savings' | 'loans' | 'agents';

const TABS: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'pigmy',   label: 'Pigmy Accounts',   icon: PiggyBank, color: 'text-violet-600' },
  { key: 'savings', label: 'Saving Accounts',  icon: Wallet,    color: 'text-emerald-600' },
  { key: 'loans',   label: 'Loan Portfolio',   icon: CreditCard, color: 'text-amber-600'  },
  { key: 'agents',  label: 'Agent Summary',    icon: Users,     color: 'text-blue-600'    },
];

function fmt(paise: number | undefined) {
  return formatCurrency(paise ?? 0);
}
function num(v: number | undefined) {
  return (v ?? 0).toLocaleString('en-IN');
}

export default function ConsolidatedReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('pigmy');
  const branding = useSystemStore(s => s.branding);

  const { data: pigmyRes,  isLoading: lPigmy,   refetch: rePigmy   } = useQuery({ queryKey: ['cons-pigmy'],   queryFn: reportApi.getConsolidatedPigmy });
  const { data: savingsRes, isLoading: lSavings, refetch: reSavings } = useQuery({ queryKey: ['cons-savings'], queryFn: reportApi.getConsolidatedSavings });
  const { data: loansRes,  isLoading: lLoans,   refetch: reLoans   } = useQuery({ queryKey: ['cons-loans'],   queryFn: reportApi.getConsolidatedLoans });
  const { data: agentsRes, isLoading: lAgents,  refetch: reAgents  } = useQuery({ queryKey: ['cons-agents'],  queryFn: reportApi.getConsolidatedAgents });

  // Correctly navigate the nested ApiResponse → { data: [...], asOfDate }
  function extractRows(res: any): { rows: any[]; asOfDate: string } {
    const payload = res?.data;           // ApiResponse.data  ← this is the object { data: [...], asOfDate }
    const inner   = payload?.data;       // { data: [...], asOfDate }
    if (!inner) return { rows: [], asOfDate: '' };
    const rows     = Array.isArray(inner.data) ? inner.data : (Array.isArray(inner) ? inner : []);
    const asOfDate = inner.asOfDate ? new Date(inner.asOfDate).toLocaleDateString('en-IN') : '';
    return { rows, asOfDate };
  }

  const { rows: pigmyRows,   asOfDate: pigmyDate   } = extractRows(pigmyRes);
  const { rows: savingsRows, asOfDate: savingsDate  } = extractRows(savingsRes);
  const { rows: loansRows,   asOfDate: loansDate    } = extractRows(loansRes);
  const { rows: agentsRows,  asOfDate: agentsDate   } = extractRows(agentsRes);

  const activeRows: any[] = activeTab === 'pigmy'   ? pigmyRows
                          : activeTab === 'savings' ? savingsRows
                          : activeTab === 'loans'   ? loansRows
                          : agentsRows;
  const activeDate = activeTab === 'pigmy'   ? pigmyDate
                   : activeTab === 'savings' ? savingsDate
                   : activeTab === 'loans'   ? loansDate
                   : agentsDate;
  const isLoading = activeTab === 'pigmy'   ? lPigmy
                  : activeTab === 'savings' ? lSavings
                  : activeTab === 'loans'   ? lLoans
                  : lAgents;

  // ── Grand totals ─────────────────────────────────────────
  const pigmyGrand = {
    accounts  : pigmyRows.reduce((s, r) => s + (r.totalAccounts || 0), 0),
    balance   : pigmyRows.reduce((s, r) => s + (r.totalBalanceInPaise || 0), 0),
    daily     : pigmyRows.reduce((s, r) => s + (r.expectedDailyCollectionInPaise || 0), 0),
    collected : pigmyRows.reduce((s, r) => s + (r.totalCollectedInPaise || 0), 0),
  };
  const savingsGrand = {
    accounts : savingsRows.reduce((s, r) => s + (r.totalAccounts || 0), 0),
    balance  : savingsRows.reduce((s, r) => s + (r.totalBalanceInPaise || 0), 0),
  };
  const loansGrand = {
    total       : loansRows.reduce((s, r) => s + (r.totalLoans || 0), 0),
    active      : loansRows.reduce((s, r) => s + (r.activeCount || 0), 0),
    overdue     : loansRows.reduce((s, r) => s + (r.overdueCount || 0), 0),
    disbursed   : loansRows.reduce((s, r) => s + (r.principalDisbursedInPaise || 0), 0),
    outstanding : loansRows.reduce((s, r) => s + (r.outstandingBalanceInPaise || 0), 0),
    repaid      : loansRows.reduce((s, r) => s + (r.totalRepaidInPaise || 0), 0),
    penalty     : loansRows.reduce((s, r) => s + (r.totalPenaltyInPaise || 0), 0),
  };
  const agentsGrand = {
    accounts    : agentsRows.reduce((s, r) => s + (r.totalPigmyAccounts || 0), 0),
    pigmyBal    : agentsRows.reduce((s, r) => s + (r.pigmyBalanceInPaise || 0), 0),
    loanOut     : agentsRows.reduce((s, r) => s + (r.loanOutstandingInPaise || 0), 0),
    cashInHand  : agentsRows.reduce((s, r) => s + (r.cashInHandInPaise || 0), 0),
  };

  // ── Unified Export ─────────────────────────────────────────
  const handleExport = (format: 'pdf' | 'csv') => {
    let title = '';
    let subtitle = '';
    let filename = '';
    let dateRange = '';
    let columns: any[] = [];
    let rows: any[] = [];
    let summary: any[] = [];

    if (activeTab === 'pigmy') {
      title = 'Consolidated Pigmy Report';
      subtitle = 'Agent-wise Pigmy Account Summary';
      dateRange = `As of ${pigmyDate}`;
      filename = `consolidated_pigmy_${pigmyDate.replace(/\//g, '-')}`;
      columns = [
        { header: '#',               dataKey: 'sno',       align: 'center', width: 10 },
        { header: 'Agent Name',      dataKey: 'agentName', align: 'left'              },
        { header: 'Agent Code',      dataKey: 'agentCode', align: 'center'            },
        { header: 'Total Accounts',  dataKey: 'accounts',  align: 'right'             },
        { header: 'Daily Expected',  dataKey: 'daily',     align: 'right'             },
        { header: 'Total Collected', dataKey: 'collected', align: 'right'             },
        { header: 'Corpus Balance',  dataKey: 'balance',   align: 'right'             },
      ];
      rows = pigmyRows.map((r, i) => ({
        sno:       i + 1,
        agentName: r.agentName,
        agentCode: r.agentCode,
        accounts:  num(r.totalAccounts),
        daily:     fmt(r.expectedDailyCollectionInPaise),
        collected: fmt(r.totalCollectedInPaise),
        balance:   fmt(r.totalBalanceInPaise),
      }));
      summary = [
        { label: 'Total Accounts',  value: num(pigmyGrand.accounts) },
        { label: 'Daily Expected',  value: fmt(pigmyGrand.daily)   },
        { label: 'Total Collected', value: fmt(pigmyGrand.collected) },
        { label: 'Corpus Balance',  value: fmt(pigmyGrand.balance)  },
      ];
    } else if (activeTab === 'savings') {
      title = 'Consolidated Savings Report';
      subtitle = 'Agent-wise Saving Account Summary';
      dateRange = `As of ${savingsDate}`;
      filename = `consolidated_savings_${savingsDate.replace(/\//g, '-')}`;
      columns = [
        { header: '#',            dataKey: 'sno',       align: 'center', width: 10 },
        { header: 'Agent Name',   dataKey: 'agentName', align: 'left'              },
        { header: 'Agent Code',   dataKey: 'agentCode', align: 'center'            },
        { header: 'Accounts',     dataKey: 'accounts',  align: 'right'             },
        { header: 'Total Balance',dataKey: 'balance',   align: 'right'             },
      ];
      rows = savingsRows.map((r, i) => ({
        sno:       i + 1,
        agentName: r.agentName,
        agentCode: r.agentCode,
        accounts:  num(r.totalAccounts),
        balance:   fmt(r.totalBalanceInPaise),
      }));
      summary = [
        { label: 'Total Accounts', value: num(savingsGrand.accounts) },
        { label: 'Total Balance',  value: fmt(savingsGrand.balance)  },
      ];
    } else if (activeTab === 'loans') {
      title = 'Consolidated Loan Portfolio';
      subtitle = 'Plan-wise Loan Summary';
      dateRange = `As of ${loansDate}`;
      filename = `consolidated_loans_${loansDate.replace(/\//g, '-')}`;
      columns = [
        { header: '#',              dataKey: 'sno',       align: 'center', width: 10 },
        { header: 'Plan Name',      dataKey: 'plan',      align: 'left'              },
        { header: 'Total',          dataKey: 'total',     align: 'right'             },
        { header: 'Active',         dataKey: 'active',    align: 'right'             },
        { header: 'Overdue',        dataKey: 'overdue',   align: 'right'             },
        { header: 'Disbursed',      dataKey: 'disbursed', align: 'right'             },
        { header: 'Outstanding',    dataKey: 'outstanding',align: 'right'            },
        { header: 'Repaid',         dataKey: 'repaid',    align: 'right'             },
        { header: 'Penalty',        dataKey: 'penalty',   align: 'right'             },
      ];
      rows = loansRows.map((r, i) => ({
        sno:         i + 1,
        plan:        r.planName,
        total:       num(r.totalLoans),
        active:      num(r.activeCount),
        overdue:     num(r.overdueCount),
        disbursed:   fmt(r.principalDisbursedInPaise),
        outstanding: fmt(r.outstandingBalanceInPaise),
        repaid:      fmt(r.totalRepaidInPaise),
        penalty:     fmt(r.totalPenaltyInPaise),
      }));
      summary = [
        { label: 'Total Loans',    value: num(loansGrand.total)       },
        { label: 'Disbursed',      value: fmt(loansGrand.disbursed)   },
        { label: 'Outstanding',    value: fmt(loansGrand.outstanding) },
        { label: 'Total Repaid',   value: fmt(loansGrand.repaid)      },
        { label: 'Total Penalty',  value: fmt(loansGrand.penalty)     },
      ];
    } else {
      title = 'Consolidated Agent Summary';
      subtitle = 'Agent-wise Portfolio Overview';
      dateRange = `As of ${agentsDate}`;
      filename = `consolidated_agents_${agentsDate.replace(/\//g, '-')}`;
      columns = [
        { header: '#',             dataKey: 'sno',       align: 'center', width: 10 },
        { header: 'Agent',         dataKey: 'agent',     align: 'left'              },
        { header: 'Code',          dataKey: 'code',      align: 'center'            },
        { header: 'Pigmy Accts',   dataKey: 'pigmyAccs', align: 'right'             },
        { header: 'Pigmy Balance', dataKey: 'pigmyBal',  align: 'right'             },
        { header: 'Loan O/S',      dataKey: 'loanOut',   align: 'right'             },
        { header: 'Cash in Hand',  dataKey: 'cash',      align: 'right'             },
      ];
      rows = agentsRows.map((r, i) => ({
        sno:      i + 1,
        agent:    r.agentName,
        code:     r.agentCode,
        pigmyAccs:num(r.totalPigmyAccounts),
        pigmyBal: fmt(r.pigmyBalanceInPaise),
        loanOut:  fmt(r.loanOutstandingInPaise),
        cash:     fmt(r.cashInHandInPaise),
      }));
      summary = [
        { label: 'Total Pigmy Accounts',    value: num(agentsGrand.accounts)   },
        { label: 'Total Pigmy Balance',     value: fmt(agentsGrand.pigmyBal)   },
        { label: 'Total Loan Outstanding',  value: fmt(agentsGrand.loanOut)    },
        { label: 'Total Cash in Hand',      value: fmt(agentsGrand.cashInHand) },
      ];
    }

    const opts = { title, subtitle, dateRange, filename, columns, rows, summary, branding };
    if (format === 'pdf') exportReportPDF({ ...opts, orientation: 'landscape' });
    else exportReportCSV(opts);
  };

  // ── Table rendering ───────────────────────────────────────
  const renderTable = () => {
    if (isLoading) return (
      <tr><td colSpan={10} className="text-center py-16 text-slate-400">
        <div className="flex justify-center items-center gap-2">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          Loading report data...
        </div>
      </td></tr>
    );
    if (activeRows.length === 0) return (
      <tr><td colSpan={10} className="text-center py-16 text-slate-400">
        <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-20" />
        No data available
      </td></tr>
    );

    if (activeTab === 'pigmy') return pigmyRows.map((r, i) => (
      <tr key={r._id || i} className="hover:bg-violet-50/30 transition-colors">
        <td className="text-slate-400 text-center text-xs">{i + 1}</td>
        <td><p className="font-semibold text-slate-800 text-sm">{r.agentName}</p></td>
        <td className="text-slate-500 text-sm text-center">{r.agentCode}</td>
        <td className="text-right font-medium text-slate-700">{num(r.totalAccounts)}</td>
        <td className="text-right font-semibold text-violet-700">{fmt(r.expectedDailyCollectionInPaise)}</td>
        <td className="text-right font-semibold text-emerald-700">{fmt(r.totalCollectedInPaise)}</td>
        <td className="text-right font-bold text-slate-900">{fmt(r.totalBalanceInPaise)}</td>
      </tr>
    ));

    if (activeTab === 'savings') return savingsRows.map((r, i) => (
      <tr key={r._id || i} className="hover:bg-emerald-50/30 transition-colors">
        <td className="text-slate-400 text-center text-xs">{i + 1}</td>
        <td><p className="font-semibold text-slate-800 text-sm">{r.agentName}</p></td>
        <td className="text-slate-500 text-sm text-center">{r.agentCode}</td>
        <td className="text-right font-medium text-slate-700">{num(r.totalAccounts)}</td>
        <td className="text-right font-bold text-slate-900">{fmt(r.totalBalanceInPaise)}</td>
      </tr>
    ));

    if (activeTab === 'loans') return loansRows.map((r, i) => (
      <tr key={r._id || i} className="hover:bg-amber-50/30 transition-colors">
        <td className="text-slate-400 text-center text-xs">{i + 1}</td>
        <td><p className="font-semibold text-slate-800 text-sm">{r.planName}</p>
            <p className="text-xs text-slate-400">{r.durationMonths}m</p></td>
        <td className="text-right">{num(r.totalLoans)}</td>
        <td className="text-right text-emerald-700 font-medium">{num(r.activeCount)}</td>
        <td className="text-right text-red-600 font-medium">{num(r.overdueCount)}</td>
        <td className="text-right font-semibold text-slate-700">{fmt(r.principalDisbursedInPaise)}</td>
        <td className="text-right font-bold text-amber-700">{fmt(r.outstandingBalanceInPaise)}</td>
        <td className="text-right font-semibold text-emerald-700">{fmt(r.totalRepaidInPaise)}</td>
        <td className="text-right font-semibold text-red-600">{fmt(r.totalPenaltyInPaise)}</td>
      </tr>
    ));

    if (activeTab === 'agents') return agentsRows.map((r, i) => (
      <tr key={r._id || i} className="hover:bg-blue-50/30 transition-colors">
        <td className="text-slate-400 text-center text-xs">{i + 1}</td>
        <td><p className="font-semibold text-slate-800 text-sm">{r.agentName}</p>
            <p className="text-xs text-slate-400">{r.agentPhone}</p></td>
        <td className="text-center text-slate-500 text-sm">{r.agentCode}</td>
        <td className="text-right">{num(r.totalPigmyAccounts)}</td>
        <td className="text-right font-medium text-violet-700">{fmt(r.pigmyBalanceInPaise)}</td>
        <td className="text-right font-medium text-slate-600">{fmt(r.expectedDailyInPaise)}</td>
        <td className="text-right font-medium text-amber-700">{num(r.totalActiveLoans)}</td>
        <td className="text-right font-bold text-red-600">{fmt(r.loanOutstandingInPaise)}</td>
        <td className="text-right font-bold text-emerald-700">{fmt(r.cashInHandInPaise)}</td>
      </tr>
    ));
  };

  const renderHeaders = () => {
    if (activeTab === 'pigmy') return (
      <tr>
        <th className="text-center w-8">#</th>
        <th>Agent</th><th className="text-center">Code</th>
        <th className="text-right">Accounts</th>
        <th className="text-right">Daily Expected</th>
        <th className="text-right">Total Collected</th>
        <th className="text-right">Corpus Balance</th>
      </tr>
    );
    if (activeTab === 'savings') return (
      <tr>
        <th className="text-center w-8">#</th>
        <th>Agent</th><th className="text-center">Code</th>
        <th className="text-right">Accounts</th>
        <th className="text-right">Total Balance</th>
      </tr>
    );
    if (activeTab === 'loans') return (
      <tr>
        <th className="text-center w-8">#</th>
        <th>Plan</th>
        <th className="text-right">Total</th><th className="text-right">Active</th>
        <th className="text-right">Overdue</th><th className="text-right">Disbursed</th>
        <th className="text-right">Outstanding</th><th className="text-right">Repaid</th>
        <th className="text-right">Penalty</th>
      </tr>
    );
    return (
      <tr>
        <th className="text-center w-8">#</th>
        <th>Agent</th><th className="text-center">Code</th>
        <th className="text-right">Pigmy Accts</th><th className="text-right">Pigmy Balance</th>
        <th className="text-right">Daily Target</th>
        <th className="text-right">Active Loans</th><th className="text-right">Loan O/S</th>
        <th className="text-right">Cash in Hand</th>
      </tr>
    );
  };

  const renderFooter = () => {
    if (activeRows.length === 0 || isLoading) return null;
    if (activeTab === 'pigmy') return (
      <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
        <td colSpan={3} className="px-3 py-3 text-slate-700">GRAND TOTAL</td>
        <td className="text-right py-3 px-3">{num(pigmyGrand.accounts)}</td>
        <td className="text-right text-violet-700 py-3 px-3">{fmt(pigmyGrand.daily)}</td>
        <td className="text-right text-emerald-700 py-3 px-3">{fmt(pigmyGrand.collected)}</td>
        <td className="text-right text-slate-900 py-3 px-3">{fmt(pigmyGrand.balance)}</td>
      </tr>
    );
    if (activeTab === 'savings') return (
      <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
        <td colSpan={3} className="px-3 py-3 text-slate-700">GRAND TOTAL</td>
        <td className="text-right py-3 px-3">{num(savingsGrand.accounts)}</td>
        <td className="text-right text-slate-900 py-3 px-3">{fmt(savingsGrand.balance)}</td>
      </tr>
    );
    if (activeTab === 'loans') return (
      <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
        <td colSpan={2} className="px-3 py-3 text-slate-700">GRAND TOTAL</td>
        <td className="text-right py-3 px-3">{num(loansGrand.total)}</td>
        <td className="text-right text-emerald-700 py-3 px-3">{num(loansGrand.active)}</td>
        <td className="text-right text-red-600 py-3 px-3">{num(loansGrand.overdue)}</td>
        <td className="text-right py-3 px-3">{fmt(loansGrand.disbursed)}</td>
        <td className="text-right text-amber-700 py-3 px-3">{fmt(loansGrand.outstanding)}</td>
        <td className="text-right text-emerald-700 py-3 px-3">{fmt(loansGrand.repaid)}</td>
        <td className="text-right text-red-600 py-3 px-3">{fmt(loansGrand.penalty)}</td>
      </tr>
    );
    return (
      <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
        <td colSpan={3} className="px-3 py-3 text-slate-700">GRAND TOTAL</td>
        <td className="text-right py-3 px-3">{num(agentsGrand.accounts)}</td>
        <td className="text-right text-violet-700 py-3 px-3">{fmt(agentsGrand.pigmyBal)}</td>
        <td className="py-3 px-3"/>
        <td className="py-3 px-3"/>
        <td className="text-right text-red-600 py-3 px-3">{fmt(agentsGrand.loanOut)}</td>
        <td className="text-right text-emerald-700 py-3 px-3">{fmt(agentsGrand.cashInHand)}</td>
      </tr>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      <ReportInstitutionHeader
        reportTitle="Consolidated Reports"
        dateRange={activeDate}
        subInfo={`Viewing ${TABS.find(t => t.key === activeTab)?.label}`}
      />

      <div className="flex items-center justify-between">
        <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit gap-1">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all ${
                  activeTab === t.key
                    ? `bg-white shadow-sm ${t.color}`
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (activeTab === 'pigmy')   rePigmy();
            if (activeTab === 'savings') reSavings();
            if (activeTab === 'loans')   reLoans();
            if (activeTab === 'agents')  reAgents();
          }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="gap-2" disabled={activeRows.length === 0}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" onClick={() => handleExport('pdf')} className="gap-2" disabled={activeRows.length === 0}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>{renderHeaders()}</thead>
            <tbody>{renderTable()}</tbody>
            {renderFooter() && <tfoot>{renderFooter()}</tfoot>}
          </table>
        </div>
        {!isLoading && activeRows.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400 flex justify-between">
            <span>{activeRows.length} row{activeRows.length !== 1 ? 's' : ''}</span>
            <span>As of {activeDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}
