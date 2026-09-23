import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Campaign, Lead, NewLeadInput, SheetData } from '../types';
import {
  ConfigError,
  IS_MOCK,
  loadSheetsConfig,
  type SheetsConfig,
} from '../lib/config';
import {
  appendLead,
  fetchSheetData,
  updateLeadCell,
} from '../lib/sheetsClient';

export interface UseSheetDataResult {
  data: SheetData | null;
  loading: boolean;
  error: string | null;
  configError: boolean;
  lastFetched: Date | null;
  refresh: () => void;
  addLead: (input: NewLeadInput) => Promise<void>;
  /** Optimistically update a single field (Status/Notes) and write back. */
  updateLeadField: (
    lead: Lead,
    field: 'Status' | 'Notes',
    value: string,
  ) => Promise<void>;
}

export function useSheetData(): UseSheetDataResult {
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const config = useMemo<{ value?: SheetsConfig; error?: string }>(() => {
    if (IS_MOCK) return {};
    try {
      return { value: loadSheetsConfig() };
    } catch (err) {
      return {
        error: err instanceof ConfigError ? err.message : 'Invalid Sheets configuration.',
      };
    }
  }, []);

  const load = useCallback(async () => {
    if (IS_MOCK) {
      setLoading(true);
      setError(null);
      setConfigError(false);
      const { getMockData } = await import('../lib/mockData');
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
      setError(err instanceof Error ? err.message : 'Could not connect to Google Sheets.');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    void load();
  }, [load]);

  const addLead = useCallback(
    async (input: NewLeadInput) => {
      const campaign: Campaign = input.campaign;
      const lead: Lead = {
        Company_Name: input.Company_Name,
        Industry: input.Industry,
        City: input.City,
        Contact_Name: input.Contact_Name,
        Email: input.Email,
        Title: input.Title,
        Status: input.Status || 'New',
        Sent_Date: '',
        FU1_Date: '',
        FU2_Date: '',
        Apollo_Person_ID: '',
        Notes: input.Notes,
        State: campaign === 'US' ? '' : undefined,
        campaign,
        _rowIndex: -1,
      };

      if (IS_MOCK) {
        setData((prev) => {
          if (!prev) return prev;
          const listKey = campaign === 'US' ? 'usLeads' : 'indiaLeads';
          const list = prev[listKey];
          const rowIndex = list.length + 2;
          return { ...prev, [listKey]: [...list, { ...lead, _rowIndex: rowIndex }] };
        });
        return;
      }

      if (!config.value) throw new Error(config.error ?? 'Not configured.');
      await appendLead(lead, config.value);
      // Refetch so row indices stay correct for later edits.
      await load();
    },
    [config, load],
  );

  const updateLeadField = useCallback(
    async (lead: Lead, field: 'Status' | 'Notes', value: string) => {
      const listKey = lead.campaign === 'US' ? 'usLeads' : 'indiaLeads';
      const prevValue = lead[field];

      // Optimistic local update.
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [listKey]: prev[listKey].map((l) =>
            l._rowIndex === lead._rowIndex && l.campaign === lead.campaign
              ? { ...l, [field]: value }
              : l,
          ),
        };
      });

      if (IS_MOCK) return;

      if (!config.value) throw new Error(config.error ?? 'Not configured.');
      try {
        await updateLeadCell(lead.campaign, lead._rowIndex, field, value, config.value);
      } catch (err) {
        // Revert on failure.
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [listKey]: prev[listKey].map((l) =>
              l._rowIndex === lead._rowIndex && l.campaign === lead.campaign
                ? { ...l, [field]: prevValue }
                : l,
            ),
          };
        });
        throw err;
      }
    },
    [config],
  );

  return {
    data,
    loading,
    error,
    configError,
    lastFetched,
    refresh: () => void load(),
    addLead,
    updateLeadField,
  };
}
