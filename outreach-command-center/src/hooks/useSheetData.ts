import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Campaign, Lead, NewLeadInput, OutreachSettings, SheetData } from '../types';
import { IS_MOCK, loadConfig } from '../lib/config';
import {
  appendLead,
  fetchSheetData,
  updateLeadCells,
  writeSettings,
} from '../lib/sheetsClient';

export interface UseSheetDataResult {
  data: SheetData | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  refresh: () => void;
  addLead: (input: NewLeadInput) => Promise<void>;
  updateLeadField: (lead: Lead, field: 'Status' | 'Notes', value: string) => Promise<void>;
  approveLeads: (leads: Lead[]) => Promise<void>;
  rejectLeads: (leads: Lead[]) => Promise<void>;
  saveSettings: (next: Partial<Omit<OutreachSettings, '_rows'>>) => Promise<void>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

  const patchLocalLeads = useCallback((leads: Lead[], patch: Partial<Lead>) => {
    setData((prev) => {
      if (!prev) return prev;
      const apply = (list: Lead[]) =>
        list.map((l) => {
          const hit = leads.some(
            (t) => t._rowIndex === l._rowIndex && t.campaign === l.campaign,
          );
          return hit ? { ...l, ...patch } : l;
        });
      return {
        ...prev,
        indiaLeads: apply(prev.indiaLeads),
        usLeads: apply(prev.usLeads),
      };
    });
  }, []);

  const addLead = useCallback(
    async (input: NewLeadInput) => {
      const campaign: Campaign = input.campaign;
      const lead: Lead = {
        Company_Name: input.Company_Name,
        Contact_Name: input.Contact_Name,
        Title: input.Title,
        Email: input.Email,
        Industry: input.Industry,
        City: input.City,
        State: input.State,
        Country: input.Country || (campaign === 'India' ? 'India' : 'United States'),
        Website: '',
        LinkedIn_URL: '',
        Apollo_ID: '',
        Apollo_Person_ID: '',
        Added_Date: todayIso(),
        Status: input.Status || (input.Email ? 'In_Sequence' : 'Pending'),
        Sequence_Step: '0',
        Next_Send_Date: '',
        Notes: input.Notes,
        Sent_Date: '',
        FU1_Date: '',
        FU2_Date: '',
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
      await load();
    },
    [config, load],
  );

  const updateLeadField = useCallback(
    async (lead: Lead, field: 'Status' | 'Notes', value: string) => {
      const listKey = lead.campaign === 'US' ? 'usLeads' : 'indiaLeads';
      const prevValue = lead[field];

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
        // Notes is optional/legacy — only write Status via the v2 column set.
        if (field === 'Notes') {
          // Soft-fail: Notes may not exist on the v2 sheet.
          return;
        }
        await updateLeadCells(lead.campaign, lead._rowIndex, { [field]: value }, config);
      } catch (err) {
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

  const approveLeads = useCallback(
    async (leads: Lead[]) => {
      if (!leads.length) return;
      patchLocalLeads(leads, {
        Status: 'In_Sequence',
        Sequence_Step: '0',
        Next_Send_Date: '',
      });
      if (IS_MOCK) return;
      try {
        await Promise.all(
          leads.map((lead) =>
            updateLeadCells(
              lead.campaign,
              lead._rowIndex,
              {
                Status: 'In_Sequence',
                Sequence_Step: '0',
                Next_Send_Date: '',
              },
              config,
            ),
          ),
        );
      } catch (err) {
        await load();
        throw err;
      }
    },
    [config, load, patchLocalLeads],
  );

  const rejectLeads = useCallback(
    async (leads: Lead[]) => {
      if (!leads.length) return;
      patchLocalLeads(leads, { Status: 'Rejected' });
      if (IS_MOCK) return;
      try {
        await Promise.all(
          leads.map((lead) =>
            updateLeadCells(lead.campaign, lead._rowIndex, { Status: 'Rejected' }, config),
          ),
        );
      } catch (err) {
        await load();
        throw err;
      }
    },
    [config, load, patchLocalLeads],
  );

  const saveSettings = useCallback(
    async (next: Partial<Omit<OutreachSettings, '_rows'>>) => {
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, settings: { ...prev.settings, ...next } };
      });
      if (IS_MOCK) return;
      const current = data?.settings;
      if (!current) {
        await load();
        return;
      }
      try {
        await writeSettings(next, current, config);
        await load();
      } catch (err) {
        await load();
        throw err;
      }
    },
    [config, data?.settings, load],
  );

  return {
    data,
    loading,
    error,
    lastFetched,
    refresh: () => void load(),
    addLead,
    updateLeadField,
    approveLeads,
    rejectLeads,
    saveSettings,
  };
}
