import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Panel from './components/Panel';
import StatCard from './components/StatCard';
import WorkflowCard from './components/WorkflowCard';
import ExecutionModal from './components/ExecutionModal';
import PipelineFunnel from './components/PipelineFunnel';
import AddLeadForm from './components/AddLeadForm';
import LeadTable from './components/LeadTable';
import DailySendChart from './components/DailySendChart';
import ReplyTracker from './components/ReplyTracker';
import EmailLogTable from './components/EmailLogTable';
import ApolloEfficiency from './components/ApolloEfficiency';
import AccessGate from './components/AccessGate';
import { useSheetData } from './hooks/useSheetData';
import { useN8nWorkflows } from './hooks/useN8nWorkflows';
import { useTheme } from './hooks/useTheme';
import { useToast } from './components/Toast';
import { emailsSentToday } from './lib/analytics';
import { COLORS } from './lib/theme';
import { IS_MOCK } from './lib/config';
import { UNAUTHORIZED_EVENT } from './lib/apiClient';
import { redirectToSignIn, signOutSite, waitForGate } from './lib/siteAuth';
import type { Campaign, CampaignSelection, Execution, Lead } from './types';

const TABS: CampaignSelection[] = ['Both', 'India', 'US'];

type GateState = 'checking' | 'authed' | 'denied';

export default function App() {
  // Access is gated by the main site's Google admin sign-in (no separate
  // password). Mock mode skips the gate for local/sample previews.
  const [gate, setGate] = useState<GateState>(IS_MOCK ? 'authed' : 'checking');

  useEffect(() => {
    if (IS_MOCK) return;
    let cancelled = false;
    (async () => {
      const g = await waitForGate();
      if (cancelled) return;
      if (!g) {
        redirectToSignIn();
        return;
      }
      const user = await g.waitForAuthUser();
      if (cancelled) return;
      if (!user || !user.email) {
        redirectToSignIn();
        return;
      }
      const me = await g.fetchAdminMe();
      if (cancelled) return;
      setGate(me.is_admin ? 'authed' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setGate('denied');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  if (gate === 'checking') return <AccessGate state="checking" />;
  if (gate === 'denied') return <AccessGate state="denied" onSignOut={() => void signOutSite()} />;

  return <Dashboard onSignOut={() => void signOutSite()} />;
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const sheets = useSheetData(true);
  const n8n = useN8nWorkflows(true);

  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [funnelTab, setFunnelTab] = useState<CampaignSelection>('Both');
  const [leadTab, setLeadTab] = useState<CampaignSelection>('Both');

  const [execOpen, setExecOpen] = useState(false);
  const [execLoading, setExecLoading] = useState(false);
  const [execData, setExecData] = useState<Execution | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const data = sheets.data;

  const selectLeads = useCallback(
    (sel: CampaignSelection): Lead[] => {
      if (!data) return [];
      if (sel === 'India') return data.indiaLeads;
      if (sel === 'US') return data.usLeads;
      return [...data.indiaLeads, ...data.usLeads];
    },
    [data],
  );

  const funnelLeads = useMemo(() => selectLeads(funnelTab), [selectLeads, funnelTab]);
  const leadTableLeads = useMemo(() => selectLeads(leadTab), [selectLeads, leadTab]);
  const allLeads = useMemo(() => selectLeads('Both'), [selectLeads]);

  const kpis = useMemo(() => {
    const indiaCount = data?.indiaLeads.length ?? 0;
    const usCount = data?.usLeads.length ?? 0;
    const sentToday = data ? emailsSentToday(data.emailLog) : 0;
    const interested = allLeads.filter((l) => l.Status === 'Interested').length;
    return { indiaCount, usCount, sentToday, interested };
  }, [data, allLeads]);

  const funnelAccent =
    funnelTab === 'US' ? COLORS.us : funnelTab === 'India' ? COLORS.india : COLORS.india;

  const refreshAll = useCallback(() => {
    sheets.refresh();
    n8n.refresh();
  }, [sheets, n8n]);

  const goTo = useCallback((id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleRun = useCallback(
    async (campaign: Campaign) => {
      try {
        const execId = await n8n.run(campaign);
        toast.success(`Execution started: ${execId || '(queued)'}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to trigger workflow.');
      }
    },
    [n8n, toast],
  );

  const handleToggle = useCallback(
    async (campaign: Campaign) => {
      try {
        await n8n.toggleActive(campaign);
        const nowActive = !(n8n.workflows[campaign].status?.active ?? false);
        toast.success(`${campaign} workflow ${nowActive ? 'activated' : 'deactivated'}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to change workflow state.');
      }
    },
    [n8n, toast],
  );

  const openExecution = useCallback(
    async (id: string) => {
      setExecOpen(true);
      setExecLoading(true);
      setExecError(null);
      setExecData(null);
      try {
        setExecData(await n8n.fetchExecutionDetail(id));
      } catch (err) {
        setExecError(err instanceof Error ? err.message : 'Failed to load execution.');
      } finally {
        setExecLoading(false);
      }
    },
    [n8n],
  );

  const loadingData = sheets.loading && !data;

  return (
    <div className="flex min-h-screen bg-surface-950">
      <Sidebar active={active} onSelect={goTo} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          lastFetched={sheets.lastFetched}
          onRefresh={refreshAll}
          loading={sheets.loading || n8n.loading}
          theme={theme}
          onToggleTheme={toggle}
          india={n8n.workflows.India.status}
          us={n8n.workflows.US.status}
          isMock={IS_MOCK}
          onOpenMobile={() => setMobileOpen(true)}
          onSignOut={onSignOut}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
          {sheets.error && (
            <ErrorBanner title="Could not connect to Google Sheets" message={sheets.error} onRetry={sheets.refresh} />
          )}

          <section id="overview" className="scroll-mt-24">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total India Leads" value={kpis.indiaCount.toLocaleString()} accent="india" icon="🇮🇳" loading={loadingData} />
              <StatCard label="Total US Leads" value={kpis.usCount.toLocaleString()} accent="us" icon="🇺🇸" loading={loadingData} />
              <StatCard label="Emails Sent Today" value={kpis.sentToday.toLocaleString()} accent="default" icon="✉" loading={loadingData} />
              <StatCard label="Interested Leads" value={kpis.interested.toLocaleString()} accent="positive" icon="★" loading={loadingData} />
            </div>
          </section>

          <section id="workflows" className="scroll-mt-24">
            <Panel title="Workflow Control" subtitle="n8n outreach sequences — status, run, and recent executions">
              {n8n.error ? (
                <ErrorBanner title="Could not reach n8n" message={n8n.error} onRetry={n8n.refresh} inline />
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <WorkflowCard state={n8n.workflows.India} accent={COLORS.india} onToggleActive={() => handleToggle('India')} onRun={() => handleRun('India')} onOpenExecution={openExecution} />
                  <WorkflowCard state={n8n.workflows.US} accent={COLORS.us} onToggleActive={() => handleToggle('US')} onRun={() => handleRun('US')} onOpenExecution={openExecution} />
                </div>
              )}
            </Panel>
          </section>

          {loadingData ? (
            <LoadingSkeleton />
          ) : (
            <>
              <section id="funnel" className="scroll-mt-24">
                <Panel title="Pipeline Funnel" subtitle="Cumulative stages" actions={<Tabs value={funnelTab} onChange={setFunnelTab} />}>
                  <PipelineFunnel leads={funnelLeads} accent={funnelAccent} />
                </Panel>
              </section>

              <section id="addlead" className="scroll-mt-24">
                <AddLeadForm onAdd={sheets.addLead} />
              </section>

              <section id="leads" className="scroll-mt-24">
                <Panel title="Lead Table" subtitle="Filter, search, and edit status/notes inline" actions={<Tabs value={leadTab} onChange={setLeadTab} />}>
                  <LeadTable leads={leadTableLeads} showCampaign={leadTab === 'Both'} onUpdate={sheets.updateLeadField} />
                </Panel>
              </section>

              <section id="daily" className="scroll-mt-24">
                <Panel title="Daily Send Volume" subtitle="Last 30 days · by email type">
                  <DailySendChart log={data?.emailLog ?? []} days={30} />
                </Panel>
              </section>

              <section id="replies" className="scroll-mt-24">
                <Panel title="Interested / Replied" subtitle="Leads that replied or expressed interest">
                  <ReplyTracker leads={allLeads} onUpdate={sheets.updateLeadField} />
                </Panel>
              </section>

              <section id="log" className="scroll-mt-24">
                <Panel title="Email Log" subtitle="Most recent 100 sends, newest first">
                  <EmailLogTable log={data?.emailLog ?? []} max={100} pageSize={10} />
                </Panel>
              </section>

              <section id="apollo" className="scroll-mt-24">
                <Panel title="Apollo Credit Efficiency" subtitle="Reveal success rate (both campaigns)">
                  <ApolloEfficiency leads={allLeads} />
                </Panel>
              </section>
            </>
          )}

          <footer className="pb-8 pt-2 text-center text-xs text-slate-600">
            PowerhouseTech · Outreach Command Center · Google Sheets (read/write) + n8n
          </footer>
        </main>
      </div>

      <ExecutionModal open={execOpen} loading={execLoading} execution={execData} error={execError} onClose={() => setExecOpen(false)} />
    </div>
  );
}

function Tabs({ value, onChange }: { value: CampaignSelection; onChange: (v: CampaignSelection) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-surface-700 bg-surface-950 p-0.5">
      {TABS.map((c) => {
        const isActive = value === c;
        const activeClass = c === 'India' ? 'bg-india text-white' : c === 'US' ? 'bg-us text-white' : 'bg-surface-700 text-white';
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={['rounded-md px-3 py-1 text-sm font-medium transition-colors', isActive ? activeClass : 'text-slate-400 hover:text-slate-200'].join(' ')}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function ErrorBanner({ title, message, onRetry, inline }: { title: string; message: string; onRetry: () => void; inline?: boolean }) {
  return (
    <div className={`${inline ? '' : 'card'} border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-rose-300/90">{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-rose-400/40 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/20">
        Try again
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((i) => (
        <div key={i} className="card p-5">
          <div className="skeleton mb-4 h-5 w-48" />
          <div className="space-y-3">
            <div className="skeleton h-6 w-full" />
            <div className="skeleton h-6 w-5/6" />
            <div className="skeleton h-6 w-4/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
