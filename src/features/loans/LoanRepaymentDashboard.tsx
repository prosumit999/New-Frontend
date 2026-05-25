// src/features/loans/LoanRepaymentDashboard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, AlertCircle, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { loanApi } from '../../api/loan.api';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';

export default function LoanRepaymentDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [daysThreshold, setDaysThreshold] = useState(30);
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['repayment-dashboard', daysThreshold],
    queryFn: () => loanApi.getRepaymentDashboard({ daysThreshold }),
  });

  const dashboard = data?.data as any;
  const loans = dashboard?.loans || [];
  const summary = dashboard?.summary || {};

  const filteredLoans = loans.filter((l: any) => 
    urgencyFilter === 'all' || l.urgency === urgencyFilter
  );

  const pigmyMutation = useMutation({
    mutationFn: ({ id, amountInPaise }: { id: string; amountInPaise: number }) =>
      loanApi.applyPigmy(id, { amountInPaise, note: 'System-suggested repayment from dashboard' }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Repayment applied successfully');
      queryClient.invalidateQueries({ queryKey: ['repayment-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to apply repayment'),
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return 'text-red-700 bg-red-100 border-red-200';
      case 'critical': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'warning': return 'text-amber-700 bg-amber-100 border-amber-200';
      default: return 'text-emerald-700 bg-emerald-100 border-emerald-200';
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return <AlertCircle className="h-4 w-4 mr-1 text-red-600" />;
      case 'critical': return <TrendingUp className="h-4 w-4 mr-1 text-orange-600" />;
      case 'warning': return <Clock className="h-4 w-4 mr-1 text-amber-600" />;
      default: return <CheckCircle className="h-4 w-4 mr-1 text-emerald-600" />;
    }
  };

  return (
    <div className="animate-fade-in animate-slide-up">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/loans')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Repayment Dashboard</h1>
            <p className="page-subtitle">Track maturity risk and process bulk pigmy-to-loan transfers</p>
          </div>
        </div>
        <div>
          <select 
            className="form-input py-2 px-3 text-sm rounded-lg border-slate-200"
            value={daysThreshold}
            onChange={(e) => setDaysThreshold(Number(e.target.value))}
          >
            <option value={7}>Upcoming 7 Days</option>
            <option value={15}>Upcoming 15 Days</option>
            <option value={30}>Upcoming 30 Days</option>
            <option value={60}>Upcoming 60 Days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setUrgencyFilter('all')}>
          <p className="text-xl font-bold text-slate-800">{summary.totalLoans || loans.length}</p>
          <p className={`text-xs mt-1 ${urgencyFilter === 'all' ? 'font-bold text-blue-600' : 'text-slate-500'}`}>Total Tracked</p>
        </div>
        <div className="card p-4 text-center cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-red-500" onClick={() => setUrgencyFilter('overdue')}>
          <p className="text-xl font-bold text-red-600">{summary.overdueCount || 0}</p>
          <p className={`text-xs mt-1 ${urgencyFilter === 'overdue' ? 'font-bold text-red-700' : 'text-slate-500'}`}>Overdue</p>
        </div>
        <div className="card p-4 text-center cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-orange-500" onClick={() => setUrgencyFilter('critical')}>
          <p className="text-xl font-bold text-orange-600">{summary.criticalCount || 0}</p>
          <p className={`text-xs mt-1 ${urgencyFilter === 'critical' ? 'font-bold text-orange-700' : 'text-slate-500'}`}>Critical (≤7 days)</p>
        </div>
        <div className="card p-4 text-center cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-amber-500" onClick={() => setUrgencyFilter('warning')}>
          <p className="text-xl font-bold text-amber-600">{summary.warningCount || 0}</p>
          <p className={`text-xs mt-1 ${urgencyFilter === 'warning' ? 'font-bold text-amber-700' : 'text-slate-500'}`}>Warning (≤30 days)</p>
        </div>
        <div className="card p-4 text-center cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-emerald-500" onClick={() => setUrgencyFilter('normal')}>
          <p className="text-xl font-bold text-emerald-600">{summary.normalCount || 0}</p>
          <p className={`text-xs mt-1 ${urgencyFilter === 'normal' ? 'font-bold text-emerald-700' : 'text-slate-500'}`}>Normal</p>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loan Ref</th>
                <th>Customer</th>
                <th className="text-center">Risk Tier</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Pigmy Funds</th>
                <th className="text-center">Maturity In</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">Evaluating risks...</td></tr>
              ) : filteredLoans.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">No loans match this urgency tier.</td></tr>
              ) : (
                filteredLoans.map((l: any) => (
                  <tr key={l.loanId}>
                    <td>
                      <span className="font-mono text-sm text-blue-600 cursor-pointer hover:underline" onClick={() => navigate(`/loans/${l.loanId}`)}>
                        {l.loanAccountNumber}
                      </span>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium text-slate-900">{l.customer?.name}</p>
                        <p className="text-xs text-slate-500">{l.customer?.customerCode}</p>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getUrgencyColor(l.urgency)}`}>
                        {getUrgencyIcon(l.urgency)}
                        <span className="capitalize">{l.urgency}</span>
                      </span>
                    </td>
                    <td className="text-right font-medium text-red-600">
                      {formatCurrency(l.loan?.outstandingInPaise)}
                    </td>
                    <td className="text-right">
                      {l.pigmyAccount?.availableBalanceInPaise > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-700 font-semibold">{formatCurrency(l.pigmyAccount.availableBalanceInPaise)}</span>
                          {l.canFullySettle && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">Can Settle Full</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400">Zero</span>
                      )}
                    </td>
                    <td className="text-center">
                      {l.daysToMaturity < 0 ? (
                        <span className="text-red-600 font-bold">{-l.daysToMaturity}d late</span>
                      ) : l.daysToMaturity === 0 ? (
                        <span className="text-orange-600 font-bold">Today</span>
                      ) : (
                        <span className="text-slate-700 font-medium">{l.daysToMaturity}d</span>
                      )}
                    </td>
                    <td className="text-center">
                      <Button
                        size="sm"
                        className={l.canFullySettle ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        disabled={!l.suggestedAmountInPaise || l.suggestedAmountInPaise <= 0}
                        isLoading={pigmyMutation.isPending && pigmyMutation.variables?.id === l.loanId}
                        onClick={() => {
                          if (window.confirm(`Transfer ₹${l.suggestedAmountInRupees} from Pigmy to ${l.loanAccountNumber}?`)) {
                            pigmyMutation.mutate({ id: l.loanId, amountInPaise: l.suggestedAmountInPaise });
                          }
                        }}
                      >
                        Transfer ₹{l.suggestedAmountInRupees || '0.00'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
