// src/api/transaction.api.ts
import { api } from './client';

export interface TransactionRecord {
  _id: string;
  transactionId: string;
  type: string;
  status: string;
  amountInPaise: number;
  feeInPaise?: number;
  netAmountInPaise?: number;
  balanceAfterInPaise?: number;
  paymentMode?: string;
  chequeNumber?: string;
  utrNumber?: string;
  reference?: string;
  note?: string;
  isReversed?: boolean;
  businessDate: string;
  createdAt: string;
  customer?: { _id: string; name: string; customerCode: string; phone: string };
  performedBy?: { _id: string; name: string; role: string; adminCode?: string; agentCode?: string };
  fromSavingAccount?: { _id: string; accountNumber: string };
  toSavingAccount?: { _id: string; accountNumber: string };
  fromPigmyAccount?: { _id: string; accountNumber: string };
  toPigmyAccount?: { _id: string; accountNumber: string };
  fromLoanAccount?: { _id: string; loanAccountNumber: string };
  toLoanAccount?: { _id: string; loanAccountNumber: string };
}

export interface TransactionListParams {
  fromDate?: string;
  toDate?: string;
  type?: string;
  customerId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const transactionApi = {
  list: (params?: TransactionListParams) =>
    api.get('/transactions', { params }),

  getById: (txnId: string) =>
    api.get(`/transactions/${txnId}`),
};
