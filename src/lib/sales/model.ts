// Ventes & Clients — types et calculs purs (testables).
// Cycle : opportunité → devis → commande client → livraison → facture → encaissement.
// Les livraisons sortent du stock partagé (Stocks & Approvisionnements).
import { round2, addDays, termDays, isValidIce, PAYMENT_TERMS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/purchase/model";

export { round2, addDays, termDays, isValidIce, PAYMENT_TERMS, PAYMENT_METHODS, type PaymentMethod };
export const DEFAULT_VAT = 20;

export const SEGMENTS = ["Grande distribution", "Grossiste", "Détaillant", "CHR (hôtels, restaurants)", "Collectivités"];
export const ACTIVITIES = ["Agroalimentaire", "Distribution", "Hôtellerie", "Restauration", "Institutionnel"];
export const SALES_REPS = ["Y. Alaoui", "S. Bennani", "K. Tazi", "M. Idrissi"];

export type Customer = {
  id: string;
  code: string; // CLI-001
  name: string;
  segment: string;
  activity: string;
  ice: string;
  if: string;
  rc: string;
  address: string;
  city: string;
  contact: string;
  email: string;
  phone: string;
  paymentTerms: string;
  creditLimit: number; // DH TTC, 0 = pas de plafond
  salesRep: string;
  active: boolean;
};

// ---------- Opportunités ----------
export type Stage = "Prospection" | "Qualification" | "Proposition" | "Négociation" | "Gagnée" | "Perdue";
export const STAGES: Stage[] = ["Prospection", "Qualification", "Proposition", "Négociation", "Gagnée", "Perdue"];
export const STAGE_PROBA: Record<Stage, number> = { Prospection: 10, Qualification: 30, Proposition: 50, Négociation: 75, Gagnée: 100, Perdue: 0 };
export type Opportunity = {
  id: string;
  number: string; // OPP-2026-001
  customerId: string;
  title: string;
  stage: Stage;
  value: number; // HT estimé
  probability: number; // %
  expectedClose: string;
  salesRep: string;
  quoteId?: string | undefined;
};
/** Taux de conversion = gagnées / opportunités qualifiées (toutes sauf « Prospection »). null sans données. */
export function conversionRate(opps: Pick<Opportunity, "stage">[]): number | null {
  const qualified = opps.filter((o) => o.stage !== "Prospection");
  if (!qualified.length) return null;
  return round2((qualified.filter((o) => o.stage === "Gagnée").length / qualified.length) * 100);
}
/** Pipeline pondéré = Σ valeur × probabilité des opportunités ouvertes. */
export const weightedPipeline = (opps: Opportunity[]) =>
  round2(opps.filter((o) => o.stage !== "Gagnée" && o.stage !== "Perdue").reduce((a, o) => a + (o.value * o.probability) / 100, 0));

// ---------- Lignes & totaux ----------
export type SalesLine = { productId: string; quantity: number; unitPrice: number; discount?: number | undefined; vatRate?: number | undefined };
export type OrderLine = SalesLine & { delivered: number; invoiced: number };
export type Totals = { ht: number; tva: number; ttc: number };
export const lineNet = (l: SalesLine) => round2(l.quantity * l.unitPrice * (1 - (l.discount ?? 0) / 100));
export function totals(lines: SalesLine[]): Totals {
  let ht = 0, tva = 0;
  for (const l of lines) {
    const n = lineNet(l);
    ht += n;
    tva += round2((n * (l.vatRate ?? DEFAULT_VAT)) / 100);
  }
  ht = round2(ht);
  tva = round2(tva);
  return { ht, tva, ttc: round2(ht + tva) };
}

// ---------- Devis ----------
export type QuoteStatus = "Brouillon" | "Envoyé" | "Accepté" | "Refusé" | "Converti";
export const QUOTE_STATUSES: QuoteStatus[] = ["Brouillon", "Envoyé", "Accepté", "Refusé", "Converti"];
export type Quote = {
  id: string;
  number: string; // DV-2026-001
  customerId: string;
  date: string;
  validUntil: string;
  status: QuoteStatus;
  lines: SalesLine[];
  opportunityId?: string | undefined;
  orderId?: string | undefined;
};
export const QUOTE_NEXT: Record<QuoteStatus, QuoteStatus[]> = {
  Brouillon: ["Envoyé"],
  Envoyé: ["Accepté", "Refusé"],
  Accepté: ["Converti"],
  Refusé: [],
  Converti: [],
};
export const isQuoteExpired = (q: Quote, today: string) => (q.status === "Envoyé" || q.status === "Brouillon") && q.validUntil < today;

// ---------- Commandes ----------
export type OrderStatus = "Confirmée" | "Partiellement livrée" | "Livrée" | "Facturée" | "Annulée";
export type SalesOrder = {
  id: string;
  number: string; // BC-2026-001
  customerId: string;
  date: string;
  deliveryDate: string;
  cancelled: boolean;
  lines: OrderLine[];
  quoteId?: string | undefined;
};
/** Statut calculé à partir des quantités livrées et facturées. */
export function orderStatus(o: SalesOrder): OrderStatus {
  if (o.cancelled) return "Annulée";
  const all = (f: (l: OrderLine) => boolean) => o.lines.length > 0 && o.lines.every(f);
  if (all((l) => l.invoiced >= l.quantity)) return "Facturée";
  if (all((l) => l.delivered >= l.quantity)) return "Livrée";
  if (o.lines.some((l) => l.delivered > 0)) return "Partiellement livrée";
  return "Confirmée";
}
export const remainingToDeliver = (l: OrderLine) => Math.max(0, l.quantity - l.delivered);
export const remainingToInvoice = (l: OrderLine) => Math.max(0, l.delivered - l.invoiced);

/**
 * Quantités livrables : plafonnées au reste à livrer ET au stock disponible.
 * Renvoie les quantités retenues et, le cas échéant, les articles bloqués par le stock.
 */
export function capDelivery(order: SalesOrder, wanted: Record<string, number>, available: Record<string, number>): { qty: Record<string, number>; short: string[] } {
  const qty: Record<string, number> = {};
  const short: string[] = [];
  for (const l of order.lines) {
    const w = Math.min(remainingToDeliver(l), Math.max(0, Math.floor(wanted[l.productId] ?? 0)));
    const stock = Math.max(0, available[l.productId] ?? 0);
    if (w > stock) short.push(l.productId);
    qty[l.productId] = Math.min(w, stock);
  }
  return { qty, short };
}

// ---------- Livraisons ----------
export type Delivery = { id: string; number: string; orderId: string; date: string; lines: { productId: string; quantity: number }[] };

// ---------- Factures & encaissements ----------
export type SalesInvoice = {
  id: string;
  number: string; // FA-2026-001
  customerId: string;
  orderId: string;
  date: string;
  dueDate: string;
  lines: SalesLine[];
};
export type Collection = { id: string; invoiceId: string; date: string; amount: number; method: PaymentMethod; reference: string };
export type InvoiceStatus = "Émise" | "Partiellement réglée" | "Réglée" | "En retard";

export const invoiceTotals = (i: SalesInvoice) => totals(i.lines);
export const collected = (invoiceId: string, cols: Collection[]) => round2(cols.filter((c) => c.invoiceId === invoiceId).reduce((a, c) => a + c.amount, 0));
export const invoiceOutstanding = (i: SalesInvoice, cols: Collection[]) => Math.max(0, round2(invoiceTotals(i).ttc - collected(i.id, cols)));
export function invoiceStatus(i: SalesInvoice, cols: Collection[], today: string): InvoiceStatus {
  const rest = invoiceOutstanding(i, cols);
  if (rest <= 0) return "Réglée";
  if (i.dueDate < today) return "En retard";
  return collected(i.id, cols) > 0 ? "Partiellement réglée" : "Émise";
}
/** Lignes facturables d'une commande : livré non encore facturé. */
export const invoiceableLines = (o: SalesOrder): SalesLine[] =>
  o.lines.filter((l) => remainingToInvoice(l) > 0).map((l) => ({ productId: l.productId, quantity: remainingToInvoice(l), unitPrice: l.unitPrice, discount: l.discount, vatRate: l.vatRate }));

export function validateCollection(amount: number, remaining: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Le montant doit être supérieur à zéro.";
  if (round2(amount) > round2(remaining)) return `Le montant dépasse le reste à encaisser (${remaining.toLocaleString("fr-FR")} DH).`;
  return null;
}

/** Encours client = factures non réglées (TTC) + commandes non facturées (TTC). */
export function customerExposure(customerId: string, orders: SalesOrder[], invoices: SalesInvoice[], cols: Collection[]) {
  const receivable = round2(invoices.filter((i) => i.customerId === customerId).reduce((a, i) => a + invoiceOutstanding(i, cols), 0));
  const uninvoiced = round2(
    orders
      .filter((o) => o.customerId === customerId && !o.cancelled)
      .reduce((a, o) => a + totals(o.lines.map((l) => ({ ...l, quantity: Math.max(0, l.quantity - l.invoiced) }))).ttc, 0),
  );
  return { receivable, uninvoiced, total: round2(receivable + uninvoiced) };
}
/** Contrôle du plafond de crédit avant confirmation d'une commande. */
export function creditCheck(c: Pick<Customer, "creditLimit">, exposure: number, newAmount: number): string | null {
  if (!c.creditLimit) return null;
  if (round2(exposure + newAmount) > c.creditLimit)
    return `Plafond de crédit dépassé : encours ${exposure.toLocaleString("fr-FR")} DH + ${newAmount.toLocaleString("fr-FR")} DH > ${c.creditLimit.toLocaleString("fr-FR")} DH.`;
  return null;
}

/** Délai moyen d'encaissement (jours entre facture et encaissement). */
export function avgCollectionDelay(invoices: SalesInvoice[], cols: Collection[]): number | null {
  const d = cols
    .map((c) => {
      const i = invoices.find((x) => x.id === c.invoiceId);
      return i ? (new Date(c.date).getTime() - new Date(i.date).getTime()) / 86_400_000 : null;
    })
    .filter((x): x is number => x !== null);
  return d.length ? Math.round(d.reduce((a, x) => a + x, 0) / d.length) : null;
}

/** Marge brute = CA HT − coût des produits facturés (coût unitaire stock). */
export function grossMargin(invoices: SalesInvoice[], unitCost: (productId: string) => number) {
  let revenue = 0, cost = 0;
  for (const i of invoices) for (const l of i.lines) {
    revenue += lineNet(l);
    cost += l.quantity * unitCost(l.productId);
  }
  revenue = round2(revenue);
  cost = round2(cost);
  return { revenue, cost, margin: round2(revenue - cost), rate: revenue > 0 ? round2(((revenue - cost) / revenue) * 100) : null };
}
