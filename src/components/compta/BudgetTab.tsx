import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/app/ui-bits";
import { thead, trow } from "@/components/budget/ui";
import { cn } from "@/lib/utils";
import { useBudgets } from "@/lib/budget/store";
import { CATEGORIES, achievementRate, centreLabel, isRevenue, varianceRate, type Category } from "@/lib/budget/model";
import { balances, fmtMad, fmtPct, MONTHS, net } from "@/lib/compta/model";
import { useCompta } from "@/lib/compta/store";
import { Amt, Note, num, type Period } from "./ui";

/** Correspondance catégories budgétaires → comptes CGNC (pour le rapprochement avec la comptabilité). */
const MAP: Record<Category, string[]> = { revenus: ["711", "712"], achats: ["611", "612"], personnel: ["617"], externes: ["613", "614"], amortissements: ["619"], autres: ["616", "618"] };

export function BudgetTab({ p }: { p: Period }) {
  const { budgets, lines } = useBudgets();
  const { entries } = useCompta();
  const months = Array.from({ length: p.to + 1 }, (_, i) => i);
  const yl = useMemo(() => {
    const ids = new Set(budgets.filter((b) => b.year === p.year).map((b) => b.id));
    return lines.filter((l) => ids.has(l.budgetId));
  }, [budgets, lines, p.year]);
  const centreOf = (budgetId: string) => budgets.find((b) => b.id === budgetId)?.centre ?? "";
  const bal = useMemo(() => balances(entries, { year: p.year, to: p.to }), [entries, p]);

  if (!yl.length) return <Panel title="Analyse budgétaire"><Note>Aucun budget saisi pour {p.year} dans le module Budgets & Prévisions.</Note></Panel>;

  const sum = (arr: (number | null)[]) => months.reduce((s, m) => s + (arr[m] ?? 0), 0);
  const missing = yl.filter((l) => months.some((m) => l.actual[m] === null)).length;

  const byCat = CATEGORIES.map((c) => {
    const ls = yl.filter((l) => l.category === c.id);
    const b = ls.reduce((s, l) => s + sum(l.budget), 0), r = ls.reduce((s, l) => s + sum(l.actual), 0);
    const gl = c.id === "revenus" ? -net(bal, ...MAP[c.id]) : net(bal, ...MAP[c.id]);
    return { ...c, b, r, gl };
  }).filter((c) => c.b || c.r);

  const centres = [...new Set(yl.map((l) => centreOf(l.budgetId)))].map((cc) => {
    const ls = yl.filter((l) => centreOf(l.budgetId) === cc && !isRevenue(l.category));
    return { cc, b: ls.reduce((s, l) => s + sum(l.budget), 0), r: ls.reduce((s, l) => s + sum(l.actual), 0) };
  });

  const monthly = months.map((m) => {
    const ch = yl.filter((l) => !isRevenue(l.category));
    return { mois: MONTHS[m], Budget: ch.reduce((s, l) => s + (l.budget[m] ?? 0), 0), Réalisé: ch.reduce((s, l) => s + (l.actual[m] ?? 0), 0) };
  });

  const tone = (cat: Category, d: number) => (Math.abs(d) < 1 ? "" : (isRevenue(cat) ? d > 0 : d < 0) ? "text-success" : "text-destructive");

  return (
    <div className="space-y-5">
      <Note>Source : module <Link to="/budgets" className="font-semibold text-primary hover:underline">Budgets & Prévisions</Link> (budget et réalisé saisis). La colonne « Réalisé comptable » provient des écritures validées pour rapprochement. {missing > 0 && `${missing} ligne(s) budgétaire(s) sans réalisé saisi sur la période — comptées comme non disponibles.`}</Note>
      <Panel title="Budget vs réalisé par nature" subtitle={`Cumul janvier – ${MONTHS[p.to]} ${p.year}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={thead}><tr><th className="py-2.5 pr-3">Catégorie</th><th className="pr-3">Comptes</th><th className={num + " pr-3"}>Budget</th><th className={num + " pr-3"}>Réalisé (budgets)</th><th className={num + " pr-3"}>Écart</th><th className={num + " pr-3"}>Écart %</th><th className={num + " pr-3"}>Taux de réalisation</th><th className={num + " pr-3"}>Réalisé comptable</th></tr></thead>
            <tbody>
              {byCat.map((c) => (
                <tr key={c.id} className={trow}>
                  <td className="py-2 pr-3 font-medium">{c.label}</td><td className="pr-3 font-mono text-xs text-muted-foreground">{MAP[c.id].join(", ")}</td>
                  <Amt v={c.b} /><Amt v={c.r} />
                  <td className={cn("py-2 pr-3", num, tone(c.id, c.r - c.b))}>{c.r - c.b > 0 ? "+" : ""}{(c.r - c.b).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className={cn("py-2 pr-3 text-xs font-semibold", num, tone(c.id, c.r - c.b))}>{fmtPct(varianceRate(c.r, c.b))}</td>
                  <td className={num + " pr-3"}>{fmtPct(achievementRate(c.r, c.b)).replace("+", "")}</td>
                  <Amt v={c.gl} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Le budget couvre un périmètre de centres de coûts ; l'écart avec le réalisé comptable signale les charges non affectées analytiquement.</p>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Évolution mensuelle des charges" subtitle="Budget vs réalisé saisi">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)} M`} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmtMad(v, 0)} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Budget" fill="var(--muted-foreground)" fillOpacity={0.3} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Réalisé" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Analyse par centre de coûts" subtitle="Charges uniquement">
          <table className="w-full text-sm">
            <thead className={thead}><tr><th className="py-2.5 pr-3">Centre</th><th className={num + " pr-3"}>Budget</th><th className={num + " pr-3"}>Réalisé</th><th className={num + " pr-3"}>Écart %</th></tr></thead>
            <tbody>{centres.map((c) => <tr key={c.cc} className={trow}><td className="py-2 pr-3">{centreLabel(c.cc)}</td><Amt v={c.b} /><Amt v={c.r} /><td className={cn("py-2 pr-3 text-xs font-semibold", num, c.r > c.b ? "text-destructive" : "text-success")}>{fmtPct(varianceRate(c.r, c.b))}</td></tr>)}</tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
