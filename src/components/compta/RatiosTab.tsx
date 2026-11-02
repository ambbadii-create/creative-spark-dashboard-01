import { useMemo, useState } from "react";
import { Panel } from "@/components/app/ui-bits";
import { Select, fieldCls } from "@/components/budget/ui";
import { cn } from "@/lib/utils";
import { useCompta } from "@/lib/compta/store";
import { RATIOS, chiffreAffaires, computeRatios, fmtMad, fmtRatio, periodDays, type RatioFamily } from "@/lib/compta/model";
import { Note, Tag, useFin, type Period } from "./ui";

const FAMILIES: RatioFamily[] = ["Rentabilité", "Liquidité", "Solvabilité", "Gestion et efficacité"];

export function RatiosTab({ p }: { p: Period }) {
  const { vatRate, setVatRate, benchmarks, setBenchmark } = useCompta();
  const { n, n1 } = useFin(p);
  const [fam, setFam] = useState<RatioFamily | "all">("all");
  const days = periodDays(p.to);
  const cur = useMemo(() => computeRatios({ bal: n.bal, openBal: n.openBal, days, vatRate }), [n, days, vatRate]);
  const prev = useMemo(() => (n1.has ? computeRatios({ bal: n1.bal, openBal: n1.openBal, days, vatRate }) : null), [n1, days, vatRate]);
  const b = n.bilan;
  const support: Record<string, string> = {
    roe: `RN ${fmtMad(n.cpc.resultatNet, 0)} / CP ${fmtMad(b.capitauxPropres, 0)}`,
    roa: `RN ${fmtMad(n.cpc.resultatNet, 0)} / Actif ${fmtMad(b.totalActif, 0)}`,
    mEbe: `CA ${fmtMad(chiffreAffaires(n.bal), 0)}`, mOp: `RE ${fmtMad(n.cpc.resultatExploitation, 0)}`, mNet: `RN ${fmtMad(n.cpc.resultatNet, 0)}`,
    lg: `AC+TA ${fmtMad(b.actifCirculant + b.tresorerieActif, 0)} / DCT ${fmtMad(b.passifCirculant + b.tresoreriePassif, 0)}`,
    lr: `Stocks exclus ${fmtMad(b.stocks, 0)}`, li: `Trésorerie-actif ${fmtMad(b.tresorerieActif, 0)}`,
    af: `FP ${fmtMad(b.financementPermanent, 0)}`, ef: `Dettes fin. ${fmtMad(b.dettesFinancement, 0)}`, de: `CP ${fmtMad(b.capitauxPropres, 0)}`,
    dso: `Clients ${fmtMad(b.creancesClients, 0)} · ${days} j`, dpo: `Fournisseurs ${fmtMad(b.fournisseurs, 0)} · ${days} j`, rotS: `Stocks ${fmtMad(b.stocks, 0)}`, rotA: `Actif ${fmtMad(b.totalActif, 0)}`,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Famille" value={fam} onChange={(e) => setFam(e.target.value as "all")}><option value="all">Toutes</option>{FAMILIES.map((f) => <option key={f}>{f}</option>)}</Select>
        <label className="block text-xs font-medium text-muted-foreground"><span className="mb-1 block">Taux de TVA d'analyse (%)</span><input type="number" min={0} max={30} className={cn(fieldCls, "w-32")} value={vatRate} onChange={(e) => setVatRate(Number(e.target.value) || 0)} /></label>
        <p className="max-w-xl text-xs text-muted-foreground">Ratios de rentabilité calculés sur la période ({days} jours), non annualisés. Les références sont indicatives et modifiables : comparez-les à votre secteur.</p>
      </div>
      {FAMILIES.filter((f) => fam === "all" || fam === f).map((f) => (
        <Panel key={f} title={f}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {RATIOS.filter((r) => r.family === f).map((r) => {
              const v = cur[r.id] ?? null, pv = prev?.[r.id] ?? null;
              const bm = r.id in benchmarks ? benchmarks[r.id]! : r.benchmark;
              const evo = v !== null && pv !== null ? v - pv : null;
              const good = evo === null || Math.abs(evo) < 1e-6 ? null : r.higherIsBetter ? evo > 0 : evo < 0;
              const vsBm = v === null || bm === null ? null : r.higherIsBetter ? v >= bm : v <= bm;
              return (
                <div key={r.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{r.name}</p>
                    {vsBm !== null && <Tag tone={vsBm ? "good" : "warn"}>{vsBm ? "Conforme à la référence" : "Sous la référence"}</Tag>}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.formula}</p>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-extrabold">{fmtRatio(v, r.unit)}</span>
                    <span className={cn("text-xs font-semibold", good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive")}>
                      N-1 : {fmtRatio(pv, r.unit).replace("Données non disponibles", "n.d.")}{evo !== null && ` (${evo > 0 ? "+" : ""}${evo.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${r.unit === "%" ? " pt" : r.unit === "jours" ? " j" : ""})`}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{r.interpretation}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Données : {support[r.id]}</p>
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">Référence
                    <input type="number" step="0.1" className={cn(fieldCls, "h-7 w-24 text-xs")} value={bm ?? ""} placeholder="aucune" onChange={(e) => setBenchmark(r.id, e.target.value === "" ? null : Number(e.target.value))} />
                    {r.unit === "%" ? "%" : r.unit === "jours" ? "jours" : "x"}
                  </label>
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
      <Note>Un ratio dont le dénominateur est nul ou non disponible affiche « Données non disponibles » ; aucune valeur n'est remplacée par zéro.</Note>
    </div>
  );
}
