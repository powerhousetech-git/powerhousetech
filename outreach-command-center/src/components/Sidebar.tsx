interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: '▧' },
  { id: 'workflows', label: 'Workflow Control', icon: '⚙' },
  { id: 'funnel', label: 'Pipeline Funnel', icon: '⧗' },
  { id: 'addlead', label: 'Add Lead', icon: '＋' },
  { id: 'leads', label: 'Lead Table', icon: '▤' },
  { id: 'daily', label: 'Daily Volume', icon: '↗' },
  { id: 'replies', label: 'Interested / Replied', icon: '✉' },
  { id: 'log', label: 'Email Log', icon: '≡' },
  { id: 'apollo', label: 'Apollo Efficiency', icon: '◑' },
];

interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ active, onSelect, mobileOpen, onCloseMobile }: SidebarProps) {
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
                ? 'bg-india/15 text-india ring-1 ring-india/30'
                : 'text-slate-400 hover:bg-surface-800 hover:text-slate-200',
            ].join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="grid h-6 w-6 place-items-center text-base" aria-hidden>
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
        <p className="text-sm font-semibold text-slate-100">PowerhouseTech</p>
        <p className="text-xs text-slate-500">Command Center</p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-surface-700/60 bg-surface-900/60 md:block">
        <div className="sticky top-0 flex h-screen flex-col">
          {brand}
          {nav}
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseMobile} aria-hidden />
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
