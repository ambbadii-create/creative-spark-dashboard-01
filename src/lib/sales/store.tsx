import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useStock, sid } from "@/lib/stock/store";
import { buildSalesDemo, type SalesState } from "./demo";
import {
  addDays, capDelivery, creditCheck, customerExposure, invoiceOutstanding, invoiceableLines, orderStatus, termDays, totals, validateCollection,
  type Collection, type Customer, type Opportunity, type Quote, type SalesInvoice, type SalesLine, type SalesOrder,
} from "./model";

const KEY = "pilotage-cg-ventes-v1";
const upsert = <T extends { id: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
const today = () => new Date().toISOString().slice(0, 10);
const seq = (prefix: string, n: number) => `${prefix}-2026-${String(n + 101).padStart(3, "0")}`;

type Ctx = SalesState & {
  upsertCustomer: (c: Customer) => void;
  upsertOpportunity: (o: Opportunity) => void;
  upsertQuote: (q: Quote) => void;
  /** Crée une commande (depuis un devis accepté ou en direct) après contrôle du plafond de crédit. */
  createOrder: (customerId: string, lines: SalesLine[], deliveryDate: string, quoteId?: string) => string | null;
  cancelOrder: (orderId: string) => string | null;
  /** Livraison : sort le stock (quantités plafonnées au reste à livrer et au stock) et crée le bon de livraison. */
  deliver: (orderId: string, wanted: Record<string, number>) => string | null;
  /** Facture le livré non encore facturé de la commande. */
  invoiceOrder: (orderId: string) => string | null;
  addCollection: (c: Collection) => string | null;
  reset: () => void;
};
const SalesCtx = createContext<Ctx | null>(null);

export function SalesProvider({ children }: { children: ReactNode }) {
  const stock = useStock();
  const [s, setS] = useState<SalesState>(buildSalesDemo);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS(JSON.parse(raw));
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(s));
  }, [s]);

  const ctx: Ctx = {
    ...s,
    upsertCustomer: (c) => setS((x) => ({ ...x, customers: upsert(x.customers, c) })),
    upsertOpportunity: (o) => setS((x) => ({ ...x, opportunities: upsert(x.opportunities, o) })),
    upsertQuote: (q) => setS((x) => ({ ...x, quotes: upsert(x.quotes, q) })),
    createOrder: (customerId, lines, deliveryDate, quoteId) => {
      const c = s.customers.find((x) => x.id === customerId);
      if (!c) return "Client introuvable.";
      if (!c.active) return "Ce client est inactif.";
      const clean = lines.filter((l) => l.productId && l.quantity > 0);
      if (!clean.length) return "Ajoutez au moins une ligne avec une quantité.";
      const exp = customerExposure(customerId, s.orders, s.invoices, s.collections).total;
      const err = creditCheck(c, exp, totals(clean).ttc);
      if (err) return err;
      const id = sid("SO");
      const order: SalesOrder = { id, number: seq("BC", s.orders.length), customerId, date: today(), deliveryDate, cancelled: false, quoteId, lines: clean.map((l) => ({ ...l, delivered: 0, invoiced: 0 })) };
      setS((x) => ({
        ...x,
        orders: [...x.orders, order],
        quotes: quoteId ? x.quotes.map((q) => (q.id === quoteId ? { ...q, status: "Converti", orderId: id } : q)) : x.quotes,
        opportunities: quoteId ? x.opportunities.map((o) => (o.quoteId === quoteId ? { ...o, stage: "Gagnée", probability: 100 } : o)) : x.opportunities,
      }));
      return null;
    },
    cancelOrder: (orderId) => {
      const o = s.orders.find((x) => x.id === orderId);
      if (!o) return "Commande introuvable.";
      if (o.lines.some((l) => l.delivered > 0)) return "Une commande déjà livrée (même partiellement) ne peut pas être annulée.";
      setS((x) => ({ ...x, orders: x.orders.map((y) => (y.id === orderId ? { ...y, cancelled: true } : y)) }));
      return null;
    },
    deliver: (orderId, wanted) => {
      const o = s.orders.find((x) => x.id === orderId);
      if (!o) return "Commande introuvable.";
      const st = orderStatus(o);
      if (st === "Annulée" || st === "Livrée" || st === "Facturée") return "Cette commande ne peut plus être livrée.";
      const avail = Object.fromEntries(stock.products.map((p) => [p.id, p.stock]));
      const { qty, short } = capDelivery(o, wanted, avail);
      if (Object.values(qty).every((q) => q <= 0)) return short.length ? "Stock insuffisant pour livrer les quantités saisies." : "Saisissez au moins une quantité à livrer.";
      const number = seq("BL", s.deliveries.length);
      for (const l of o.lines) {
        const q = qty[l.productId] ?? 0;
        if (q <= 0) continue;
        const p = stock.products.find((x) => x.id === l.productId);
        const e = stock.addMovement({ id: sid("M"), date: today(), number: `MVT-${number}-${l.productId}`, type: "sortie", productId: l.productId, warehouseId: p?.warehouseId ?? "", quantity: q, unitCost: p?.unitCost ?? 0, document: number, user: "Service commercial" });
        if (e) return e;
      }
      setS((x) => ({
        ...x,
        orders: x.orders.map((y) => (y.id === orderId ? { ...y, lines: y.lines.map((l) => ({ ...l, delivered: l.delivered + (qty[l.productId] ?? 0) })) } : y)),
        deliveries: [...x.deliveries, { id: sid("D"), number, orderId, date: today(), lines: o.lines.filter((l) => (qty[l.productId] ?? 0) > 0).map((l) => ({ productId: l.productId, quantity: qty[l.productId]! })) }],
      }));
      return short.length ? `Livraison partielle : stock insuffisant pour ${short.length} article(s).` : null;
    },
    invoiceOrder: (orderId) => {
      const o = s.orders.find((x) => x.id === orderId);
      if (!o) return "Commande introuvable.";
      const lines = invoiceableLines(o);
      if (!lines.length) return "Rien à facturer : livrez d'abord la marchandise.";
      const c = s.customers.find((x) => x.id === o.customerId);
      const inv: SalesInvoice = { id: sid("I"), number: seq("FA", s.invoices.length), customerId: o.customerId, orderId, date: today(), dueDate: addDays(today(), termDays(c?.paymentTerms ?? "30")), lines };
      setS((x) => ({
        ...x,
        invoices: [...x.invoices, inv],
        orders: x.orders.map((y) => (y.id === orderId ? { ...y, lines: y.lines.map((l) => ({ ...l, invoiced: l.delivered })) } : y)),
      }));
      return null;
    },
    addCollection: (c) => {
      const inv = s.invoices.find((i) => i.id === c.invoiceId);
      if (!inv) return "Facture introuvable.";
      const err = validateCollection(c.amount, invoiceOutstanding(inv, s.collections));
      if (err) return err;
      setS((x) => ({ ...x, collections: [...x.collections, c] }));
      return null;
    },
    reset: () => {
      setS(buildSalesDemo());
      stock.reset();
    },
  };
  return <SalesCtx.Provider value={ctx}>{children}</SalesCtx.Provider>;
}

export function useSales() {
  const c = useContext(SalesCtx);
  if (!c) throw new Error("useSales hors SalesProvider");
  return c;
}
