import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Lock, LockOpen, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/app/ui-bits";
import { Btn, fieldCls, thead, trow } from "@/components/budget/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { can, useCompta } from "@/lib/compta/store";
import { MONTHS_LONG, balances, bilan, isBalanced, periodKey, trialBalance } from "@/lib/compta/model";
import { NoData, Note, Tag, num, type Period } from "./ui";

export function ClosingTab({ p }: { p: Period }) {
  const { entries, closed, audit, role, closePeriod, reopenPeriod } = useCompta();
  const [reopen, setReopen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const periods = Array.from({ length: 12 }, (_, m) => `${p.year}-${String(m + 1).padStart(2, "0")}`);
  const focus = `${p.year}-${String(p.to + 1).padStart(2, "0")}`;

  const stats = useMemo(() => {
    const inP = (k: string) => entries.filter((e) => periodKey(e.date) === k);
    return Object.fromEntries(periods.map((k) => {
      const es = inP(k);
      return [k, { n: es.length, drafts: es.filter((e) => e.status === "Brouillon").length, unbalanced: es.filter((e) => !isBalanced(e)).length, noRef: es.filter((e) => !e.ref).length }];
    }));
  }, [entries, periods]);

  const yearEntries = entries.filter((e) => e.date.startsWith(String(p.year)));
  const unbalanced = yearEntries.filter((e) => !isBalanced(e));
  const drafts = yearEntries.filter((e) => e.status === "Brouillon");
  const noRef = yearEntries.filter((e) => !e.ref);
  const unlettered = yearEntries.filter((e) => e.status === "Validée").flatMap((e) => e.lines.filter((l) => (l.account === "3421" || l.account === "4411") && !l.letter));
  const tb = trialBalance(entries, { year: p.year, to: p.to });
  const tbOk = Math.abs(tb.reduce((s, r) => s + r.closeD - r.closeC, 0)) < 0.01;
  const b = bilan(balances(entries, { year: p.year, to: p.to }));
  const st = stats[focus]!;

  const checklist = [
    { label: "Toutes les écritures de la période sont validées", ok: st.drafts === 0 },
    { label: "Aucune écriture déséquilibrée", ok: st.unbalanced === 0 },
    { label: "Pièces justificatives référencées", ok: st.noRef === 0, warn: true },
    { label: "Balance générale équilibrée", ok: tbOk },
    { label: "Bilan équilibré (actif = passif)", ok: Math.abs(b.totalActif - b.totalPassif) < 0.01 },
    { label: "Tous les comptes classés (mapping CGNC)", ok: b.unclassified.length === 0 },
    { label: "Comptes de tiers lettrés", ok: unlettered.length === 0, warn: true },
    { label: "Rapprochement bancaire (module Trésorerie)", ok: null as boolean | null },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { k: "Écritures déséquilibrées", v: unbalanced.length, bad: unbalanced.length > 0 },
          { k: "Écritures non validées", v: drafts.length, bad: drafts.length > 0 },
          { k: "Lignes de tiers non lettrées", v: unlettered.length, bad: false, warn: unlettered.length > 0 },
          { k: "Pièces justificatives manquantes", v: noRef.length, bad: false, warn: noRef.length > 0 },
          { k: "Périodes clôturées", v: `${periods.filter((k) => closed.includes(k)).length} / 12`, bad: false },
        ].map((x) => (
          <div key={x.k} className="card-elevated p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{x.k}</p>
            <p className={cn("mt-2 font-display text-xl font-extrabold", x.bad && "text-destructive", x.warn && "text-warning")}>{x.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Périodes comptables" subtitle={`Exercice ${p.year} — rôle actuel : ${role}`} className="xl:col-span-2">
          <table className="w-full text-sm">
            <thead className={thead}><tr><th className="py-2.5 pr-3">Période</th><th className={num + " pr-3"}>Écritures</th><th className={num + " pr-3"}>Brouillons</th><th className={num + " pr-3"}>Sans pièce</th><th className="pr-3">Statut</th><th /></tr></thead>
            <tbody>
              {periods.map((k, m) => {
                const s = stats[k]!, isC = closed.includes(k);
                return (
                  <tr key={k} className={cn(trow, k === focus && "bg-accent/40")}>
                    <td className="py-2 pr-3 capitalize">{MONTHS_LONG[m]} {p.year}</td>
                    <td className={num + " pr-3"}>{s.n || "—"}</td><td className={num + " pr-3"}>{s.drafts || "—"}</td><td className={num + " pr-3"}>{s.noRef || "—"}</td>
                    <td className="pr-3">{isC ? <Tag tone="primary"><Lock className="mr-1 h-3 w-3" />Clôturée</Tag> : s.n ? <Tag tone="warn">Ouverte</Tag> : <Tag>Sans écriture</Tag>}</td>
                    <td className="py-1 text-right">
                      {s.n > 0 && can(role, "cloturer") && (isC
                        ? <Btn variant="ghost" className="h-7 text-xs" onClick={() => { setReopen(k); setReason(""); }}><LockOpen className="h-3.5 w-3.5" />Rouvrir</Btn>
                        : <Btn className="h-7 text-xs" onClick={() => { const err = closePeriod(k); err ? toast.error(err) : toast.success(`Période ${k} clôturée`); }}><Lock className="h-3.5 w-3.5" />Clôturer</Btn>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!can(role, "cloturer") && <div className="mt-3"><Note>La clôture et la réouverture sont réservées au directeur financier (changez de rôle dans les filtres pour tester).</Note></div>}
        </Panel>

        <Panel title="Check-list de clôture" subtitle={`Période ${MONTHS_LONG[p.to]} ${p.year}`}>
          <ul className="space-y-2.5 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                {c.ok === null ? <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className={cn("mt-0.5 h-4 w-4 shrink-0", c.warn ? "text-warning" : "text-destructive")} />}
                <span>{c.label}{c.ok === null && <span className="block text-xs text-muted-foreground">Données non disponibles — relève du module Trésorerie.</span>}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {(unbalanced.length > 0 || drafts.length > 0) && (
        <Panel title="Anomalies à traiter" subtitle="Écritures bloquant la clôture">
          <table className="w-full text-sm">
            <thead className={thead}><tr><th className="py-2.5 pr-3">Pièce</th><th className="pr-3">Date</th><th className="pr-3">Libellé</th><th className="pr-3">Anomalie</th></tr></thead>
            <tbody>
              {[...new Set([...unbalanced, ...drafts])].map((e) => (
                <tr key={e.id} className={trow}><td className="py-2 pr-3 font-mono text-xs">{e.piece}</td><td className="pr-3">{new Date(e.date).toLocaleDateString("fr-FR")}</td><td className="pr-3">{e.label}</td>
                  <td className="pr-3 space-x-1">{!isBalanced(e) && <Tag tone="bad">Déséquilibrée</Tag>}{e.status === "Brouillon" && <Tag tone="warn">Non validée</Tag>}{!e.ref && <Tag tone="warn">Sans pièce</Tag>}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel title="Piste d'audit" subtitle="Actions enregistrées : création, modification, validation, lettrage, clôture et réouverture">
        {audit.length === 0 ? <NoData>Aucune action enregistrée depuis le chargement des données de démonstration.</NoData> : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className={cn(thead, "sticky top-0 bg-card")}><tr><th className="py-2.5 pr-3">Date et heure</th><th className="pr-3">Rôle</th><th className="pr-3">Action</th><th className="pr-3">Détail</th></tr></thead>
              <tbody>{audit.map((a) => <tr key={a.id} className={trow}><td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{new Date(a.at).toLocaleString("fr-FR")}</td><td className="pr-3">{a.role}</td><td className="pr-3 font-medium">{a.action}</td><td className="pr-3">{a.detail}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>

      {reopen && (
        <Dialog open onOpenChange={(o) => !o && setReopen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rouvrir la période {reopen}</DialogTitle><DialogDescription>La réouverture est tracée dans la piste d'audit. Indiquez un motif précis.</DialogDescription></DialogHeader>
            <textarea className={cn(fieldCls, "h-24 py-2")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : correction d'une facture fournisseur reçue tardivement" />
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setReopen(null)}>Annuler</Btn>
              <Btn onClick={() => { const err = reopenPeriod(reopen, reason); if (err) toast.error(err); else { toast.success(`Période ${reopen} rouverte`); setReopen(null); } }}>Confirmer la réouverture</Btn>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
