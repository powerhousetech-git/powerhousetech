import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Campaign, Execution, WorkflowStatus } from '../types';
import { ConfigError, IS_MOCK, loadN8nConfig, type N8nConfig } from '../lib/config';
import {
  getExecution,
  getWorkflow,
  listExecutions,
  runWorkflow,
  setWorkflowActive,
} from '../lib/n8nClient';

export interface WorkflowState {
  campaign: Campaign;
  id: string;
  status: WorkflowStatus | null;
  executions: Execution[];
  busy: boolean;
}

export interface UseN8nResult {
  workflows: Record<Campaign, WorkflowState>;
  loading: boolean;
  error: string | null;
  configError: boolean;
  refresh: () => void;
  toggleActive: (campaign: Campaign) => Promise<void>;
  run: (campaign: Campaign) => Promise<string>;
  fetchExecutionDetail: (id: string) => Promise<Execution>;
}

const CAMPAIGNS: Campaign[] = ['India', 'US'];

export function useN8nWorkflows(): UseN8nResult {
  const config = useMemo<{ value?: N8nConfig; error?: string }>(() => {
    if (IS_MOCK) return {};
    try {
      return { value: loadN8nConfig() };
    } catch (err) {
      return {
        error: err instanceof ConfigError ? err.message : 'Invalid n8n configuration.',
      };
    }
  }, []);

  const idFor = useCallback(
    (campaign: Campaign): string => {
      if (IS_MOCK) {
        return campaign === 'India' ? 'yrYIauoO1q46DORb' : '41O5a05zrxyWqpe2';
      }
      return campaign === 'India'
        ? config.value?.indiaWorkflowId ?? ''
        : config.value?.usWorkflowId ?? '';
    },
    [config],
  );

  const [workflows, setWorkflows] = useState<Record<Campaign, WorkflowState>>({
    India: { campaign: 'India', id: idFor('India'), status: null, executions: [], busy: false },
    US: { campaign: 'US', id: idFor('US'), status: null, executions: [], busy: false },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback((campaign: Campaign, next: Partial<WorkflowState>) => {
    setWorkflows((prev) => ({ ...prev, [campaign]: { ...prev[campaign], ...next } }));
  }, []);

  const loadOne = useCallback(
    async (campaign: Campaign) => {
      const id = idFor(campaign);
      if (IS_MOCK) {
        const { getMockWorkflows, getMockExecutions } = await import('../lib/mockData');
        patch(campaign, {
          id,
          status: getMockWorkflows()[campaign],
          executions: getMockExecutions(id),
        });
        return;
      }
      const cfg = config.value!;
      const [status, executions] = await Promise.all([
        getWorkflow(id, cfg),
        listExecutions(id, 5, cfg).catch(() => [] as Execution[]),
      ]);
      patch(campaign, { id, status, executions });
    },
    [config, idFor, patch],
  );

  const refresh = useCallback(async () => {
    if (!IS_MOCK && !config.value) {
      setError(config.error ?? 'n8n not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await Promise.all(CAMPAIGNS.map((c) => loadOne(c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach n8n.');
    } finally {
      setLoading(false);
    }
  }, [config, loadOne]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll every 15s while any execution is running.
  const workflowsRef = useRef(workflows);
  workflowsRef.current = workflows;
  useEffect(() => {
    const anyRunning = CAMPAIGNS.some((c) =>
      workflows[c].executions.some((e) => e.status === 'running' || e.status === 'waiting'),
    );
    if (!anyRunning) return;
    const timer = window.setInterval(() => {
      CAMPAIGNS.forEach((c) => {
        const hasRunning = workflowsRef.current[c].executions.some(
          (e) => e.status === 'running' || e.status === 'waiting',
        );
        if (hasRunning) void loadOne(c);
      });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [workflows, loadOne]);

  const toggleActive = useCallback(
    async (campaign: Campaign) => {
      const wf = workflowsRef.current[campaign];
      const target = !(wf.status?.active ?? false);
      patch(campaign, { busy: true });
      try {
        if (IS_MOCK) {
          await new Promise((r) => setTimeout(r, 300));
          patch(campaign, {
            status: wf.status
              ? { ...wf.status, active: target }
              : { id: wf.id, name: `${campaign} Outreach Sequence`, active: target },
          });
          return;
        }
        const status = await setWorkflowActive(wf.id, target, config.value!);
        patch(campaign, { status });
      } finally {
        patch(campaign, { busy: false });
      }
    },
    [config, patch],
  );

  const run = useCallback(
    async (campaign: Campaign): Promise<string> => {
      const wf = workflowsRef.current[campaign];
      patch(campaign, { busy: true });
      try {
        if (IS_MOCK) {
          await new Promise((r) => setTimeout(r, 400));
          const execId = `${wf.id}-exec-${Date.now()}`;
          const running: Execution = {
            id: execId,
            workflowId: wf.id,
            status: 'running',
            startedAt: new Date().toISOString(),
            mode: 'trigger',
          };
          patch(campaign, { executions: [running, ...wf.executions].slice(0, 5) });
          // Simulate completion after a few seconds.
          window.setTimeout(() => {
            setWorkflows((prev) => ({
              ...prev,
              [campaign]: {
                ...prev[campaign],
                executions: prev[campaign].executions.map((e) =>
                  e.id === execId
                    ? { ...e, status: 'success', stoppedAt: new Date().toISOString() }
                    : e,
                ),
              },
            }));
          }, 6000);
          return execId;
        }
        const { executionId } = await runWorkflow(wf.id, config.value!);
        // Pull fresh executions so the new run shows up.
        void loadOne(campaign);
        return executionId;
      } finally {
        patch(campaign, { busy: false });
      }
    },
    [config, loadOne, patch],
  );

  const fetchExecutionDetail = useCallback(
    async (id: string): Promise<Execution> => {
      if (IS_MOCK) {
        const { getMockExecutionDetail } = await import('../lib/mockData');
        return getMockExecutionDetail(id);
      }
      return getExecution(id, config.value!);
    },
    [config],
  );

  return {
    workflows,
    loading,
    error,
    configError: !IS_MOCK && !config.value,
    refresh: () => void refresh(),
    toggleActive,
    run,
    fetchExecutionDetail,
  };
}
