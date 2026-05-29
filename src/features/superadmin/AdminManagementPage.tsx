// src/features/superadmin/AdminManagementPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Shield, Key, Power, Search, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { superadminApi } from '../../api/superadmin.api';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDateTime } from '../../utils/format';

// Password strength checker
function checkPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[@$!%*?&#]/.test(pwd)) score++;
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['', 'text-red-500', 'text-orange-500', 'text-yellow-600', 'text-blue-500', 'text-emerald-600'];
  return { score, label: labels[score] || '', color: colors[score] || '' };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { score, label, color } = checkPasswordStrength(password);
  if (!password) return null;
  const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];
  const barColors = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'];
  return (
    <div className="mt-1.5">
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColors[score]} transition-all duration-300`}
          style={{ width: widths[score] }}
        />
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span className={`text-xs font-medium ${color}`}>{label}</span>
        {score === 5 && <CheckCircle className="h-3 w-3 text-emerald-500" />}
      </div>
      <div className="flex flex-wrap gap-x-3 mt-1">
        {[
          { pass: password.length >= 8, label: '8+ chars' },
          { pass: /[A-Z]/.test(password), label: 'Uppercase' },
          { pass: /[a-z]/.test(password), label: 'Lowercase' },
          { pass: /\d/.test(password), label: 'Number' },
          { pass: /[@$!%*?&#]/.test(password), label: 'Special' },
        ].map((r) => (
          <span key={r.label} className={`text-[10px] flex items-center gap-0.5 ${r.pass ? 'text-emerald-600' : 'text-slate-400'}`}>
            {r.pass ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminManagementPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  // List state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', phone: '', email: '', password: '' });

  // Reset modal
  const [showReset, setShowReset] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPwd, setShowResetPwd] = useState(false);

  // Toggle dialog
  const [toggleTarget, setToggleTarget] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
  const [toggleReason, setToggleReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admins', page, search, statusFilter],
    queryFn: () => superadminApi.listAdmins({
      page,
      limit: 15,
      search: search || undefined,
      isActive: statusFilter === '' ? undefined : statusFilter === 'true',
    }),
  });

  const admins = (data?.data?.data?.admins as any[]) || [];
  const pagination = data?.data?.data?.pagination as any;

  // Create
  const createMutation = useMutation({
    mutationFn: () => superadminApi.createAdmin({
      name: newAdmin.name,
      phone: newAdmin.phone,
      email: newAdmin.email || undefined,
      password: newAdmin.password,
    }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Admin created successfully');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setShowCreate(false);
      setNewAdmin({ name: '', phone: '', email: '', password: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });

  // Reset password
  const resetMutation = useMutation({
    mutationFn: () => superadminApi.resetAdminPassword(showReset!, { newPassword }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.data?.message || res?.data?.message || 'Password reset. All sessions invalidated.');
      setShowReset(null);
      setNewPassword('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Reset failed'),
  });

  // Toggle status
  const toggleMutation = useMutation({
    mutationFn: () => superadminApi.toggleAdminStatus(toggleTarget!.id, {
      isActive: !toggleTarget!.isActive,
      reason: toggleReason || undefined,
    }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.data?.message || res?.data?.message || 'Status updated');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setToggleTarget(null);
      setToggleReason('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  const pwdStrength = checkPasswordStrength(newAdmin.password);
  const createFormValid = newAdmin.name.length >= 2
    && /^[6-9]\d{9}$/.test(newAdmin.phone)
    && pwdStrength.score === 5;

  const resetPwdStrength = checkPasswordStrength(newPassword);
  const resetFormValid = resetPwdStrength.score === 5;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Admin Management</h1>
          <p className="page-subtitle">Create, manage, and control admin user accounts</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Admin
        </Button>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-header bg-slate-50/50">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="w-full max-w-sm">
              <Input
                placeholder="Search by name, phone, admin code..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(['', 'true', 'false'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => { setStatusFilter(val); setPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === val
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {val === '' ? 'All' : val === 'true' ? '🟢 Active' : '🔴 Inactive'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Admin Code</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">Loading admins...</td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Shield className="h-8 w-8 text-slate-300" />
                    <span>No admin accounts found.</span>
                  </div>
                </td></tr>
              ) : (
                admins.map((admin) => {
                  const isSelf = admin._id === currentUser?._id || admin._id === (currentUser as any)?.id;
                  return (
                    <tr key={admin._id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                            <Shield className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{admin.name}</p>
                            {isSelf && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">You</span>}
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600">{admin.phone}</td>
                      <td className="text-slate-500">{admin.email || '—'}</td>
                      <td><span className="font-mono text-xs font-medium text-blue-600">{admin.adminCode || '—'}</span></td>
                      <td><StatusBadge status={admin.isActive ? 'active' : 'inactive'} /></td>
                      <td className="text-slate-500 text-sm">{formatDateTime(admin.createdAt)}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setShowReset(admin._id); setNewPassword(''); setShowResetPwd(false); }}
                            title="Reset Password"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf}
                            title={isSelf ? 'Cannot change your own status' : (admin.isActive ? 'Deactivate' : 'Activate')}
                            onClick={() => !isSelf && setToggleTarget({ id: admin._id, name: admin.name, isActive: admin.isActive })}
                          >
                            <Power className={`h-3.5 w-3.5 ${isSelf ? 'text-slate-300' : admin.isActive ? 'text-red-500' : 'text-emerald-500'}`} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
            <p>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Admin Modal ────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Create Admin Account</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="form-label">Full Name *</label>
                <Input
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin(a => ({ ...a, name: e.target.value }))}
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>
              <div>
                <label className="form-label">Phone Number *</label>
                <Input
                  value={newAdmin.phone}
                  onChange={(e) => setNewAdmin(a => ({ ...a, phone: e.target.value }))}
                  placeholder="10-digit mobile (6-9 start)"
                  maxLength={10}
                />
                {newAdmin.phone && !/^[6-9]\d{9}$/.test(newAdmin.phone) && (
                  <p className="text-xs text-red-500 mt-1">Must be a valid 10-digit Indian number</p>
                )}
              </div>
              <div>
                <label className="form-label">Email (Optional)</label>
                <Input
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin(a => ({ ...a, email: e.target.value }))}
                  placeholder="admin@company.com"
                />
              </div>
              <div>
                <label className="form-label">Password *</label>
                <div className="relative">
                  <Input
                    type={showCreatePwd ? 'text' : 'password'}
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin(a => ({ ...a, password: e.target.value }))}
                    placeholder="Strong password required"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showCreatePwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthBar password={newAdmin.password} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowCreate(false); setNewAdmin({ name: '', phone: '', email: '', password: '' }); }}>
                Cancel
              </Button>
              <Button
                isLoading={createMutation.isPending}
                onClick={() => createMutation.mutate()}
                disabled={!createFormValid || createMutation.isPending}
              >
                Create Admin
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ──────────────────────────────── */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-slate-900">Reset Admin Password</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-500 mb-4">
                Setting a new password will immediately invalidate all active sessions for this admin.
              </p>
              <label className="form-label">New Password *</label>
              <div className="relative">
                <Input
                  type={showResetPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 chars with uppercase, number, special"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showResetPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthBar password={newPassword} />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowReset(null); setNewPassword(''); }}>Cancel</Button>
              <Button
                isLoading={resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
                disabled={!resetFormValid || resetMutation.isPending}
              >
                Reset Password
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toggle Status Confirm Dialog ──────────────────────── */}
      {toggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Power className={`h-5 w-5 ${toggleTarget.isActive ? 'text-red-600' : 'text-emerald-600'}`} />
              <h3 className="text-lg font-semibold text-slate-900">
                {toggleTarget.isActive ? 'Deactivate' : 'Activate'} Admin
              </h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 mb-4">
                {toggleTarget.isActive
                  ? `Deactivating "${toggleTarget.name}" will lock them out and invalidate all their sessions.`
                  : `Activating "${toggleTarget.name}" will restore their access to the system.`}
              </p>
              <label className="form-label">Reason (Optional)</label>
              <Input
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
                placeholder="e.g. On leave, Compliance hold..."
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setToggleTarget(null); setToggleReason(''); }}>Cancel</Button>
              <Button
                variant={toggleTarget.isActive ? 'destructive' : 'default'}
                isLoading={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate()}
              >
                {toggleTarget.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
