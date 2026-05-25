// src/utils/balanceHelpers.ts
// ─────────────────────────────────────────────────────────────────────────────
// OPENING BALANCE CALCULATION — Single Source of Truth
//
// The backend returns transactions newest-first (rows[0] = most recent).
// The naive approach: take oldestRow.balanceAfterInPaise and subtract/add amount.
//
// BUG this fixes: Some legacy transactions (early pigmy collections, imported data)
// have balanceAfterInPaise = null/undefined. When the oldest tx on a page is one
// of these, the opening balance renders as "—".
//
// FIX: Scan the array (newest-first) from the LAST element backward to find the
// nearest tx with a valid balanceAfterInPaise. Then walk forward through any
// null-balance tx before it to reconstruct the opening balance mathematically.
// ─────────────────────────────────────────────────────────────────────────────
import { isCreditTransaction } from './format';

export interface TxLike {
  type?: string | null;
  amountInPaise?: number | null;
  balanceAfterInPaise?: number | null;
}

/**
 * Calculate the opening balance for the given page of transactions.
 *
 * @param rows        Array of transactions from the API — NEWEST FIRST.
 * @param accountType Context: 'saving' | 'pigmy' | 'loan'
 * @returns           Opening balance in paise, or undefined if not computable.
 */
export function calculateOpeningBalance(
  rows: TxLike[],
  accountType: 'saving' | 'pigmy' | 'loan' = 'saving',
): number | undefined {
  if (!rows || rows.length === 0) return undefined;

  // rows[last] = oldest tx on the current page
  // Find the oldest tx that has a valid balanceAfterInPaise
  // We scan from the last element (oldest) toward [0] (newest).
  let anchorIndex = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].balanceAfterInPaise != null) {
      anchorIndex = i;
      break; // found the oldest tx with a valid balance
    }
  }

  if (anchorIndex === -1) {
    // No tx on this page has a balance snapshot — cannot compute.
    return undefined;
  }

  // Start from the anchor's balance AFTER and walk backward toward the oldest tx.
  // "Backward" in display = toward the end of the array (since array is newest-first).
  // The anchor is at rows[anchorIndex]. We need the balance BEFORE rows[anchorIndex].
  let balance = rows[anchorIndex].balanceAfterInPaise as number;

  // Walk from anchorIndex to the end (oldest direction) to compute the opening balance
  // BEFORE the very first (oldest) tx on the page.
  for (let i = anchorIndex; i < rows.length; i++) {
    const tx = rows[i];
    const amount = tx.amountInPaise ?? 0;
    const isCredit = isCreditTransaction(tx.type ?? '', accountType);

    // Reverse the transaction to get balance BEFORE it:
    // Credit increased balance → subtract to reverse
    // Debit decreased balance → add to reverse
    if (isCredit) {
      balance -= amount;
    } else {
      balance += amount;
    }
  }

  return balance;
}

/**
 * Calculate closing balance from the first (newest) tx on the page.
 */
export function calculateClosingBalance(rows: TxLike[]): number | undefined {
  if (!rows || rows.length === 0) return undefined;
  // rows[0] = newest tx
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].balanceAfterInPaise != null) {
      return rows[i].balanceAfterInPaise as number;
    }
  }
  return undefined;
}
