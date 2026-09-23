import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Campaign, Lead, NewLeadInput, SheetData } from '../types';
import { IS_MOCK, loadConfig } from '../lib/config';
import { appendLead, fetchSheetData, updateLeadCell } from '../lib/sheetsClient';

export interface UseSheetDataResult {
  data: SheetData | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  refresh: () => void;
  addLead: (input: NewLeadInput) => Promise<void>;
  updateLeadField: (lead: Lead, field: 'Status' | 'Notes', value: string) => Promise<void>;
}

export function useSheetData(enabled: boolean = true): UseSheetDataResult {
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const config = useMemo(() => loadConfig(), []);

  const load = useCallback(async () => {
    if (IS_MOCK) {
      setLoading(true);
      setError(null);
      const { getMockData } = await import('../lib/mockData');
      await new Promise((r) => setTimeout(r, 400));
      setData(getMockData());
      setLastFetched(new Date());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSheetData(config);
      setData(result);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load data from Google Sheets.');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

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
          return { ...prev, [listKey]: [...list, { ...lead, _rowIndex: list.length + 2 }] };
        });
        return;
      }

      await appendLead(lead, config);
      await load(); // refetch so row indices stay correct
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

      try {
        await updateLeadCell(lead.campaign, lead._rowIndex, field, value, config);
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
    lastFetched,
    refresh: () => void load(),
    addLead,
    updateLeadField,
  };
}
