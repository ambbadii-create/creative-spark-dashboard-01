import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Printer, Search, Truck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field, Select } from "@/components/budget/ui";
import { OrderStatusBadge } from "@/components/stock/ui";
import { useStock, sid } from "@/lib/stock/store";
import { lineNetHT, ORDER_STATUSES, type OrderLine, type OrderStatus, type PurchaseOrder } from "@/lib/stock/model";
import { usePurchase } from "@/lib/purchase/store";
import { addDays, DEFAULT_VAT, orderTotals, PAYMENT_TERMS, termDays } from "@/lib/purchase/model";
import { fdate, fmt2, IconBtn, rowCls, Table, Td, Th, today } from "./ui";
import { ReceiveDialog } from "./ReceiptsTab";

export type OrderSeed = { supplier?: string; lines?: OrderLine[]; requestId?: string };

export function OrdersTab({ seed, onSeedConsumed }: { seed: OrderSeed | null; onSeedConsumed: () => void }) {
  const { orders } = useStock();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const creating = seed !== null;

  const rows = useMemo(
    () =>
      orders
        .filter((o) => (status === "all" || o.status === status) && `${o.number} ${o.supplier}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [orders, q, status],
  );

  return (
    <Panel
      title="Commandes fournisseurs"
      subtitle="Commandes partagées avec Stocks & Approvisionnements — montants HT, TVA et TTC"
      action={
        <Btn onClick={() => setEditing({} as PurchaseOrder)}>
          <Plus className="h-4 w-4" /> Nouvelle commande
        </Btn>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de commande ou fournisseur" className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring" />
        </label>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Tous les statuts</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>
      <Table
        empty={rows.length === 0}
        head={
          <>
            <Th>N° commande</Th><Th>Fournisseur</Th><Th>Date</Th><Th>Livraison prévue</Th><Th>Conditions</Th><Th right>HT</Th><Th right>TTC</Th><Th>Statut</Th><Th />
          </>
        }
      >
        {rows.map((o) => {
          const t = orderTotals(o);
          const late = o.expected < today() && !["Reçue", "Annulée"].includes(o.status);
          return (
            <tr key={o.id} className={rowCls}>
              <Td strong>{o.number}</Td>
              <Td>{o.supplier}</Td>
              <Td muted>{fdate(o.date)}</Td>
              <Td muted>
                {fdate(o.expected)} {late && <span className="text-xs text-destructive">(en retard)</span>}
              </Td>
              <Td muted>{o.paymentTerms ?? "—"}</Td>
              <Td right>{fmt2(t.ht)}</Td>
              <Td right strong>{fmt2(t.ttc)}</Td>
              <Td><OrderStatusBadge status={o.status} /></Td>
              <Td className="whitespace-nowrap">
                <IconBtn title="Modifier" onClick={() => setEditing(o)}><Pencil className="h-4 w-4" /></IconBtn>
                {["Validée", "Envoyée", "Partiellement reçue"].includes(o.status) && (
                  <IconBtn title="Réceptionner" onClick={() => setReceiving(o)}><Truck className="h-4 w-4" /></IconBtn>
                )}
                <IconBtn title="Imprimer le bon de commande" onClick={() => printOrder(o)}><Printer className="h-4 w-4" /></IconBtn>
              </Td>
            </tr>
          );
        })}
      </Table>
      {(editing || creating) && (
        <OrderDialog
          order={editing?.id ? editing : undefined}
          seed={seed ?? undefined}
          onClose={() => {
            setEditing(null);
            onSeedConsumed();
          }}
        />
      )}
      {receiving && <ReceiveDialog order={receiving} onClose={() => setReceiving(null)} />}
    </Panel>
  );
}

function OrderDialog({ order, seed, onClose }: { order?: PurchaseOrder | undefined; seed?: OrderSeed | undefined; onClose: () => void }) {
  const { products, orders, upsertOrder } = useStock();
  const { suppliers, vatRates, requests, upsertRequest } = usePurchase();
  const active = suppliers.filter((s) => s.active || s.name === order?.supplier);
  const locked = order && ["Partiellement reçue", "Reçue"].includes(order.status);
  const [f, setF] = useState<PurchaseOrder>(() => {
    if (order) return { ...order, lines: order.lines.map((l) => ({ ...l, vatRate: l.vatRate ?? DEFAULT_VAT, discount: l.discount ?? 0 })) };
    const supplier = seed?.supplier ?? "";
    const terms = suppliers.find((s) => s.name === supplier)?.paymentTerms ?? "60 jours";
    const next = Math.max(40, ...orders.map((o) => Number(o.number.split("-").pop()) || 0)) + 1;
    return { id: sid("O"), number: `CMD-2026-${String(next).padStart(3, "0")}`, supplier, date: today(), expected: addDays(today(), 14), status: "Brouillon", paymentTerms: terms, lines: seed?.lines ?? [] };
  });
  const [err, setErr] = useState("");
  const set = <K extends keyof PurchaseOrder>(k: K, v: PurchaseOrder[K]) => setF((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, p: Partial<OrderLine>) => setF((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) }));
  const t = orderTotals(f);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.supplier) return setErr("Sélectionnez un fournisseur.");
    if (f.lines.length === 0) return setErr("Ajoutez au moins une ligne.");
    if (f.lines.some((l) => !(l.quantity > 0) || l.unitCost < 0)) return setErr("Quantités > 0 et prix positifs obligatoires.");
    if (f.lines.some((l) => (l.discount ?? 0) < 0 || (l.discount ?? 0) > 100)) return setErr("La remise doit être comprise entre 0 et 100 %.");
    if (f.lines.some((l) => l.quantity < l.received)) return setErr("Une quantité ne peut pas être inférieure à la quantité déjà reçue.");
    if (new Set(f.lines.map((l) => l.productId)).size !== f.lines.length) return setErr("Un article ne peut figurer qu'une fois par commande.");
    if (f.expected < f.date) return setErr("La livraison prévue ne peut pas précéder la date de commande.");
    upsertOrder(f);
    if (seed?.requestId) {
      const r = requests.find((x) => x.id === seed.requestId);
      if (r) upsertRequest({ ...r, status: "Convertie en commande", orderId: f.id });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? `Modifier ${order.number}` : "Nouvelle commande fournisseur"}</DialogTitle>
          <DialogDescription>Totaux HT, TVA et TTC calculés automatiquement ligne par ligne.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select
              label="Fournisseur *"
              value={f.supplier}
              className="col-span-2"
              disabled={!!locked}
              onChange={(e) => {
                const s = suppliers.find((x) => x.name === e.target.value);
                setF((x) => ({ ...x, supplier: e.target.value, paymentTerms: s?.paymentTerms ?? x.paymentTerms }));
              }}
            >
              <option value="">— Choisir —</option>
              {active.map((s) => (
                <option key={s.id} value={s.name}>{s.code} · {s.name}</option>
              ))}
            </Select>
            <Field label="Date de commande" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
            <Field label="Livraison prévue" type="date" value={f.expected} onChange={(e) => set("expected", e.target.value)} />
            <Select label="Conditions de paiement" value={f.paymentTerms ?? ""} onChange={(e) => set("paymentTerms", e.target.value)} className="col-span-2">
              {PAYMENT_TERMS.map((p) => <option key={p}>{p}</option>)}
            </Select>
            <Select label="Statut" value={f.status} onChange={(e) => set("status", e.target.value as OrderStatus)} className="col-span-2" disabled={!!locked}>
              {(locked ? [f.status] : ORDER_STATUSES.filter((s) => s !== "Reçue" && s !== "Partiellement reçue")).map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Lignes</p>
              <Btn type="button" variant="ghost" onClick={() => setF((x) => ({ ...x, lines: [...x.lines, { productId: products[0]?.id ?? "", quantity: 1, received: 0, unitCost: products[0]?.unitCost ?? 0, discount: 0, vatRate: DEFAULT_VAT }] }))}>
                <Plus className="h-4 w-4" /> Ajouter une ligne
              </Btn>
            </div>
            {f.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-border p-2 md:grid-cols-[1fr_80px_100px_70px_80px_110px_32px] md:border-0 md:p-0">
                <Select label={i === 0 ? "Article" : undefined} value={l.productId} className="col-span-2 md:col-span-1" onChange={(e) => setLine(i, { productId: e.target.value, unitCost: products.find((p) => p.id === e.target.value)?.unitCost ?? l.unitCost })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.designation}</option>)}
                </Select>
                <Field label={i === 0 ? "Qté" : undefined} type="number" min={Math.max(1, l.received)} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                <Field label={i === 0 ? "PU HT" : undefined} type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: Number(e.target.value) })} />
                <Field label={i === 0 ? "Remise %" : undefined} type="number" min={0} max={100} value={l.discount ?? 0} onChange={(e) => setLine(i, { discount: Number(e.target.value) })} />
                <Select label={i === 0 ? "TVA" : undefined} value={l.vatRate ?? DEFAULT_VAT} onChange={(e) => setLine(i, { vatRate: Number(e.target.value) })}>
                  {vatRates.map((r) => <option key={r} value={r}>{r} %</option>)}
                </Select>
                <p className="pb-2 text-right text-sm font-semibold text-foreground">{fmt2(lineNetHT(l))}</p>
                <button type="button" disabled={l.received > 0} title={l.received > 0 ? "Ligne déjà partiellement reçue" : "Supprimer"} onClick={() => setF((x) => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))} className="mb-1 rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive disabled:opacity-30">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="text-foreground">{fmt2(t.ht)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="text-foreground">{fmt2(t.tva)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 font-bold"><span className="text-foreground">Total TTC</span><span className="text-foreground">{fmt2(t.ttc)}</span></div>
            <p className="pt-1 text-xs text-muted-foreground">Échéance estimée : {fdate(addDays(f.date, termDays(f.paymentTerms ?? "")))}</p>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">{order ? "Enregistrer" : "Créer la commande"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Bon de commande imprimable (fenêtre d'impression du navigateur). */
function printOrder(o: PurchaseOrder) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const t = orderTotals(o);
  const rows = o.lines
    .map((l) => `<tr><td>${esc(l.productId)}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">${fmt2(l.unitCost)}</td><td style="text-align:right">${l.discount ?? 0} %</td><td style="text-align:right">${l.vatRate ?? DEFAULT_VAT} %</td><td style="text-align:right">${fmt2(lineNetHT(l))}</td></tr>`)
    .join("");
  w.document.write(`<html><head><title>${esc(o.number)}</title><style>body{font-family:sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #ddd;padding:6px;font-size:13px;text-align:left}</style></head><body>
  <h2>Bon de commande ${esc(o.number)}</h2><p>Société Atlas SA — Données de démonstration</p>
  <p><b>Fournisseur :</b> ${esc(o.supplier)}<br/><b>Date :</b> ${fdate(o.date)} — <b>Livraison prévue :</b> ${fdate(o.expected)}<br/><b>Conditions :</b> ${esc(o.paymentTerms ?? "—")}</p>
  <table><thead><tr><th>Article</th><th>Qté</th><th>PU HT</th><th>Remise</th><th>TVA</th><th>Montant HT</th></tr></thead><tbody>${rows}</tbody></table>
  <p style="text-align:right">Total HT : ${fmt2(t.ht)}<br/>TVA : ${fmt2(t.tva)}<br/><b>Total TTC : ${fmt2(t.ttc)}</b></p>
  <script>window.print()</script></body></html>`);
  w.document.close();
}
