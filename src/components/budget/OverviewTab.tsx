import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Gauge, Scale, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import {
  CATEGORIES, CENTRES, MONTHS, achievementRate, forecastMonths, forecastYear, isRevenue, lineStats, sumStats,
  varianceNature, varianceRate, type BudgetLine, type Category,
} from "@/lib/budget/model";
import { useBudgets } from "@/lib/budget/store";
import { fmt, fmtM, pct, thead, trow } from "./ui";
import { SIGNIFICANT } from "./ActionsTab";
import { cn } from "@/lib/utils";

const tip = { contentStyle: { borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 } };
const mAxis = (v: number) => `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
const DONUT = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub?: ReactNode; tone?: "good" | "bad" | undefined }) {
  return (
    <div className="card-elevated flex items-start gap-3 p-4">
      <span className="rounded-lg bg-accent p-2 text-accent-foreground"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-1 truncate font-display text-xl font-extrabold text-foreground", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function OverviewTab({ lines, months, centreOf }: { lines: BudgetLine[]; months: number[]; centreOf: (l: BudgetLine) => string }) {
  const { actions } = useBudgets();
  const [scope, setScope] = useState<"charges" | "revenus">("charges");
  const scoped = lines.filter((l) => (scope === "revenus" ? isRevenue(l.category) : !isRevenue(l.category)));

  // ——— KPIs (périmètre sélectionné) ———
  const s = sumStats(scoped.map((l) => lineStats(l, months)));
  const ecart = s.actual - s.budgetToDate;
  const nature = varianceNature(scope === "revenus" ? "revenus" : "achats", ecart);
  const taux = achievementRate(s.actual, s.budgetToDate);
  const tEcart = varianceRate(s.actual, s.budgetToDate);

  // ——— Budget vs réalisé mensuel ———
  const monthly = months.map((m) => ({
    mois: MONTHS[m],
    budget: scoped.reduce((a, l) => a + (l.budget[m] ?? 0), 0),
    reel: scoped.some((l) => l.actual[m] != null) ? scoped.reduce((a, l) => a + (l.actual[m] ?? 0), 0) : null,
  }));

  // ——— Répartition budgétaire par centre de coûts (budget annuel) ———
  const byCentre = CENTRES.map((c) => ({
    name: c.label,
    value: scoped.filter((l) => centreOf(l) === c.id).reduce((a, l) => a + lineStats(l).budgetYear, 0),
  })).filter((x) => x.value > 0);
  const totalCentre = byCentre.reduce((a, x) => a + x.value, 0);

  // ——— Synthèse des écarts par catégorie ———
  const byCat = CATEGORIES.map((c) => {
    const gl = scoped.filter((l) => l.category === c.id);
    const st = sumStats(gl.map((l) => lineStats(l, months)));
    const e = st.actual - st.budgetToDate;
    return { id: c.id, label: c.label, budget: st.budgetToDate, actual: st.actual, ecart: e, taux: varianceRate(st.actual, st.budgetToDate), nature: varianceNature(c.id, e), n: gl.length };
  }).filter((x) => x.n > 0);

  // ——— Analyse par centre de coûts ———
  const centreRows = CENTRES.map((c) => {
    const gl = scoped.filter((l) => centreOf(l) === c.id);
    const st = sumStats(gl.map((l) => lineStats(l, months)));
    const e = st.actual - st.budgetToDate;
    return { id: c.id, label: c.label, budget: st.budgetToDate, actual: st.actual, ecart: e, taux: achievementRate(st.actual, st.budgetToDate), nature: varianceNature(gl[0]?.category ?? "achats", e), n: gl.length };
  }).filter((x) => x.n > 0).sort((a, b) => b.budget - a.budget);

  // ——— Prévision de fin d'année ———
  const fm = scoped.map((l) => ({ l, f: forecastMonths(l) }));
  const fcData = MONTHS.map((mois, m) => {
    let v = 0, b = 0, actual = true;
    for (const { l, f } of fm) {
      const x = f[m]!;
      if (!x.isActual) actual = false;
      v += x.value;
      b += l.budget[m] ?? 0;
    }
    return { mois, reel: actual ? Math.round(v) : null, prevision: actual ? null : Math.round(v), budget: Math.round(b) };
  });
  const fy = scoped.reduce((a, l) => a + forecastYear(l), 0);
  const fyBudget = scoped.reduce((a, l) => a + lineStats(l).budgetYear, 0);
  const fyEcart = fy - fyBudget;

  // ——— Alertes budgétaires (écarts défavorables ≥ seuil) ———
  const alerts = scoped
    .map((l) => { const st = lineStats(l); const e = st.actual - st.budgetToDate; return { l, e, r: varianceRate(st.actual, st.budgetToDate) }; })
    .filter((x) => varianceNature(x.l.category, x.e) === "defavorable" && x.r !== null && Math.abs(x.r) >= SIGNIFICANT)
    .sort((a, b) => Math.abs(b.r!) - Math.abs(a.r!));

  // ——— Actions correctives visibles ———
  const visibleActions = actions.filter((a) => lines.some((l) => l.id === a.lineId));
  const lineLabel = (id: string) => lines.find((l) => l.id === id)?.label ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Périmètre des indicateurs :</span>
        {(["charges", "revenus"] as const).map((k) => (
          <button key={k} onClick={() => setScope(k)} className={cn("rounded-full px-3 py-1 text-xs font-semibold", scope === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
            {k === "charges" ? "Charges" : "Chiffre d'affaires"}
          </button>
        ))}
      </div>

      {/* 4 KPI en une ligne */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label="Budget annuel" value={fmtM(s.budgetYear)} sub="Période sélectionnée" />
        <Kpi icon={TrendingUp} label="Réalisé à date" value={fmtM(s.actual)} sub={`vs budget à date ${fmtM(s.budgetToDate)}`} />
        <Kpi icon={Scale} label="Écart budgétaire" value={`${ecart > 0 ? "+" : ""}${fmt(ecart)}`} tone={nature === "favorable" ? "good" : nature === "defavorable" ? "bad" : undefined}
          sub={`${tEcart !== null && tEcart > 0 ? "+" : ""}${pct(tEcart)} · ${nature === "favorable" ? "Favorable" : nature === "defavorable" ? "Défavorable" : "Neutre"}`} />
        <Kpi icon={Gauge} label="Taux de consommation" value={pct(taux)} sub="Réel / budget des mois réalisés" />
      </div>

      {/* Rangée analytique : 3 colonnes */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Budget vs Réalisé" subtitle={scope === "charges" ? "Charges mensuelles, en DH" : "Chiffre d'affaires mensuel, en DH"}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly} barGap={3}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickFormatter={mAxis} tickLine={false} axisLine={false} fontSize={11} width={44} />
                <Tooltip {...tip} formatter={(v: number) => fmt(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar name="Budget" dataKey="budget" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
                <Bar name="Réalisé" dataKey="reel" fill="var(--chart-1)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Répartition budgétaire" subtitle={`Budget annuel par centre de coûts · total ${fmtM(totalCentre)}`}>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCentre} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} strokeWidth={0}>
                  {byCentre.map((x, i) => <Cell key={x.name} fill={DONUT[i % DONUT.length]} />)}
                </Pie>
                <Tooltip {...tip} formatter={(v: number) => fmtM(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }}
                  formatter={(v: string) => {
                    const x = byCentre.find((c) => c.name === v);
                    return `${v} · ${totalCentre ? Math.round(((x?.value ?? 0) / totalCentre) * 100) : 0} %`;
                  }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Synthèse des écarts" subtitle="Par catégorie, sur les mois réalisés">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={thead}>
                <th className="py-2 pr-2 font-medium">Catégorie</th>
                <th className="py-2 pr-2 text-right font-medium">Budget</th>
                <th className="py-2 pr-2 text-right font-medium">Réel</th>
                <th className="py-2 pr-2 text-right font-medium">Écart</th>
                <th className="py-2 text-right font-medium">%</th>
              </tr></thead>
              <tbody>
                {byCat.map((r) => (
                  <tr key={r.id} className={trow}>
                    <td className="py-2 pr-2 text-xs font-medium text-foreground">{r.label}</td>
                    <td className="py-2 pr-2 text-right text-xs whitespace-nowrap text-muted-foreground">{fmtM(r.budget)}</td>
                    <td className="py-2 pr-2 text-right text-xs whitespace-nowrap text-foreground">{fmtM(r.actual)}</td>
                    <td className={cn("py-2 pr-2 text-right text-xs whitespace-nowrap font-semibold", r.nature === "favorable" ? "text-success" : r.nature === "defavorable" ? "text-destructive" : "text-muted-foreground")}>{r.ecart > 0 ? "+" : ""}{fmtM(r.ecart)}</td>
                    <td className="py-2 text-right text-xs text-foreground">{r.taux !== null && r.taux > 0 ? "+" : ""}{pct(r.taux)}</td>
                  </tr>
                ))}
                {byCat.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Aucune donnée.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Rangée opérationnelle : 3 colonnes */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Analyse par centre de coûts" subtitle="Cumul sur les mois réalisés">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={thead}>
                <th className="py-2 pr-2 font-medium">Centre</th>
                <th className="py-2 pr-2 text-right font-medium">Budget</th>
                <th className="py-2 pr-2 text-right font-medium">Réalisé</th>
                <th className="py-2 pr-2 text-right font-medium">Écart</th>
                <th className="py-2 text-right font-medium">Conso.</th>
              </tr></thead>
              <tbody>
                {centreRows.map((r) => (
                  <tr key={r.id} className={trow}>
                    <td className="py-2 pr-2 text-xs font-medium text-foreground">{r.label}</td>
                    <td className="py-2 pr-2 text-right text-xs whitespace-nowrap text-muted-foreground">{fmtM(r.budget)}</td>
                    <td className="py-2 pr-2 text-right text-xs whitespace-nowrap text-foreground">{fmtM(r.actual)}</td>
                    <td className={cn("py-2 pr-2 text-right text-xs whitespace-nowrap font-semibold", r.nature === "favorable" ? "text-success" : r.nature === "defavorable" ? "text-destructive" : "text-muted-foreground")}>{r.ecart > 0 ? "+" : ""}{fmtM(r.ecart)}</td>
                    <td className="py-2 text-right text-xs text-foreground">{pct(r.taux)}</td>
                  </tr>
                ))}
                {centreRows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Aucune donnée.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Prévision de fin d'année" subtitle={`Projeté ${fmtM(fy)} · ${fyEcart >= 0 ? "+" : ""}${fmtM(fyEcart)} vs budget annuel`}>
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={fcData}>
                <defs>
                  <pattern id="ov-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="var(--accent)" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-1)" strokeWidth="2" />
                  </pattern>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickFormatter={mAxis} tickLine={false} axisLine={false} width={44} />
                <Tooltip {...tip} formatter={(v: number) => fmt(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="reel" name="Réalisé" fill="var(--chart-1)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="prevision" name="Prévision" fill="url(#ov-hatch)" stroke="var(--chart-1)" strokeDasharray="4 3" radius={[5, 5, 0, 0]} />
                <Line dataKey="budget" name="Budget" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Alertes budgétaires" subtitle={`Écarts défavorables d'au moins ${SIGNIFICANT} %`}>
          {alerts.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <p className="text-sm font-medium text-foreground">Aucune alerte</p>
              <p className="text-xs text-muted-foreground">Tous les écarts sont sous le seuil de {SIGNIFICANT} %.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {alerts.map(({ l, e, r }) => (
                <li key={l.id} className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive-soft/50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{l.label}</p>
                    <p className="text-[11px] text-muted-foreground">{centreOf(l) ? CENTRES.find((c) => c.id === centreOf(l))?.label ?? centreOf(l) : ""}</p>
                    <p className="mt-0.5 text-xs font-bold text-destructive">{e > 0 ? "+" : ""}{fmt(e)} ({r! > 0 ? "+" : ""}{pct(r)})</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Bas de page : actions + informations */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Actions correctives" subtitle={`${visibleActions.length} action(s) sur le périmètre affiché`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={thead}>
                <th className="py-2 pr-3 font-medium">Ligne</th>
                <th className="py-2 pr-3 font-medium">Action recommandée</th>
                <th className="py-2 pr-3 font-medium">Responsable</th>
                <th className="py-2 font-medium">Statut</th>
              </tr></thead>
              <tbody>
                {visibleActions.map((a) => (
                  <tr key={a.id} className={trow}>
                    <td className="py-2 pr-3 text-xs font-medium text-foreground">{lineLabel(a.lineId)}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{a.action}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{a.owner}</td>
                    <td className="py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", a.status === "Terminée" ? "bg-success-soft text-success" : a.status === "En cours" ? "bg-accent text-accent-foreground" : "bg-warning-soft text-foreground")}>{a.status}</span></td>
                  </tr>
                ))}
                {visibleActions.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucune action enregistrée — voyez l'onglet Actions correctives.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Informations budgétaires" subtitle="Hypothèses et méthodologie">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>Mois réalisés : montants réels saisis, non modifiés.</li>
            <li>Prévision des mois restants : budget mensuel × taux de réalisation à date de chaque ligne (borné entre 50 % et 150 %).</li>
            <li>Seuil d'alerte : écart défavorable d'au moins {SIGNIFICANT} % sur le cumul à date.</li>
            <li>Recettes : écart positif favorable. Charges : écart positif défavorable.</li>
            <li>Données de démonstration conservées localement dans ce navigateur.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export type { Category };
