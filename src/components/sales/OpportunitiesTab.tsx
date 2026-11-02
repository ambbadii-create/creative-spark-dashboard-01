import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field, Select, fmt } from "@/components/budget/ui";
import { sid } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import { conversionRate, round2, weightedPipeline, SALES_REPS, STAGES, STAGE_PROBA, type Opportunity, type Stage } from "@/lib/sales/model";
import { fdate, StageBadge, TextArea } from "./ui";

export function OpportunitiesTab() {
  const { opportunities, customers } = useSales();
  const [editing, setEditing] = useState<Opportunity | "new" | null>(null);
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const conv = conversionRate(opportunities);
  const won = opportunities.filter((o) => o.stage === "Gagnée").reduce((a, o) => a + o.value, 0);
  const lost = opportunities.filter((o) => o.stage === "Perdue").reduce((a, o) => a + o.value, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-elevated p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pipeline pondéré</p>
          <p className="mt-2 font-display text-xl font-extrabold text-foreground">{fmt(weightedPipeline(opportunities))}</p>
          <p className="mt-1 text-xs text-muted-foreground">Σ valeur × probabilité (opportunités ouvertes)</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Taux de conversion</p>
          <p className="mt-2 font-display text-xl font-extrabold text-foreground">{conv === null ? "n.c." : `${conv} %`}</p>
          <p className="mt-1 text-xs text-muted-foreground">Gagnées / opportunités qualifiées</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Gagné / perdu</p>
          <p className="mt-2 font-display text-xl font-extrabold text-foreground">{fmt(won)} <span className="text-sm font-semibold text-muted-foreground">/ {fmt(lost)}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Valeur des opportunités clôturées</p>
        </div>
      </div>

      <Panel title="Pipeline commercial" subtitle="Cliquez sur une opportunité pour la modifier ou changer d'étape" action={<Btn onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouvelle opportunité</Btn>}>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((s) => {
            const list = opportunities.filter((o) => o.stage === s);
            const value = list.reduce((a, o) => a + o.value, 0);
            return (
              <div key={s} className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <StageBadge s={s} />
                  <span className="text-[11px] text-muted-foreground">{list.length} · {fmt(value)}</span>
                </div>
                <ul className="space-y-2">
                  {list.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => setEditing(o)} className="w-full rounded-lg border border-border bg-card p-2.5 text-left shadow-sm transition-colors hover:border-ring">
                        <p className="text-xs font-semibold text-foreground">{o.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{cName(o.customerId)}</p>
                        <p className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-foreground">{fmt(o.value)}</span>
                          <span className="text-muted-foreground">{o.probability} % · {fdate(o.expectedClose)}</span>
                        </p>
                      </button>
                    </li>
                  ))}
                  {list.length === 0 && <li className="py-3 text-center text-[11px] text-muted-foreground">—</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </Panel>

      {editing && <OpportunityDialog opportunity={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OpportunityDialog({ opportunity, onClose }: { opportunity?: Opportunity | undefined; onClose: () => void }) {
  const { opportunities, customers, upsertOpportunity } = useSales();
  const [f, setF] = useState<Opportunity & { notes: string }>(
    () => ({
      notes: "",
      ...(opportunity ?? {
        id: sid("O"), number: `OPP-2026-${String(opportunities.length + 101).padStart(3, "0")}`, customerId: customers[0]?.id ?? "",
        title: "", stage: "Prospection" as Stage, value: 0, probability: STAGE_PROBA.Prospection, expectedClose: new Date().toISOString().slice(0, 10), salesRep: SALES_REPS[0]!,
      }),
    }),
  );
  const [err, setErr] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return setErr("L'intitulé est obligatoire.");
    if (!f.customerId) return setErr("Sélectionnez un client ou prospect.");
    if (!Number.isFinite(f.value) || f.value <= 0) return setErr("La valeur estimée doit être supérieure à zéro.");
    const { notes: _n, ...opp } = f;
    upsertOpportunity({ ...opp, title: f.title.trim() });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{opportunity ? `${opportunity.number} · ${opportunity.title}` : "Nouvelle opportunité"}</DialogTitle>
          <DialogDescription>La probabilité suit l'étape du pipeline (modifiable).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Intitulé *" value={f.title} onChange={(e) => set("title", e.target.value)} className="col-span-2" />
            <Select label="Client / prospect *" value={f.customerId} onChange={(e) => set("customerId", e.target.value)}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </Select>
            <Select label="Commercial" value={f.salesRep} onChange={(e) => set("salesRep", e.target.value)}>
              {SALES_REPS.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Étape" value={f.stage} onChange={(e) => {
              const stage = e.target.value as Stage;
              setF((x) => ({ ...x, stage, probability: STAGE_PROBA[stage] }));
            }}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Field label="Probabilité (%)" type="number" min={0} max={100} value={f.probability} onChange={(e) => set("probability", round2(Number(e.target.value)))} />
            <Field label="Valeur estimée (HT)" type="number" min={0} value={f.value} onChange={(e) => set("value", Number(e.target.value))} />
            <Field label="Clôture prévue" type="date" value={f.expectedClose} onChange={(e) => set("expectedClose", e.target.value)} />
            <TextArea label="Notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} className="col-span-2" />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">{opportunity ? "Enregistrer" : "Créer l'opportunité"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
