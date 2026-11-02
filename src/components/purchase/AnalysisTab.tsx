import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/app/ui-bits";
import { Btn, fmt, StatCard } from "@/components/budget/ui";
import { downloadCsv } from "@/components/stock/ui";
import { ORDER_STATUSES, toCsv } from "@/lib/stock/model";
import { useStock } from "@/lib/stock/store";
import { usePurchase } from "@/lib/purchase/store";
import { avgPaymentDelay, concentration, orderTotals } from "@/lib/purchase/model";
import { deliveryPerformance, monthlySpend, spendByCategory, spendBySupplier } from "./analytics";
import { rowCls, Table, Td, Th, today } from "./ui";

export function AnalysisTab() {
  const { orders, products } = useStock();
  const { invoices, payments, receipts } = usePurchase();
  const year = Number(today().slice(0, 4));
  const monthly = monthlySpend(orders, invoices, year);
  const bySupplier = spendBySupplier(orders);
  const byCat = spendByCategory(orders, products);
  const perf = deliveryPerformance(orders, receipts);
  const delay = avgPaymentDelay(invoices, payments);
  const conc = concentration(bySupplier.map((s) => s.value));
  const byStatus = ORDER_STATUSES.map((s) => {
    const list = orders.filter((o) => o.status === s);
    return { s, n: list.length, ttc: list.reduce((a, o) => a + orderTotals(o).ttc, 0) };
  }).filter((x) => x.n > 0);
  const total = bySupplier.reduce((a, s) => a + s.value, 0);

  const exportCsv = () =>
    downloadCsv(
      "analyse-achats.csv",
      toCsv(
        ["Section", "Libellé", "Montant HT (DH)", "Part (%)"],
        [
          ...monthly.map((m) => ["Mensuel engagé", m.mois, m.engage, ""] as (string | number)[]),
          ...monthly.map((m) => ["Mensuel facturé", m.mois, m.facture, ""] as (string | number)[]),
          ...bySupplier.map((s) => ["Fournisseur", s.name, s.value, total ? Math.round((s.value / total) * 1000) / 10 : 0]),
          ...byCat.map((c) => ["Catégorie", c.name, c.value, total ? Math.round((c.value / total) * 1000) / 10 : 0]),
        ],
      ),
    );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Btn variant="ghost" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Btn>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Engagements HT" value={fmt(total)} sub="Commandes hors brouillons et annulées" />
        <StatCard label="Délai moyen de paiement" value={delay === null ? "n.c." : `${delay} j`} sub="Date facture → règlement" />
        <StatCard label="Premier fournisseur" value={conc ? `${conc.top1.toLocaleString("fr-FR")} %` : "n.c."} sub="Part des engagements" />
        <StatCard label="Top 3 fournisseurs" value={conc ? `${conc.top3.toLocaleString("fr-FR")} %` : "n.c."} sub="Concentration" tone={conc && conc.top3 > 80 ? "bad" : undefined} />
      </div>

      <Panel title="Dépenses mensuelles" subtitle={`HT, ${year} — engagé (commandes) vs facturé`}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} width={40} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="engage" name="Engagé" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="facture" name="Facturé" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Achats par fournisseur">
          <Table head={<><Th>Fournisseur</Th><Th right>HT</Th><Th right>Part</Th></>}>
            {bySupplier.map((s) => (
              <tr key={s.name} className={rowCls}><Td>{s.name}</Td><Td right strong>{fmt(s.value)}</Td><Td right muted>{total ? Math.round((s.value / total) * 100) : 0} %</Td></tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Achats par catégorie">
          <Table head={<><Th>Catégorie</Th><Th right>HT</Th><Th right>Part</Th></>}>
            {byCat.map((c) => (
              <tr key={c.name} className={rowCls}><Td>{c.name}</Td><Td right strong>{fmt(c.value)}</Td><Td right muted>{total ? Math.round((c.value / total) * 100) : 0} %</Td></tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Commandes par statut">
          <Table head={<><Th>Statut</Th><Th right>Nombre</Th><Th right>TTC</Th></>}>
            {byStatus.map((x) => (
              <tr key={x.s} className={rowCls}><Td>{x.s}</Td><Td right>{x.n}</Td><Td right strong>{fmt(x.ttc)}</Td></tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Performance de livraison" subtitle="Réceptions au plus tard à la date prévue">
          <Table head={<><Th>Fournisseur</Th><Th right>Commandes</Th><Th right>Réceptions</Th><Th right>À l'heure</Th></>}>
            {perf.map((p) => (
              <tr key={p.name} className={rowCls}><Td>{p.name}</Td><Td right>{p.orders}</Td><Td right>{p.receipts}</Td><Td right strong>{p.rate === null ? "n.c." : `${p.rate} %`}</Td></tr>
            ))}
          </Table>
        </Panel>
      </div>
    </div>
  );
}
