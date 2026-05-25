// src/types/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// TypeScript interfaces mirroring backend models and API responses.
// Rule: all money fields are in PAISE (integer). Display converts ÷ 100.
// ─────────────────────────────────────────────────────────────────────────────

// ── Roles ─────────────────────────────────────────────────────────────────────
export type UserRole = 'dev' | 'superadmin' | 'admin' | 'agent';

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  adminCode?: string;
  agentCode?: string;
  isActive: boolean;
  smsEnabled?: boolean;
  permissions?: {
    canAddCustomer?: boolean;
  };
  createdAt: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: AuthUser;
    accessToken: string;
    expiresIn: number;
  };
}

export interface RefreshResponse {
  success: boolean;
  data: {
    accessToken: string;
    expiresIn: number;
  };
}

// ── Pagination ─────────────────────────────────────────────────────────────────
export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    [key: string]: T[] | Pagination;
    pagination: Pagination;
  };
}

// ── Agent ──────────────────────────────────────────────────────────────────────
export type AgentStatus = 'active' | 'inactive' | 'suspended' | 'terminated';
export type AgentKycStatus =
  | 'kyc_pending'
  | 'documents_submitted'
  | 'kyc_verified'
  | 'kyc_rejected';

export interface AgentProfile {
  _id: string;
  agentCode: string;
  name: string;
  fullName?: string;
  phone: string;
  email?: string;
  status: AgentStatus;
  kycStatus: AgentKycStatus;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  fatherOrSpouseName?: string;
  alternatePhone?: string;
  personalEmail?: string;
  area?: string;
  employeeId?: string;
  joiningDate?: string;
  commissionType?: 'percentage' | 'fixed' | 'none';
  commissionRateBps?: number;
  assignedPincodes?: string[];
  aadhaarMasked?: string;
  panMasked?: string;
  currentAddress?: {
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
  };
  permanentAddress?: {
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branchName?: string;
  };
  bankName?: string;
  accountNumberMasked?: string;
  ifscCode?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Customer ───────────────────────────────────────────────────────────────────
// Backend KYC flow: pending → phone_verified → documents_submitted → kyc_verified | kyc_rejected
export type KycStatus =
  | 'pending'
  | 'phone_verified'
  | 'documents_submitted'
  | 'kyc_verified'
  | 'kyc_rejected';

export interface Customer {
  _id: string;
  customerCode: string;
  name: string;
  phone: string;
  // Optional contact / address fields
  alternatePhone?: string;
  address?: string;
  city?: string;
  pincode?: string;
  // Masked PII (never full values — use getDecryptedAadhar/PAN APIs)
  aadharMasked?: string;
  panMasked?: string;
  // Nominee
  nomineeName?: string;
  nomineeRelation?: string;
  // KYC state machine
  kycStatus: KycStatus;
  phoneVerified: boolean;
  phoneVerifiedAt?: string;
  kycSubmittedAt?: string;
  kycVerifiedAt?: string;
  kycRejectedReason?: string;
  kycVerifiedBy?: { _id: string; name: string; role: string };
  kycDocuments?: {
    aadhaarFront?: { url?: string; publicId?: string };
    aadhaarBack?: { url?: string; publicId?: string };
    panCard?: { url?: string; publicId?: string };
    photo?: { url?: string; publicId?: string };
    signature?: { url?: string; publicId?: string };
  };
  // Account state
  isActive: boolean;
  isDeleted?: boolean;
  smsEnabled?: boolean;
  // Relations (populated on GET /customers/:id)
  assignedAgent?: {
    _id: string;
    name: string;
    agentCode: string;
    phone?: string;
  };
  createdBy?: { _id: string; name: string; role: string };
  createdAt: string;
  updatedAt?: string;
}

// ── Account Status ─────────────────────────────────────────────────────────────
export type AccountStatus = 'active' | 'closed' | 'frozen';

// ── Saving Account ─────────────────────────────────────────────────────────────
export interface SavingAccount {
  _id: string;
  accountNumber: string;
  customer: { _id: string; name: string; customerCode: string; phone: string; kycStatus?: string };
  assignedAgent?: { _id: string; name: string; agentCode: string };
  // Balance
  balanceInPaise: number; // PAISE
  // Opening charge (one-time, collected on account creation)
  openingChargeInPaise: number; // PAISE
  openingChargeDeducted: boolean;
  openingChargeDeductedAt?: string;
  // Status
  status: AccountStatus;
  isDeleted?: boolean;
  // Lifecycle — Open
  openedBy?: { _id: string; name: string; role: string };
  openedAt?: string;
  businessDate?: string;
  // Lifecycle — Close
  closedBy?: { _id: string; name: string; role: string };
  closedAt?: string;
  closureReason?: string;
  // Lifecycle — Freeze
  frozenBy?: { _id: string; name: string; role: string };
  frozenAt?: string;
  freezeReason?: string;
  // Timestamps
  createdAt: string;
  updatedAt?: string;
  // Live aggregate stats — only present on GET /accounts/:id
  stats?: {
    totalDepositedInPaise: number;
    totalDepositedInRupees: string;
    totalDeposits: number;
    lastDepositAt?: string;
    currentBalanceInRupees: string;
  };
}

// ── Pigmy Account ──────────────────────────────────────────────────────────────
export interface PigmyAccount {
  _id: string;
  accountNumber: string;
  customer: { _id: string; name: string; customerCode: string; phone: string; kycStatus?: string };
  // Linked accounts
  savingAccount?: { _id: string; accountNumber: string; balanceInPaise: number; status: AccountStatus };
  activeLoan?: { _id: string; loanAccountNumber: string; outstandingBalanceInPaise: number; status: string; maturityDate?: string } | null;
  assignedAgent?: { _id: string; name: string; agentCode: string; phone?: string };
  // Collection config
  dailyDepositAmountInPaise: number; // PAISE
  collectionFrequency: 'daily' | 'weekly';
  // Running totals
  balanceInPaise: number; // PAISE
  totalCollectedInPaise: number; // PAISE
  totalCollectionDays: number;
  lastCollectionDate?: string;
  // Reassignment flags
  requiresReassignment?: boolean;
  reassignmentReason?: 'agent_terminated' | 'manual' | null;
  // Status
  status: AccountStatus;
  isDeleted?: boolean;
  // Lifecycle — Open
  openedBy?: { _id: string; name: string; role: string };
  openedAt?: string;
  businessDate?: string;
  // Lifecycle — Close
  closedBy?: { _id: string; name: string; role: string };
  closedAt?: string;
  closureReason?: string;
  // Lifecycle — Freeze
  frozenBy?: { _id: string; name: string; role: string };
  frozenAt?: string;
  freezeReason?: string;
  // Timestamps
  createdAt: string;
  updatedAt?: string;
  // Live aggregate stats — only present on GET /pigmy-accounts/:id
  stats?: {
    totalCollectedInPaise: number;
    totalCollectedInRupees: string;
    totalAppliedToLoanInPaise: number;
    totalAppliedInRupees: string;
    pendingBalanceInRupees: string;
    totalCollections: number;
    lastCollectionAt?: string;
  };
}

// ── Collection ─────────────────────────────────────────────────────────────────
export type CollectionStatus = 'collected' | 'missed' | 'reversed';

export interface Collection {
  _id: string;
  receiptNumber: string;
  pigmyAccount: { _id: string; accountNumber: string };
  customer: { _id: string; name: string; customerCode: string };
  agent?: { _id: string; name: string; agentCode: string };
  amountInPaise: number; // PAISE
  balanceAfterInPaise: number; // PAISE
  collectionDate: string;
  businessDate: string;
  status: CollectionStatus;
  isReversed: boolean;
  note?: string;
  createdAt: string;
}

// ── Loan ───────────────────────────────────────────────────────────────────────
export type LoanStatus = 'active' | 'overdue' | 'closed' | 'written_off';

export interface LoanAccount {
  _id: string;
  loanAccountNumber: string;
  customer: { _id: string; name: string; customerCode: string; phone: string };
  loanPlan: { _id: string; planName: string; durationMonths: number };
  pigmyAccount?: { _id: string; accountNumber: string; balanceInPaise: number };
  principalAmountInPaise: number; // PAISE
  outstandingBalanceInPaise: number; // PAISE
  interestInPaise: number; // PAISE
  processingFeeInPaise: number; // PAISE
  netDisbursalInPaise: number; // PAISE
  penaltyAmountInPaise: number; // PAISE
  totalRepaidInPaise: number; // PAISE
  status: LoanStatus;
  isDeleted?: boolean;
  disbursedAt?: string;
  maturityDate?: string;
  closedAt?: string;
  durationMonths: number;
  interestRateBps: number;
  createdAt: string;
}

// ── Loan Plan ──────────────────────────────────────────────────────────────────
export interface LoanPlan {
  _id: string;
  planCode: string;
  planName: string;
  description: string;
  durationMonths: number;
  baseInterestRateBps: number;
  processingFeeBps: number;
  minLoanAmountInPaise: number; // PAISE
  maxLoanAmountInPaise: number; // PAISE
  isActive: boolean;
}

// ── Agent Deposit ──────────────────────────────────────────────────────────────
export type DepositStatus = 'completed' | 'reversed';

export interface AgentDeposit {
  _id: string;
  depositId: string;
  agent: { _id: string; name: string; agentCode: string };
  admin: { _id: string; name: string };
  amountInPaise: number; // PAISE
  agentBalanceBefore: number; // PAISE
  agentBalanceAfter: number; // PAISE
  status: DepositStatus;
  isReversed: boolean;
  note?: string;
  businessDate: string;
  createdAt: string;
}

// ── Ledger ─────────────────────────────────────────────────────────────────────
export interface LedgerAccount {
  _id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'income' | 'expense';
  normalBalance: 'debit' | 'credit';
  runningBalanceInPaise: number; // PAISE
  isSystem: boolean;
  isActive: boolean;
  description?: string;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: string;
  debitInRupees: string; // Already formatted string from backend
  creditInRupees: string; // Already formatted string from backend
  netBalanceInRupees: string; // Already formatted string from backend
  side: string;
}

// ── Reports ────────────────────────────────────────────────────────────────────
export interface DashboardKpis {
  totalCustomers: number;
  kycPendingCustomers: number;
  activeAgents: number;
  totalSavingBalanceInPaise: number; // PAISE
  totalPigmyBalanceInPaise: number; // PAISE
  activeLoanCount: number;
  totalOutstandingLoanInPaise: number; // PAISE
  overdueLoans: number;
  todayCollectionsInPaise: number; // PAISE
  dayStatus: 'open' | 'closed';
  businessDate: string;
}

// ── AppConfig ──────────────────────────────────────────────────────────────────
export interface AppConfigItem {
  key: string;
  value: unknown;
  description?: string;
  updatedBy?: string;
  updatedAt?: string;
}

// ── Audit Log ──────────────────────────────────────────────────────────────────
export interface AuditLog {
  _id: string;
  performedBy: { _id: string; name: string; role: string };
  action: string;
  entity: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  requestId?: string;
  status: 'success' | 'failed';
  createdAt: string;
}

// ── API Error ──────────────────────────────────────────────────────────────────
export interface ApiErrorData {
  success: false;
  statusCode: number;
  message: string;
  errors?: Record<string, string>;
}
