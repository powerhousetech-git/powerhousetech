interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: '▧' },
  { id: 'funnel', label: 'Pipeline Funnel', icon: '⧗' },
  { id: 'daily', label: 'Daily Send Volume', icon: '↗' },
  { id: 'industry', label: 'Industry Breakdown', icon: '▤' },
  { id: 'replies', label: 'Replies & Interest', icon: '✉' },
  { id: 'apollo', label: 'Apollo Efficiency', icon: '◑' },
  { id: 'log', label: 'Email Log', icon: '≡' },
];

interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
  /** Controls the mobile drawer open state. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  active,
  onSelect,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelect(item.id);
              onCloseMobile();
            }}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
              isActive
                ? 'bg-india/15 text-white ring-1 ring-india/30'
                : 'text-slate-400 hover:bg-surface-800 hover:text-slate-200',
            ].join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              className={`grid h-6 w-6 place-items-center text-base ${
                isActive ? 'text-india' : 'text-slate-500'
              }`}
              aria-hidden
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-surface-700/60 px-4 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-india/20 text-lg text-india">
        ⚡
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">PowerhouseTech</p>
        <p className="text-xs text-slate-500">Outreach Analytics</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-surface-700/60 bg-surface-900/60 md:block">
        <div className="sticky top-0 flex h-screen flex-col">
          {brand}
          {nav}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onCloseMobile}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-surface-700/60 bg-surface-900 shadow-2xl">
            {brand}
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
