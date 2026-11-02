// Stocks & Approvisionnements — types, référentiels et calculs (purs, testables).
// Valorisation : coût unitaire moyen pondéré (CMUP) simplifié — chaque article
// porte un coût unitaire unique, la valeur du stock = quantité × coût unitaire.

export type Warehouse = { id: string; label: string; city: string };
export const WAREHOUSES: Warehouse[] = [
  { id: "ENT-CASA", label: "Entrepôt central", city: "Casablanca" },
  { id: "ENT-FES", label: "Dépôt Fès", city: "Fès" },
  { id: "ENT-TGR", label: "Dépôt Tanger", city: "Tanger" },
  { id: "ENT-MKE", label: "Dépôt Marrakech", city: "Marrakech" },
];
export const warehouseLabel = (id: string) => {
  const w = WAREHOUSES.find((x) => x.id === id);
  return w ? `${w.label} (${w.city})` : id;
};

export const STOCK_CATEGORIES = ["Épicerie", "Huiles & condiments", "Boissons", "Hygiène", "Surgelés"] as const;

export type Product = {
  id: string;
  ref: string; // référence unique
  designation: string;
  category: string;
  unit: string; // unité de mesure
  warehouseId: string;
  stock: number;
  min: number;
  max: number;
  unitCost: number; // DH
  supplier?: string | undefined;
  barcode?: string | undefined;
  expiry?: string | null; // ISO date
};

export type StockStatus = "disponible" | "faible" | "rupture" | "surstock";
export const STATUS_LABEL: Record<StockStatus, string> = {
  disponible: "Disponible",
  faible: "Stock faible",
  rupture: "Rupture",
  surstock: "Surstock",
};

export function stockStatus(p: Pick<Product, "stock" | "min" | "max">): StockStatus {
  if (p.stock <= 0) return "rupture";
  if (p.stock < p.min) return "faible";
  if (p.stock > p.max) return "surstock";
  return "disponible";
}

export const stockValue = (p: Pick<Product, "stock" | "unitCost">) => p.stock * p.unitCost;

export type MovementType =
  | "entree" | "sortie" | "transfert" | "ajustement_pos" | "ajustement_neg" | "retour_fournisseur" | "retour_client";

export const MOVEMENT_TYPES: { id: MovementType; label: string; sign: 1 | -1 }[] = [
  { id: "entree", label: "Entrée fournisseur", sign: 1 },
  { id: "sortie", label: "Sortie", sign: -1 },
  { id: "transfert", label: "Transfert entre entrepôts", sign: -1 },
  { id: "ajustement_pos", label: "Ajustement positif", sign: 1 },
  { id: "ajustement_neg", label: "Ajustement négatif", sign: -1 },
  { id: "retour_fournisseur", label: "Retour fournisseur", sign: -1 },
  { id: "retour_client", label: "Retour client", sign: 1 },
];
export const movementLabel = (t: MovementType) => MOVEMENT_TYPES.find((x) => x.id === t)?.label ?? t;
/** Variation de stock sur l'entrepôt source : +quantité ou −quantité. */
export const movementDelta = (t: MovementType, qty: number) => (MOVEMENT_TYPES.find((x) => x.id === t)?.sign ?? 1) * qty;

export type Movement = {
  id: string;
  date: string; // ISO
  number: string; // MVT-2026-0001
  type: MovementType;
  productId: string;
  warehouseId: string;
  targetWarehouseId?: string | undefined; // transferts uniquement
  quantity: number;
  unitCost: number;
  document?: string | undefined;
  user?: string | undefined;
};
export const movementValue = (m: Movement) => m.quantity * m.unitCost;

export type OrderStatus = "Brouillon" | "En attente de validation" | "Validée" | "Envoyée" | "Partiellement reçue" | "Reçue" | "Annulée";
export const ORDER_STATUSES: OrderStatus[] = ["Brouillon", "En attente de validation", "Validée", "Envoyée", "Partiellement reçue", "Reçue", "Annulée"];

export type OrderLine = {
  productId: string;
  quantity: number;
  received: number;
  unitCost: number; // prix unitaire HT (DH)
  discount?: number | undefined; // remise en %
  vatRate?: number | undefined; // taux de TVA en %
};
export type PurchaseOrder = {
  id: string;
  number: string; // CMD-2026-041
  supplier: string;
  date: string; // ISO
  expected: string; // ISO, livraison prévue
  status: OrderStatus;
  lines: OrderLine[];
  paymentTerms?: string | undefined; // ex. « 60 jours fin de mois »
};

/** Montant HT net d'une ligne (après remise), arrondi au centime. */
export const lineNetHT = (l: OrderLine) => Math.round(l.quantity * l.unitCost * (1 - (l.discount ?? 0) / 100) * 100) / 100;
/** Total HT net de la commande. */
export const orderTotal = (o: Pick<PurchaseOrder, "lines">) => Math.round(o.lines.reduce((a, l) => a + lineNetHT(l) * 100, 0)) / 100;
export const orderQty = (o: PurchaseOrder) => o.lines.reduce((a, l) => a + l.quantity, 0);
/** Statut après réception : toutes les lignes reçues → Reçue ; sinon Partiellement reçue. */
export function receiptStatus(o: PurchaseOrder): OrderStatus {
  const complete = o.lines.every((l) => l.received >= l.quantity);
  if (complete) return "Reçue";
  if (o.lines.some((l) => l.received > 0)) return "Partiellement reçue";
  return o.status;
}
/** Quantité restant à recevoir sur une ligne (jamais négative). */
export const remainingQty = (l: OrderLine) => Math.max(0, l.quantity - l.received);

/** Quantité de réapprovisionnement recommandée : ramener le stock au maximum. */
export const replenishmentQty = (p: Pick<Product, "stock" | "max">) => Math.max(0, p.max - p.stock);

/** Jours avant expiration ; null si pas de date. */
export function daysToExpiry(p: Product, today: Date = new Date()): number | null {
  if (!p.expiry) return null;
  return Math.ceil((new Date(p.expiry).getTime() - today.getTime()) / 86_400_000);
}

/** Valeur du stock en fin de chaque mois, reconstituée à partir des mouvements. */
export function monthlyStockValues(products: Product[], movements: Movement[], year = 2026): { mois: number; value: number }[] {
  const current = products.reduce((a, p) => a + stockValue(p), 0);
  const lastMonth = Math.max(-1, ...movements.map((m) => new Date(m.date).getMonth()));
  const out: { mois: number; value: number }[] = [];
  let value = current;
  for (let m = 11; m >= 0; m--) {
    if (m <= lastMonth) out.unshift({ mois: m, value: Math.round(value) });
    // retirer les mouvements du mois m pour obtenir la valeur de fin du mois m−1
    for (const mv of movements) {
      const d = new Date(mv.date);
      if (d.getFullYear() === year && d.getMonth() === m) value -= movementDelta(mv.type, mv.quantity) * mv.unitCost;
    }
  }
  return out;
}

/** Rotation des stocks = valeur des sorties / valeur moyenne du stock. null si données insuffisantes. */
export function turnoverRatio(movements: Movement[], avgStockValue: number): number | null {
  if (avgStockValue <= 0) return null;
  const sorties = movements
    .filter((m) => m.type === "sortie")
    .reduce((a, m) => a + movementValue(m), 0);
  if (sorties <= 0) return null;
  return sorties / avgStockValue;
}

/** Export CSV (séparateur point-virgule, compatible Excel FR). */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"'\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(esc).join(";")).join("\n");
}
