import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, PackageX, Download } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DemoBadge, KpiCard, PageHeader, Panel } from "@/components/app/ui-bits";
import { budgetAlerts, budgetVsActual, expenses, formatMAD, kpis, monthly, stockAlerts, transactions } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Pilotage CG" },
      { name: "description", content: "Vue d'ensemble : chiffre d'affaires, charges, trésorerie, budgets et stocks en MAD." },
      { property: "og:title", content: "Tableau de bord — Pilotage CG" },
      { property: "og:description", content: "Pilotage de la performance pour les entreprises marocaines." },
    ],
  }),
  component: Dashboard,
});

const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tip = { contentStyle: { borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 } };
const mdh = (v: number) => `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;

const statusStyle: Record<string, string> = {
  "Encaissé": "bg-success-soft text-success",
  "Payé": "bg-accent text-accent-foreground",
  "En attente": "bg-warning-soft text-foreground",
  "En retard": "bg-destructive-soft text-destructive",
};

function Dashboard() {
  const totalExp = expenses.reduce((a, e) => a + e.value, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle="Synthèse de la performance — janvier à octobre 2026"
        actions={
          <div className="flex items-center gap-3">
            <DemoBadge />
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Download className="h-4 w-4" /> Exporter
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.percent ? `${k.value.toLocaleString("fr-FR")} %` : formatMAD(k.value, true)} delta={k.delta} hint={k.hint} inverse={k.inverse ?? false} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Chiffre d'affaires et résultat mensuels" subtitle="En millions de DH" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={mdh} tickLine={false} axisLine={false} fontSize={12} width={48} />
                <Tooltip {...tip} formatter={(v: number) => formatMAD(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area name="Chiffre d'affaires" dataKey="ca" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#g1)" />
                <Area name="Résultat net" dataKey="resultat" stroke="var(--chart-3)" strokeWidth={2.5} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Répartition des charges" subtitle="Cumul 2026">
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={expenses} dataKey="value" innerRadius={50} outerRadius={78} paddingAngle={2}>
                  {expenses.map((_, i) => <Cell key={i} fill={C[i]} />)}
                </Pie>
                <Tooltip {...tip} formatter={(v: number) => formatMAD(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {expenses.map((e, i) => (
              <li key={e.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: C[i] }} />
                  {e.name}
                </span>
                <span className="font-semibold text-foreground">{Math.round((e.value / totalExp) * 100)} %</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Budget vs Réalisé" subtitle="En millions de DH" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={budgetVsActual} barGap={4}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="poste" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                <Tooltip {...tip} formatter={(v: number) => `${v.toLocaleString("fr-FR")} M DH`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar name="Budget" dataKey="budget" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                <Bar name="Réalisé" dataKey="reel" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Alertes d'écarts budgétaires" subtitle="Dépassements supérieurs à 5 %">
            <ul className="space-y-3">
              {budgetAlerts.map((a) => (
                <li key={a.poste} className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-destructive-soft text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{a.poste}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.centre}</p>
                  </div>
                  <span className="text-sm font-bold text-destructive">+{a.ecart.toLocaleString("fr-FR")} %</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Alertes de stock" subtitle="Articles sous le seuil de sécurité">
            <ul className="space-y-3">
              {stockAlerts.map((s) => (
                <li key={s.article}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      <PackageX className={cn("h-4 w-4", s.level === "critique" ? "text-destructive" : "text-warning")} />
                      {s.article}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.depot}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", s.level === "critique" ? "bg-destructive" : "bg-warning")} style={{ width: `${(s.stock / s.seuil) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{s.stock} / {s.seuil} unités</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Transactions récentes" subtitle="Dernières écritures">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Date</th>
                <th className="py-3 pr-4 font-medium">Référence</th>
                <th className="py-3 pr-4 font-medium">Tiers</th>
                <th className="py-3 pr-4 font-medium">Type</th>
                <th className="py-3 pr-4 text-right font-medium">Montant</th>
                <th className="py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.ref} className="border-b border-border last:border-0 hover:bg-muted/60">
                  <td className="py-3 pr-4 text-muted-foreground">{t.date}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-foreground">{t.ref}</td>
                  <td className="py-3 pr-4 font-medium text-foreground">{t.tiers}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{t.type}</td>
                  <td className={cn("py-3 pr-4 text-right font-semibold", t.montant >= 0 ? "text-success" : "text-foreground")}>
                    {t.montant > 0 ? "+" : ""}{formatMAD(t.montant)}
                  </td>
                  <td className="py-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusStyle[t.statut])}>{t.statut}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="text-center text-xs text-muted-foreground">
        Toutes les données affichées sont fictives et servent uniquement d'illustration. Aucun calcul financier n'est encore branché.
      </p>
    </div>
  );
}
