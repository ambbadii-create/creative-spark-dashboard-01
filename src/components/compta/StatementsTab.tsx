import { useMemo, useState, type ReactNode } from "react";
import { Download, Printer } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { Btn, thead, trow } from "@/components/budget/ui";
import { cn } from "@/lib/utils";
import { useCompta } from "@/lib/compta/store";
import { accountLabel, net, tableauFinancement, type Bal } from "@/lib/compta/model";
import { Amt, Note, SubNav, VarCells, downloadCsv, num, useFin, type Fin, type Period } from "./ui";

type Sub = "bilan" | "cpc" | "esg" | "tf" | "notes";
const SUBS: { id: Sub; label: string }[] = [
  { id: "bilan", label: "Bilan" }, { id: "cpc", label: "CPC" }, { id: "esg", label: "ESG" }, { id: "tf", label: "Tableau de financement" }, { id: "notes", label: "Notes & informations" },
];

type Row = { label: string; cur: number; prev: number; level?: 0 | 1 | 2; inverse?: boolean; prefixes?: string[]; sign?: 1 | -1 };

export function StatementsTab({ p }: { p: Period }) {
  const [sub, setSub] = useState<Sub>("bilan");
  const fin = useFin(p);
  return (
    <div className="space-y-4">
      <SubNav items={SUBS} value={sub} onChange={setSub} />
      {sub === "bilan" && <BilanView n={fin.n} n1={fin.n1} p={p} />}
      {sub === "cpc" && <CpcView n={fin.n} n1={fin.n1} p={p} />}
      {sub === "esg" && <EsgView n={fin.n} n1={fin.n1} p={p} />}
      {sub === "tf" && <TfView p={p} />}
      {sub === "notes" && <NotesView n={fin.n} p={p} />}
    </div>
  );
}

function Statement({ title, subtitle, rows, p, hasPrev, footer }: { title: string; subtitle: string; rows: Row[]; p: Period; hasPrev: boolean; footer?: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const fin = useFin(p);
  return (
    <Panel title={title} subtitle={subtitle} action={<div className="flex gap-2 print:hidden">
      <Btn variant="ghost" onClick={() => downloadCsv(`${title.toLowerCase().replace(/\W+/g, "-")}-${p.year}.csv`, ["Poste", `N (${p.year})`, `N-1 (${p.year - 1})`, "Écart", "Écart %"], rows.map((r) => [r.label, r.cur, r.prev, r.cur - r.prev, r.prev ? ((r.cur - r.prev) / Math.abs(r.prev)) * 100 : ""]))}><Download className="h-4 w-4" />Excel (CSV)</Btn>
      <Btn variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />PDF / Imprimer</Btn>
    </div>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={thead}><tr><th className="py-2.5 pr-3">Poste</th><th className={num + " pr-3"}>Exercice N</th><th className={num + " pr-3"}>Exercice N-1</th><th className={num + " pr-3"}>Écart</th><th className={num + " pr-3"}>Écart %</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <>
                <tr key={r.label} className={cn(trow, r.level === 0 && "bg-muted/60 font-bold", r.level === 1 && "font-semibold", r.prefixes && "cursor-pointer")} onClick={() => r.prefixes && setOpen(open === r.label ? null : r.label)}>
                  <td className={cn("py-2 pr-3", r.level === 2 && "pl-5 text-muted-foreground")}>{r.prefixes && <span className="mr-1 text-xs text-primary">{open === r.label ? "▾" : "▸"}</span>}{r.label}</td>
                  <Amt v={r.cur} /><Amt v={hasPrev ? r.prev : null} /><VarCells cur={r.cur} prev={r.prev} inverse={r.inverse} hasPrev={hasPrev} />
                </tr>
                {open === r.label && r.prefixes && <DrillRows prefixes={r.prefixes} sign={r.sign ?? 1} bal={fin.n.bal} prev={fin.n1.bal} hasPrev={hasPrev} />}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </Panel>
  );
}

function DrillRows({ prefixes, sign, bal, prev, hasPrev }: { prefixes: string[]; sign: 1 | -1; bal: Bal; prev: Bal; hasPrev: boolean }) {
  const accs = [...new Set([...bal.keys(), ...prev.keys()])].filter((a) => prefixes.some((p) => a.startsWith(p))).sort();
  return (
    <>
      {accs.map((a) => (
        <tr key={a} className="border-b border-border bg-accent/30 text-xs">
          <td className="py-1.5 pl-8 pr-3"><span className="font-mono font-semibold">{a}</span> {accountLabel(a)}</td>
          <Amt v={sign * net(bal, a)} /><Amt v={hasPrev ? sign * net(prev, a) : null} /><VarCells cur={sign * net(bal, a)} prev={sign * net(prev, a)} hasPrev={hasPrev} />
        </tr>
      ))}
    </>
  );
}

function BilanView({ n, n1, p }: { n: Fin; n1: Fin; p: Period }) {
  const b = n.bilan, c = n1.bilan;
  const actif: Row[] = [
    { label: "Actif immobilisé (net)", cur: b.actifImmobilise, prev: c.actifImmobilise, level: 1, prefixes: ["2"] },
    { label: "Immobilisations brutes", cur: b.immoBrut, prev: c.immoBrut, level: 2 },
    { label: "Amortissements", cur: -b.amortissements, prev: -c.amortissements, level: 2 },
    { label: "Actif circulant (hors trésorerie)", cur: b.actifCirculant, prev: c.actifCirculant, level: 1, prefixes: ["3"] },
    { label: "Stocks", cur: b.stocks, prev: c.stocks, level: 2 },
    { label: "Clients et comptes rattachés", cur: b.creancesClients, prev: c.creancesClients, level: 2 },
    { label: "Autres créances (État, …)", cur: b.autresCreances, prev: c.autresCreances, level: 2 },
    { label: "Trésorerie-actif", cur: b.tresorerieActif, prev: c.tresorerieActif, level: 1, prefixes: ["51"] },
    { label: "TOTAL ACTIF", cur: b.totalActif, prev: c.totalActif, level: 0 },
  ];
  const passif: Row[] = [
    { label: "Financement permanent", cur: b.financementPermanent, prev: c.financementPermanent, level: 1 },
    { label: "Capitaux propres (y.c. résultat en cours)", cur: b.capitauxPropres, prev: c.capitauxPropres, level: 2, prefixes: ["11"], sign: -1 },
    { label: "dont résultat net de la période", cur: b.resultatEnCours, prev: c.resultatEnCours, level: 2 },
    { label: "Dettes de financement", cur: b.dettesFinancement, prev: c.dettesFinancement, level: 2, inverse: true, prefixes: ["14"], sign: -1 },
    { label: "Passif circulant (hors trésorerie)", cur: b.passifCirculant, prev: c.passifCirculant, level: 1, inverse: true, prefixes: ["4"], sign: -1 },
    { label: "Fournisseurs et comptes rattachés", cur: b.fournisseurs, prev: c.fournisseurs, level: 2, inverse: true },
    { label: "Autres dettes (personnel, organismes sociaux, État)", cur: b.autresDettes, prev: c.autresDettes, level: 2, inverse: true },
    { label: "Trésorerie-passif", cur: b.tresoreriePassif, prev: c.tresoreriePassif, level: 1, inverse: true, prefixes: ["55"], sign: -1 },
    { label: "TOTAL PASSIF", cur: b.totalPassif, prev: c.totalPassif, level: 0 },
  ];
  const ok = Math.abs(b.totalActif - b.totalPassif) < 0.01;
  return (
    <div className="grid gap-5 2xl:grid-cols-2">
      <Statement title="Bilan — Actif" subtitle={`Valeurs nettes au ${new Date(p.year, p.to + 1, 0).toLocaleDateString("fr-FR")} vs même date N-1`} rows={actif} p={p} hasPrev={n1.has} />
      <Statement title="Bilan — Passif" subtitle="Présentation CGNC simplifiée (masses principales)" rows={passif} p={p} hasPrev={n1.has}
        footer={<Note tone={ok ? "good" : "bad"}>{ok ? "Contrôle : total actif = total passif." : `Bilan déséquilibré : écart de ${(b.totalActif - b.totalPassif).toFixed(2)} MAD.`} Le résultat de la période (classes 6 et 7 non encore soldées) est intégré aux capitaux propres.</Note>} />
    </div>
  );
}

function CpcView({ n, n1, p }: { n: Fin; n1: Fin; p: Period }) {
  const a = n.cpc, c = n1.cpc;
  const rows: Row[] = [
    { label: "I. Produits d'exploitation", cur: a.produitsExploitation, prev: c.produitsExploitation, level: 1, prefixes: ["71"], sign: -1 },
    { label: "II. Charges d'exploitation", cur: a.chargesExploitation, prev: c.chargesExploitation, level: 1, inverse: true, prefixes: ["61"] },
    { label: "III. Résultat d'exploitation (I − II)", cur: a.resultatExploitation, prev: c.resultatExploitation, level: 0 },
    { label: "IV. Produits financiers", cur: a.produitsFinanciers, prev: c.produitsFinanciers, level: 1, prefixes: ["73"], sign: -1 },
    { label: "V. Charges financières", cur: a.chargesFinancieres, prev: c.chargesFinancieres, level: 1, inverse: true, prefixes: ["63"] },
    { label: "VI. Résultat financier (IV − V)", cur: a.resultatFinancier, prev: c.resultatFinancier, level: 0 },
    { label: "VII. Résultat courant (III + VI)", cur: a.resultatCourant, prev: c.resultatCourant, level: 0 },
    { label: "VIII. Produits non courants", cur: a.produitsNonCourants, prev: c.produitsNonCourants, level: 1, prefixes: ["75"], sign: -1 },
    { label: "IX. Charges non courantes", cur: a.chargesNonCourantes, prev: c.chargesNonCourantes, level: 1, inverse: true, prefixes: ["65"] },
    { label: "X. Résultat non courant (VIII − IX)", cur: a.resultatNonCourant, prev: c.resultatNonCourant, level: 0 },
    { label: "XI. Résultat avant impôts (VII + X)", cur: a.resultatAvantImpots, prev: c.resultatAvantImpots, level: 0 },
    { label: "XII. Impôts sur les résultats", cur: a.impots, prev: c.impots, level: 1, inverse: true, prefixes: ["67"] },
    { label: "XIII. Résultat net (XI − XII)", cur: a.resultatNet, prev: c.resultatNet, level: 0 },
  ];
  return <Statement title="Compte de produits et charges (CPC)" subtitle="Cliquez sur une rubrique pour afficher le détail par compte" rows={rows} p={p} hasPrev={n1.has}
    footer={<Note>L'impôt de la période est une provision mensuelle estimée (taux de démonstration), non une liquidation fiscale.</Note>} />;
}

function EsgView({ n, n1, p }: { n: Fin; n1: Fin; p: Period }) {
  const rows: Row[] = n.sig.map((l, i) => ({ label: l.label, cur: l.value, prev: n1.sig[i]!.value, level: l.total ? 1 : 2, inverse: l.label.startsWith("−") }));
  const caf: Row[] = n.caf.items.map((l, i) => ({ label: `${l.sign > 0 ? "+" : "−"} ${l.label}`, cur: l.value, prev: n1.caf.items[i]!.value, level: 2 }));
  caf.push({ label: "Capacité d'autofinancement (CAF)", cur: n.caf.caf, prev: n1.caf.caf, level: 0 });
  return (
    <div className="space-y-5">
      <Statement title="ESG — Tableau de formation des résultats (TFR)" subtitle="Soldes de gestion selon le modèle CGNC" rows={rows} p={p} hasPrev={n1.has} />
      <Statement title="ESG — Capacité d'autofinancement (CAF)" subtitle="Méthode additive à partir du résultat net" rows={caf} p={p} hasPrev={n1.has} />
    </div>
  );
}

function TfView({ p }: { p: Period }) {
  const { entries } = useCompta();
  const tf = useMemo(() => tableauFinancement(entries, { year: p.year, to: p.to }), [entries, p]);
  const ok = tf.deltaFrBilan !== null && Math.abs(tf.deltaFrBilan - tf.variationFr) < 0.01;
  return (
    <Panel title="Tableau de financement" subtitle={`Emplois et ressources stables — du 1er janvier au ${new Date(p.year, p.to + 1, 0).toLocaleDateString("fr-FR")}`}>
      <div className="grid gap-6 lg:grid-cols-2">
        {[{ t: "Ressources stables", r: tf.ressources, tot: tf.totalRessources }, { t: "Emplois stables", r: tf.emplois, tot: tf.totalEmplois }].map((g) => (
          <table key={g.t} className="w-full text-sm">
            <thead className={thead}><tr><th className="py-2.5 pr-3">{g.t}</th><th className={num + " pr-3"}>Montant</th></tr></thead>
            <tbody>
              {g.r.map((r) => <tr key={r.label} className={trow}><td className="py-2 pr-3">{r.label}</td><Amt v={r.value} /></tr>)}
              <tr className="bg-muted/60 font-bold"><td className="py-2 pr-3">Total</td><Amt v={g.tot} /></tr>
            </tbody>
          </table>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Variation du fonds de roulement (ressources − emplois)</p><p className="mt-1 font-display text-lg font-bold tabular-nums">{tf.variationFr.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Variation du FRNG selon les bilans</p><p className="mt-1 font-display text-lg font-bold tabular-nums">{tf.deltaFrBilan === null ? "Données non disponibles" : `${tf.deltaFrBilan.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD`}</p></div>
      </div>
      <div className="mt-3"><Note tone={ok ? "good" : "warn"}>{ok ? "Contrôle : la variation du fonds de roulement est réconciliée avec les bilans d'ouverture et de clôture." : "La variation calculée ne se réconcilie pas avec les bilans : vérifier les mouvements des comptes de classe 1 et 2."}</Note></div>
    </Panel>
  );
}

function NotesView({ n, p }: { n: Fin; p: Period }) {
  const { entries, vatRate } = useCompta();
  const drafts = entries.filter((e) => e.status === "Brouillon" && e.date.startsWith(String(p.year))).length;
  const items = [
    { t: "Référentiel comptable", d: "Comptes tenus selon la nomenclature du CGNC (plan à 4 chiffres). Le mapping comptes → postes est réalisé par rubrique (classe et sous-classe) ; il doit être validé par l'expert-comptable avant publication des états de synthèse officiels." },
    { t: "Périmètre des données", d: `États établis à partir des écritures validées uniquement. ${drafts} écriture(s) en brouillon sur l'exercice ne sont pas prises en compte.` },
    { t: "Résultat de la période", d: `Résultat net provisoire de ${n.cpc.resultatNet.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD : les classes 6 et 7 ne sont pas soldées avant la clôture annuelle.` },
    { t: "Impôt sur les sociétés", d: "La charge d'IS est une provision mensuelle estimée. Le barème applicable, la cotisation minimale et les régularisations doivent être déterminés lors de la liquidation fiscale." },
    { t: "TVA", d: `Analyse des délais clients/fournisseurs fondée sur un taux de TVA de ${vatRate} % (paramétrable dans Ratios financiers). Les taux réels (20 %, 14 %, 10 %, 7 %) sont portés par les factures des modules Ventes et Achats.` },
    { t: "Engagements hors bilan", d: "Données non disponibles : aucun engagement (cautions, nantissements, crédit-bail) n'est saisi dans l'application." },
  ];
  return (
    <Panel title="Notes et informations complémentaires" subtitle="ETIC simplifié — éléments nécessaires à la lecture des états">
      <dl className="grid gap-3 md:grid-cols-2">
        {items.map((i) => <div key={i.t} className="rounded-lg border border-border p-3"><dt className="text-sm font-semibold">{i.t}</dt><dd className="mt-1 text-sm text-muted-foreground">{i.d}</dd></div>)}
      </dl>
    </Panel>
  );
}
