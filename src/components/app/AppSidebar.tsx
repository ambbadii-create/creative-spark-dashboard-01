import { Link, useRouterState } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { modules } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-72",
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary font-display text-sm font-extrabold text-sidebar-primary-foreground">
          CG
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-display text-base font-bold text-sidebar-accent-foreground">Pilotage CG</p>
            <p className="text-[11px] opacity-70">Contrôle de gestion</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {modules.map((m) => {
          const active = m.to === "/" ? path === "/" : path.startsWith(m.to);
          return (
            <Link
              key={m.to}
              to={m.to}
              title={m.title}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <m.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{m.title}</span>}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={onToggle}
        className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-sidebar-accent"
        aria-label="Réduire le menu"
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!collapsed && "Réduire le menu"}
      </button>
    </aside>
  );
}
