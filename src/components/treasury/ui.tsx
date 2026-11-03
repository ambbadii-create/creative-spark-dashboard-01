import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export const NA = "Données non disponibles";
export const fmtDH = (v: number | null | undefined, cur = "DH") =>
  v === null || v === undefined || Number.isNaN(v) ? NA : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} ${cur === "MAD" ? "DH" : cur}`;
export const fmtK = (v: number) => `${Math.round(v / 1000).toLocaleString("fr-FR")} k`;
export const fmtDate = (iso?: string) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("fr-FR") : "—");
export const tip = { contentStyle: { borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 } };

const TONES: Record<string, string> = {
  good: "bg-success-soft text-success",
  bad: "bg-destructive-soft text-destructive",
  warn: "bg-warning-soft text-foreground",
  info: "bg-accent text-accent-foreground",
  muted: "bg-muted text-muted-foreground",
};
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  Validé: "good", Encaissé: "good", Payé: "good", Rapproché: "good", Actif: "good", Transmis: "good", Ouverte: "good", "En cours": "info",
  Brouillon: "muted", "À encaisser": "info", "À payer": "info", Programmé: "info", "Non rapproché": "muted", "À transmettre": "warn", Fermée: "muted",
  "Partiellement encaissé": "warn", "Partiellement payé": "warn", "Partiellement rapproché": "warn", "En attente de validation": "warn", "À vérifier": "warn", Bloqué: "warn",
  "En retard": "bad", Litige: "bad", Annulé: "muted", Rejeté: "bad", Clôturé: "muted", Soldé: "muted",
};
export function Pill({ children, tone }: { children: ReactNode; tone?: keyof typeof TONES }) {
  const t = tone ?? STATUS_TONE[String(children)] ?? "muted";
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", TONES[t])}>{children}</span>;
}

/** Nature de la donnée : réel, programmé, attendu, hypothèse. */
export function NatureTag({ kind }: { kind: "Réel" | "Programmé" | "Attendu" | "Hypothèse" | "Démo" }) {
  const cls = {
    Réel: "bg-success-soft text-success",
    Programmé: "bg-accent text-accent-foreground",
    Attendu: "border border-dashed border-primary/50 bg-accent text-accent-foreground",
    Hypothèse: "border border-dashed border-warning bg-warning-soft text-foreground",
    Démo: "bg-warning-soft text-foreground",
  }[kind];
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>{kind}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
      <Inbox className="h-6 w-6" />
      {children}
    </div>
  );
}

export function usePager<T>(rows: T[], size = 12) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(page, pages - 1);
  return { slice: rows.slice(p * size, p * size + size), page: p, pages, setPage, total: rows.length };
}
export function Pager({ page, pages, setPage, total }: { page: number; pages: number; setPage: (n: number) => void; total: number }) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
      <span>{total} ligne(s)</span>
      <div className="flex items-center gap-2">
        <button className="rounded-md border border-border p-1 hover:bg-muted disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Page précédente"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <span>Page {page + 1} / {pages}</span>
        <button className="rounded-md border border-border p-1 hover:bg-muted disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Page suivante"><ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export function Search({ value, onChange, placeholder = "Rechercher…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      <span className="mb-1 block">Recherche</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
    </label>
  );
}

/** Carte KPI avec comparaison à la période précédente et mini-courbe. */
export function TrendKpi({ label, value, prev, spark, hint, inverse }: { label: string; value: number | null; prev: number | null; spark?: number[]; hint?: string; inverse?: boolean }) {
  const diff = value !== null && prev !== null ? value - prev : null;
  const pctV = diff !== null && prev ? (diff / Math.abs(prev)) * 100 : null;
  const good = diff === null ? null : inverse ? diff <= 0 : diff >= 0;
  return (
    <div className="card-elevated p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className={cn("font-display font-extrabold text-foreground", value === null ? "text-sm text-muted-foreground" : "text-xl")}>{fmtDH(value)}</p>
        {spark && spark.length > 1 && (
          <div className="h-8 w-20">
            <ResponsiveContainer>
              <AreaChart data={spark.map((v, i) => ({ i, v }))}>
                <Area dataKey="v" stroke="var(--chart-1)" fill="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        {diff === null ? (
          <span className="text-muted-foreground">Comparaison non disponible</span>
        ) : (
          <>
            <span className={cn("rounded-md px-1.5 py-0.5 font-semibold", good ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")}>
              {diff >= 0 ? "▲" : "▼"} {pctV === null ? "n.c." : `${pctV >= 0 ? "+" : ""}${pctV.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}
            </span>
            <span className="text-muted-foreground">{diff >= 0 ? "+" : ""}{fmtDH(diff)} vs période préc.</span>
          </>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{children}</p>;
}
