import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PackageCheck, Pencil, Plus, Trash2, X } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sid, useStock } from "@/lib/stock/store";
import { ORDER_STATUSES, orderQty, orderTotal, remainingQty, warehouseLabel, type OrderLine, type OrderStatus, type PurchaseOrder } from "@/lib/stock/model";
import { Btn, Field, fmt, Select, thead, trow } from "@/components/budget/ui";
import { OrderStatusBadge } from "./ui";

export type OrderDraft = { productId?: string; quantity?: number };

export function OrdersTab({ draft, onDraftConsumed }: { draft: OrderDraft | null; onDraftConsumed: () => void }) {
  const { products, orders, deleteOrder } = useStock();
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [creating, setCreating] = useState<OrderDraft | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    if (draft) {
      setCreating(draft);
      onDraftConsumed();
    }
  }, [draft, onDraftConsumed]);

  const productOf = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const filtered = useMemo(
    () => orders.filter((o) => status === "all" || o.status === status).sort((a, b) => b.date.localeCompare(a.date)),
    [orders, status],
  );

  return (
    <Panel
      title="Approvisionnements & commandes fournisseurs"
      subtitle={`${filtered.length} commande(s) affichée(s) sur ${orders.length}`}
      action={
        <Btn onClick={() => setCreating({})}>
          <Plus className="h-4 w-4" />
          Nouvelle commande
        </Btn>
      }
    >
      <div className="mb-4 max-w-xs">
        <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Tous</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={thead}>
            <tr>
              <th className="py-2.5 pr-3 font-medium">Numéro</th>
              <th className="py-2.5 pr-3 font-medium">Fournisseur</th>
              <th className="py-2.5 pr-3 font-medium">Commande</th>
              <th className="py-2.5 pr-3 font-medium">Livraison prévue</th>
              <th className="py-2.5 pr-3 text-right font-medium">Articles</th>
              <th className="py-2.5 pr-3 text-right font-medium">Montant</th>
              <th className="py-2.5 pr-3 font-medium">Réception</th>
              <th className="py-2.5 pr-3 font-medium">Statut</th>
              <th className="py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const received = o.lines.reduce((a, l) => a + l.received, 0);
              const total = orderQty(o);
              const late = (o.status === "Validée" || o.status === "Partiellement reçue") && o.expected < new Date().toISOString().slice(0, 10);
              return (
                <tr key={o.id} className={trow}>
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{o.number}</td>
                  <td className="py-2.5 pr-3 font-medium text-foreground">{o.supplier}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{new Date(o.date).toLocaleDateString("fr-FR")}</td>
                  <td className="py-2.5 pr-3">
                    <span className={late ? "font-semibold text-destructive" : "text-muted-foreground"}>{new Date(o.expected).toLocaleDateString("fr-FR")}</span>
                    {late && <span className="ml-1 text-xs text-destructive">(en retard)</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {o.lines.length} ligne(s) · {total.toLocaleString("fr-FR")} u.
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-foreground">{fmt(orderTotal(o))}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {received.toLocaleString("fr-FR")} / {total.toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2.5 pr-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {(o.status === "Validée" || o.status === "Partiellement reçue") && (
                        <button onClick={() => setReceiving(o)} title="Réceptionner" className="rounded-md p-1.5 text-muted-foreground hover:bg-success-soft hover:text-success">
                          <PackageCheck className="h-4 w-4" />
                        </button>
                      )}
                      {o.status !== "Reçue" && (
                        <button onClick={() => setEditing(o)} title="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm(`Supprimer la commande ${o.number} ?`)) deleteOrder(o.id);
                        }}
                        title="Supprimer"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Aucune commande ne correspond au filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && <OrderDialog order={editing ?? undefined} draft={creating ?? undefined} onClose={() => { setCreating(null); setEditing(null); }} />}
      {receiving && <ReceiveDialog order={receiving} onClose={() => setReceiving(null)} />}
      <p className="mt-3 text-xs text-muted-foreground">Produits référencés : {productOf.size}. La réception d'une commande crée automatiquement les mouvements d'entrée correspondants.</p>
    </Panel>
  );
}

function OrderDialog({ order, draft, onClose }: { order?: PurchaseOrder | undefined; draft?: OrderDraft | undefined; onClose: () => void }) {
  const { products, orders, upsertOrder } = useStock();
  const isEdit = !!order;
  const [f, setF] = useState<PurchaseOrder>(() => {
    if (order) return order;
    const lines: OrderLine[] = draft?.productId ? [{ productId: draft.productId, quantity: draft.quantity ?? 1, received: 0, unitCost: products.find((p) => p.id === draft.productId)?.unitCost ?? 0 }] : [];
    return {
      id: sid("O"),
      number: `CMD-2026-${String(orders.length + 41).padStart(3, "0")}`,
      supplier: "",
      date: new Date().toISOString().slice(0, 10),
      expected: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
      status: "Brouillon",
      lines,
    };
  });
  const [err, setErr] = useState("");
  const set = <K extends keyof PurchaseOrder>(k: K, v: PurchaseOrder[K]) => setF((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, patch: Partial<OrderLine>) => setF((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.supplier.trim()) return setErr("Le fournisseur est obligatoire.");
    if (f.lines.length === 0) return setErr("Ajoutez au moins une ligne de commande.");
    if (f.lines.some((l) => l.quantity <= 0)) return setErr("Chaque ligne doit avoir une quantité supérieure à zéro.");
    if (f.expected < f.date) return setErr("La livraison prévue ne peut pas précéder la date de commande.");
    upsertOrder({ ...f, supplier: f.supplier.trim() });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Modifier ${order.number}` : "Nouvelle commande fournisseur"}</DialogTitle>
          <DialogDescription>Le montant total est calculé automatiquement à partir des lignes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Fournisseur *" value={f.supplier} onChange={(e) => set("supplier", e.target.value)} className="col-span-2" placeholder="Coopérative Zaytouna" />
            <Field label="Date de commande" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
            <Field label="Livraison prévue" type="date" value={f.expected} onChange={(e) => set("expected", e.target.value)} />
            <Select label="Statut" value={f.status} onChange={(e) => set("status", e.target.value as OrderStatus)} className="col-span-2">
              {ORDER_STATUSES.filter((s) => s !== "Reçue" && s !== "Partiellement reçue").map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Lignes de commande</p>
              <Btn
                type="button"
                variant="ghost"
                onClick={() => setF((x) => ({ ...x, lines: [...x.lines, { productId: products[0]?.id ?? "", quantity: 1, received: 0, unitCost: products[0]?.unitCost ?? 0 }] }))}
              >
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </Btn>
            </div>
            {f.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_110px_32px] items-end gap-2">
                <Select
                  label={i === 0 ? "Article" : undefined}
                  value={l.productId}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setLine(i, { productId: e.target.value, unitCost: p?.unitCost ?? l.unitCost });
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ref} · {p.designation}
                    </option>
                  ))}
                </Select>
                <Field label={i === 0 ? "Quantité" : undefined} type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                <Field label={i === 0 ? "Coût unit. (DH)" : undefined} type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: Number(e.target.value) })} />
                <button type="button" onClick={() => setF((x) => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))} className="mb-1 rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-right text-sm font-semibold text-foreground">Total : {fmt(orderTotal(f))}</p>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Btn>
            <Btn type="submit">{isEdit ? "Enregistrer" : "Créer la commande"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const { products, receiveOrder } = useStock();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(order.lines.map((l) => [l.productId, remainingQty(l)])));
  const productOf = (id: string) => products.find((p) => p.id === id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réceptionner {order.number}</DialogTitle>
          <DialogDescription>Seules les quantités réellement reçues sont ajoutées au stock. Le reste demeure à recevoir.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            receiveOrder(order.id, qty);
            onClose();
          }}
        >
          {order.lines.map((l) => {
            const p = productOf(l.productId);
            const rest = remainingQty(l);
            return (
              <div key={l.productId} className="flex items-end justify-between gap-3 rounded-lg border border-border p-3">
                <div className="text-sm">
                  <p className="font-medium text-foreground">{p?.designation ?? l.productId}</p>
                  <p className="text-xs text-muted-foreground">
                    Reçu : {l.received} / {l.quantity} — reste {rest} · {p ? warehouseLabel(p.warehouseId) : ""}
                  </p>
                </div>
                <Field
                  label="À recevoir"
                  type="number"
                  min={0}
                  max={rest}
                  value={qty[l.productId] ?? 0}
                  onChange={(e) => setQty((q) => ({ ...q, [l.productId]: Math.min(rest, Math.max(0, Number(e.target.value))) }))}
                  className="w-28"
                />
              </div>
            );
          })}
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Btn>
            <Btn type="submit">Valider la réception</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
