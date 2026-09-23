import { useCallback, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import Panel from './components/Panel';
import StatCard from './components/StatCard';
import PipelineFunnel from './components/PipelineFunnel';
import DailySendChart from './components/DailySendChart';
import IndustryBreakdown from './components/IndustryBreakdown';
import ReplyTable from './components/ReplyTable';
import ApolloEfficiency from './components/ApolloEfficiency';
import EmailLogTable from './components/EmailLogTable';
import { useSheetData } from './hooks/useSheetData';
import { emailsSentToday, repliedOrInterested } from './lib/analytics';
import { formatRefreshed } from './lib/dates';
import { COLORS } from './lib/theme';
import type { CampaignSelection, Lead } from './types';

const CAMPAIGNS: CampaignSelection[] = ['Both', 'India', 'US'];

const isMockMode = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export default function App() {
  const { data, loading, error, configError, lastFetched, refresh } =
    useSheetData();
  const [selection, setSelection] = useState<CampaignSelection>('Both');
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Leads for the current campaign selection.
  const leads = useMemo<Lead[]>(() => {
    if (!data) return [];
    if (selection === 'India') return data.indiaLeads;
    if (selection === 'US') return data.usLeads;
    return [...data.indiaLeads, ...data.usLeads];
  }, [data, selection]);

  const log = useMemo(() => {
    if (!data) return [];
    if (selection === 'Both') return data.emailLog;
    return data.emailLog.filter((e) => e.Campaign === selection);
  }, [data, selection]);

  const accent =
    selection === 'India'
      ? COLORS.india
      : selection === 'US'
        ? COLORS.us
        : COLORS.india;

  const totalLeads = data
    ? data.indiaLeads.length + data.usLeads.length
    : 0;
  const sentToday = useMemo(() => emailsSentToday(log), [log]);
  const replies = useMemo(() => repliedOrInterested(leads).length, [leads]);

  const goTo = useCallback((id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // --- Hard config error: show setup guidance instead of the dashboard -------
  if (configError) {
    return <ConfigErrorScreen message={error ?? ''} />;
  }

  return (
    <div className="flex min-h-screen bg-surface-950">
      <Sidebar
        active={active}
        onSelect={goTo}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-surface-700/60 bg-surface-950/85 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg border border-surface-700 text-slate-300 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <div className="mr-auto">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-white">
                  Outreach Analytics
                </h1>
                {isMockMode && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/30">
                    Sample data
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Last refreshed: {formatRefreshed(lastFetched)}
              </p>
            </div>

            <CampaignToggle value={selection} onChange={setSelection} />

            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-india px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
            >
              <span className={loading ? 'inline-block animate-spin' : ''}>↻</span>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
          {error && !configError && (
            <div className="card border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              <p className="font-semibold">Could not connect to Google Sheets</p>
              <p className="mt-1 text-rose-300/90">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-3 rounded-md border border-rose-400/40 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/20"
              >
                Try again
              </button>
            </div>
          )}

          {/* --- Overview KPIs --- */}
          <section id="overview" className="scroll-mt-24">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total Leads (India + US)"
                value={totalLeads.toLocaleString()}
                hint={
                  data
                    ? `${data.indiaLeads.length} India · ${data.usLeads.length} US`
                    : undefined
                }
                accent="default"
                loading={loading && !data}
              />
              <StatCard
                label={`Leads in view (${selection})`}
                value={leads.length.toLocaleString()}
                accent={
                  selection === 'US'
                    ? 'us'
                    : selection === 'India'
                      ? 'india'
                      : 'default'
                }
                loading={loading && !data}
              />
              <StatCard
                label="Emails Sent Today"
                value={sentToday.toLocaleString()}
                accent="us"
                loading={loading && !data}
              />
              <StatCard
                label="Replies / Interested"
                value={replies.toLocaleString()}
                accent="positive"
                loading={loading && !data}
              />
            </div>
          </section>

          {loading && !data ? (
            <LoadingSkeleton />
          ) : (
            <>
              <section id="funnel" className="scroll-mt-24">
                <Panel
                  title="Pipeline Funnel"
                  subtitle={`Cumulative stages · ${selection}`}
                >
                  <PipelineFunnel leads={leads} accent={accent} />
                </Panel>
              </section>

              <section id="daily" className="scroll-mt-24">
                <Panel
                  title="Daily Send Volume"
                  subtitle="Last 30 days · by email type"
                >
                  <DailySendChart log={log} days={30} />
                </Panel>
              </section>

              <section id="industry" className="scroll-mt-24">
                <Panel
                  title="Industry Breakdown"
                  subtitle={`Top 10 industries by leads · ${selection}`}
                >
                  <IndustryBreakdown leads={leads} limit={10} />
                </Panel>
              </section>

              <section id="replies" className="scroll-mt-24">
                <Panel
                  title="Replies & Interest"
                  subtitle="Leads that replied or expressed interest"
                >
                  <ReplyTable leads={leads} />
                </Panel>
              </section>

              <section id="apollo" className="scroll-mt-24">
                <Panel
                  title="Apollo Credit Efficiency"
                  subtitle={`Reveal success rate · ${selection}`}
                >
                  <ApolloEfficiency leads={leads} />
                </Panel>
              </section>

              <section id="log" className="scroll-mt-24">
                <Panel
                  title="Email Log"
                  subtitle="Most recent 50 sends, newest first"
                >
                  <EmailLogTable log={log} max={50} pageSize={10} />
                </Panel>
              </section>
            </>
          )}

          <footer className="pb-8 pt-2 text-center text-xs text-slate-600">
            PowerhouseTech · Outreach Analytics · read-only view of the outreach
            Google Sheet
          </footer>
        </main>
      </div>
    </div>
  );
}

function CampaignToggle({
  value,
  onChange,
}: {
  value: CampaignSelection;
  onChange: (v: CampaignSelection) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-surface-700 bg-surface-900 p-0.5">
      {CAMPAIGNS.map((c) => {
        const isActive = value === c;
        const activeClass =
          c === 'India'
            ? 'bg-india text-white'
            : c === 'US'
              ? 'bg-us text-white'
              : 'bg-surface-700 text-white';
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? activeClass : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card p-5">
          <div className="skeleton mb-4 h-5 w-48" />
          <div className="space-y-3">
            <div className="skeleton h-6 w-full" />
            <div className="skeleton h-6 w-5/6" />
            <div className="skeleton h-6 w-4/6" />
            <div className="skeleton h-6 w-3/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-950 px-4">
      <div className="card max-w-lg p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-india/20 text-xl text-india">
            ⚡
          </span>
          <h1 className="text-lg font-semibold text-white">
            Configuration needed
          </h1>
        </div>
        <p className="text-sm text-slate-300">{message}</p>
        <div className="mt-4 rounded-lg border border-surface-700 bg-surface-900 p-4 text-xs text-slate-400">
          <p className="mb-2 font-medium text-slate-300">Quick setup</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>
              Copy <code className="text-slate-200">.env.example</code> to{' '}
              <code className="text-slate-200">.env</code>
            </li>
            <li>
              Set <code className="text-slate-200">VITE_SPREADSHEET_ID</code>
            </li>
            <li>
              Set{' '}
              <code className="text-slate-200">
                VITE_GOOGLE_SERVICE_ACCOUNT_JSON
              </code>{' '}
              (base64 of the key file)
            </li>
            <li>
              Restart the dev server (
              <code className="text-slate-200">npm run dev</code>)
            </li>
          </ol>
          <p className="mt-3">See the README for full instructions.</p>
        </div>
      </div>
    </div>
  );
}
