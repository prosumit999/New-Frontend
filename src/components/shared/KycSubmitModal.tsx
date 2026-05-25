// src/components/shared/KycSubmitModal.tsx
import { useState } from 'react';
import { X, Upload, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { KycFileRow } from './KycFileRow';
import toast from 'react-hot-toast';

export interface KycSubmitData {
  aadhaarNumber: string;
  panNumber: string;
  aadhaarFront: File;
  aadhaarBack: File;
  panCard: File;
  photo: File;
  signatureOrAgreement?: File | null;
}

interface KycSubmitModalProps {
  open: boolean;
  onClose: () => void;
  entityType: 'agent' | 'customer';
  entityName: string;
  isResubmit: boolean;
  isLoading: boolean;
  onSubmit: (data: KycSubmitData) => void;
}

export function KycSubmitModal({
  open,
  onClose,
  entityType,
  entityName,
  isResubmit,
  isLoading,
  onSubmit,
}: KycSubmitModalProps) {
  const [aadhaarRaw, setAadhaarRaw] = useState('');
  const [panRaw, setPanRaw] = useState('');
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState<File | null>(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState<File | null>(null);
  const [panCardFile, setPanCardFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [sigFile, setSigFile] = useState<File | null>(null);

  const [showAadhaar, setShowAadhaar] = useState(false);
  const [showPan, setShowPan] = useState(false);

  const resetForm = () => {
    setAadhaarRaw('');
    setPanRaw('');
    setAadhaarFrontFile(null);
    setAadhaarBackFile(null);
    setPanCardFile(null);
    setPhotoFile(null);
    setSigFile(null);
    setShowAadhaar(false);
    setShowPan(false);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const handleSubmit = () => {
    if (!aadhaarRaw || !/^\d{12}$/.test(aadhaarRaw)) {
      toast.error('Valid 12-digit Aadhaar number is required');
      return;
    }
    if (!panRaw || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panRaw)) {
      toast.error('Valid PAN number is required');
      return;
    }
    if (!aadhaarFrontFile || !aadhaarBackFile || !panCardFile || !photoFile) {
      toast.error('Aadhaar front/back, PAN card, and photograph are required');
      return;
    }

    if (entityType === 'customer' && !sigFile) {
      toast.error('Customer signature is required');
      return;
    }

    onSubmit({
      aadhaarNumber: aadhaarRaw,
      panNumber: panRaw,
      aadhaarFront: aadhaarFrontFile,
      aadhaarBack: aadhaarBackFile,
      panCard: panCardFile,
      photo: photoFile,
      signatureOrAgreement: sigFile,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-t-2xl px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {isResubmit ? 'Resubmit KYC Documents' : 'Submit KYC Documents'}
              </h2>
              <p className="text-blue-200 text-sm mt-0.5 capitalize">
                {entityType}: {entityName}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Identity Numbers */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Identity Numbers</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Aadhaar Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Input
                    type={showAadhaar ? 'text' : 'password'}
                    value={aadhaarRaw}
                    onChange={e => setAadhaarRaw(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="12-digit Aadhaar"
                    maxLength={12}
                    autoComplete="off"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    onClick={() => setShowAadhaar(!showAadhaar)}
                  >
                    {showAadhaar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {aadhaarRaw && !/^\d{12}$/.test(aadhaarRaw) && (
                  <p className="text-xs text-red-500 mt-1">Must be exactly 12 digits</p>
                )}
              </div>
              <div>
                <label className="form-label">PAN Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Input
                    type={showPan ? 'text' : 'password'}
                    value={panRaw}
                    onChange={e => setPanRaw(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    autoComplete="off"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    onClick={() => setShowPan(!showPan)}
                  >
                    {showPan ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {panRaw && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panRaw) && (
                  <p className="text-xs text-red-500 mt-1">Invalid PAN (e.g. ABCDE1234F)</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-1.5 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700">
                Identity numbers are encrypted and stored securely. Only the last 4 digits will be visible after submission.
              </p>
            </div>
          </div>

          {/* Document Uploads */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Document Photos / Scans</p>
            <div className="space-y-3 relative z-0">
              <KycFileRow label="Aadhaar Front" required file={aadhaarFrontFile} onChange={setAadhaarFrontFile} />
              <KycFileRow label="Aadhaar Back" required file={aadhaarBackFile} onChange={setAadhaarBackFile} />
              <KycFileRow label="PAN Card Image" required file={panCardFile} onChange={setPanCardFile} />
              <KycFileRow label={entityType === 'agent' ? 'Photograph' : 'Customer Photo'} required file={photoFile} onChange={setPhotoFile} />
              
              {entityType === 'agent' && (
                <KycFileRow label="Signed Agreement" file={sigFile} onChange={setSigFile} />
              )}
              {entityType === 'customer' && (
                <KycFileRow label="Customer Signature" required file={sigFile} onChange={setSigFile} />
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 border-t border-slate-100 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            isLoading={isLoading}
            onClick={handleSubmit}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Submit KYC Documents
          </Button>
        </div>
      </div>
    </div>
  );
}
