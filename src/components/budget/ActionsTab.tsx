import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { lineStats, varianceNature, varianceRate, type ActionStatus, type BudgetLine, type CorrectiveAction } from "@/lib/budget/model";
import { uid, useBudgets } from "@/lib/budget/store";
import { Btn, Field, Select, fmt, pct, thead, trow } from "./ui";
import { cn } from "@/lib/utils";

export const SIGNIFICANT = 5; // % d'écart défavorable

const STATUSES: ActionStatus[] = ["À lancer", "En cours", "Terminée"];

export function ActionsTab({ lines, centreOf }: { lines: BudgetLine[]; centreOf: (l: BudgetLine) => string }) {
  const { actions, upsertAction, deleteAction } = useBudgets();
  const [edit, setEdit] = useState<CorrectiveAction | null>(null);

  const significant = lines
    .map((l) => { const s = lineStats(l); const e = s.actual - s.budgetToDate; return { l, e, r: varianceRate(s.actual, s.budgetToDate) }; })
    .filter((x) => varianceNature(x.l.category, x.e) === "defavorable" && x.r !== null && Math.abs(x.r) >= SIGNIFICANT);
  const visible = actions.filter((a) => lines.some((l) => l.id === a.lineId));
  const lineOf = (id: string) => lines.find((l) => l.id === id);
  const blank = (lineId: string): CorrectiveAction => ({ id: uid("A"), lineId, cause: "", action: "", owner: "", deadline: "", status: "À lancer" });

  return (
    <div className="space-y-6">
      <Panel title="Écarts significatifs" subtitle={`Écarts défavorables d'au moins ${SIGNIFICANT} % sur le cumul à date`}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {significant.length === 0 && <p className="text-sm text-muted-foreground">Aucun écart significatif.</p>}
          {significant.map(({ l, e, r }) => {
            const n = actions.filter((a) => a.lineId === l.id).length;
            return (
              <div key={l.id} className="rounded-xl border border-destructive/25 bg-destructive-soft/50 p-4">
                <p className="text-sm font-semibold text-foreground">{l.label}</p>
                <p className="text-xs text-muted-foreground">{centreOf(l)}</p>
                <p className="mt-2 text-sm font-bold text-destructive">{e > 0 ? "+" : ""}{fmt(e)} <span className="font-medium">({r! > 0 ? "+" : ""}{pct(r)})</span></p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{n} action(s)</span>
                  <Btn variant="ghost" className="h-8 text-xs" onClick={() => setEdit(blank(l.id))}><Plus className="h-3.5 w-3.5" />Action</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Plan d'actions correctives" subtitle={`${visible.length} action(s)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={thead}>
              <th className="py-2.5 pr-3 font-medium">Ligne</th><th className="py-2.5 pr-3 font-medium">Cause</th><th className="py-2.5 pr-3 font-medium">Action corrective</th>
              <th className="py-2.5 pr-3 font-medium">Responsable</th><th className="py-2.5 pr-3 font-medium">Échéance</th><th className="py-2.5 pr-3 font-medium">Statut</th><th />
            </tr></thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id} className={trow}>
                  <td className="py-2.5 pr-3 font-medium text-foreground">{lineOf(a.lineId)?.label}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{a.cause}</td>
                  <td className="py-2.5 pr-3 text-foreground">{a.action}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{a.owner}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{new Date(a.deadline).toLocaleDateString("fr-FR")}</td>
                  <td className="py-2.5 pr-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", a.status === "Terminée" ? "bg-success-soft text-success" : a.status === "En cours" ? "bg-accent text-accent-foreground" : "bg-warning-soft text-foreground")}>{a.status}</span></td>
                  <td className="whitespace-nowrap py-2.5 text-right">
                    <button aria-label="Modifier" onClick={() => setEdit(a)} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button aria-label="Supprimer" onClick={() => deleteAction(a.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucune action enregistrée.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {edit && <ActionDialog action={edit} lines={lines} onClose={() => setEdit(null)} onSave={(a) => { upsertAction(a); setEdit(null); }} />}
    </div>
  );
}

function ActionDialog({ action, lines, onClose, onSave }: { action: CorrectiveAction; lines: BudgetLine[]; onClose: () => void; onSave: (a: CorrectiveAction) => void }) {
  const [a, setA] = useState(action);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (p: Partial<CorrectiveAction>) => setA({ ...a, ...p });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Action corrective</DialogTitle><DialogDescription>Documentez la cause de l'écart et le plan d'action.</DialogDescription></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const x: Record<string, string> = {};
            (["cause", "action", "owner", "deadline"] as const).forEach((k) => { if (!a[k].trim()) x[k] = "Champ obligatoire."; });
            setErr(x);
            if (!Object.keys(x).length) onSave(a);
          }}
        >
          <Select label="Ligne budgétaire" value={a.lineId} onChange={(e) => set({ lineId: e.target.value })}>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </Select>
          <Field label="Cause de l'écart *" value={a.cause} error={err["cause"]} onChange={(e) => set({ cause: e.target.value })} />
          <Field label="Action corrective *" value={a.action} error={err["action"]} onChange={(e) => set({ action: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsable *" value={a.owner} error={err["owner"]} onChange={(e) => set({ owner: e.target.value })} />
            <Field label="Échéance *" type="date" value={a.deadline} error={err["deadline"]} onChange={(e) => set({ deadline: e.target.value })} />
          </div>
          <Select label="Statut" value={a.status} onChange={(e) => set({ status: e.target.value as ActionStatus })}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <div className="flex justify-end gap-2 pt-2"><Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn><Btn type="submit">Enregistrer</Btn></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
