// src/hooks/useDebounce.ts
// Generic debounce hook — replaces the duplicated useEffect+setTimeout pattern
// spread across every list/search page in the app.
import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * silence. Re-renders triggered by intermediate keystrokes do NOT fire the
 * query — only the final stable value does.
 *
 * @param value  The raw, rapidly-changing value (e.g. from an input onChange)
 * @param delay  Debounce delay in milliseconds (default: 400ms)
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
