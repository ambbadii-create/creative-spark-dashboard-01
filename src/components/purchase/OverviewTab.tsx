import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/app/ui-bits";
import { fmt, StatCard } from "@/components/budget/ui";
import { OrderStatusBadge } from "@/components/stock/ui";
import { useStock } from "@/lib/stock/store";
import { usePurchase } from "@/lib/purchase/store";
import { invoiceStatus, invoiceTtc, orderTotals, outstanding } from "@/lib/purchase/model";
import { deliveryPerformance, monthlySpend, spendByCategory } from "./analytics";
import { Badge, fdate, fmt2, InvoiceBadge, rowCls, Table, Td, Th, today } from "./ui";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function PurchaseOverview() {
  const { orders, products } = useStock();
  const { invoices, payments, suppliers, receipts } = usePurchase();
  const now = today();
  const ym = now.slice(0, 7);

  const k = useMemo(() => {
    const monthOrders = orders.filter((o) => o.date.startsWith(ym) && !["Annulée", "Brouillon"].includes(o.status));
    const monthInvoices = invoices.filter((i) => i.date.startsWith(ym));
    const open = orders.filter((o) => ["En attente de validation", "Validée", "Envoyée", "Partiellement reçue"].includes(o.status));
    const unpaid = invoices.filter((i) => outstanding(i, payments) > 0);
    return {
      engage: monthOrders.reduce((a, o) => a + orderTotals(o).ht, 0),
      facture: monthInvoices.reduce((a, i) => a + i.ht, 0),
      open: open.length,
      openValue: open.reduce((a, o) => a + orderTotals(o).ttc, 0),
      unpaid: unpaid.reduce((a, i) => a + outstanding(i, payments), 0),
      unpaidCount: unpaid.length,
      late: unpaid.filter((i) => i.dueDate < now).length,
      active: suppliers.filter((s) => s.active).length,
    };
  }, [orders, invoices, payments, suppliers, ym, now]);

  const year = Number(now.slice(0, 4));
  const monthly = monthlySpend(orders, invoices, year).slice(0, new Date().getMonth() + 1);
  const byCat = spendByCategory(orders, products);
  const catTotal = byCat.reduce((a, c) => a + c.value, 0);
  const perf = deliveryPerformance(orders, receipts).sort((a, b) => b.orders - a.orders).slice(0, 5);
  const pending = orders.filter((o) => o.status === "En attente de validation");
  const expected = orders.filter((o) => ["Validée", "Envoyée", "Partiellement reçue"].includes(o.status)).sort((a, b) => a.expected.localeCompare(b.expected)).slice(0, 5);
  const dues = invoices.filter((i) => outstanding(i, payments) > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const sName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Achats du mois" value={fmt(k.engage)} sub={`Engagé (commandes HT) · facturé : ${fmt(k.facture)}`} />
        <StatCard label="Commandes en cours" value={String(k.open)} sub={`${fmt(k.openValue)} TTC à recevoir / valider`} />
        <StatCard label="Factures à payer" value={fmt(k.unpaid)} sub={`${k.unpaidCount} facture(s) · ${k.late} en retard`} tone={k.late > 0 ? "bad" : undefined} />
        <StatCard label="Fournisseurs actifs" value={String(k.active)} sub={`sur ${suppliers.length} référencés`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Évolution des achats" subtitle={`HT par mois, ${year} (démonstration)`}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} width={40} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="engage" name="Engagé" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="facture" name="Facturé" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Répartition des achats" subtitle="Engagements HT par catégorie">
          {byCat.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commande.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {byCat.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-foreground">{c.name}</span>
                    <span className="text-muted-foreground">{Math.round((c.value / catTotal) * 100)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <Panel title="Performance fournisseurs" subtitle="Livraisons à l'heure (réceptions enregistrées)">
          <ul className="space-y-2 text-sm">
            {perf.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                <span className="text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.orders} cde · {p.rate === null ? "n.c." : `${p.rate} % à l'heure`}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Commandes en attente de validation">
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">Aucune commande en attente.</p> : (
            <ul className="space-y-2 text-sm">
              {pending.map((o) => (
                <li key={o.id} className="flex justify-between gap-2"><span className="text-foreground">{o.number} · {o.supplier}</span><span className="font-semibold text-foreground">{fmt(orderTotals(o).ttc)}</span></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Réceptions attendues">
          <ul className="space-y-2 text-sm">
            {expected.map((o) => (
              <li key={o.id} className="flex justify-between gap-2"><span className="text-foreground">{o.number} · {o.supplier}</span><span className={o.expected < now ? "text-destructive" : "text-muted-foreground"}>{fdate(o.expected)}</span></li>
            ))}
          </ul>
        </Panel>
        <Panel title="Échéances fournisseurs">
          <ul className="space-y-2 text-sm">
            {dues.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span className="text-foreground">{sName(i.supplierId)} <span className="text-xs text-muted-foreground">· {fdate(i.dueDate)}</span></span>
                <span className="flex items-center gap-2 font-semibold text-foreground">{fmt(outstanding(i, payments))}{i.dueDate < now && <Badge t="bad">Retard</Badge>}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Dernières commandes fournisseurs">
          <Table head={<><Th>N°</Th><Th>Fournisseur</Th><Th>Date</Th><Th right>TTC</Th><Th>Statut</Th></>}>
            {[...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((o) => (
              <tr key={o.id} className={rowCls}><Td strong>{o.number}</Td><Td>{o.supplier}</Td><Td muted>{fdate(o.date)}</Td><Td right>{fmt2(orderTotals(o).ttc)}</Td><Td><OrderStatusBadge status={o.status} /></Td></tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Dernières factures fournisseurs">
          <Table head={<><Th>Référence</Th><Th>Fournisseur</Th><Th>Date</Th><Th right>TTC</Th><Th>Statut</Th></>}>
            {[...invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((i) => (
              <tr key={i.id} className={rowCls}><Td strong>{i.reference}</Td><Td>{sName(i.supplierId)}</Td><Td muted>{fdate(i.date)}</Td><Td right>{fmt2(invoiceTtc(i))}</Td><Td><InvoiceBadge s={invoiceStatus(i, payments, now)} /></Td></tr>
            ))}
          </Table>
        </Panel>
      </div>
    </div>
  );
}
