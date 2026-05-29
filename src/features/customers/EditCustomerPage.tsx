// src/features/customers/EditCustomerPage.tsx
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Bell, BellOff } from 'lucide-react';
import { customerApi } from '../../api/customer.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ── Zod mirroring backend updateCustomerSchema ────────────────────────────────
const editCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150).optional().or(z.literal('')),
  alternatePhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  address: z.string().min(5).max(300).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Must be 6 digits')
    .optional()
    .or(z.literal('')),
  nomineeName: z.string().max(150).optional().or(z.literal('')),
  nomineeRelation: z.string().max(100).optional().or(z.literal('')),
  smsEnabled: z.boolean().optional(),
});

type EditCustomerForm = z.infer<typeof editCustomerSchema>;

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading: isLoadingCustomer } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getCustomer(id!),
    enabled: !!id,
  });

  const customer = data?.data?.customer as any;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<EditCustomerForm>({
    resolver: zodResolver(editCustomerSchema),
  });

  // Watch smsEnabled to show live toggle state
  const smsEnabled = useWatch({ control, name: 'smsEnabled' });

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name || '',
        alternatePhone: customer.alternatePhone || '',
        address: customer.address || '',
        city: customer.city || '',
        pincode: customer.pincode || '',
        nomineeName: customer.nomineeName || '',
        nomineeRelation: customer.nomineeRelation || '',
        smsEnabled: customer.smsEnabled ?? true,
      });
    }
  }, [customer, reset]);

  const mutation = useMutation({
    mutationFn: (formData: EditCustomerForm) => {
      const payload: Record<string, any> = {};
      Object.entries(formData).forEach(([key, val]) => {
        // Include booleans (false is a valid update), skip empty strings for optional fields
        if (val !== undefined && val !== '') {
          payload[key] = val;
        }
      });
      return customerApi.update(id!, payload);
    },
    onSuccess: () => {
      toast.success('Customer updated successfully');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      navigate(`/customers/${id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Update failed');
    },
  });

  if (isLoadingCustomer) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/customers/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title">Edit Customer</h1>
          <p className="page-subtitle">{customer?.customerCode} — {customer?.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="max-w-3xl">
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900">Personal Details</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="form-label">Full Name</label>
              <Input {...register('name')} error={errors.name?.message} />
            </div>
            <div>
              <label className="form-label">Alternate Phone</label>
              <Input {...register('alternatePhone')} maxLength={10} error={errors.alternatePhone?.message} />
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900">Address</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="form-label">Full Address</label>
              <Input {...register('address')} error={errors.address?.message} />
            </div>
            <div>
              <label className="form-label">City</label>
              <Input {...register('city')} error={errors.city?.message} />
            </div>
            <div>
              <label className="form-label">Pincode</label>
              <Input {...register('pincode')} maxLength={6} error={errors.pincode?.message} />
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900">Nominee</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="form-label">Nominee Name</label>
              <Input {...register('nomineeName')} error={errors.nomineeName?.message} />
            </div>
            <div>
              <label className="form-label">Relationship</label>
              <Input {...register('nomineeRelation')} error={errors.nomineeRelation?.message} />
            </div>
          </div>
        </div>

        {/* ── SMS Preference ────────────────────────────────────────────── */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
          </div>
          <div className="card-body">
            <button
              type="button"
              onClick={() => setValue('smsEnabled', !smsEnabled, { shouldDirty: true })}
              className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-colors ${
                smsEnabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              {smsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              <div className="text-left flex-1">
                <p className="text-sm font-medium">
                  SMS Notifications — {smsEnabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-xs opacity-70">
                  Customer receives SMS alerts for KYC, transactions, and loan updates
                </p>
              </div>
              <div className={`h-5 w-9 rounded-full transition-colors relative shrink-0 ${smsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${smsEnabled ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-8">
          <Button type="submit" isLoading={mutation.isPending} disabled={!isDirty} className="min-w-[140px]">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/customers/${id}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
