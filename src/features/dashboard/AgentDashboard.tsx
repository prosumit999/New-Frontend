// src/features/dashboard/AgentDashboard.tsx
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sun, Moon, ClipboardList, ChevronRight,
  CheckCircle2, Clock, Banknote, BarChart2, RefreshCw, Users, ShieldAlert, FileText, AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { collectionApi } from '../../api/collection.api';
import { customerApi } from '../../api/customer.api';
import { formatCurrency, formatDate } from '../../utils/format';
import { Button } from '../../components/ui/Button';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // ── Day status: single source of truth
  const { isOpen, displayDate, businessDate, isFetching, refetch } = useBusinessDate();

  // ── Today's collection sheet (agent's own)
  const { data: sheetData, isLoading: sheetLoading } = useQuery({
    queryKey: ['daily-sheet-dashboard', businessDate],
    queryFn: () => collectionApi.getAgentSheet({ date: businessDate }),
    enabled: !!businessDate && isOpen,
    staleTime: 60_000,
  });

  const sheet = (sheetData?.data as any);
  const summary = sheet?.summary || {};
  const items: any[] = sheet?.sheet || [];

  // Next 5 pending accounts
  const pendingItems = items.filter((i: any) => i.collectionStatus === 'pending').slice(0, 5);

  // ── Recent Customer Requests
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['recent-customers-dashboard'],
    queryFn: () => customerApi.list({ isDeleted: 'all', limit: 5 }),
    staleTime: 60_000,
  });
  
  const recentCustomers = (customersData as any)?.customers || [];

  const collectionRate = summary.totalAccounts > 0
    ? Math.round((summary.collectedCount / summary.totalAccounts) * 100)
    : 0;

  return (
    <div className="animate-fade-in animate-slide-up space-y-6">

      {/* ── Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">
            {isOpen
              ? `Business day is open — ${displayDate}`
              : 'Business day is closed. Wait for admin to open the day.'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {/* ── Day Status Banner */}
      <div className={`rounded-xl p-5 flex items-center gap-4 border transition-all ${
        isOpen
          ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
          : 'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-200'
      }`}>
        <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
          isOpen ? 'bg-emerald-100' : 'bg-slate-200'
        }`}>
          {isOpen
            ? <Sun className="h-6 w-6 text-emerald-600" />
            : <Moon className="h-6 w-6 text-slate-500" />}
        </div>
        <div className="flex-1">
          <p className={`font-bold text-lg ${isOpen ? 'text-emerald-800' : 'text-slate-600'}`}>
            {isOpen ? 'Day is Open' : 'Day is Closed'}
          </p>
          <p className="text-sm text-slate-500">{displayDate || 'Fetching date...'}</p>
        </div>
        {isOpen && (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => navigate('/collections/new')}
          >
            Record Collection <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>

      {/* ── Collection Stats (only when day is open and data loaded) */}
      {isOpen && !sheetLoading && summary.totalAccounts > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{summary.totalAccounts || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Assigned Accounts</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{summary.collectedCount || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Collected</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{summary.pendingCount || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Pending</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xl font-bold text-blue-700">{collectionRate}%</p>
              <p className="text-xs text-slate-400 mt-1">Completion Rate</p>
            </div>
          </div>

          {/* ── Progress bar */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">Today's Progress</span>
              </div>
              <span className="text-sm font-bold text-blue-700">
                {formatCurrency(summary.totalCollectedInPaise || 0)}
                <span className="text-slate-400 font-normal text-xs ml-1">
                  of {formatCurrency(summary.expectedTotalInPaise || 0)}
                </span>
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(collectionRate, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {summary.pendingCount > 0
                ? `${summary.pendingCount} accounts still pending`
                : '✨ All collections complete for today!'}
            </p>
          </div>

          {/* ── Pending accounts list */}
          {pendingItems.length > 0 && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <h2 className="font-semibold text-slate-800 text-sm">Pending Collections</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/collections/sheet')}>
                  View All
                </Button>
              </div>
              <div className="divide-y divide-slate-50">
                {pendingItems.map((item: any) => (
                  <div key={item.accountId} className="flex items-center justify-between px-5 py-3 hover:bg-amber-50/30 transition-colors">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{item.customer?.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.accountNumber}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">
                        {formatCurrency(item.dailyDepositAmountInPaise)}
                      </span>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3"
                        onClick={() => navigate(`/collections/new?accountId=${item.accountId}`)}
                      >
                        Collect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Loading state */}
      {isOpen && sheetLoading && (
        <div className="card p-8 text-center">
          <div className="flex justify-center items-center gap-2 text-slate-400">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            Loading collection sheet...
          </div>
        </div>
      )}

      {/* ── Empty state when no accounts assigned */}
      {isOpen && !sheetLoading && summary.totalAccounts === 0 && (
        <div className="card p-8 text-center text-slate-400">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600">No accounts assigned yet</p>
          <p className="text-sm mt-1">Contact your admin to get pigmy accounts assigned to you.</p>
        </div>
      )}

      {/* ── Recent Customer Requests */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Recent Customer Requests</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
            View All
          </Button>
        </div>
        {customersLoading ? (
          <div className="p-6 flex justify-center"><RefreshCw className="h-5 w-5 text-slate-400 animate-spin" /></div>
        ) : recentCustomers.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No recent customer additions</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentCustomers.map((customer: any) => {
               // Determine customer status presentation
               let statusText = 'Pending';
               let statusColor = 'text-slate-500 bg-slate-100 border-slate-200';
               let StatusIcon = Clock;
               let detailsLine = '';

               if (customer.isDeleted) {
                 statusText = 'Deleted';
                 statusColor = 'text-red-700 bg-red-50 border-red-200';
                 StatusIcon = AlertTriangle;
                 detailsLine = customer.deletedReason ? `Reason: ${customer.deletedReason}` : 'Record removed by admins';
               } else if (customer.kycStatus === 'kyc_verified') {
                 statusText = 'Approved';
                 statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                 StatusIcon = CheckCircle2;
                 detailsLine = 'Active and verified by admin';
               } else if (customer.kycStatus === 'kyc_rejected') {
                 statusText = 'Rejected';
                 statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
                 StatusIcon = ShieldAlert;
                 detailsLine = customer.kycRejectedReason ? `Reason: ${customer.kycRejectedReason}` : 'Action required';
               } else if (customer.kycStatus === 'documents_submitted') {
                 statusText = 'Under Review';
                 statusColor = 'text-blue-700 bg-blue-50 border-blue-200';
                 StatusIcon = FileText;
                 detailsLine = 'Requires admin approval';
               } else {
                 statusText = 'Created';
                 detailsLine = 'Awaiting KYC docs from customer';
               }

               return (
                 <div key={customer._id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                   <div className="flex-1">
                     <p className="font-medium text-slate-800 text-sm">{customer.name}</p>
                     <p className="text-xs text-slate-400 font-mono mt-0.5">{customer.phone} · {formatDate(customer.createdAt)}</p>
                     <p className="text-xs text-slate-600 mt-1 italic">{detailsLine}</p>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                     <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor}`}>
                       <StatusIcon className="h-3 w-3" />
                       {statusText}
                     </span>
                     {!customer.isDeleted && (
                       <button onClick={() => navigate(`/customers/${customer._id}`)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                         View Details
                       </button>
                     )}
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>

      {/* ── Quick navigation */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: ClipboardList, label: 'Daily Sheet', path: '/collections/sheet', color: 'blue' },
          { icon: Banknote, label: 'All Collections', path: '/collections', color: 'emerald' },
          { icon: CheckCircle2, label: 'My Customers', path: '/customers', color: 'indigo' },
          { icon: BarChart2, label: 'Pigmy Accounts', path: '/pigmy', color: 'amber' },
        ].map(({ icon: Icon, label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`card p-4 flex items-center gap-3 text-left hover:shadow-md transition-all ${
              color === 'blue' ? 'hover:border-blue-200' :
              color === 'emerald' ? 'hover:border-emerald-200' :
              color === 'indigo' ? 'hover:border-indigo-200' :
              'hover:border-amber-200'
            }`}
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
              color === 'blue' ? 'bg-blue-100' :
              color === 'emerald' ? 'bg-emerald-100' :
              color === 'indigo' ? 'bg-indigo-100' :
              'bg-amber-100'
            }`}>
              <Icon className={`h-5 w-5 ${
                color === 'blue' ? 'text-blue-600' :
                color === 'emerald' ? 'text-emerald-600' :
                color === 'indigo' ? 'text-indigo-600' :
                'text-amber-600'
              }`} />
            </div>
            <span className="text-sm font-semibold text-slate-700">{label}</span>
            <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}
