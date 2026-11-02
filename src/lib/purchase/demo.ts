// Données de démonstration — Achats & Fournisseurs (fictives).
// Les identifiants ICE / IF / RC sont des valeurs factices de démonstration,
// sans lien avec les entreprises réelles portant un nom similaire.
import type { Invoice, Payment, PurchaseRequest, Receipt, Supplier } from "./model";
import { DEFAULT_VAT_RATES } from "./model";

const sup = (n: number, name: string, category: string, city: string, paymentTerms: string, active = true): Supplier => ({
  id: `S-${String(n).padStart(3, "0")}`,
  code: `FRS-${String(n).padStart(3, "0")}`,
  name,
  ice: `00000000000${String(n).padStart(4, "0")}`,
  if: `DEMO-IF-${n}`,
  rc: `DEMO-RC-${n}`,
  address: "",
  city,
  contact: "",
  email: "",
  phone: "",
  paymentTerms,
  category,
  active,
});

const suppliers: Supplier[] = [
  sup(1, "Coopérative Zaytouna", "Agroalimentaire", "Meknès", "60 jours"),
  sup(2, "Centrale Danone", "Agroalimentaire", "Casablanca", "30 jours"),
  sup(3, "COSUMAR", "Matières premières", "Casablanca", "60 jours fin de mois"),
  sup(4, "Dari", "Agroalimentaire", "Salé", "60 jours"),
  sup(5, "Sultan Tea Import", "Agroalimentaire", "Tanger", "30 jours"),
  sup(6, "Frigodar", "Agroalimentaire", "Agadir", "30 jours"),
  sup(7, "Minoterie Al Manar", "Matières premières", "Fès", "60 jours"),
  sup(8, "Lesieur Cristal", "Agroalimentaire", "Casablanca", "60 jours"),
  sup(9, "Transports Atlas Logistique", "Transport", "Casablanca", "30 jours", false),
];

const requests: PurchaseRequest[] = [
  { id: "R-001", number: "DA-2026-001", date: "2026-10-02", requester: "K. Alaoui", department: "Production", justification: "Réassort huile d'olive sous le seuil minimum", neededBy: "2026-10-20", status: "Convertie en commande", lines: [{ productId: "P-HUI1", quantity: 600, estimatedPrice: 285 }], orderId: "O-041" },
  { id: "R-002", number: "DA-2026-002", date: "2026-10-18", requester: "S. Bennani", department: "Logistique", justification: "Rupture lait UHT dépôt central", neededBy: "2026-10-28", status: "En validation", lines: [{ productId: "P-LAI1", quantity: 1200, estimatedPrice: 7.5 }] },
  { id: "R-003", number: "DA-2026-003", date: "2026-10-25", requester: "N. Tazi", department: "Commercial", justification: "Préparation campagne Ramadan", neededBy: "2026-11-30", status: "Soumise", lines: [{ productId: "P-MIE1", quantity: 100, estimatedPrice: 120 }, { productId: "P-THE1", quantity: 500, estimatedPrice: 42 }] },
  { id: "R-004", number: "DA-2026-004", date: "2026-10-27", requester: "Y. Idrissi", department: "Maintenance", justification: "Savon pour l'atelier", neededBy: "2026-11-10", status: "Brouillon", lines: [{ productId: "P-SAV1", quantity: 40, estimatedPrice: 74 }] },
];

const receipts: Receipt[] = [
  { id: "REC-001", number: "BR-2026-001", orderId: "O-041", date: "2026-10-18", lines: [{ productId: "P-HUI1", ordered: 600, received: 300, note: "Livraison partielle annoncée par le fournisseur" }] },
];

const invoices: Invoice[] = [
  { id: "F-001", reference: "FZ-2026-1180", supplierId: "S-001", orderId: "O-041", date: "2026-10-19", dueDate: "2026-12-18", ht: 85200, tva: 17040, validated: true },
  { id: "F-002", reference: "COS-88412", supplierId: "S-003", date: "2026-08-20", dueDate: "2026-10-19", ht: 24000, tva: 4800, validated: true },
  { id: "F-003", reference: "MAM-2026-312", supplierId: "S-007", date: "2026-09-05", dueDate: "2026-11-04", ht: 41600, tva: 8320, validated: true },
  { id: "F-004", reference: "LC-77120", supplierId: "S-008", date: "2026-10-26", dueDate: "2026-12-25", ht: 18600, tva: 3720, validated: false },
];

const payments: Payment[] = [
  { id: "PAY-001", invoiceId: "F-003", date: "2026-10-05", amount: 49920, method: "Virement", reference: "VIR-2026-0412" },
  { id: "PAY-002", invoiceId: "F-002", date: "2026-10-10", amount: 10000, method: "Chèque", reference: "CHQ-5521" },
  { id: "PAY-003", invoiceId: "F-001", date: "2026-10-28", amount: 30000, method: "Effet (LCN)", reference: "LCN-2026-118" },
];

export const buildPurchaseDemo = () => ({ suppliers, requests, receipts, invoices, payments, vatRates: DEFAULT_VAT_RATES });
