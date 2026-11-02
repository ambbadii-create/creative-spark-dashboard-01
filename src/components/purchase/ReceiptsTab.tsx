import { useState } from "react";
import { Truck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field } from "@/components/budget/ui";
import { OrderStatusBadge } from "@/components/stock/ui";
import { useStock } from "@/lib/stock/store";
import { remainingQty, warehouseLabel, type PurchaseOrder } from "@/lib/stock/model";
import { usePurchase } from "@/lib/purchase/store";
import { Badge, fdate, rowCls, Table, Td, Th, today } from "./ui";

export function ReceiptsTab() {
  const { orders, products } = useStock();
  const { receipts } = usePurchase();
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const expected = orders.filter((o) => ["Validée", "Envoyée", "Partiellement reçue"].includes(o.status)).sort((a, b) => a.expected.localeCompare(b.expected));
  const pName = (id: string) => products.find((p) => p.id === id)?.designation ?? id;
  const oNum = (id: string) => orders.find((o) => o.id === id)?.number ?? id;

  return (
    <div className="space-y-5">
      <Panel title="Réceptions attendues" subtitle="Seules les quantités réellement reçues sont ajoutées au stock">
        <Table
          empty={expected.length === 0}
          head={<><Th>Commande</Th><Th>Fournisseur</Th><Th>Livraison prévue</Th><Th right>Reste à recevoir</Th><Th>Statut</Th><Th /></>}
        >
          {expected.map((o) => {
            const rest = o.lines.reduce((a, l) => a + remainingQty(l), 0);
            const late = o.expected < today();
            return (
              <tr key={o.id} className={rowCls}>
                <Td strong>{o.number}</Td>
                <Td>{o.supplier}</Td>
                <Td muted>{fdate(o.expected)} {late && <Badge t="bad">En retard</Badge>}</Td>
                <Td right>{rest.toLocaleString("fr-FR")}</Td>
                <Td><OrderStatusBadge status={o.status} /></Td>
                <Td right>
                  <Btn variant="ghost" onClick={() => setReceiving(o)}><Truck className="h-4 w-4" /> Réceptionner</Btn>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      <Panel title="Historique des réceptions" subtitle="Bons de réception enregistrés">
        <Table empty={receipts.length === 0} head={<><Th>N° réception</Th><Th>Date</Th><Th>Commande</Th><Th>Article</Th><Th right>Commandé</Th><Th right>Reçu</Th><Th>Écart / remarque</Th></>}>
          {[...receipts].reverse().flatMap((r) =>
            r.lines.map((l, i) => (
              <tr key={`${r.id}-${i}`} className={rowCls}>
                <Td strong>{i === 0 ? r.number : ""}</Td>
                <Td muted>{i === 0 ? fdate(r.date) : ""}</Td>
                <Td>{oNum(r.orderId)}</Td>
                <Td>{pName(l.productId)}</Td>
                <Td right>{l.ordered}</Td>
                <Td right strong>{l.received}</Td>
                <Td muted>{l.note ?? r.note ?? "—"}</Td>
              </tr>
            )),
          )}
        </Table>
      </Panel>
      {receiving && <ReceiveDialog order={receiving} onClose={() => setReceiving(null)} />}
    </div>
  );
}

export function ReceiveDialog({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const { products } = useStock();
  const { receive } = usePurchase();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(order.lines.map((l) => [l.productId, remainingQty(l)])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Réceptionner {order.number}</DialogTitle>
          <DialogDescription>Quantités plafonnées au reste à recevoir : une même livraison ne peut pas être enregistrée deux fois.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const r = receive(order.id, qty, notes);
            if (r) return setErr(r);
            onClose();
          }}
        >
          {order.lines.map((l) => {
            const p = products.find((x) => x.id === l.productId);
            const rest = remainingQty(l);
            const gap = rest - (qty[l.productId] ?? 0);
            return (
              <div key={l.productId} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_110px_1fr]">
                <div className="text-sm">
                  <p className="font-medium text-foreground">{p?.designation ?? l.productId}</p>
                  <p className="text-xs text-muted-foreground">Reçu {l.received} / {l.quantity} · reste {rest} · {p ? warehouseLabel(p.warehouseId) : ""}</p>
                  {gap > 0 && rest > 0 && <p className="text-xs text-warning">Écart : {gap} non livré(s)</p>}
                </div>
                <Field label="Reçu" type="number" min={0} max={rest} disabled={rest === 0} value={qty[l.productId] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [l.productId]: Math.min(rest, Math.max(0, Number(e.target.value))) }))} />
                <Field label="Remarque / écart" value={notes[l.productId] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [l.productId]: e.target.value }))} placeholder="Ex. colis endommagé" />
              </div>
            );
          })}
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">Valider la réception</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
