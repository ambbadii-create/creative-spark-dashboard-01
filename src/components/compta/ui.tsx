import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useCompta } from "@/lib/compta/store";
import { balances, bilan, caf, cpc, equilibre, fmtNum, fmtPct, sig, variationPct, type Bal } from "@/lib/compta/model";
import { toCsv } from "@/lib/stock/model";

export type Period = { year: number; to: number };

/** Agrégats financiers N et N-1 (même période) calculés depuis les écritures validées. */
export function useFin({ year, to }: Period) {
  const { entries } = useCompta();
  return useMemo(() => {
    const mk = (y: number) => {
      const bal = balances(entries, { year: y, to });
      const has = entries.some((e) => e.status === "Validée" && e.date.startsWith(String(y)));
      const b = bilan(bal);
      return { has, bal, openBal: balances(entries, { year: y, to, onlyOpening: true }), cpc: cpc(bal), sig: sig(bal), caf: caf(bal), bilan: b, eq: equilibre(b) };
    };
    return { n: mk(year), n1: mk(year - 1) };
  }, [entries, year, to]);
}
export type Fin = ReturnType<typeof useFin>["n"];

/** Série mensuelle d'un indicateur calculé sur les seuls mouvements du mois. */
export function useMonthly(year: number, to: number, pick: (bal: Bal) => number) {
  const { entries } = useCompta();
  return useMemo(() => Array.from({ length: to + 1 }, (_, m) => pick(balances(entries, { year, from: m, to: m }))), [entries, year, to, pick]);
}

export const num = "text-right tabular-nums whitespace-nowrap";
export const Amt = ({ v, className }: { v: number | null | undefined; className?: string }) => (
  <td className={cn("py-2 pr-3", num, className)}>{v === null || v === undefined ? <span className="text-xs text-muted-foreground">n.d.</span> : fmtNum(v)}</td>
);

/** Cellule de variation : verte si favorable, rouge sinon. */
export function VarCells({ cur, prev, inverse, hasPrev = true }: { cur: number; prev: number; inverse?: boolean | undefined; hasPrev?: boolean }) {
  if (!hasPrev) return <><td className={cn("py-2 pr-3 text-xs text-muted-foreground", num)}>n.d.</td><td className={cn("py-2 pr-3 text-xs text-muted-foreground", num)}>n.d.</td></>;
  const d = cur - prev, p = variationPct(cur, prev);
  const good = Math.abs(d) < 0.01 ? null : inverse ? d < 0 : d > 0;
  const tone = good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive";
  return (
    <>
      <td className={cn("py-2 pr-3", num, tone)}>{d > 0 ? "+" : ""}{fmtNum(d)}</td>
      <td className={cn("py-2 pr-3 text-xs font-semibold", num, tone)}>{fmtPct(p)}</td>
    </>
  );
}

export function SubNav<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {items.map((i) => (
        <button key={i.id} onClick={() => onChange(i.id)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors", value === i.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "bad" | "good" }) {
  return (
    <p className={cn("rounded-lg border px-3 py-2 text-xs",
      tone === "info" && "border-border bg-muted/50 text-muted-foreground",
      tone === "warn" && "border-warning/40 bg-warning-soft text-foreground",
      tone === "bad" && "border-destructive/30 bg-destructive-soft text-destructive",
      tone === "good" && "border-success/30 bg-success-soft text-success")}>{children}</p>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "good" | "bad" | "warn" | "primary" }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
      tone === "muted" && "bg-muted text-muted-foreground", tone === "good" && "bg-success-soft text-success",
      tone === "bad" && "bg-destructive-soft text-destructive", tone === "warn" && "bg-warning-soft text-foreground", tone === "primary" && "bg-accent text-accent-foreground")}>{children}</span>
  );
}

export function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const blob = new Blob(["\ufeff" + toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const NoData = ({ children = "Données non disponibles" }: { children?: ReactNode }) => (
  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</div>
);
