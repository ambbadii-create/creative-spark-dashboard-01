import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/app/ui-bits";
import { fmt, StatCard } from "@/components/budget/ui";
import { useSales } from "@/lib/sales/store";
import {
  conversionRate, invoiceOutstanding, invoiceStatus, invoiceTotals, orderStatus, round2, totals, weightedPipeline, STAGES,
} from "@/lib/sales/model";
import { Badge, fdate, fmt2, OrderBadge, rowCls, SalesInvoiceBadge, Table, Td, Th, today } from "./ui";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function SalesOverview() {
  const { customers, opportunities, orders, invoices, collections, targets } = useSales();
  const now = today();
  const ym = now.slice(0, 7);
  const year = Number(now.slice(0, 4));
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";

  const k = useMemo(() => {
    const prev = new Date(year, Number(now.slice(5, 7)) - 2, 1).toISOString().slice(0, 7);
    const ca = invoices.filter((i) => i.date.startsWith(ym)).reduce((a, i) => a + invoiceTotals(i).ht, 0);
    const caPrev = invoices.filter((i) => i.date.startsWith(prev)).reduce((a, i) => a + invoiceTotals(i).ht, 0);
    const open = orders.filter((o) => !["Facturée", "Annulée"].includes(orderStatus(o)));
    const unpaid = invoices.filter((i) => invoiceOutstanding(i, collections) > 0);
    const late = unpaid.filter((i) => i.dueDate < now);
    return {
      ca,
      delta: caPrev > 0 ? round2(((ca - caPrev) / caPrev) * 100) : null,
      openCount: open.length,
      openValue: open.reduce((a, o) => a + totals(o.lines).ttc, 0),
      due: unpaid.reduce((a, i) => a + invoiceOutstanding(i, collections), 0),
      lateSum: late.reduce((a, i) => a + invoiceOutstanding(i, collections), 0),
      lateCount: late.length,
      conv: conversionRate(opportunities),
    };
  }, [invoices, orders, collections, opportunities, ym, now, year]);

  const monthly = useMemo(() => {
    const rows: { mois: string; ca: number; objectif: number | null }[] = [];
    for (let m = 0; m < Number(now.slice(5, 7)); m++) {
      const key = `${year}-${String(m + 1).padStart(2, "0")}`;
      rows.push({
        mois: new Date(year, m, 1).toLocaleDateString("fr-FR", { month: "short" }),
        ca: round2(invoices.filter((i) => i.date.startsWith(key)).reduce((a, i) => a + invoiceTotals(i).ht, 0)),
        objectif: targets[m] ?? null,
      });
    }
    return rows;
  }, [invoices, targets, year, now]);

  const bySegment = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of invoices) {
      const seg = customers.find((c) => c.id === i.customerId)?.segment ?? "Autre";
      map.set(seg, round2((map.get(seg) ?? 0) + invoiceTotals(i).ht));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [invoices, customers]);
  const segTotal = bySegment.reduce((a, c) => a + c.value, 0);

  const top = useMemo(() => {
    const map = new Map<string, { ca: number; n: number }>();
    for (const i of invoices) {
      const e = map.get(i.customerId) ?? { ca: 0, n: 0 };
      e.ca = round2(e.ca + invoiceTotals(i).ht);
      e.n += 1;
      map.set(i.customerId, e);
    }
    return [...map.entries()].map(([id, v]) => ({ name: cName(id), ...v })).sort((a, b) => b.ca - a.ca).slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, customers]);
  const topTotal = top.reduce((a, t) => a + t.ca, 0);

  const pipeline = STAGES.map((s) => ({
    stage: s,
    n: opportunities.filter((o) => o.stage === s).length,
    value: opportunities.filter((o) => o.stage === s).reduce((a, o) => a + o.value, 0),
  }));
  const toDeliver = orders.filter((o) => ["Confirmée", "Partiellement livrée"].includes(orderStatus(o))).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)).slice(0, 6);
  const dues = invoices.filter((i) => invoiceOutstanding(i, collections) > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chiffre d'affaires" value={fmt(k.ca)} sub={k.delta === null ? "HT facturé ce mois" : `HT ce mois · ${k.delta > 0 ? "+" : ""}${k.delta} % vs mois précédent`} />
        <StatCard label="Commandes clients" value={String(k.openCount)} sub={`${fmt(k.openValue)} TTC en cours de traitement`} />
        <StatCard label="Créances clients" value={fmt(k.due)} sub={`dont ${fmt(k.lateSum)} en retard (${k.lateCount} facture(s))`} tone={k.lateCount > 0 ? "bad" : undefined} />
        <StatCard label="Taux de conversion" value={k.conv === null ? "n.c." : `${k.conv} %`} sub="Opportunités gagnées / qualifiées" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Évolution du chiffre d'affaires" subtitle={`HT facturé par mois, ${year}`}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} width={40} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="ca" name="CA réel" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="objectif" name="Objectif" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.08} strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Répartition du chiffre d'affaires" subtitle="HT facturé par segment client">
          {bySegment.length === 0 ? <p className="text-sm text-muted-foreground">Aucune facture.</p> : (
            <div className="flex items-center gap-4">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bySegment} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {bySegment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {bySegment.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-foreground">{c.name}</span>
                    <span className="text-muted-foreground">{Math.round((c.value / segTotal) * 100)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <Panel title="Performance commerciale" subtitle="Top 5 clients (HT facturé)">
          <ul className="space-y-2 text-sm">
            {top.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                <span className="text-foreground">{t.name}</span>
                <span className="text-xs text-muted-foreground">{fmt(t.ca)} · {topTotal > 0 ? Math.round((t.ca / topTotal) * 100) : 0} % · {t.n} fact.</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Pipeline commercial" subtitle={`Valeur pondérée : ${fmt(weightedPipeline(opportunities))}`}>
          <ul className="space-y-2 text-sm">
            {pipeline.map((p) => (
              <li key={p.stage} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                <span className="text-foreground">{p.stage} <span className="text-xs text-muted-foreground">({p.n})</span></span>
                <span className="font-semibold text-foreground">{fmt(p.value)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Commandes à traiter" subtitle="En attente de livraison">
          {toDeliver.length === 0 ? <p className="text-sm text-muted-foreground">Aucune commande en attente.</p> : (
            <ul className="space-y-2 text-sm">
              {toDeliver.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{o.number} · {cName(o.customerId)}</span>
                  <span className="flex items-center gap-2">
                    <span className={o.deliveryDate < now ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{fdate(o.deliveryDate)}</span>
                    <OrderBadge s={orderStatus(o)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Suivi des créances" subtitle="Factures non réglées, par échéance">
          {dues.length === 0 ? <p className="text-sm text-muted-foreground">Aucune créance en cours.</p> : (
            <ul className="space-y-2 text-sm">
              {dues.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{i.number} · {cName(i.customerId)} <span className="text-xs text-muted-foreground">· {fdate(i.dueDate)}</span></span>
                  <span className="flex items-center gap-2 font-semibold text-foreground">{fmt(invoiceOutstanding(i, collections))}{i.dueDate < now && <Badge t="bad">Retard</Badge>}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Dernières commandes clients">
          <Table head={<><Th>N°</Th><Th>Client</Th><Th>Date</Th><Th right>TTC</Th><Th>Statut</Th></>}>
            {[...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((o) => (
              <tr key={o.id} className={rowCls}><Td strong>{o.number}</Td><Td>{cName(o.customerId)}</Td><Td muted>{fdate(o.date)}</Td><Td right>{fmt2(totals(o.lines).ttc)}</Td><Td><OrderBadge s={orderStatus(o)} /></Td></tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Dernières factures et encaissements">
          <Table head={<><Th>Facture</Th><Th>Client</Th><Th right>TTC</Th><Th right>Encaissé</Th><Th right>Reste</Th><Th>Statut</Th></>}>
            {[...invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((i) => {
              const t = invoiceTotals(i).ttc;
              const rest = invoiceOutstanding(i, collections);
              return (
                <tr key={i.id} className={rowCls}>
                  <Td strong>{i.number}</Td><Td>{cName(i.customerId)}</Td><Td right>{fmt2(t)}</Td><Td right>{fmt2(t - rest)}</Td><Td right>{fmt2(rest)}</Td>
                  <Td><SalesInvoiceBadge s={invoiceStatus(i, collections, now)} /></Td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      </div>
    </div>
  );
}
