// Agrégats partagés entre Vue d'ensemble et Analyse des achats.
import { lineNetHT, type Product, type PurchaseOrder } from "@/lib/stock/model";
import { orderTotals, round2, type Invoice, type Receipt } from "@/lib/purchase/model";

export const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const live = (orders: PurchaseOrder[]) => orders.filter((o) => o.status !== "Annulée" && o.status !== "Brouillon");

/** Engagements (commandes HT) et achats facturés (factures HT) par mois de l'année. */
export function monthlySpend(orders: PurchaseOrder[], invoices: Invoice[], year: number) {
  const rows = MONTHS.map((mois) => ({ mois, engage: 0, facture: 0 }));
  for (const o of live(orders)) if (new Date(o.date).getFullYear() === year) rows[new Date(o.date).getMonth()]!.engage += orderTotals(o).ht;
  for (const i of invoices) if (new Date(i.date).getFullYear() === year) rows[new Date(i.date).getMonth()]!.facture += i.ht;
  return rows.map((r) => ({ ...r, engage: round2(r.engage), facture: round2(r.facture) }));
}

export function spendByCategory(orders: PurchaseOrder[], products: Product[]) {
  const m = new Map<string, number>();
  for (const o of live(orders)) for (const l of o.lines) {
    const c = products.find((p) => p.id === l.productId)?.category ?? "Autres";
    m.set(c, (m.get(c) ?? 0) + lineNetHT(l));
  }
  return [...m.entries()].map(([name, value]) => ({ name, value: round2(value) })).sort((a, b) => b.value - a.value);
}

export function spendBySupplier(orders: PurchaseOrder[]) {
  const m = new Map<string, number>();
  for (const o of live(orders)) m.set(o.supplier, (m.get(o.supplier) ?? 0) + orderTotals(o).ht);
  return [...m.entries()].map(([name, value]) => ({ name, value: round2(value) })).sort((a, b) => b.value - a.value);
}

/** Performance de livraison : part des réceptions effectuées au plus tard à la date prévue. */
export function deliveryPerformance(orders: PurchaseOrder[], receipts: Receipt[]) {
  const m = new Map<string, { receipts: number; onTime: number; orders: number }>();
  for (const o of live(orders)) {
    const e = m.get(o.supplier) ?? { receipts: 0, onTime: 0, orders: 0 };
    e.orders++;
    for (const r of receipts.filter((x) => x.orderId === o.id)) {
      e.receipts++;
      if (r.date <= o.expected) e.onTime++;
    }
    m.set(o.supplier, e);
  }
  return [...m.entries()].map(([name, e]) => ({ name, ...e, rate: e.receipts ? Math.round((e.onTime / e.receipts) * 100) : null }));
}
