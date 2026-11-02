import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-foreground">
      <FlaskConical className="h-3 w-3 text-warning" /> Données de démonstration
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, subtitle, children, className, action }: { title: string; subtitle?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("card-elevated p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function KpiCard({ label, value, delta, hint, inverse }: { label: string; value: string; delta: number; hint: string; inverse?: boolean }) {
  const good = inverse ? delta < 0 : delta >= 0;
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card-elevated p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-3 font-display text-2xl font-extrabold text-foreground">{value}</p>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold", good ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")}>
          <Icon className="h-3 w-3" />
          {delta > 0 ? "+" : ""}
          {delta.toLocaleString("fr-FR")} %
        </span>
        <span className="text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}
