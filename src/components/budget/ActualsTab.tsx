import { useState } from "react";
import { Info } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { MONTHS, categoryLabel, centreLabel, parseAmount, type BudgetLine } from "@/lib/budget/model";
import { useBudgets } from "@/lib/budget/store";
import { Select, fmt } from "./ui";
import { cn } from "@/lib/utils";

export function ActualsTab({ lines, year }: { lines: BudgetLine[]; year: number }) {
  const { budgets, setActual } = useBudgets();
  const yb = budgets.filter((b) => b.year === year && lines.some((l) => l.budgetId === b.id));
  const [bid, setBid] = useState("");
  const current = yb.find((b) => b.id === bid) ?? yb[0];
  const rows = lines.filter((l) => l.budgetId === current?.id);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-accent p-4 text-sm text-accent-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Saisie manuelle du réalisé. Aucune donnée comptable n'est importée automatiquement : aucune connexion à un logiciel comptable n'est configurée. Laissez une case vide pour un mois non clôturé.</p>
      </div>
      <Panel
        title={`Saisie du réalisé ${year}`}
        subtitle="Chaque montant est rattaché à l'exercice, au mois et au centre du budget sélectionné"
        action={
          <Select value={current?.id ?? ""} onChange={(e) => setBid(e.target.value)} className="w-56">
            {yb.map((b) => <option key={b.id} value={b.id}>{centreLabel(b.centre)}</option>)}
          </Select>
        }
      >
        <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-muted" /> Budget (lecture seule)</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-primary bg-card" /> Réel (saisissable)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="border-b border-border text-left uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Ligne</th>
                {MONTHS.map((m) => <th key={m} className="px-1 py-2 text-center font-medium">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-foreground">{l.label}</p>
                    <p className="text-muted-foreground">{categoryLabel(l.category)}</p>
                  </td>
                  {MONTHS.map((_, m) => (
                    <td key={m} className="px-1 py-2">
                      <p className="mb-1 rounded bg-muted px-1.5 py-1 text-right text-muted-foreground" title="Budget">{Math.round((l.budget[m] ?? 0) / 1000)} k</p>
                      <ActualCell value={l.actual[m] ?? null} onCommit={(v) => setActual(l.id, m, v)} />
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={13} className="py-8 text-center text-muted-foreground">Aucune ligne pour ces filtres.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Montants réels en DH. Budget affiché en milliers (k). Exemple de format : 125 000 ou 125000,50.</p>
      </Panel>
    </div>
  );
}

function ActualCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : String(value));
  const invalid = text !== null && text.trim() !== "" && parseAmount(text) === null;
  return (
    <input
      value={shown}
      inputMode="decimal"
      aria-label="Montant réel"
      title={value !== null ? fmt(value) : "Non saisi"}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text === null) return;
        if (text.trim() === "") onCommit(null);
        else { const v = parseAmount(text); if (v === null) return; onCommit(v); }
        setText(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("h-7 w-full min-w-[72px] rounded border-2 border-primary/40 bg-card px-1.5 text-right text-foreground outline-none focus:border-primary", invalid && "border-destructive")}
    />
  );
}
