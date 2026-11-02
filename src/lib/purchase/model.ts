// Achats & Fournisseurs — types et calculs purs (testables).
// Les commandes fournisseurs sont partagées avec Stocks & Approvisionnements
// (une seule source : le store stock). Ce module ajoute fournisseurs, demandes,
// réceptions (historique), factures et règlements.
import { lineNetHT, type OrderLine, type PurchaseOrder } from "@/lib/stock/model";

/** Centimes : tous les montants sont arrondis à 2 décimales. */
export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Taux de TVA marocains configurables (modifiables dans l'onglet Fournisseurs > Paramètres). */
export const DEFAULT_VAT_RATES = [20, 14, 10, 7, 0];
export const DEFAULT_VAT = 20;

export type Supplier = {
  id: string;
  code: string; // FRS-001
  name: string; // raison sociale
  ice: string; // 15 chiffres
  if: string; // identifiant fiscal
  rc: string; // registre de commerce
  address: string;
  city: string;
  contact: string;
  email: string;
  phone: string;
  paymentTerms: string;
  category: string;
  active: boolean;
};
export const SUPPLIER_CATEGORIES = ["Matières premières", "Agroalimentaire", "Emballages", "Hygiène & entretien", "Services", "Transport"];
export const PAYMENT_TERMS = ["Comptant", "30 jours", "60 jours", "60 jours fin de mois", "90 jours"];

/** Nombre de jours d'échéance correspondant à une condition de paiement. */
export function termDays(terms: string): number {
  const n = Number(terms.match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(n) ? n : 0;
}
export const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** ICE : 15 chiffres. */
export const isValidIce = (ice: string) => /^\d{15}$/.test(ice.trim());

// ---------- Demandes d'achat ----------
export type RequestStatus = "Brouillon" | "Soumise" | "En validation" | "Approuvée" | "Rejetée" | "Convertie en commande";
export const REQUEST_STATUSES: RequestStatus[] = ["Brouillon", "Soumise", "En validation", "Approuvée", "Rejetée", "Convertie en commande"];
export type RequestLine = { productId: string; quantity: number; estimatedPrice: number };
export type PurchaseRequest = {
  id: string;
  number: string; // DA-2026-001
  date: string;
  requester: string;
  department: string;
  justification: string;
  neededBy: string;
  status: RequestStatus;
  lines: RequestLine[];
  orderId?: string | undefined;
};
export const DEPARTMENTS = ["Production", "Logistique", "Commercial", "Administration", "Maintenance"];
export const requestTotal = (r: Pick<PurchaseRequest, "lines">) => round2(r.lines.reduce((a, l) => a + l.quantity * l.estimatedPrice, 0));

/** Transitions autorisées du circuit de validation. */
export const REQUEST_NEXT: Record<RequestStatus, RequestStatus[]> = {
  Brouillon: ["Soumise"],
  Soumise: ["En validation", "Rejetée"],
  "En validation": ["Approuvée", "Rejetée"],
  Approuvée: ["Convertie en commande"],
  Rejetée: [],
  "Convertie en commande": [],
};
export const canTransition = (from: RequestStatus, to: RequestStatus) => REQUEST_NEXT[from].includes(to);

// ---------- Totaux HT / TVA / TTC ----------
export type Totals = { ht: number; tva: number; ttc: number };
export function linesTotals(lines: OrderLine[], defaultVat = DEFAULT_VAT): Totals {
  let ht = 0;
  let tva = 0;
  for (const l of lines) {
    const net = lineNetHT(l);
    ht += net;
    tva += round2((net * (l.vatRate ?? defaultVat)) / 100);
  }
  ht = round2(ht);
  tva = round2(tva);
  return { ht, tva, ttc: round2(ht + tva) };
}
export const orderTotals = (o: Pick<PurchaseOrder, "lines">) => linesTotals(o.lines);

// ---------- Réceptions ----------
export type ReceiptLine = { productId: string; ordered: number; received: number; note?: string | undefined };
export type Receipt = { id: string; number: string; orderId: string; date: string; lines: ReceiptLine[]; note?: string | undefined };

/** Quantités effectivement réceptionnables : plafonnées au reste à recevoir (évite les doublons). */
export function capReceipt(order: PurchaseOrder, wanted: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of order.lines) {
    const rest = Math.max(0, l.quantity - l.received);
    out[l.productId] = Math.min(rest, Math.max(0, Math.floor(wanted[l.productId] ?? 0)));
  }
  return out;
}

// ---------- Factures ----------
export type InvoiceStatus = "À vérifier" | "Validée" | "Partiellement payée" | "Payée" | "En retard";
export const INVOICE_STATUSES: InvoiceStatus[] = ["À vérifier", "Validée", "Partiellement payée", "Payée", "En retard"];
export type Invoice = {
  id: string;
  reference: string; // n° de facture du fournisseur
  supplierId: string;
  orderId?: string | undefined;
  date: string;
  dueDate: string;
  ht: number;
  tva: number;
  validated: boolean;
};
export const invoiceTtc = (i: Pick<Invoice, "ht" | "tva">) => round2(i.ht + i.tva);

export type PaymentMethod = "Virement" | "Chèque" | "Effet (LCN)" | "Espèces";
export const PAYMENT_METHODS: PaymentMethod[] = ["Virement", "Chèque", "Effet (LCN)", "Espèces"];
export type Payment = { id: string; invoiceId: string; date: string; amount: number; method: PaymentMethod; reference: string };

export const paidAmount = (invoiceId: string, payments: Payment[]) => round2(payments.filter((p) => p.invoiceId === invoiceId).reduce((a, p) => a + p.amount, 0));
export const outstanding = (inv: Invoice, payments: Payment[]) => Math.max(0, round2(invoiceTtc(inv) - paidAmount(inv.id, payments)));

/** Statut calculé : payée > partiellement payée > en retard > validée > à vérifier. */
export function invoiceStatus(inv: Invoice, payments: Payment[], today: string): InvoiceStatus {
  const paid = paidAmount(inv.id, payments);
  const ttc = invoiceTtc(inv);
  if (paid >= ttc && ttc > 0) return "Payée";
  if (inv.dueDate < today) return "En retard";
  if (paid > 0) return "Partiellement payée";
  return inv.validated ? "Validée" : "À vérifier";
}

/** Contrôle de rapprochement facture ↔ commande ↔ réception (montant HT). */
export function matchInvoice(inv: Invoice, order: PurchaseOrder | undefined): { orderHt: number; receivedHt: number; gap: number } | null {
  if (!order) return null;
  const orderHt = linesTotals(order.lines).ht;
  const receivedHt = linesTotals(order.lines.map((l) => ({ ...l, quantity: l.received }))).ht;
  return { orderHt, receivedHt, gap: round2(inv.ht - receivedHt) };
}

/** Validation d'un règlement : montant positif et ne dépassant pas le reste à payer. */
export function validatePayment(amount: number, remaining: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Le montant doit être supérieur à zéro.";
  if (round2(amount) > round2(remaining)) return `Le montant dépasse le reste à payer (${remaining.toLocaleString("fr-FR")} DH).`;
  return null;
}

/** Délai moyen de paiement (jours entre date de facture et règlement), null sans données. */
export function avgPaymentDelay(invoices: Invoice[], payments: Payment[]): number | null {
  const delays = payments
    .map((p) => {
      const inv = invoices.find((i) => i.id === p.invoiceId);
      return inv ? (new Date(p.date).getTime() - new Date(inv.date).getTime()) / 86_400_000 : null;
    })
    .filter((d): d is number => d !== null);
  return delays.length ? Math.round(delays.reduce((a, d) => a + d, 0) / delays.length) : null;
}

/** Part du premier fournisseur et des 3 premiers dans le total des achats. */
export function concentration(amounts: number[]): { top1: number; top3: number } | null {
  const total = amounts.reduce((a, v) => a + v, 0);
  if (total <= 0) return null;
  const s = [...amounts].sort((a, b) => b - a);
  return { top1: round2((s[0]! / total) * 100), top3: round2((s.slice(0, 3).reduce((a, v) => a + v, 0) / total) * 100) };
}
