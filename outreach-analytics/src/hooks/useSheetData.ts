import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SheetData } from '../types';
import {
  fetchSheetData,
  loadConfig,
  SheetsConfigError,
  type SheetsConfig,
} from '../lib/sheetsClient';

export interface UseSheetDataResult {
  data: SheetData | null;
  loading: boolean;
  error: string | null;
  /** True when the failure is a config problem (bad/missing env), not a fetch. */
  configError: boolean;
  lastFetched: Date | null;
  refresh: () => void;
}

/**
 * Fetches and caches all three sheets. Runs once on mount and again whenever
 * `refresh()` is called. Results are held in state so re-renders don't refetch.
 */
export function useSheetData(): UseSheetDataResult {
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<boolean>(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Resolve config once. A config error is a hard, non-retryable state.
  const config = useMemo<{ value?: SheetsConfig; error?: string }>(() => {
    try {
      return { value: loadConfig() };
    } catch (err) {
      return {
        error:
          err instanceof SheetsConfigError
            ? err.message
            : 'Invalid dashboard configuration.',
      };
    }
  }, []);

  const load = useCallback(async () => {
    // Opt-in preview mode: render sample data without any Google setup.
    if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
      setLoading(true);
      setError(null);
      setConfigError(false);
      const { getMockData } = await import('../lib/mockData');
      // Small delay so loading skeletons are visible during preview.
      await new Promise((r) => setTimeout(r, 400));
      setData(getMockData());
      setLastFetched(new Date());
      setLoading(false);
      return;
    }

    if (!config.value) {
      setError(config.error ?? 'Invalid configuration.');
      setConfigError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setConfigError(false);
    try {
      const result = await fetchSheetData(config.value);
      setData(result);
      setLastFetched(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect to Google Sheets.',
      );
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    loading,
    error,
    configError,
    lastFetched,
    refresh: () => void load(),
  };
}
