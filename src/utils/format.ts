// src/utils/format.ts
// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL FORMATTING — All backend amounts are in PAISE (integer).
// Display always converts: paise ÷ 100 = rupees.
// Submit always converts:  rupees × 100 = paise (integer).
// NEVER pass floating-point rupees to the backend.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert paise (backend integer) → formatted rupees string for display.
 * Example: 150000 → "₹1,500.00"
 */
export const formatCurrency = (paise: number | null | undefined): string => {
  if (paise == null) return '₹0.00';
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

/**
 * Rupees string for compact display (no ₹ symbol prefix from Intl).
 * Example: 150000 paise → "1,500.00"
 */
export const formatAmount = (paise: number | null | undefined): string => {
  if (paise == null) return '0.00';
  return (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Convert rupees entered by user in a form → paise integer for API.
 * Example: "1500.50" → 150050
 */
export const rupeesToPaise = (rupees: string | number): number => {
  const val = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
};

/**
 * Convert paise → rupees number (for form default values).
 * Example: 150050 → 1500.50
 */
export const paiseToRupees = (paise: number | null | undefined): number => {
  if (paise == null) return 0;
  return paise / 100;
};

// ─────────────────────────────────────────────────────────────────────────────
// DATE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────
import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '—';
  return format(d, 'dd MMM yyyy');
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '—';
  return format(d, 'dd MMM yyyy, hh:mm a');
};

export const formatDateShort = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '—';
  return format(d, 'dd/MM/yyyy');
};

export const formatRelative = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
};

// ─────────────────────────────────────────────────────────────────────────────
// BPS FORMATTING (Basis Points)
// 100 bps = 1%
// ─────────────────────────────────────────────────────────────────────────────
export const bpsToPercent = (bps: number): string => {
  return `${(bps / 100).toFixed(2)}%`;
};

// ─────────────────────────────────────────────────────────────────────────────
// MISC
// ─────────────────────────────────────────────────────────────────────────────
export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '—';
  // Indian mobile: +91-XXXXX-XXXXX
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) return `+91-${clean.slice(0, 5)}-${clean.slice(5)}`;
  return phone;
};

export const maskAadhaar = (aadhaar: string | null | undefined): string => {
  if (!aadhaar) return '—';
  return aadhaar.replace(/^(\d{4})\d{4}(\d{4})$/, '****-****-$2') || aadhaar;
};

export const maskPan = (pan: string | null | undefined): string => {
  if (!pan) return '—';
  return pan.replace(/^([A-Z]{5})\d{4}([A-Z])$/, '$1XXXX$2') || pan;
};

export const truncate = (str: string | null | undefined, len = 40): string => {
  if (!str) return '—';
  return str.length > len ? `${str.slice(0, len)}...` : str;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT / DEBIT DETERMINATION — SINGLE SOURCE OF TRUTH
// ─────────────────────────────────────────────────────────────────────────────
// Used by: SavingDetailPage, PigmyDetailPage, LoanDetailPage,
//          CustomerAccountReportsPage, TransactionDetailModal, statementExport.ts
//
// RULES:
//   Credit = money COMING IN to the account being viewed
//   Debit  = money GOING OUT of (or being charged against) the account being viewed
//
// The same transaction type can be credit or debit depending on which account
// is viewing it. Example:
//   - saving_to_pigmy_transfer → DEBIT on Saving, CREDIT on Pigmy
//   - pigmy_to_saving_transfer → DEBIT on Pigmy, CREDIT on Saving
//   - loan_repayment           → DEBIT on Saving (money leaving), CREDIT on Loan (reducing outstanding)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines if a transaction type represents money COMING IN to the account.
 *
 * @param type        Transaction type string (e.g., 'saving_deposit', 'loan_repayment')
 * @param accountType The account context viewing this transaction
 * @returns           true if credit (money in), false if debit (money out)
 */
export function isCreditTransaction(
  type: string | undefined | null,
  accountType: 'saving' | 'pigmy' | 'loan' = 'saving',
): boolean {
  if (!type) return false;
  // Normalize by replacing any spaces with underscores
  // just in case the UI or API passed a pre-formatted string like "loan repayment"
  // Normalize inputs for maximum robustness
  const t = (type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const context = (accountType || 'saving').trim().toLowerCase();


  switch (context) {
    case 'saving':
      return (
        t === 'saving_deposit'
        || t === 'pigmy_to_saving_transfer'
        || t === 'loan_to_saving'
        || t.includes('deposit')
      );

    case 'pigmy':
      return (
        t === 'pigmy_collection'
        || t === 'saving_to_pigmy_transfer'
        || t.includes('collection')
      );

    // ── LOAN ACCOUNT PASSBOOK (RBI/NABARD-compliant MFI standard) ────────────
    // Tracks OUTSTANDING BALANCE (what the customer owes).
    //
    // CREDIT (Cr) = increases outstanding / puts loan on books:
    //   loan_to_saving (disbursement), penalty_charge, missed_collection_penalty,
    //   loan_repayment_reversal, loan_write_off_reversal, net_cash_disbursal
    //
    // DEBIT (Dr) = decreases outstanding / removes from books:
    //   loan_repayment, saving_to_loan_repayment, loan_write_off,
    //   loan_closure, processing_fee, interest_deduction
    case 'loan':
      return (
        t === 'loan_to_saving'              // Disbursement: creates the principal
        || t === 'penalty_charge'            // Penalty adds to amount owed
        || t === 'missed_collection_penalty' // Missed-day penalty adds to amount owed
        || t === 'loan_repayment_reversal'   // Un-applying a payment restores outstanding
        || t === 'loan_write_off_reversal'   // Write-off reversal restores asset on books
        || t === 'net_cash_disbursal'        // Net disbursal summary entry
        || t === 'loan_disbursement'         // Disbursement summary/idempotency record
        || t.includes('disbursal')           // Any future disbursal-type entries
        || t.includes('disbursement')
      );

    default:
      return t.includes('deposit') || t.includes('credit') || t.includes('_to_saving');
  }
}
