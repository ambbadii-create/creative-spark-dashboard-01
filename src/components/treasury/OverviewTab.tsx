import { Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { accountBalance, addDays, consolidatedPosition, daysBetween, periodFlows, toMad } from "@/lib/treasury/model";
import { useTreasury } from "@/lib/treasury/store";
import { useTreasuryData, useAlerts } from "./data";
import { fmtDH, fmtK, TrendKpi, Pill, tip } from "./ui";
import { Workspace } from "./shared";

export function TreasuryOverview({ from, to, go }: { from: string; to: string; go: (tab: string) => void }) {
  const t = useTreasury(), d = useTreasuryData(), alerts = useAlerts();
  const length = Math.max(1, daysBetween(from, to) + 1), prevTo = addDays(from, -1), prevFrom = addDays(prevTo, -length + 1);
  const pos = consolidatedPosition(t.accounts, t.allMovements, t.fx, to), prev = consolidatedPosition(t.accounts, t.allMovements, t.fx, prevTo);
  const flow = periodFlows(t.allMovements, t.accounts, t.fx, from, to), pf = periodFlows(t.allMovements, t.accounts, t.fx, prevFrom, prevTo);
  const fc = d.forecast(30, "Semaine", t.scenarios.Central);
  const series = Array.from({ length: Math.min(length, 31) }, (_, i) => {
    const date = addDays(from, Math.floor(i * (length - 1) / Math.max(1, Math.min(length, 31) - 1)));
    const flows = periodFlows(t.allMovements, t.accounts, t.fx, date, date);
    return { date: date.slice(5), solde: consolidatedPosition(t.accounts, t.allMovements, t.fx, date).available, Encaissements: flows.inflow, Décaissements: flows.outflow };
  });
  return <Workspace title="Vue d'ensemble de trésorerie">
    {pos.missingFx.length > 0 && <p role="alert" className="text-destructive">Cours manquants : {pos.missingFx.join(", ")} — consolidation incomplète.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <TrendKpi label="Solde bancaire total" value={pos.bank} prev={prev.bank}/><TrendKpi label="Solde des caisses" value={pos.cash} prev={prev.cash}/><TrendKpi label="Trésorerie disponible" value={pos.available} prev={prev.available} spark={series.map((r) => r.solde)} hint={`${fmtDH(pos.restricted)} indisponibles`}/>
      <TrendKpi label="Encaissements de la période" value={flow.inflow} prev={pf.inflow}/><TrendKpi label="Décaissements de la période" value={flow.outflow} prev={pf.outflow} inverse/><TrendKpi label="Prévision à 30 jours" value={fc.at(-1)?.closing ?? null} prev={null} hint="Scénario central · attendu et hypothèses"/>
    </div>
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <section className="min-w-0"><h3 className="mb-3 text-sm font-semibold">Évolution de la trésorerie disponible</h3><div className="h-64"><ResponsiveContainer><AreaChart data={series}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="date" tick={{fontSize:11}}/><YAxis tickFormatter={fmtK} tick={{fontSize:11}}/><Tooltip {...tip} formatter={(v: number) => fmtDH(v)}/><Area type="monotone" dataKey="solde" name="Disponible" stroke="var(--primary)" fill="var(--accent)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div><div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xs"><span>Ouverture : {fmtDH(prev.available)}</span><span>Entrées : {fmtDH(flow.inflow)}</span><span>Sorties : {fmtDH(flow.outflow)}</span><span>Clôture : {fmtDH(pos.available)}</span></div></section>
      <section className="min-w-0"><h3 className="mb-3 text-sm font-semibold">Encaissements vs Décaissements</h3><div className="h-64"><ResponsiveContainer><BarChart data={series}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="date" tick={{fontSize:11}}/><YAxis tickFormatter={fmtK} tick={{fontSize:11}}/><Tooltip {...tip} formatter={(v: number) => fmtDH(v)}/><Legend/><Bar dataKey="Encaissements" fill="var(--success)"/><Bar dataKey="Décaissements" fill="var(--warning)"/></BarChart></ResponsiveContainer></div></section>
      <section><h3 className="mb-3 text-sm font-semibold">Répartition des soldes</h3><div className="divide-y divide-border">{t.accounts.filter((a) => a.status !== "Clôturé").map((a) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.bank ?? a.location} · {a.currency}</p></div><div className="text-right"><p className="font-semibold">{fmtDH(accountBalance(a,t.allMovements,to),a.currency)}</p>{a.currency !== "MAD" && <p className="text-xs text-muted-foreground">{fmtDH(toMad(accountBalance(a,t.allMovements,to),a.currency,t.fx))}</p>}</div></div>)}</div></section>
      <section className="min-w-0"><h3 className="mb-3 text-sm font-semibold">Prévisions de liquidité · 30 jours</h3><div className="h-56"><ResponsiveContainer><AreaChart data={fc}><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tickFormatter={fmtK} tick={{fontSize:11}}/><Tooltip {...tip} formatter={(v: number) => fmtDH(v)}/><ReferenceLine y={t.rules.minCash} stroke="var(--destructive)" strokeDasharray="4 4"/><Area dataKey="closing" name="Solde projeté" stroke="var(--success)" fill="var(--success-soft)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div><p className="text-xs text-muted-foreground">Seuil minimum : {fmtDH(t.rules.minCash)} · Position actuelle : {fmtDH(d.position.available)}</p></section>
    </div>
    <section><h3 className="mb-3 text-sm font-semibold">Alertes de trésorerie <Pill tone="warn">{alerts.length}</Pill></h3><div className="grid gap-3 lg:grid-cols-2">{alerts.map((a,i) => <div key={i} className="rounded-lg border border-border bg-card p-3"><p className="text-sm font-semibold"><Pill tone={a.level === "critique" ? "bad" : "warn"}>{a.level}</Pill> {a.title}</p><p className="mt-1 text-xs text-muted-foreground">{a.detail}</p></div>)}</div></section>
    <div className="flex flex-wrap gap-4 text-sm"><Link to="/ventes" className="text-primary">Ventes & Clients →</Link><Link to="/achats" className="text-primary">Achats & Fournisseurs →</Link><Link to="/comptabilite" className="text-primary">Comptabilité →</Link></div>
  </Workspace>;
}