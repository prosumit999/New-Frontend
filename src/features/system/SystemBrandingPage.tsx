// src/features/system/SystemBrandingPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// INSTITUTION CONFIGURATION PAGE
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'react-hot-toast';
import {
  Save, Building2, Phone, Mail, MapPin, Tag, FileText, ImageOff, Lock,
} from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useSystemStore } from '../../store/system.store';
import { systemApi } from '../../api/system.api';

// ── Zod schema ────────────────────────────────────────────────────────────────
const institutionSchema = z.object({
  name: z.string().min(2, 'Institution name must be at least 2 characters'),
  registrationNumber: z.string().optional(),
  contactPhone: z
    .string()
    .regex(/^\d{10}$/, 'Must be exactly 10 digits')
    .optional()
    .or(z.literal('')),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  receiptTagline: z.string().max(150).optional(),
  smsFooter: z.string().max(100).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
  }),
});

type InstitutionFormValues = z.infer<typeof institutionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SystemBrandingPage() {
  const fetchBranding = useSystemStore((s) => s.fetchBranding);
  const branding = useSystemStore((s) => s.branding);
  const logoUrl = (branding as any)?.institution?.logoUrl || '';

  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<InstitutionFormValues>({
    resolver: zodResolver(institutionSchema),
    defaultValues: {
      name: '',
      registrationNumber: '',
      contactPhone: '',
      contactEmail: '',
      receiptTagline: '',
      smsFooter: '',
      address: { street: '', city: '', state: '', zipCode: '' },
    },
  });

  // ── Load config on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const inst = await systemApi.getInstitutionConfig();
        form.reset({
          name: inst?.name || '',
          registrationNumber: inst?.registrationNumber || '',
          contactPhone: inst?.contactPhone || '',
          contactEmail: inst?.contactEmail || '',
          receiptTagline: inst?.receiptTagline || '',
          smsFooter: inst?.smsFooter || '',
          address: {
            street: inst?.address?.street || '',
            city: inst?.address?.city || '',
            state: inst?.address?.state || '',
            zipCode: inst?.address?.zipCode || '',
          },
        });
        // Logo is managed exclusively via the Dev Panel — skip setting it here
      } catch {
        toast.error('Failed to load institution config');
      }
    };
    load();
  }, []);

  const onSubmit = async (data: InstitutionFormValues) => {
    setIsSaving(true);
    try {
      const payload: Record<string, any> = { ...data };
      const updated = await systemApi.updateInstitutionConfig(payload);
      toast.success('Institution configuration saved successfully');
      fetchBranding();
    } catch {
      toast.error('Failed to save institution config. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Institution Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your institution's branding, contact information, and logo
          </p>
        </div>
      </div>

      {/* ── Logo Thumbnail — Read-only, managed by Dev Panel ─────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center">
                <span className="text-white text-[8px] font-bold">IMG</span>
              </div>
            ) : (
              <ImageOff className="h-4 w-4 text-slate-400" />
            )}
            <h2 className="font-semibold text-slate-800 text-sm">Institution Logo</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            <Lock className="h-3 w-3" />
            Managed by Dev Panel
          </div>
        </div>
        <div className="p-8 flex flex-col items-center gap-4">
          {/* Centered logo thumbnail */}
          <div className="relative">
            {logoUrl && (
              <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl scale-110 pointer-events-none" />
            )}
            <div className={`relative w-40 h-40 rounded-2xl flex items-center justify-center overflow-hidden border-2 ${
              logoUrl
                ? 'bg-white border-blue-200 shadow-xl shadow-blue-100'
                : 'bg-slate-50 border-dashed border-slate-200'
            }`}>
              {logoUrl ? (
                <img src={logoUrl} alt="Institution Logo" className="w-full h-full object-contain p-4" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center px-4">
                  <ImageOff className="h-10 w-10 text-slate-300" />
                  <p className="text-xs text-slate-400 font-medium">No logo uploaded</p>
                </div>
              )}
            </div>
          </div>
          <div className="text-center space-y-1">
            {logoUrl ? (
              <p className="text-sm font-semibold text-emerald-700">Logo is active</p>
            ) : (
              <p className="text-sm font-semibold text-slate-500">No logo configured</p>
            )}
            <p className="text-xs text-slate-400">
              To upload or change the logo, log in to the{' '}
              <span className="font-semibold text-violet-600">Dev Panel</span> → Branding section.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Institution Details ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 text-sm">General Information</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Institution Name <span className="text-red-500">*</span></label>
              <Input
                {...form.register('name')}
                error={form.formState.errors.name?.message}
                placeholder="e.g. Abhishekh Microfinance"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">CIN / GST / Registration No.</label>
              <Input
                {...form.register('registrationNumber')}
                placeholder="e.g. GSTIN123456"
              />
            </div>
          </div>
        </div>

        {/* ── Contact Information ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Phone className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Contact & Communication</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Phone className="h-3.5 w-3.5 text-slate-400" /> Contact Phone
              </label>
              <Input
                {...form.register('contactPhone')}
                error={form.formState.errors.contactPhone?.message}
                placeholder="10-digit mobile number"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Mail className="h-3.5 w-3.5 text-slate-400" /> Contact Email
              </label>
              <Input
                type="email"
                {...form.register('contactEmail')}
                error={form.formState.errors.contactEmail?.message}
                placeholder="info@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Tag className="h-3.5 w-3.5 text-slate-400" /> Receipt / PDF Tagline
              </label>
              <Input
                {...form.register('receiptTagline')}
                placeholder="Thank you for banking with us."
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <FileText className="h-3.5 w-3.5 text-slate-400" /> SMS Footer Text
              </label>
              <Input
                {...form.register('smsFooter')}
                placeholder="e.g. ABHISHEKH MICROFINANCE"
              />
            </div>
          </div>
        </div>

        {/* ── Address ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Mailing Address</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-sm font-medium text-slate-700">Street / Area</label>
              <Input {...form.register('address.street')} placeholder="123 Main Street, Area Name" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">City</label>
              <Input {...form.register('address.city')} placeholder="City" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">State</label>
              <Input {...form.register('address.state')} placeholder="State" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Pin Code</label>
              <Input {...form.register('address.zipCode')} placeholder="000000" />
            </div>
          </div>
        </div>

        {/* ── Save Button ──────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving} className="gap-2 px-8">
            <Save className="h-4 w-4" />
            Save Institution Settings
          </Button>
        </div>

      </form>
    </div>
  );
}
