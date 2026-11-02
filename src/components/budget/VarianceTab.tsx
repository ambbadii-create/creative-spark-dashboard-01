import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { Panel } from "@/components/app/ui-bits";
import { MONTHS, achievementRate, categoryLabel, isRevenue, lineStats, varianceNature, varianceRate, type BudgetLine } from "@/lib/budget/model";
import { SearchBox } from "./LinesTab";
import { Select, SortTh, VarianceBadge, fmt, pct, sortBy, thead, trow, type Sort } from "./ui";
import { cn } from "@/lib/utils";

const tip = { contentStyle: { borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 } };

export function VarianceTab({ lines, months, centreOf }: { lines: BudgetLine[]; months: number[]; centreOf: (l: BudgetLine) => string }) {
  const [q, setQ] = useState("");
  const [nat, setNat] = useState("all");
  const [sort, setSort] = useState<Sort<"label" | "budget" | "actual" | "ecart" | "taux">>({ key: "ecart", dir: -1 });

  const data = lines.map((l) => {
    const s = lineStats(l, months);
    const ecart = s.actual - s.budgetToDate;
    return { l, s, ecart, taux: achievementRate(s.actual, s.budgetToDate), tEcart: varianceRate(s.actual, s.budgetToDate), nature: varianceNature(l.category, ecart) };
  });
  const rows = sortBy(
    data.filter((r) => (nat === "all" || r.nature === nat) && `${r.l.label} ${centreOf(r.l)}`.toLowerCase().includes(q.toLowerCase())),
    (r) => ({ label: r.l.label, budget: r.s.budgetToDate, actual: r.s.actual, ecart: Math.abs(r.ecart), taux: r.taux ?? -1 })[sort.key],
    sort.dir,
  );

  const monthlyVar = (rev: boolean) =>
    months.map((m) => {
      const ls = lines.filter((l) => isRevenue(l.category) === rev && l.actual[m] != null);
      const v = ls.reduce((a, l) => a + (l.actual[m] ?? 0) - (l.budget[m] ?? 0), 0);
      return { mois: MONTHS[m], ecart: ls.length ? Math.round(v) : null, fav: rev ? v >= 0 : v <= 0 };
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {[{ t: "Écarts mensuels — chiffre d'affaires", d: monthlyVar(true), s: "Positif = favorable" }, { t: "Écarts mensuels — charges", d: monthlyVar(false), s: "Positif = dépassement (défavorable)" }].map((c) => (
          <Panel key={c.t} title={c.t} subtitle={`Réel − Budget, en DH · ${c.s}`}>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={c.d}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mois" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)} k`} tickLine={false} axisLine={false} width={50} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                  <Tooltip {...tip} formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="ecart" name="Écart" radius={4}>
                    {c.d.map((x) => <Cell key={x.mois} fill={x.fav ? "var(--success)" : "var(--destructive)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Analyse des écarts par ligne" subtitle="Comparaison sur les mois disposant d'un réalisé · n.c. = budget nul, taux non calculable">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} />
          <Select value={nat} onChange={(e) => setNat(e.target.value)} className="w-48">
            <option value="all">Tous les écarts</option>
            <option value="favorable">Favorables</option>
            <option value="defavorable">Défavorables</option>
          </Select>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={thead}>
              <SortTh k="label" sort={sort} setSort={setSort}>Ligne</SortTh>
              <th className="py-2.5 pr-3 font-medium">Centre</th>
              <SortTh k="budget" sort={sort} setSort={setSort} right>Budget à date</SortTh>
              <SortTh k="actual" sort={sort} setSort={setSort} right>Réel</SortTh>
              <SortTh k="ecart" sort={sort} setSort={setSort} right>Écart</SortTh>
              <SortTh k="taux" sort={sort} setSort={setSort} right>Réalisation</SortTh>
              <th className="py-2.5 pr-3 text-right font-medium">Taux d'écart</th>
              <th className="py-2.5 font-medium">Nature</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.l.id} className={trow}>
                  <td className="py-2.5 pr-3"><p className="font-medium text-foreground">{r.l.label}</p><p className="text-xs text-muted-foreground">{categoryLabel(r.l.category)}</p></td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{centreOf(r.l)}</td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">{fmt(r.s.budgetToDate)}</td>
                  <td className="py-2.5 pr-3 text-right font-medium text-foreground">{fmt(r.s.actual)}</td>
                  <td className={cn("py-2.5 pr-3 text-right font-semibold", r.nature === "favorable" ? "text-success" : r.nature === "defavorable" ? "text-destructive" : "text-muted-foreground")}>{r.ecart > 0 ? "+" : ""}{fmt(r.ecart)}</td>
                  <td className="py-2.5 pr-3 text-right text-foreground">{pct(r.taux)}</td>
                  <td className="py-2.5 pr-3 text-right text-foreground">{r.tEcart !== null && r.tEcart > 0 ? "+" : ""}{pct(r.tEcart)}</td>
                  <td className="py-2.5"><VarianceBadge category={r.l.category} value={r.ecart} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Aucun écart ne correspond.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
