import { useCallback, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/app/ui-bits";
import { Select, thead, trow } from "@/components/budget/ui";
import { cn } from "@/lib/utils";
import { useCompta } from "@/lib/compta/store";
import { MONTHS, balances, chiffreAffaires, cpc, fmtK, fmtMad, fmtPct, safeDiv, sig, sigValue, variationPct, type Bal } from "@/lib/compta/model";
import { Amt, Note, SubNav, VarCells, num, useFin, type Period } from "./ui";

type Sub = "cpc" | "sig" | "caf" | "bilan" | "equilibre" | "comparatif";
const SUBS: { id: Sub; label: string }[] = [
  { id: "cpc", label: "Analyse du CPC" }, { id: "sig", label: "SIG" }, { id: "caf", label: "CAF" },
  { id: "bilan", label: "Analyse du bilan" }, { id: "equilibre", label: "Équilibre financier" }, { id: "comparatif", label: "Analyse comparative" },
];
const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }, formatter: (v: number) => fmtMad(v, 0) };
const pctOf = (a: number, b: number) => { const x = safeDiv(a, b); return x === null ? null : x * 100; };

export function AnalysisTab({ p }: { p: Period }) {
  const [sub, setSub] = useState<Sub>("sig");
  const { n, n1 } = useFin(p);
  const caN = chiffreAffaires(n.bal), caN1 = chiffreAffaires(n1.bal);

  return (
    <div className="space-y-4">
      <SubNav items={SUBS} value={sub} onChange={setSub} />

      {sub === "cpc" && (() => {
        const items = [
          { k: "Chiffre d'affaires", c: caN, pv: caN1 },
          { k: "Valeur ajoutée", c: sigValue(n.sig, "va"), pv: sigValue(n1.sig, "va") },
          { k: "EBE", c: sigValue(n.sig, "ebe"), pv: sigValue(n1.sig, "ebe") },
          { k: "Résultat d'exploitation", c: n.cpc.resultatExploitation, pv: n1.cpc.resultatExploitation },
          { k: "Résultat financier", c: n.cpc.resultatFinancier, pv: n1.cpc.resultatFinancier },
          { k: "Résultat courant", c: n.cpc.resultatCourant, pv: n1.cpc.resultatCourant },
          { k: "Résultat net", c: n.cpc.resultatNet, pv: n1.cpc.resultatNet },
        ];
        const margins = [
          { k: "Taux de valeur ajoutée", c: pctOf(sigValue(n.sig, "va"), caN), pv: pctOf(sigValue(n1.sig, "va"), caN1) },
          { k: "Marge d'EBE", c: pctOf(sigValue(n.sig, "ebe"), caN), pv: pctOf(sigValue(n1.sig, "ebe"), caN1) },
          { k: "Marge opérationnelle", c: pctOf(n.cpc.resultatExploitation, caN), pv: pctOf(n1.cpc.resultatExploitation, caN1) },
          { k: "Marge nette", c: pctOf(n.cpc.resultatNet, caN), pv: pctOf(n1.cpc.resultatNet, caN1) },
        ];
        const g = variationPct(caN, caN1);
        return (
          <div className="grid gap-5 xl:grid-cols-3">
            <Panel title="Indicateurs de résultat" subtitle={`Croissance du CA : ${n1.has ? fmtPct(g) : "n.d."}`} className="xl:col-span-2">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={items.map((i) => ({ k: i.k, N: i.c, "N-1": n1.has ? i.pv : null }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="k" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)} M`} />
                    <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="N-1" fill="var(--muted-foreground)" fillOpacity={0.3} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="N" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead className={thead}><tr><th className="py-2.5 pr-3">Indicateur</th><th className={num + " pr-3"}>N</th><th className={num + " pr-3"}>N-1</th><th className={num + " pr-3"}>Écart</th><th className={num + " pr-3"}>%</th></tr></thead>
                <tbody>{items.map((i) => <tr key={i.k} className={trow}><td className="py-2 pr-3">{i.k}</td><Amt v={i.c} /><Amt v={n1.has ? i.pv : null} /><VarCells cur={i.c} prev={i.pv} hasPrev={n1.has} /></tr>)}</tbody>
              </table>
            </Panel>
            <Panel title="Marges" subtitle="En % du chiffre d'affaires">
              <ul className="space-y-3">
                {margins.map((m) => {
                  const d = m.c !== null && m.pv !== null && n1.has ? m.c - m.pv : null;
                  return (
                    <li key={m.k} className="border-b border-border pb-2 last:border-0">
                      <div className="flex items-baseline justify-between"><span className="text-sm">{m.k}</span><span className="font-display text-lg font-bold">{fmtPct(m.c).replace("+", "")}</span></div>
                      <p className={cn("text-xs", d === null ? "text-muted-foreground" : d >= 0 ? "text-success" : "text-destructive")}>{d === null ? "N-1 n.d." : `${d >= 0 ? "+" : ""}${d.toFixed(1)} pt vs N-1 (${fmtPct(m.pv).replace("+", "")})`}</p>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3"><Note>Lecture : une marge d'EBE stable avec une marge nette en baisse indique un effet des dotations, des charges financières ou de l'impôt plutôt qu'une dégradation de l'exploitation.</Note></div>
            </Panel>
          </div>
        );
      })()}

      {sub === "sig" && (
        <Panel title="Soldes intermédiaires de gestion (CGNC)" subtitle="Formation du résultat — N vs N-1, avec formule de calcul">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={thead}><tr><th className="py-2.5 pr-3">Solde</th><th className="pr-3">Formule</th><th className={num + " pr-3"}>N</th><th className={num + " pr-3"}>N-1</th><th className={num + " pr-3"}>Écart</th><th className={num + " pr-3"}>%</th></tr></thead>
              <tbody>
                {n.sig.map((l, i) => (
                  <tr key={l.key} className={cn(trow, l.total && "bg-muted/50 font-semibold")}>
                    <td className={cn("py-2 pr-3", !l.total && "pl-4 text-muted-foreground")}>{l.label}</td>
                    <td className="pr-3 font-mono text-[11px] text-muted-foreground">{l.formula}</td>
                    <Amt v={l.value} /><Amt v={n1.has ? n1.sig[i]!.value : null} /><VarCells cur={l.value} prev={n1.sig[i]!.value} hasPrev={n1.has} inverse={l.label.startsWith("−")} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><Note>EBE et EBITDA : l'EBE marocain se calcule après impôts et taxes (616) et avant dotations (619). L'EBITDA anglo-saxon part du résultat d'exploitation et y réintègre les dotations ; il inclut généralement les autres produits et charges d'exploitation (718/618). L'écart entre les deux sur la période : {fmtMad(n.cpc.resultatExploitation + sigValue(n.sig, "dotations") - sigValue(n.sig, "reprises") - sigValue(n.sig, "ebe"), 0)}.</Note></div>
        </Panel>
      )}

      {sub === "caf" && (
        <Panel title="Capacité d'autofinancement" subtitle="CAF = Résultat net + charges non décaissables − produits non encaissables ± retraitements de cessions">
          <table className="w-full text-sm">
            <thead className={thead}><tr><th className="py-2.5 pr-3">Élément</th><th className="pr-3">Comptes</th><th className={num + " pr-3"}>N</th><th className={num + " pr-3"}>N-1</th></tr></thead>
            <tbody>
              {n.caf.items.map((l, i) => <tr key={l.label} className={trow}><td className="py-2 pr-3">{l.sign > 0 ? "+" : "−"} {l.label}</td><td className="pr-3 font-mono text-xs text-muted-foreground">{l.formula}</td><Amt v={l.value} /><Amt v={n1.has ? n1.caf.items[i]!.value : null} /></tr>)}
              <tr className="bg-muted/60 font-bold"><td className="py-2 pr-3" colSpan={2}>CAF</td><Amt v={n.caf.caf} /><Amt v={n1.has ? n1.caf.caf : null} /></tr>
            </tbody>
          </table>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Note>CAF / CA : {fmtPct(pctOf(n.caf.caf, caN)).replace("+", "")} — part du chiffre d'affaires disponible pour financer investissements et remboursements.</Note>
            <Note>Couverture des remboursements d'emprunts : {(() => { const r = safeDiv(n.caf.caf, 100_000 * (p.to + 1)); return r === null ? "n.d." : `${r.toFixed(1)} x`; })()} (échéances en capital de la période).</Note>
          </div>
        </Panel>
      )}

      {sub === "bilan" && (() => {
        const b = n.bilan, c = n1.bilan;
        const rows = [
          { k: "Actif immobilisé", v: b.actifImmobilise, pv: c.actifImmobilise, base: b.totalActif, side: "Actif" },
          { k: "Actif circulant", v: b.actifCirculant, pv: c.actifCirculant, base: b.totalActif, side: "Actif" },
          { k: "Trésorerie-actif", v: b.tresorerieActif, pv: c.tresorerieActif, base: b.totalActif, side: "Actif" },
          { k: "Capitaux propres", v: b.capitauxPropres, pv: c.capitauxPropres, base: b.totalPassif, side: "Passif" },
          { k: "Dettes de financement", v: b.dettesFinancement, pv: c.dettesFinancement, base: b.totalPassif, side: "Passif" },
          { k: "Passif circulant", v: b.passifCirculant, pv: c.passifCirculant, base: b.totalPassif, side: "Passif" },
          { k: "Trésorerie-passif", v: b.tresoreriePassif, pv: c.tresoreriePassif, base: b.totalPassif, side: "Passif" },
        ];
        return (
          <Panel title="Analyse du bilan" subtitle="Structure de l'actif et du financement — poids et évolution">
            <table className="w-full text-sm">
              <thead className={thead}><tr><th className="py-2.5 pr-3">Masse</th><th className="pr-3">Côté</th><th className={num + " pr-3"}>N</th><th className={num + " pr-3"}>% du total</th><th className={num + " pr-3"}>N-1</th><th className={num + " pr-3"}>Écart</th><th className={num + " pr-3"}>%</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.k} className={trow}><td className="py-2 pr-3 font-medium">{r.k}</td><td className="pr-3 text-muted-foreground">{r.side}</td><Amt v={r.v} /><td className={num + " pr-3"}>{fmtPct(pctOf(r.v, r.base)).replace("+", "")}</td><Amt v={n1.has ? r.pv : null} /><VarCells cur={r.v} prev={r.pv} hasPrev={n1.has} inverse={r.side === "Passif" && r.k !== "Capitaux propres"} /></tr>)}</tbody>
            </table>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Note>Couverture des immobilisations par les capitaux propres : {fmtPct(pctOf(b.capitauxPropres, b.actifImmobilise)).replace("+", "")}</Note>
              <Note>Financement permanent / actif immobilisé : {fmtPct(pctOf(b.financementPermanent, b.actifImmobilise)).replace("+", "")} {b.financementPermanent >= b.actifImmobilise ? "— règle d'équilibre respectée" : "— règle d'équilibre non respectée"}</Note>
              <Note>Taux de vétusté des immobilisations : {fmtPct(pctOf(b.amortissements, b.immoBrut)).replace("+", "")}</Note>
            </div>
          </Panel>
        );
      })()}

      {sub === "equilibre" && (() => {
        const b = n.bilan;
        if (!n.eq) return <Panel title="Équilibre financier"><Note tone="bad">Calcul non fiable : comptes non classés ({b.unclassified.join(", ")}). Complétez le plan comptable.</Note></Panel>;
        const blocks = [
          { k: "FRNG", formula: "Financement permanent − Actif immobilisé", parts: [["Financement permanent", b.financementPermanent], ["− Actif immobilisé net", -b.actifImmobilise]], v: n.eq.frng, pv: n1.eq?.frng ?? null },
          { k: "BFR", formula: "Actif circulant hors trésorerie − Passif circulant hors trésorerie", parts: [["Actif circulant (classe 3)", b.actifCirculant], ["− Passif circulant (classe 4)", -b.passifCirculant]], v: n.eq.bfr, pv: n1.eq?.bfr ?? null },
          { k: "Trésorerie nette", formula: "FRNG − BFR (= Trésorerie-actif − Trésorerie-passif)", parts: [["Trésorerie-actif (51)", b.tresorerieActif], ["− Trésorerie-passif (55)", -b.tresoreriePassif]], v: n.eq.tn, pv: n1.eq?.tn ?? null },
        ] as const;
        return (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              {blocks.map((x) => (
                <Panel key={x.k} title={x.k} subtitle={x.formula}>
                  <ul className="space-y-1.5 text-sm">{x.parts.map(([l, v]) => <li key={l} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="tabular-nums">{fmtMad(v as number)}</span></li>)}</ul>
                  <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2"><span className="font-semibold">{x.k}</span><span className="font-display text-lg font-bold tabular-nums">{fmtK(x.v)}</span></div>
                  <p className="text-xs text-muted-foreground">N-1 : {n1.has ? fmtK(x.pv) : "n.d."}</p>
                </Panel>
              ))}
            </div>
            <Note tone={n.eq.coherent ? "good" : "bad"}>
              {n.eq.coherent ? `Contrôle : FRNG (${fmtK(n.eq.frng)}) − BFR (${fmtK(n.eq.bfr)}) = trésorerie nette (${fmtK(n.eq.tn)}).` : "Incohérence : FRNG − BFR ≠ trésorerie nette."}{" "}
              BFR en jours de CA : {(() => { const r = safeDiv(n.eq.bfr, caN); return r === null ? "n.d." : `${Math.round(r * 365 * 12 / (p.to + 1) / 12)} j`; })()}.
              {n.eq.frng > n.eq.bfr ? " Le fonds de roulement finance intégralement le BFR : trésorerie positive." : " Le BFR excède le fonds de roulement : recours au financement court terme."}
            </Note>
          </div>
        );
      })()}

      {sub === "comparatif" && <Comparative p={p} />}
    </div>
  );
}

function Comparative({ p }: { p: Period }) {
  const { entries } = useCompta();
  const [grain, setGrain] = useState<"mois" | "trimestre">("mois");
  const [ind, setInd] = useState<"ca" | "ebe" | "rex" | "rn">("ca");
  const pick = useCallback((b: Bal) => (ind === "ca" ? chiffreAffaires(b) : ind === "ebe" ? sigValue(sig(b), "ebe") : ind === "rex" ? cpc(b).resultatExploitation : cpc(b).resultatNet), [ind]);
  const data = useMemo(() => {
    const has1 = entries.some((e) => e.date.startsWith(String(p.year - 1)));
    const buckets = grain === "mois" ? Array.from({ length: p.to + 1 }, (_, m) => ({ l: MONTHS[m]!, f: m, t: m })) : [0, 1, 2, 3].filter((q) => q * 3 <= p.to).map((q) => ({ l: `T${q + 1}`, f: q * 3, t: Math.min(q * 3 + 2, p.to) }));
    return buckets.map((b) => {
      const cur = pick(balances(entries, { year: p.year, from: b.f, to: b.t }));
      const prev = has1 ? pick(balances(entries, { year: p.year - 1, from: b.f, to: b.t })) : null;
      return { periode: b.l, N: cur, "N-1": prev, var: prev === null ? null : variationPct(cur, prev) };
    });
  }, [entries, p, grain, pick]);
  return (
    <Panel title="Analyse comparative" subtitle="N vs N-1 par mois ou par trimestre" action={<div className="flex gap-2">
      <Select value={ind} onChange={(e) => setInd(e.target.value as "ca")}><option value="ca">Chiffre d'affaires</option><option value="ebe">EBE</option><option value="rex">Résultat d'exploitation</option><option value="rn">Résultat net</option></Select>
      <Select value={grain} onChange={(e) => setGrain(e.target.value as "mois")}><option value="mois">Mensuel</option><option value="trimestre">Trimestriel</option></Select>
    </div>}>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="periode" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)} M`} />
            <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="N-1" fill="var(--muted-foreground)" fillOpacity={0.3} radius={[3, 3, 0, 0]} />
            <Bar dataKey="N" fill="var(--primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="mt-3 w-full text-sm">
        <thead className={thead}><tr><th className="py-2.5 pr-3">Période</th><th className={num + " pr-3"}>N</th><th className={num + " pr-3"}>N-1</th><th className={num + " pr-3"}>Écart</th><th className={num + " pr-3"}>%</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.periode} className={trow}><td className="py-2 pr-3">{d.periode}</td><Amt v={d.N} /><Amt v={d["N-1"]} /><VarCells cur={d.N} prev={d["N-1"] ?? 0} hasPrev={d["N-1"] !== null} /></tr>)}</tbody>
      </table>
    </Panel>
  );
}
