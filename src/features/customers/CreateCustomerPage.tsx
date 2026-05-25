// src/features/customers/CreateCustomerPage.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { customerApi } from '../../api/customer.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ── Zod schema mirroring backend's createCustomerSchema ───────────────────────
const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  alternatePhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid alternate mobile number')
    .optional()
    .or(z.literal('')),
  address: z.string().min(5, 'Address is required (min 5 chars)').max(300),
  city: z.string().max(100).optional().or(z.literal('')),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Enter valid 6-digit pincode')
    .optional()
    .or(z.literal('')),
  nomineeName: z.string().max(150).optional().or(z.literal('')),
  nomineeRelation: z.string().max(100).optional().or(z.literal('')),
});

type CreateCustomerForm = z.infer<typeof createCustomerSchema>;

export default function CreateCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCustomerForm>({
    resolver: zodResolver(createCustomerSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateCustomerForm) => {
      const cleaned: Record<string, any> = { ...data };
      Object.keys(cleaned).forEach((key) => {
        if (cleaned[key] === '') delete cleaned[key];
      });
      return customerApi.create(cleaned);
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Customer created. OTP sent to phone.');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      const customerId = res.data?.customer?._id;
      if (customerId) {
        navigate(`/customers/${customerId}`);
      } else {
        navigate('/customers');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create customer';
      toast.error(msg);
    },
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Register New Customer</h1>
          <p className="page-subtitle">Add a new customer to the system. An OTP will be sent for phone verification.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="max-w-3xl">
        {/* ── Personal Details ─────────────────────────────────────────── */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900">Personal Details</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="form-label">Full Name *</label>
              <Input {...register('name')} placeholder="Customer full name" error={errors.name?.message} />
            </div>
            <div>
              <label className="form-label">Phone Number *</label>
              <Input {...register('phone')} placeholder="9876543210" maxLength={10} error={errors.phone?.message} />
            </div>
            <div>
              <label className="form-label">Alternate Phone</label>
              <Input {...register('alternatePhone')} placeholder="9876543210" maxLength={10} error={errors.alternatePhone?.message} />
            </div>
          </div>
        </div>

        {/* ── Address ──────────────────────────────────────────────────── */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900">Address</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="form-label">Full Address *</label>
              <Input {...register('address')} placeholder="House/Flat, Street, Locality" error={errors.address?.message} />
            </div>
            <div>
              <label className="form-label">City</label>
              <Input {...register('city')} placeholder="City / Town" error={errors.city?.message} />
            </div>
            <div>
              <label className="form-label">Pincode</label>
              <Input {...register('pincode')} placeholder="6-digit pincode" maxLength={6} error={errors.pincode?.message} />
            </div>
          </div>
        </div>

        {/* ── Nominee ─────────────────────────────────────────────────── */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900">Nominee Details</h2>
            <span className="text-xs text-slate-400">Optional</span>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="form-label">Nominee Name</label>
              <Input {...register('nomineeName')} placeholder="Name of nominee" error={errors.nomineeName?.message} />
            </div>
            <div>
              <label className="form-label">Relationship</label>
              <Input {...register('nomineeRelation')} placeholder="e.g. Spouse, Parent, Child" error={errors.nomineeRelation?.message} />
            </div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pb-8">
          <Button type="submit" isLoading={mutation.isPending} className="min-w-[160px]">
            <UserPlus className="h-4 w-4 mr-2" />
            Create Customer
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/customers')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
