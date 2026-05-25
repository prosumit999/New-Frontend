// src/router/index.tsx
import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import LoginPage from '../features/auth/LoginPage';
import AdminDashboard from '../features/dashboard/AdminDashboard';
import AgentDashboard from '../features/dashboard/AgentDashboard';
import SuperadminDashboard from '../features/dashboard/SuperadminDashboard';
import AgentListPage from '../features/agents/AgentListPage';
import CreateAgentPage from '../features/agents/CreateAgentPage';
import AgentDetailPage from '../features/agents/AgentDetailPage';
import EditAgentProfilePage from '../features/agents/EditAgentProfilePage';
import AgentKycPendingPage from '../features/agents/AgentKycPendingPage';
import ReassignmentPage from '../features/agents/ReassignmentPage';
import CustomerListPage from '../features/customers/CustomerListPage';
import CreateCustomerPage from '../features/customers/CreateCustomerPage';
import CustomerDetailPage from '../features/customers/CustomerDetailPage';
import EditCustomerPage from '../features/customers/EditCustomerPage';
import CustomerKycPendingPage from '../features/customers/CustomerKycPendingPage';
import SavingListPage from '../features/savings/SavingListPage';
import CreateSavingPage from '../features/savings/CreateSavingPage';
import SavingDetailPage from '../features/savings/SavingDetailPage';
import PigmyListPage from '../features/pigmy/PigmyListPage';
import CreatePigmyPage from '../features/pigmy/CreatePigmyPage';
import PigmyDetailPage from '../features/pigmy/PigmyDetailPage';
import CollectionListPage from '../features/collections/CollectionListPage';
import RecordCollectionPage from '../features/collections/RecordCollectionPage';
import CollectionDetailPage from '../features/collections/CollectionDetailPage';
import DailySheetPage from '../features/collections/DailySheetPage';
import MissedCollectionsPage from '../features/collections/MissedCollectionsPage';
import DailySummaryPage from '../features/collections/DailySummaryPage';
import AgentCollectionReportPage from '../features/collections/AgentCollectionReportPage';
import AgentDepositListPage from '../features/agent-deposits/AgentDepositListPage';
import RecordDepositPage from '../features/agent-deposits/RecordDepositPage';
import AgentDepositDetailPage from '../features/agent-deposits/AgentDepositDetailPage';
import AgentBalanceDashboard from '../features/agent-deposits/AgentBalanceDashboard';
import LoanListPage from '../features/loans/LoanListPage';
import CreateLoanPage from '../features/loans/CreateLoanPage';
import LoanDetailPage from '../features/loans/LoanDetailPage';
import LoanRepaymentDashboard from '../features/loans/LoanRepaymentDashboard';
import DeficitDashboardPage from '../features/loans/DeficitDashboardPage';
import DayControlPage from '../features/day-control/DayControlPage';
import LoanPlansPage from '../features/superadmin/LoanPlansPage';
import AdminManagementPage from '../features/superadmin/AdminManagementPage';
import SystemControlPage from '../features/superadmin/SystemControlPage';
import AuditLogsPage from '../features/superadmin/AuditLogsPage';
import LedgerAccountsPage from '../features/superadmin/LedgerAccountsPage';
import SuperadminDayControlPage from '../features/superadmin/SuperadminDayControlPage';
import ReportsHubPage from '../features/reports/ReportsHubPage';
import OperationalReportsPage from '../features/reports/OperationalReportsPage';
import FinancialReportsPage from '../features/reports/FinancialReportsPage';
import LoanPortfolioReportPage from '../features/reports/LoanPortfolioReportPage';
import LedgerPage from '../features/ledger/LedgerPage';
import CashBankPayment from '../features/transactions/CashBankPayment';
import TransactionHistoryPage from '../features/transactions/TransactionHistoryPage';
import DailyTransactionReportPage from '../features/reports/DailyTransactionReportPage';
import CustomerAccountReportsPage from '../features/reports/CustomerAccountReportsPage';
// ── Agent Reports ─────────────────────────────────────────────────────────────
import AgentReportsHubPage from '../features/reports/AgentReportsHubPage';
import AgentPigmyReportPage from '../features/reports/AgentPigmyReportPage';
import AgentCollectionRptPage from '../features/reports/AgentCollectionReportPage';
import AgentDepositReportPage from '../features/reports/AgentDepositReportPage';
// ── Dev Panel (vendor-level) ───────────────────────────────────────────
import DevDashboard from '../features/dev/DevDashboard';
import DevPanelPage from '../features/dev/DevPanelPage';
import { useAuthStore } from '../store/auth.store';
import { DayGuard } from '../components/common/DayGuard';

// Helper component to guard routes based on role
const RoleGuard = ({ roles, children }: { roles: string[]; children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    if (user.role === 'dev') return <Navigate to="/dev/dashboard" replace />;
    if (user.role === 'superadmin') return <Navigate to="/superadmin/dashboard" replace />;
    if (user.role === 'admin') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/agent/dashboard" replace />;
  }
  return children;
};

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      // ── Dashboards ────────────────────────────────────────────────────
      { path: 'dashboard', element: <RoleGuard roles={['admin']}><AdminDashboard /></RoleGuard> },
      { path: 'agent/dashboard', element: <RoleGuard roles={['agent']}><AgentDashboard /></RoleGuard> },
      { path: 'superadmin/dashboard', element: <RoleGuard roles={['superadmin']}><SuperadminDashboard /></RoleGuard> },
      // ── Agents ────────────────────────────────────────────────────────
      { path: 'agents', element: <RoleGuard roles={['superadmin', 'admin']}><AgentListPage /></RoleGuard> },
      { path: 'agents/new', element: <RoleGuard roles={['superadmin', 'admin']}><CreateAgentPage /></RoleGuard> },
      { path: 'agents/kyc-pending', element: <RoleGuard roles={['superadmin', 'admin']}><AgentKycPendingPage /></RoleGuard> },
      { path: 'agents/reassignment', element: <RoleGuard roles={['superadmin', 'admin']}><ReassignmentPage /></RoleGuard> },
      { path: 'agents/:id', element: <RoleGuard roles={['superadmin', 'admin']}><AgentDetailPage /></RoleGuard> },
      { path: 'agents/:id/edit', element: <RoleGuard roles={['superadmin', 'admin']}><EditAgentProfilePage /></RoleGuard> },
      // ── Customers ─────────────────────────────────────────────────────
      { path: 'customers', element: <RoleGuard roles={['superadmin', 'admin', 'agent']}><CustomerListPage /></RoleGuard> },
      { path: 'customers/new', element: <RoleGuard roles={['admin', 'agent']}><CreateCustomerPage /></RoleGuard> },
      { path: 'customers/kyc-pending', element: <RoleGuard roles={['superadmin', 'admin']}><CustomerKycPendingPage /></RoleGuard> },
      { path: 'customers/:id', element: <RoleGuard roles={['superadmin', 'admin', 'agent']}><CustomerDetailPage /></RoleGuard> },
      { path: 'customers/:id/edit', element: <RoleGuard roles={['admin']}><EditCustomerPage /></RoleGuard> },
      // ── Saving Accounts (superadmin read-only, admin full access) ────────────────
      { path: 'savings', element: <RoleGuard roles={['admin', 'superadmin']}><SavingListPage /></RoleGuard> },
      { path: 'savings/new', element: <RoleGuard roles={['admin']}><CreateSavingPage /></RoleGuard> },
      { path: 'savings/:id', element: <RoleGuard roles={['admin', 'superadmin']}><SavingDetailPage /></RoleGuard> },
      // ── Pigmy Accounts ────────────────────────────────────────────────
      { path: 'pigmy', element: <RoleGuard roles={['superadmin', 'admin', 'agent']}><PigmyListPage /></RoleGuard> },
      { path: 'pigmy/new', element: <RoleGuard roles={['superadmin', 'admin', 'agent']}><CreatePigmyPage /></RoleGuard> },
      { path: 'pigmy/:id', element: <RoleGuard roles={['superadmin', 'admin', 'agent']}><PigmyDetailPage /></RoleGuard> },
      // ── Collections ───────────────────────────────────────────
      { path: 'collections', element: <RoleGuard roles={['admin', 'agent', 'superadmin']}><CollectionListPage /></RoleGuard> },
      { path: 'collections/new', element: <RoleGuard roles={['admin', 'agent']}><DayGuard><RecordCollectionPage /></DayGuard></RoleGuard> },
      { path: 'collections/record', element: <RoleGuard roles={['admin', 'agent']}><DayGuard><RecordCollectionPage /></DayGuard></RoleGuard> },
      { path: 'collections/sheet', element: <RoleGuard roles={['admin', 'agent', 'superadmin']}><DailySheetPage /></RoleGuard> },
      { path: 'collections/missed', element: <RoleGuard roles={['admin', 'superadmin']}><MissedCollectionsPage /></RoleGuard> },
      { path: 'collections/daily-summary', element: <RoleGuard roles={['admin', 'superadmin']}><DailySummaryPage /></RoleGuard> },
      { path: 'collections/agent-report', element: <RoleGuard roles={['admin', 'superadmin']}><AgentCollectionReportPage /></RoleGuard> },
      { path: 'collections/:id', element: <RoleGuard roles={['admin', 'agent', 'superadmin']}><CollectionDetailPage /></RoleGuard> },
      // ── Agent Deposits ──────────────────────────────────────────────────
      { path: 'agent-deposits', element: <RoleGuard roles={['superadmin', 'admin']}><AgentDepositListPage /></RoleGuard> },
      { path: 'agent-deposits/new', element: <RoleGuard roles={['admin', 'superadmin']}><DayGuard><RecordDepositPage /></DayGuard></RoleGuard> },
      { path: 'agent-deposits/balances', element: <RoleGuard roles={['admin', 'superadmin']}><AgentBalanceDashboard /></RoleGuard> },
      { path: 'agent-deposits/:id', element: <RoleGuard roles={['superadmin', 'admin']}><AgentDepositDetailPage /></RoleGuard> },
      // ── Loans ──────────────────────────────────────────────────────────
      { path: 'loans', element: <RoleGuard roles={['admin', 'agent', 'superadmin']}><LoanListPage /></RoleGuard> },
      { path: 'loans/new', element: <RoleGuard roles={['admin']}><DayGuard><CreateLoanPage /></DayGuard></RoleGuard> },
      { path: 'loans/repayments', element: <RoleGuard roles={['admin', 'superadmin']}><LoanRepaymentDashboard /></RoleGuard> },
      { path: 'loans/deficit', element: <RoleGuard roles={['admin', 'superadmin']}><DeficitDashboardPage /></RoleGuard> },
      { path: 'loans/:id', element: <RoleGuard roles={['admin', 'agent', 'superadmin']}><LoanDetailPage /></RoleGuard> },
      // ── Day Control ────────────────────────────────────────────────────
      { path: 'day-control', element: <RoleGuard roles={['admin', 'superadmin']}><DayControlPage /></RoleGuard> },
      // ── Superadmin ─────────────────────────────────────────────────────
      { path: 'superadmin/admins', element: <RoleGuard roles={['superadmin']}><AdminManagementPage /></RoleGuard> },
      { path: 'superadmin/system', element: <RoleGuard roles={['superadmin']}><SystemControlPage /></RoleGuard> },
      { path: 'superadmin/loan-plans', element: <RoleGuard roles={['superadmin']}><LoanPlansPage /></RoleGuard> },
      { path: 'superadmin/audit-logs', element: <RoleGuard roles={['superadmin', 'admin']}><AuditLogsPage /></RoleGuard> },
      { path: 'superadmin/ledger-accounts', element: <RoleGuard roles={['superadmin']}><LedgerAccountsPage /></RoleGuard> },
      { path: 'superadmin/day-control', element: <RoleGuard roles={['superadmin']}><SuperadminDayControlPage /></RoleGuard> },
      // ── Dev Panel (vendor-level — DEV role only) ─────────────────────────────
      { path: 'dev/dashboard', element: <RoleGuard roles={['dev']}><DevDashboard /></RoleGuard> },
      { path: 'dev/panel', element: <RoleGuard roles={['dev']}><DevPanelPage /></RoleGuard> },
      // ── Admin Reports ─────────────────────────────────────────────────
      { path: 'reports', element: <RoleGuard roles={['superadmin', 'admin']}><ReportsHubPage /></RoleGuard> },
      { path: 'reports/operational', element: <RoleGuard roles={['superadmin', 'admin']}><OperationalReportsPage /></RoleGuard> },
      { path: 'reports/loans', element: <RoleGuard roles={['superadmin', 'admin']}><LoanPortfolioReportPage /></RoleGuard> },
      { path: 'reports/financial', element: <RoleGuard roles={['superadmin', 'admin']}><FinancialReportsPage /></RoleGuard> },
      { path: 'reports/daily-transactions', element: <RoleGuard roles={['superadmin', 'admin']}><DailyTransactionReportPage /></RoleGuard> },
      { path: 'reports/customer-accounts', element: <RoleGuard roles={['superadmin', 'admin']}><CustomerAccountReportsPage /></RoleGuard> },
      // ── Agent Reports (unique routes — agent-scoped data only) ─────────
      { path: 'agent/reports', element: <RoleGuard roles={['agent']}><AgentReportsHubPage /></RoleGuard> },
      { path: 'agent/reports/pigmy', element: <RoleGuard roles={['agent']}><AgentPigmyReportPage /></RoleGuard> },
      { path: 'agent/reports/collections', element: <RoleGuard roles={['agent']}><AgentCollectionRptPage /></RoleGuard> },
      { path: 'agent/reports/deposits', element: <RoleGuard roles={['agent']}><AgentDepositReportPage /></RoleGuard> },
      // ── Ledger ────────────────────────────────────────────────────────
      { path: 'ledger', element: <RoleGuard roles={['superadmin', 'admin']}><LedgerPage /></RoleGuard> },
      // ── Transactions ──────────────────────────────────────────────────
      { path: 'transactions/hub', element: <RoleGuard roles={['admin']}><DayGuard><CashBankPayment /></DayGuard></RoleGuard> },
      { path: 'transactions/history', element: <RoleGuard roles={['admin', 'superadmin']}><TransactionHistoryPage /></RoleGuard> },
      // ── Fallback ──────────────────────────────────────────────────────
      { path: '*', element: <div className="p-8 text-center">Page not found</div> },
    ],
  },
]);
