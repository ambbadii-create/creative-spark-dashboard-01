import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useStock, sid } from "@/lib/stock/store";
import { buildPurchaseDemo } from "./demo";
import { capReceipt, type Invoice, type Payment, type PurchaseRequest, type Receipt, type Supplier } from "./model";

type State = { suppliers: Supplier[]; requests: PurchaseRequest[]; receipts: Receipt[]; invoices: Invoice[]; payments: Payment[]; vatRates: number[] };
const KEY = "pilotage-cg-achats-v1";

const upsert = <T extends { id: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

type Ctx = State & {
  upsertSupplier: (s: Supplier) => void;
  upsertRequest: (r: PurchaseRequest) => void;
  upsertInvoice: (i: Invoice) => void;
  addPayment: (p: Payment) => void;
  setVatRates: (r: number[]) => void;
  /** Réception : met à jour le stock (quantités plafonnées) et historise le bon de réception. */
  receive: (orderId: string, wanted: Record<string, number>, notes: Record<string, string>, note?: string) => string | null;
  reset: () => void;
};

const PurchaseCtx = createContext<Ctx | null>(null);

export function PurchaseProvider({ children }: { children: ReactNode }) {
  const stock = useStock();
  const [state, setState] = useState<State>(buildPurchaseDemo);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const ctx: Ctx = {
    ...state,
    upsertSupplier: (s) => setState((x) => ({ ...x, suppliers: upsert(x.suppliers, s) })),
    upsertRequest: (r) => setState((x) => ({ ...x, requests: upsert(x.requests, r) })),
    upsertInvoice: (i) => setState((x) => ({ ...x, invoices: upsert(x.invoices, i) })),
    addPayment: (p) => setState((x) => ({ ...x, payments: [...x.payments, p] })),
    setVatRates: (vatRates) => setState((x) => ({ ...x, vatRates })),
    receive: (orderId, wanted, notes, note) => {
      const order = stock.orders.find((o) => o.id === orderId);
      if (!order) return "Commande introuvable.";
      if (order.status === "Annulée" || order.status === "Reçue") return "Cette commande ne peut plus être réceptionnée.";
      if (order.status === "Brouillon" || order.status === "En attente de validation") return "La commande doit être validée avant réception.";
      const qty = capReceipt(order, wanted);
      if (Object.values(qty).every((q) => q <= 0)) return "Saisissez au moins une quantité reçue.";
      stock.receiveOrder(orderId, qty);
      const receipt: Receipt = {
        id: sid("REC"),
        number: `BR-2026-${String(state.receipts.length + 1).padStart(3, "0")}`,
        orderId,
        date: new Date().toISOString().slice(0, 10),
        note,
        lines: order.lines.map((l) => ({ productId: l.productId, ordered: l.quantity, received: qty[l.productId] ?? 0, note: notes[l.productId] || undefined })).filter((l) => l.received > 0),
      };
      setState((x) => ({ ...x, receipts: [...x.receipts, receipt] }));
      return null;
    },
    reset: () => {
      setState(buildPurchaseDemo());
      stock.reset();
    },
  };
  return <PurchaseCtx.Provider value={ctx}>{children}</PurchaseCtx.Provider>;
}

export function usePurchase() {
  const c = useContext(PurchaseCtx);
  if (!c) throw new Error("usePurchase hors PurchaseProvider");
  return c;
}
