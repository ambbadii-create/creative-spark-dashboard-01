import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/budget/model";
import { varianceNature } from "@/lib/budget/model";

export const fmt = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} DH`;
export const fmtM = (v: number) => `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M DH`;
export const pct = (v: number | null) => (v === null ? "n.c." : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);

export const fieldCls =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

export function Select({ label, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string | undefined }) {
  return (
    <label className={cn("block text-xs font-medium text-muted-foreground", className)}>
      {label && <span className="mb-1 block">{label}</span>}
      <select className={fieldCls} {...p}>{children}</select>
    </label>
  );
}

export function Field({ label, error, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label?: string | undefined; error?: string | undefined }) {
  return (
    <label className={cn("block text-xs font-medium text-muted-foreground", className)}>
      <span className="mb-1 block">{label}</span>
      <input className={cn(fieldCls, error && "border-destructive")} {...p} />
      {error && <span className="mt-1 block text-destructive">{error}</span>}
    </label>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: "good" | "bad" | "forecast" | undefined }) {
  return (
    <div className={cn("card-elevated p-4", tone === "forecast" && "border-dashed border-primary/40")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-xl font-extrabold text-foreground", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function VarianceBadge({ category, value }: { category: Category; value: number }) {
  const n = varianceNature(category, value);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        n === "favorable" && "bg-success-soft text-success",
        n === "defavorable" && "bg-destructive-soft text-destructive",
        n === "neutre" && "bg-muted text-muted-foreground",
      )}
    >
      {n === "favorable" ? "Favorable" : n === "defavorable" ? "Défavorable" : "Neutre"}
    </span>
  );
}

export function ForecastTag() {
  return <span className="rounded-full border border-dashed border-primary/50 bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Prévision</span>;
}

export type Sort<K extends string> = { key: K; dir: 1 | -1 };
export function SortTh<K extends string>({ k, sort, setSort, children, right }: { k: K; sort: Sort<K>; setSort: (s: Sort<K>) => void; children: ReactNode; right?: boolean }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th className={cn("py-2.5 pr-3 font-medium", right && "text-right")}>
      <button onClick={() => setSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : -1 })} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {children} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}
export function sortBy<T>(rows: T[], get: (r: T) => number | string, dir: 1 | -1) {
  return [...rows].sort((a, b) => {
    const x = get(a), y = get(b);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr")) * dir;
  });
}

export const thead = "border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground";
export const trow = "border-b border-border last:border-0 hover:bg-muted/50";

export function Btn({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "ghost" && "border border-border bg-card text-foreground hover:bg-muted",
        variant === "danger" && "text-destructive hover:bg-destructive-soft",
        className,
      )}
      {...p}
    />
  );
}
