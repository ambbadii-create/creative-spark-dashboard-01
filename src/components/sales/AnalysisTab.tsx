import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { Btn, fmt, StatCard } from "@/components/budget/ui";
import { useStock } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import {
  avgCollectionDelay, conversionRate, grossMargin, invoiceOutstanding, invoiceTotals, orderStatus, round2, totals,
} from "@/lib/sales/model";
import { downloadCsv, fmt2, rowCls, Table, Td, Th, today } from "./ui";

export function AnalysisTab() {
  const { customers, opportunities, orders, invoices, collections } = useSales();
  const { products } = useStock();
  const now = today();
  const year = now.slice(0, 4);
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const pName = (id: string) => products.find((p) => p.id === id)?.designation ?? id;

  const ytd = invoices.filter((i) => i.date.startsWith(year));
  const caYtd = ytd.reduce((a, i) => a + invoiceTotals(i).ht, 0);
  const margin = grossMargin(ytd, (pid) => products.find((p) => p.id === pid)?.unitCost ?? 0);
  const activeOrders = orders.filter((o) => !o.cancelled);
  const avgBasket = activeOrders.length ? round2(activeOrders.reduce((a, o) => a + totals(o.lines).ttc, 0) / activeOrders.length) : 0;
  const conv = conversionRate(opportunities);
  const delay = avgCollectionDelay(invoices, collections);

  const byCustomer = useMemo(() => {
    const map = new Map<string, { ca: number; n: number }>();
    for (const i of invoices) {
      const e = map.get(i.customerId) ?? { ca: 0, n: 0 };
      e.ca = round2(e.ca + invoiceTotals(i).ht);
      e.n += 1;
      map.set(i.customerId, e);
    }
    return [...map.entries()].map(([id, v]) => ({ id, name: cName(id), ...v })).sort((a, b) => b.ca - a.ca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, customers]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { ca: number; qty: number }>();
    for (const i of invoices) for (const l of i.lines) {
      const e = map.get(l.productId) ?? { ca: 0, qty: 0 };
      e.ca = round2(e.ca + l.quantity * l.unitPrice * (1 - (l.discount ?? 0) / 100));
      e.qty += l.quantity;
      map.set(l.productId, e);
    }
    return [...map.entries()].map(([id, v]) => ({ id, name: pName(id), ...v })).sort((a, b) => b.ca - a.ca).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, products]);

  const byRep = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of invoices) {
      const rep = customers.find((c) => c.id === i.customerId)?.salesRep ?? "—";
      map.set(rep, round2((map.get(rep) ?? 0) + invoiceTotals(i).ht));
    }
    return [...map.entries()].map(([name, ca]) => ({ name, ca })).sort((a, b) => b.ca - a.ca);
  }, [invoices, customers]);

  const exportInvoices = () =>
    downloadCsv(`factures-clients-${year}.csv`, ["N°", "Client", "Date", "Échéance", "HT", "TVA", "TTC", "Encaissé", "Reste"],
      invoices.map((i) => {
        const t = invoiceTotals(i);
        const rest = invoiceOutstanding(i, collections);
        return [i.number, cName(i.customerId), i.date, i.dueDate, t.ht, t.tva, t.ttc, round2(t.ttc - rest), rest];
      }));
  const exportOrders = () =>
    downloadCsv(`commandes-clients-${year}.csv`, ["N°", "Client", "Date", "Livraison souhaitée", "HT", "TVA", "TTC", "Statut"],
      orders.map((o) => { const t = totals(o.lines); return [o.number, cName(o.customerId), o.date, o.deliveryDate, t.ht, t.tva, t.ttc, orderStatus(o)]; }));
  const exportReceivables = () =>
    downloadCsv(`creances-clients.csv`, ["N°", "Client", "Échéance", "Reste dû", "Retard (jours)"],
      invoices.filter((i) => invoiceOutstanding(i, collections) > 0).map((i) => [
        i.number, cName(i.customerId), i.dueDate, invoiceOutstanding(i, collections),
        Math.max(0, Math.floor((new Date(now).getTime() - new Date(i.dueDate).getTime()) / 86_400_000)),
      ]));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`CA ${year} (HT)`} value={fmt(caYtd)} sub={`${ytd.length} facture(s) validée(s)`} />
        <StatCard label="Marge brute" value={fmt(margin.margin)} sub={margin.rate === null ? "Coûts articles indisponibles" : `${margin.rate} % du CA HT`} tone={margin.rate !== null && margin.rate < 15 ? "bad" : "good"} />
        <StatCard label="Panier moyen" value={fmt(avgBasket)} sub={`${activeOrders.length} commande(s) TTC`} />
        <StatCard label="Conversion / délai" value={conv === null ? "n.c." : `${conv} %`} sub={`Délai moyen d'encaissement : ${delay === null ? "n.c." : `${delay} j`}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Chiffre d'affaires par commercial" subtitle="HT facturé, tous exercices">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRep} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} width={40} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ca" name="CA HT" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Concentration clients" subtitle="Part des 5 premiers clients dans le CA facturé">
          <ul className="space-y-2 text-sm">
            {byCustomer.slice(0, 5).map((c) => {
              const total = byCustomer.reduce((a, x) => a + x.ca, 0);
              const share = total > 0 ? Math.round((c.ca / total) * 100) : 0;
              return (
                <li key={c.id} className="space-y-1">
                  <div className="flex justify-between gap-2"><span className="text-foreground">{c.name}</span><span className="text-xs text-muted-foreground">{fmt(c.ca)} · {share} %</span></div>
                  <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${share}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="CA par client" subtitle="HT facturé et nombre de factures">
          <Table empty={byCustomer.length === 0} head={<><Th>Client</Th><Th right>CA HT</Th><Th right>Factures</Th><Th right>Part</Th></>}>
            {byCustomer.map((c) => {
              const total = byCustomer.reduce((a, x) => a + x.ca, 0);
              return (
                <tr key={c.id} className={rowCls}>
                  <Td>{c.name}</Td><Td right>{fmt2(c.ca)}</Td><Td right muted>{c.n}</Td><Td right muted>{total > 0 ? `${Math.round((c.ca / total) * 100)} %` : "—"}</Td>
                </tr>
              );
            })}
          </Table>
        </Panel>
        <Panel title="CA par article" subtitle="Top 10 — HT facturé">
          <Table empty={byProduct.length === 0} head={<><Th>Article</Th><Th right>Quantité</Th><Th right>CA HT</Th></>}>
            {byProduct.map((p) => (
              <tr key={p.id} className={rowCls}><Td>{p.name}</Td><Td right muted>{p.qty}</Td><Td right>{fmt2(p.ca)}</Td></tr>
            ))}
          </Table>
        </Panel>
      </div>

      <Panel title="Exports" subtitle="Fichiers CSV (séparateur « ; », compatible Excel)">
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={exportInvoices}><Download className="h-4 w-4" /> Journal des factures</Btn>
          <Btn variant="ghost" onClick={exportOrders}><Download className="h-4 w-4" /> Journal des commandes</Btn>
          <Btn variant="ghost" onClick={exportReceivables}><Download className="h-4 w-4" /> Créances en cours</Btn>
        </div>
      </Panel>
    </div>
  );
}
