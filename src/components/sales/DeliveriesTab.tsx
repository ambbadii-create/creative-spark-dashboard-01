import { useMemo, useState } from "react";
import { Search, Truck } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { Btn } from "@/components/budget/ui";
import { useStock } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import { orderStatus, remainingToDeliver, type SalesOrder } from "@/lib/sales/model";
import { DeliverDialog } from "./DeliverDialog";
import { fdate, IconBtn, OrderBadge, rowCls, Table, Td, Th, today } from "./ui";

export function DeliveriesTab() {
  const { deliveries, orders, customers } = useSales();
  const { products } = useStock();
  const [q, setQ] = useState("");
  const [delivering, setDelivering] = useState<SalesOrder | null>(null);
  const now = today();
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const pName = (id: string) => products.find((p) => p.id === id)?.designation ?? id;
  const orderOf = (orderId: string) => orders.find((o) => o.id === orderId);

  const pending = useMemo(
    () => orders.filter((o) => ["Confirmée", "Partiellement livrée"].includes(orderStatus(o))).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)),
    [orders],
  );
  const rows = useMemo(
    () =>
      deliveries
        .filter((d) => {
          const o = orderOf(d.orderId);
          return `${d.number} ${o?.number ?? ""} ${o ? cName(o.customerId) : ""}`.toLowerCase().includes(q.toLowerCase());
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deliveries, orders, q, customers],
  );

  return (
    <div className="space-y-5">
      <Panel title="Commandes à livrer" subtitle="Les quantités expédiées débitent automatiquement le stock">
        <Table empty={pending.length === 0} head={<><Th>Commande</Th><Th>Client</Th><Th>Livraison souhaitée</Th><Th right>Reste à livrer</Th><Th>Statut</Th><Th /></>}>
          {pending.map((o) => {
            const rest = o.lines.reduce((a, l) => a + remainingToDeliver(l), 0);
            return (
              <tr key={o.id} className={rowCls}>
                <Td strong>{o.number}</Td>
                <Td>{cName(o.customerId)}</Td>
                <Td muted>{fdate(o.deliveryDate)}{o.deliveryDate < now && <span className="ml-1 text-destructive">(en retard)</span>}</Td>
                <Td right muted>{rest} article(s)</Td>
                <Td><OrderBadge s={orderStatus(o)} /></Td>
                <Td><Btn variant="ghost" onClick={() => setDelivering(o)}><Truck className="h-4 w-4" /> Livrer</Btn></Td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      <Panel title="Bons de livraison" subtitle="Historique des expéditions">
        <div className="mb-4 max-w-sm">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de BL, commande, client" className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring" />
          </label>
        </div>
        <Table empty={rows.length === 0} head={<><Th>N° BL</Th><Th>Commande</Th><Th>Client</Th><Th>Date</Th><Th>Contenu</Th></>}>
          {rows.map((d) => {
            const o = orderOf(d.orderId);
            return (
              <tr key={d.id} className={rowCls}>
                <Td strong>{d.number}</Td>
                <Td muted>{o?.number ?? "—"}</Td>
                <Td>{o ? cName(o.customerId) : "—"}</Td>
                <Td muted>{fdate(d.date)}</Td>
                <Td muted>{d.lines.map((l) => `${pName(l.productId)} × ${l.quantity}`).join(", ")}</Td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      {delivering && <DeliverDialog order={delivering} onClose={() => setDelivering(null)} />}
    </div>
  );
}
