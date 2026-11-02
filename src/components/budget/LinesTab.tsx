import { useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { CATEGORIES, CENTRES, MONTHS, categoryLabel, centreLabel, lineStats, parseAmount, type Budget, type BudgetLine, type Category } from "@/lib/budget/model";
import { uid, useBudgets } from "@/lib/budget/store";
import { Btn, Field, Select, SortTh, fmt, sortBy, thead, trow, type Sort } from "./ui";

type Draft = { id?: string; budgetId: string; category: Category; label: string; months: string[]; actual?: (number | null)[] };

export function LinesTab({ lines, year }: { lines: BudgetLine[]; year: number }) {
  const { budgets, addBudget, upsertLine, deleteLine } = useBudgets();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort<"label" | "centre" | "cat" | "total">>({ key: "total", dir: -1 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newBudget, setNewBudget] = useState<{ year: string; centre: string; error?: string | undefined } | null>(null);
  const [toDelete, setToDelete] = useState<BudgetLine | null>(null);

  const yearBudgets = budgets.filter((b) => b.year === year);
  const bOf = (l: BudgetLine) => budgets.find((b) => b.id === l.budgetId);
  const rows = sortBy(
    lines.filter((l) => `${l.label} ${centreLabel(bOf(l)?.centre ?? "")} ${categoryLabel(l.category)}`.toLowerCase().includes(q.toLowerCase())),
    (l) => (sort.key === "label" ? l.label : sort.key === "centre" ? centreLabel(bOf(l)?.centre ?? "") : sort.key === "cat" ? categoryLabel(l.category) : lineStats(l).budgetYear),
    sort.dir,
  );

  const openNew = () =>
    setDraft({ budgetId: yearBudgets[0]?.id ?? "", category: "achats", label: "", months: Array(12).fill("") });
  const openEdit = (l: BudgetLine) =>
    setDraft({ id: l.id, budgetId: l.budgetId, category: l.category, label: l.label, months: l.budget.map(String), actual: l.actual });

  return (
    <div className="space-y-6">
      <Panel
        title={`Budgets ${year}`}
        subtitle="Un budget par exercice et par centre de coûts"
        action={<Btn variant="ghost" onClick={() => setNewBudget({ year: String(year), centre: CENTRES[0]!.id })}><Plus className="h-4 w-4" />Nouveau budget</Btn>}
      >
        <div className="flex flex-wrap gap-2">
          {yearBudgets.length === 0 && <p className="text-sm text-muted-foreground">Aucun budget pour cet exercice.</p>}
          {yearBudgets.map((b) => (
            <span key={b.id} className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
              {centreLabel(b.centre)} · {budgetsLineCount(b, lines)} ligne(s)
            </span>
          ))}
        </div>
      </Panel>

      <Panel
        title="Lignes budgétaires"
        subtitle={`${rows.length} ligne(s) — montants budgétés annuels`}
        action={<Btn onClick={openNew} disabled={yearBudgets.length === 0}><Plus className="h-4 w-4" />Ajouter une ligne</Btn>}
      >
        <SearchBox value={q} onChange={setQ} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={thead}>
              <SortTh k="label" sort={sort} setSort={setSort}>Libellé</SortTh>
              <SortTh k="centre" sort={sort} setSort={setSort}>Centre</SortTh>
              <SortTh k="cat" sort={sort} setSort={setSort}>Catégorie</SortTh>
              <SortTh k="total" sort={sort} setSort={setSort} right>Budget annuel</SortTh>
              <th className="py-2.5 text-right font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className={trow}>
                  <td className="py-2.5 pr-3 font-medium text-foreground">{l.label}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{centreLabel(bOf(l)?.centre ?? "")}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{categoryLabel(l.category)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-foreground">{fmt(lineStats(l).budgetYear)}</td>
                  <td className="py-2.5 text-right">
                    <button aria-label="Modifier" onClick={() => openEdit(l)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button aria-label="Supprimer" onClick={() => setToDelete(l)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Aucune ligne ne correspond.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {draft && <LineDialog draft={draft} budgets={yearBudgets} onClose={() => setDraft(null)} onSave={(l) => { upsertLine(l); setDraft(null); }} />}

      <Dialog open={!!newBudget} onOpenChange={(o) => !o && setNewBudget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau budget</DialogTitle><DialogDescription>Choisissez l'exercice et le centre de coûts.</DialogDescription></DialogHeader>
          {newBudget && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const y = Number(newBudget.year);
                if (!Number.isInteger(y) || y < 2000 || y > 2100) return setNewBudget({ ...newBudget, error: "Exercice invalide (ex. 2027)." });
                if (budgets.some((b) => b.year === y && b.centre === newBudget.centre)) return setNewBudget({ ...newBudget, error: "Un budget existe déjà pour ce centre et cet exercice." });
                addBudget({ year: y, centre: newBudget.centre });
                setNewBudget(null);
              }}
            >
              <Field label="Exercice *" value={newBudget.year} onChange={(e) => setNewBudget({ ...newBudget, year: e.target.value, error: undefined })} inputMode="numeric" />
              <Select label="Centre de coûts *" value={newBudget.centre} onChange={(e) => setNewBudget({ ...newBudget, centre: e.target.value, error: undefined })}>
                {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
              {newBudget.error && <p className="text-sm text-destructive">{newBudget.error}</p>}
              <div className="flex justify-end gap-2"><Btn type="button" variant="ghost" onClick={() => setNewBudget(null)}>Annuler</Btn><Btn type="submit">Créer</Btn></div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer la ligne ?</DialogTitle><DialogDescription>« {toDelete?.label} » sera supprimée avec ses montants réalisés et ses actions correctives.</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setToDelete(null)}>Annuler</Btn><Btn variant="danger" onClick={() => { deleteLine(toDelete!.id); setToDelete(null); }}>Supprimer</Btn></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const budgetsLineCount = (b: Budget, lines: BudgetLine[]) => lines.filter((l) => l.budgetId === b.id).length;

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex max-w-xs items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Rechercher…" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
    </div>
  );
}

function LineDialog({ draft, budgets, onClose, onSave }: { draft: Draft; budgets: Budget[]; onClose: () => void; onSave: (l: BudgetLine) => void }) {
  const [d, setD] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!d.label.trim()) errs["label"] = "Libellé obligatoire.";
    if (!d.budgetId) errs["budgetId"] = "Budget obligatoire.";
    const amounts = d.months.map((m) => parseAmount(m === "" ? "0" : m));
    amounts.forEach((a, i) => { if (a === null) errs[`m${i}`] = "Montant invalide"; });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({ id: d.id ?? uid("L"), budgetId: d.budgetId, category: d.category, label: d.label.trim(), budget: amounts as number[], actual: d.actual ?? Array(12).fill(null) });
  };
  const fillAll = () => set({ months: Array(12).fill(d.months[0] ?? "") });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{d.id ? "Modifier la ligne budgétaire" : "Nouvelle ligne budgétaire"}</DialogTitle><DialogDescription>Montants budgétés mensuels en DH, hors taxes.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Budget (centre) *" value={d.budgetId} onChange={(e) => set({ budgetId: e.target.value })}>
              {budgets.map((b) => <option key={b.id} value={b.id}>{centreLabel(b.centre)} {b.year}</option>)}
            </Select>
            <Select label="Catégorie *" value={d.category} onChange={(e) => set({ category: e.target.value as Category })}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.compte})</option>)}
            </Select>
            <Field label="Libellé *" value={d.label} error={errors["label"]} onChange={(e) => set({ label: e.target.value })} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Budget mensuel (DH)</p>
              <button type="button" onClick={fillAll} className="text-xs font-semibold text-primary hover:underline">Recopier janvier sur l'année</button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {MONTHS.map((m, i) => (
                <Field key={m} label={m} value={d.months[i]} error={errors[`m${i}`]} inputMode="decimal" onChange={(e) => set({ months: d.months.map((v, j) => (j === i ? e.target.value : v)) })} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2"><Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn><Btn type="submit">Enregistrer</Btn></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
