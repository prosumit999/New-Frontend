// src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useSystemStore } from '../../store/system.store';
import { cn } from '../../utils/cn';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  PiggyBank,
  Banknote,
  FileText,
  Settings,
  ShieldAlert,
  Wallet,
  BookOpen,
  ClipboardList,
  CalendarX2,
  UserPlus,
  CreditCard,
  BarChart3,
  Receipt,
  Download,
  History,
  Code2,
} from 'lucide-react';

interface SidebarProps {
  onLinkClick?: () => void;
}

export function Sidebar({ onLinkClick }: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const branding = useSystemStore((s) => s.branding);
  if (!user) return null;

  // Institution branding from InstitutionConfig model
  const institutionName = branding?.institution?.name || 'Microfinance';
  const institutionLogo = branding?.institution?.logoUrl;
  const gstNumber = branding?.institution?.registrationNumber || '';

  const isAgent = user.role === 'agent';
  const isDev = user.role === 'dev';
  const canAddCustomer = user.permissions?.canAddCustomer !== false; // default true

  // ── Agent-specific sidebar ─────────────────────────────────────────────────
  const agentMenuGroups = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', href: '/agent/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Collections',
      items: [
        { name: 'Record Collection', href: '/collections/record', icon: Receipt },
        { name: 'My Daily Sheet', href: '/collections/sheet', icon: Download },
        { name: 'All Collections', href: '/collections', icon: Wallet },
      ],
    },
    {
      title: 'Customers',
      items: [
        ...(canAddCustomer
          ? [{ name: 'Add Customer', href: '/customers/new', icon: UserPlus }]
          : []),
        { name: 'My Customers', href: '/customers', icon: Users },
      ],
    },
    {
      title: 'Accounts',
      items: [
        { name: 'Pigmy Accounts', href: '/pigmy', icon: PiggyBank },
        { name: 'Loan Status', href: '/loans', icon: CreditCard },
      ],
    },
    {
      title: 'Reports',
      items: [
        { name: 'Reports Hub', href: '/agent/reports', icon: BarChart3 },
        { name: 'Pigmy Report', href: '/agent/reports/pigmy', icon: PiggyBank },
        { name: 'Collection Report', href: '/agent/reports/collections', icon: Receipt },
        { name: 'Deposit Report', href: '/agent/reports/deposits', icon: Banknote },
      ],
    },
  ];

  // ── Superadmin-dedicated sidebar (oversight + system config) ──────────────────
  const superadminMenuGroups = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Monitoring (Read-Only)',
      items: [
        { name: 'Customers', href: '/customers', icon: Users },
        { name: 'Savings Accounts', href: '/savings', icon: Wallet },
        { name: 'Pigmy Accounts', href: '/pigmy', icon: PiggyBank },
        { name: 'Loans', href: '/loans', icon: Banknote },
        { name: 'Collections', href: '/collections', icon: Wallet },
        { name: 'Agent Deposits', href: '/agent-deposits', icon: Receipt },
      ],
    },
    {
      title: 'Staff',
      items: [
        { name: 'Staff & Agents', href: '/agents', icon: Briefcase },
      ],
    },
    {
      title: 'Analytics',
      items: [
        { name: 'Reports', href: '/reports', icon: FileText },
        { name: 'Ledger', href: '/ledger', icon: BookOpen },
        { name: 'Transaction History', href: '/transactions/history', icon: History },
        { name: 'Deficit Warnings', href: '/loans/deficit', icon: ShieldAlert },
      ],
    },
    {
      title: 'System Config',
      items: [
        { name: 'Admin Users', href: '/superadmin/admins', icon: ShieldAlert },
        { name: 'Loan Plans', href: '/superadmin/loan-plans', icon: CreditCard },
        { name: 'Ledger Accounts', href: '/superadmin/ledger-accounts', icon: BookOpen },
        { name: 'System Control', href: '/superadmin/system', icon: Settings },
        { name: 'Day Control', href: '/day-control', icon: ShieldAlert },
        { name: 'Backdate Day Open', href: '/superadmin/day-control', icon: CalendarX2 },
        { name: 'Audit Logs', href: '/superadmin/audit-logs', icon: ClipboardList },
      ],
    },
  ];

  // ── Admin sidebar (full banking operations) ─────────────────────────────────
  const adminMenuGroups = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Core Operations',
      items: [
        { name: 'Transactions Hub', href: '/transactions/hub', icon: Banknote },
        { name: 'Customers', href: '/customers', icon: Users },
        { name: 'Savings', href: '/savings', icon: Wallet },
        { name: 'Pigmy Accounts', href: '/pigmy', icon: PiggyBank },
        { name: 'Loans', href: '/loans', icon: Banknote },
        { name: 'Collections', href: '/collections', icon: Wallet },
      ],
    },
    {
      title: 'Management',
      items: [
        { name: 'Staff & Agents', href: '/agents', icon: Briefcase },
        { name: 'Agent Deposits', href: '/agent-deposits', icon: Banknote },
        { name: 'Deficit Warnings', href: '/loans/deficit', icon: ShieldAlert },
        { name: 'Reports', href: '/reports', icon: FileText },
        { name: 'Ledger', href: '/ledger', icon: BookOpen },
        { name: 'Transaction History', href: '/transactions/history', icon: History },
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'Day Control', href: '/day-control', icon: ShieldAlert },
        { name: 'Audit Logs', href: '/superadmin/audit-logs', icon: ClipboardList },
      ],
    },
  ];

  // ── Dev sidebar (vendor-level — minimal, focused on system config) ─────────
  const devMenuGroups = [
    {
      title: 'Overview',
      items: [
        { name: 'Dev Dashboard', href: '/dev/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { name: 'Dev Panel', href: '/dev/panel', icon: Code2 },
      ],
    },
  ];

  // Pick the correct menu based on role
  const menuGroups = isDev
    ? devMenuGroups
    : isAgent
    ? agentMenuGroups
    : user.role === 'superadmin'
      ? superadminMenuGroups
      : adminMenuGroups;

  return (
    <div className="flex h-full flex-col bg-[#0f1f36] text-slate-300">
      {/* ── Institution Branding Header ──────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#1e3a5f] bg-[#152845]">
        <div className="flex items-center gap-3">
          {institutionLogo ? (
            <img
              src={institutionLogo}
              alt={institutionName}
              className="h-10 w-10 rounded-xl object-cover border border-blue-500/30 shadow-sm"
            />
          ) : (
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <span className="text-white text-base font-bold">
                {institutionName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white leading-tight truncate">
              {institutionName}
            </h1>
            {gstNumber && gstNumber !== 'CIN/GST Not Set' && (
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                {gstNumber}
              </p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <div className="space-y-8">
          {menuGroups.map((group) => {
            // All menus are pre-scoped per role — no runtime filtering needed
            if (group.items.length === 0) return null;

            return (
              <div key={group.title}>
                <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item: any) => {
                    // Only apply 'end' matching if it's explicitly set or if it's a known parent route
                    // that shares prefixes with other sidebar items to avoid double-activation.
                    const isParentWithSubItems = 
                      item.href === '/loans' || 
                      item.href === '/collections' || 
                      item.href === '/agent/reports';

                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={onLinkClick}
                        end={isParentWithSubItems}
                        className={({ isActive }) =>
                          cn(
                            'sidebar-link',
                            isActive && 'active'
                          )
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.name}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 p-4 border-t border-[#1e3a5f] bg-[#0c192c]">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500">Logged in as</span>
            <span className="text-sm font-medium text-white">{user.name}</span>
            <span className="text-xs text-blue-400 capitalize">{user.role}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
