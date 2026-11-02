import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { buildStockDemo } from "./demo";
import { movementDelta, receiptStatus, remainingQty, type Movement, type Product, type PurchaseOrder } from "./model";

type State = { products: Product[]; movements: Movement[]; orders: PurchaseOrder[] };
const KEY = "pilotage-cg-stocks-v1";

type Ctx = State & {
  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  /** Applique un mouvement et met à jour le stock. Renvoie un message d'erreur ou null. */
  addMovement: (m: Movement) => string | null;
  upsertOrder: (o: PurchaseOrder) => void;
  deleteOrder: (id: string) => void;
  /** Réceptionne des quantités sur une commande (plafonnées au reste à recevoir). */
  receiveOrder: (orderId: string, receipts: Record<string, number>) => void;
  reset: () => void;
};

const StockCtx = createContext<Ctx | null>(null);
export const sid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function StockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(buildStockDemo);
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
    upsertProduct: (p) =>
      setState((s) => ({
        ...s,
        products: s.products.some((x) => x.id === p.id) ? s.products.map((x) => (x.id === p.id ? p : x)) : [...s.products, p],
      })),
    deleteProduct: (id) =>
      setState((s) => ({
        ...s,
        products: s.products.filter((p) => p.id !== id),
        movements: s.movements.filter((m) => m.productId !== id),
      })),
    addMovement: (m) => {
      const product = state.products.find((p) => p.id === m.productId);
      if (!product) return "Article introuvable.";
      if (!Number.isFinite(m.quantity) || m.quantity <= 0) return "La quantité doit être supérieure à zéro.";
      const delta = movementDelta(m.type, m.quantity);
      if (product.stock + delta < 0) return `Stock insuffisant : ${product.stock} ${product.unit} disponible(s).`;
      setState((s) => {
        let products = s.products.map((p) => (p.id === m.productId ? { ...p, stock: p.stock + delta } : p));
        // Transfert : créditer l'entrepôt cible (même référence), en créant la fiche si besoin
        if (m.type === "transfert" && m.targetWarehouseId) {
          const target = products.find((p) => p.ref === product.ref && p.warehouseId === m.targetWarehouseId);
          if (target) {
            products = products.map((p) => (p.id === target.id ? { ...p, stock: p.stock + m.quantity } : p));
          } else {
            products = [...products, { ...product, id: sid("P"), warehouseId: m.targetWarehouseId, stock: m.quantity }];
          }
        }
        return { ...s, products, movements: [...s.movements, m] };
      });
      return null;
    },
    upsertOrder: (o) =>
      setState((s) => ({
        ...s,
        orders: s.orders.some((x) => x.id === o.id) ? s.orders.map((x) => (x.id === o.id ? o : x)) : [...s.orders, o],
      })),
    deleteOrder: (id) => setState((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== id) })),
    receiveOrder: (orderId, receipts) =>
      setState((s) => {
        const order = s.orders.find((o) => o.id === orderId);
        if (!order || order.status === "Annulée" || order.status === "Reçue") return s;
        let products = s.products;
        const movements = [...s.movements];
        const lines = order.lines.map((l) => {
          const qty = Math.min(Math.max(0, receipts[l.productId] ?? 0), remainingQty(l));
          if (qty <= 0) return l;
          const product = products.find((p) => p.id === l.productId);
          if (product) products = products.map((p) => (p.id === l.productId ? { ...p, stock: p.stock + qty } : p));
          movements.push({
            id: sid("M"),
            date: new Date().toISOString().slice(0, 10),
            number: `MVT-2026-${String(movements.length + 1).padStart(4, "0")}`,
            type: "entree",
            productId: l.productId,
            warehouseId: product?.warehouseId ?? "",
            quantity: qty,
            unitCost: l.unitCost,
            document: order.number,
            user: "Contrôleur de gestion",
          });
          return { ...l, received: l.received + qty };
        });
        const updated: PurchaseOrder = { ...order, lines };
        return { ...s, products, movements, orders: s.orders.map((o) => (o.id === orderId ? { ...updated, status: receiptStatus(updated) } : o)) };
      }),
    reset: () => setState(buildStockDemo()),
  };
  return <StockCtx.Provider value={ctx}>{children}</StockCtx.Provider>;
}

export function useStock() {
  const c = useContext(StockCtx);
  if (!c) throw new Error("useStock hors StockProvider");
  return c;
}
