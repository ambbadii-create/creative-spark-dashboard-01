import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lightbulb } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { MONTHS, forecastMonths, forecastYear, isRevenue, lineStats, result, type BudgetLine } from "@/lib/budget/model";
import { StatCard, fmt, fmtM } from "./ui";

const tip = { contentStyle: { borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 } };

export function ForecastTab({ lines }: { lines: BudgetLine[] }) {
  const fc = result(lines, forecastYear);
  const bud = result(lines, (l) => lineStats(l).budgetYear);
  const fm = lines.map((l) => ({ l, f: forecastMonths(l) }));
  const lastActual = Math.max(-1, ...lines.flatMap((l) => l.actual.map((a, i) => (a != null ? i : -1))));

  const data = MONTHS.map((mois, m) => {
    let r = 0, e = 0, br = 0, be = 0, actual = true;
    for (const { l, f } of fm) {
      const x = f[m]!;
      if (!x.isActual) actual = false;
      if (isRevenue(l.category)) { r += x.value; br += l.budget[m] ?? 0; } else { e += x.value; be += l.budget[m] ?? 0; }
    }
    const res = r - e;
    return { mois, reel: actual ? res : null, prevision: actual ? null : res, budget: br - be };
  });

  const delta = (a: number, b: number) => `${a - b >= 0 ? "+" : ""}${fmtM(a - b)} vs budget`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard tone="forecast" label="CA prévisionnel fin d'année" value={fmtM(fc.revenue)} sub={delta(fc.revenue, bud.revenue)} />
        <StatCard tone="forecast" label="Charges prévisionnelles" value={fmtM(fc.expenses)} sub={delta(fc.expenses, bud.expenses)} />
        <StatCard tone="forecast" label="Résultat prévisionnel" value={fmtM(fc.result)} sub={delta(fc.result, bud.result)} />
      </div>

      <Panel title="Résultat mensuel : réalisé, prévision et budget" subtitle={lastActual >= 0 ? `Réalisé jusqu'à ${MONTHS[lastActual]} · prévision au-delà` : "Aucun réalisé saisi · prévision = budget"}>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={data}>
              <defs>
                <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="var(--accent)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-1)" strokeWidth="2" />
                </pattern>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mois" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)} k`} tickLine={false} axisLine={false} width={56} />
              <Tooltip {...tip} formatter={(v: number) => fmt(v)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="reel" name="Réalisé" fill="var(--chart-1)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="prevision" name="Prévision (estimée)" fill="url(#hatch)" stroke="var(--chart-1)" strokeDasharray="4 3" radius={[5, 5, 0, 0]} />
              <Line dataKey="budget" name="Budget" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="flex gap-3 rounded-xl border border-dashed border-primary/40 bg-accent p-5 text-sm text-accent-foreground">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">Méthode de prévision et hypothèses</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Mois réalisés : montants réels saisis, non modifiés.</li>
            <li>Mois restants : budget mensuel × taux de réalisation à date de chaque ligne (borné entre 50 % et 150 %).</li>
            <li>Une ligne sans réalisé conserve son budget comme prévision.</li>
            <li>Aucune saisonnalité supplémentaire, inflation ou événement exceptionnel n'est pris en compte.</li>
          </ul>
          <p className="pt-1 text-xs opacity-80">Ces montants sont des estimations et ne constituent pas des résultats réels.</p>
        </div>
      </div>
    </div>
  );
}
