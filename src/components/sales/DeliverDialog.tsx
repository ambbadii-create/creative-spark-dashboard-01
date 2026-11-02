import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Btn } from "@/components/budget/ui";
import { useStock } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import { remainingToDeliver, type SalesOrder } from "@/lib/sales/model";
import { fmt2 } from "./ui";

/** Saisie des quantités livrées : plafonnées au reste à livrer et au stock disponible (sortie de stock automatique). */
export function DeliverDialog({ order, onClose }: { order: SalesOrder; onClose: () => void }) {
  const { products } = useStock();
  const { customers, deliver } = useSales();
  const [wanted, setWanted] = useState<Record<string, number>>(() => Object.fromEntries(order.lines.map((l) => [l.productId, remainingToDeliver(l)])));
  const [err, setErr] = useState("");
  const c = customers.find((x) => x.id === order.customerId);

  const submit = () => {
    const e = deliver(order.id, wanted);
    if (e) return setErr(e);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Livrer {order.number}</DialogTitle>
          <DialogDescription>{c?.name ?? "—"} · le stock est débité des quantités effectivement expédiées.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {order.lines.map((l) => {
            const p = products.find((x) => x.id === l.productId);
            const rest = remainingToDeliver(l);
            return (
              <div key={l.productId} className="grid grid-cols-[1fr_90px_90px_110px] items-center gap-2 text-sm">
                <span className="text-foreground">{p ? `${p.ref} · ${p.designation}` : l.productId}</span>
                <span className="text-right text-muted-foreground">Reste {rest}</span>
                <span className="text-right text-muted-foreground">Stock {p?.stock ?? 0}</span>
                <input
                  type="number" min={0} max={rest} value={wanted[l.productId] ?? 0}
                  onChange={(e) => setWanted((w) => ({ ...w, [l.productId]: Number(e.target.value) }))}
                  className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  disabled={rest === 0}
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Valeur de la livraison : {fmt2(order.lines.reduce((a, l) => a + Math.min(remainingToDeliver(l), wanted[l.productId] ?? 0) * l.unitPrice * (1 - (l.discount ?? 0) / 100), 0))} HT</p>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
          <Btn type="button" onClick={submit}>Valider la livraison</Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
