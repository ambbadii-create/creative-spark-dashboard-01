// Données de démonstration — Ventes & Clients (fictives, ICE/IF/RC factices).
import type { Collection, Customer, Delivery, Opportunity, OrderLine, Quote, SalesInvoice, SalesOrder } from "./model";
import { addDays, invoiceTotals, round2 } from "./model";

const cli = (n: number, name: string, segment: string, activity: string, city: string, paymentTerms: string, creditLimit: number, salesRep: string): Customer => ({
  id: `C-${String(n).padStart(3, "0")}`,
  code: `CLI-${String(n).padStart(3, "0")}`,
  name, segment, activity, city, paymentTerms, creditLimit, salesRep,
  ice: `00100000000${String(n).padStart(4, "0")}`,
  if: `DEMO-IF-C${n}`,
  rc: `DEMO-RC-C${n}`,
  address: "",
  contact: "",
  email: "",
  phone: "",
  active: true,
});

export const DEMO_CUSTOMERS: Customer[] = [
  cli(1, "Marjane Distribution (démo)", "Grande distribution", "Distribution", "Casablanca", "60 jours", 900_000, "Y. Alaoui"),
  cli(2, "Grossiste Derb Omar (démo)", "Grossiste", "Distribution", "Casablanca", "30 jours", 400_000, "S. Bennani"),
  cli(3, "Hôtel Atlas Agadir (démo)", "CHR (hôtels, restaurants)", "Hôtellerie", "Agadir", "30 jours", 150_000, "K. Tazi"),
  cli(4, "Épicerie Fine Gueliz (démo)", "Détaillant", "Distribution", "Marrakech", "Comptant", 50_000, "M. Idrissi"),
  cli(5, "Cantine Centrale Rabat (démo)", "Collectivités", "Institutionnel", "Rabat", "90 jours", 300_000, "Y. Alaoui"),
  cli(6, "Restaurant Dar Fès (démo)", "CHR (hôtels, restaurants)", "Restauration", "Fès", "30 jours", 80_000, "K. Tazi"),
  cli(7, "Supérette Tanger Med (démo)", "Détaillant", "Distribution", "Tanger", "30 jours", 60_000, "S. Bennani"),
  cli(8, "Agro Souss Export (démo)", "Grossiste", "Agroalimentaire", "Agadir", "60 jours fin de mois", 500_000, "M. Idrissi"),
];

// Prix de vente HT (≈ coût + 25 à 40 %)
const PRICE: Record<string, number> = { "P-HUI1": 379, "P-SEM1": 128, "P-THE1": 58, "P-SUC1": 24, "P-FAR1": 265, "P-COU1": 112, "P-HUI2": 82, "P-CON1": 9.5, "P-EAU1": 4.5, "P-SAV1": 99, "P-RIZ1": 129, "P-PAT1": 74, "P-MIE1": 165 };
const PRODUCTS = Object.keys(PRICE);

export function buildSalesDemo() {
  const orders: SalesOrder[] = [];
  const deliveries: Delivery[] = [];
  const invoices: SalesInvoice[] = [];
  const collections: Collection[] = [];
  const quotes: Quote[] = [];

  // 20 commandes réparties de janvier à octobre 2026
  for (let i = 0; i < 20; i++) {
    const month = Math.floor(i / 2); // 0..9
    const day = 5 + ((i * 7) % 20);
    const date = `2026-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const c = DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length]!;
    const big = c.segment === "Grande distribution" || c.segment === "Grossiste";
    const p1 = PRODUCTS[i % PRODUCTS.length]!, p2 = PRODUCTS[(i * 3 + 1) % PRODUCTS.length]!;
    const q = (base: number) => Math.round(base * (big ? 4 : 1) * (1 + (i % 3) * 0.3));
    const recent = i >= 17; // dernières commandes : pas encore (totalement) livrées
    const partial = i === 16 || i === 17;
    const mkLine = (pid: string, qty: number, discount: number): OrderLine => {
      const delivered = recent ? (partial ? Math.floor(qty / 2) : 0) : qty;
      return { productId: pid, quantity: qty, unitPrice: PRICE[pid]!, discount, vatRate: 20, delivered, invoiced: i === 16 ? 0 : recent ? 0 : delivered };
    };
    const lines = [mkLine(p1, q(60), big ? 5 : 0), mkLine(p2, q(40), 0)];
    const num = String(i + 1).padStart(3, "0");
    const order: SalesOrder = { id: `SO-${num}`, number: `BC-2026-${num}`, customerId: c.id, date, deliveryDate: addDays(date, 7), cancelled: false, lines };
    if (i % 4 === 0) {
      const qid = `Q-${num}`;
      quotes.push({ id: qid, number: `DV-2026-${num}`, customerId: c.id, date: addDays(date, -10), validUntil: addDays(date, 20), status: "Converti", lines: lines.map(({ delivered: _d, invoiced: _i, ...l }) => l), orderId: order.id });
      order.quoteId = qid;
    }
    orders.push(order);
    const shipped = lines.filter((l) => l.delivered > 0);
    if (shipped.length) deliveries.push({ id: `D-${num}`, number: `BL-2026-${num}`, orderId: order.id, date: addDays(date, 5), lines: shipped.map((l) => ({ productId: l.productId, quantity: l.delivered })) });
    const billed = lines.filter((l) => l.invoiced > 0);
    if (billed.length) {
      const invDate = addDays(date, 6);
      const days = Number(c.paymentTerms.match(/\d+/)?.[0] ?? 0);
      const inv: SalesInvoice = { id: `I-${num}`, number: `FA-2026-${num}`, customerId: c.id, orderId: order.id, date: invDate, dueDate: addDays(invDate, days), lines: billed.map((l) => ({ productId: l.productId, quantity: l.invoiced, unitPrice: l.unitPrice, discount: l.discount, vatRate: l.vatRate })) };
      invoices.push(inv);
      const ttc = invoiceTotals(inv).ttc;
      // règlements : anciennes factures soldées, quelques partiels / impayés récents
      if (i < 11) collections.push({ id: `E-${num}`, invoiceId: inv.id, date: addDays(invDate, Math.max(5, days - 3)), amount: ttc, method: i % 2 ? "Chèque" : "Virement", reference: `ENC-2026-${num}` });
      else if (i % 3 === 0) collections.push({ id: `E-${num}`, invoiceId: inv.id, date: addDays(invDate, 15), amount: round2(ttc * 0.5), method: "Virement", reference: `ENC-2026-${num}` });
    }
  }

  quotes.push(
    { id: "Q-101", number: "DV-2026-101", customerId: "C-003", date: "2026-10-12", validUntil: "2026-11-12", status: "Envoyé", lines: [{ productId: "P-MIE1", quantity: 120, unitPrice: 165, vatRate: 20 }, { productId: "P-THE1", quantity: 200, unitPrice: 58, vatRate: 20 }], opportunityId: "O-003" },
    { id: "Q-102", number: "DV-2026-102", customerId: "C-005", date: "2026-10-20", validUntil: "2026-11-20", status: "Accepté", lines: [{ productId: "P-COU1", quantity: 300, unitPrice: 112, discount: 3, vatRate: 20 }, { productId: "P-CON1", quantity: 1500, unitPrice: 9.5, vatRate: 20 }], opportunityId: "O-004" },
    { id: "Q-103", number: "DV-2026-103", customerId: "C-006", date: "2026-10-25", validUntil: "2026-11-25", status: "Brouillon", lines: [{ productId: "P-HUI1", quantity: 40, unitPrice: 379, vatRate: 20 }] },
    { id: "Q-104", number: "DV-2026-104", customerId: "C-007", date: "2026-09-02", validUntil: "2026-10-02", status: "Refusé", lines: [{ productId: "P-EAU1", quantity: 2000, unitPrice: 4.5, vatRate: 20 }] },
  );

  const opp = (n: number, customerId: string, title: string, stage: Opportunity["stage"], value: number, probability: number, expectedClose: string, salesRep: string, quoteId?: string): Opportunity => ({ id: `O-${String(n).padStart(3, "0")}`, number: `OPP-2026-${String(n).padStart(3, "0")}`, customerId, title, stage, value, probability, expectedClose, salesRep, quoteId });
  const opportunities: Opportunity[] = [
    opp(1, "C-001", "Référencement gamme huiles — 2027", "Négociation", 620_000, 75, "2026-12-15", "Y. Alaoui"),
    opp(2, "C-008", "Contrat export semoule", "Proposition", 410_000, 50, "2026-12-30", "M. Idrissi"),
    opp(3, "C-003", "Approvisionnement petit-déjeuner hôtel", "Proposition", 31_000, 50, "2026-11-20", "K. Tazi", "Q-101"),
    opp(4, "C-005", "Marché cantine T4", "Gagnée", 47_000, 100, "2026-10-22", "Y. Alaoui", "Q-102"),
    opp(5, "C-002", "Volume farine T1 2027", "Qualification", 280_000, 30, "2027-01-31", "S. Bennani"),
    opp(6, "C-007", "Eau minérale été", "Perdue", 9_000, 0, "2026-09-10", "S. Bennani", "Q-104"),
    opp(7, "C-006", "Menu ramadan Dar Fès", "Qualification", 22_000, 30, "2027-02-10", "K. Tazi"),
    opp(8, "C-004", "Corner épicerie fine", "Prospection", 15_000, 10, "2027-03-01", "M. Idrissi"),
    opp(9, "C-001", "Promo rentrée scolaire", "Gagnée", 180_000, 100, "2026-08-25", "Y. Alaoui"),
    opp(10, "C-008", "Huile de tournesol vrac", "Perdue", 95_000, 0, "2026-07-15", "M. Idrissi"),
  ];

  // Objectifs mensuels de CA HT (démonstration)
  const targets = [210_000, 210_000, 230_000, 230_000, 250_000, 250_000, 240_000, 240_000, 260_000, 260_000, 280_000, 300_000];

  return { customers: DEMO_CUSTOMERS, opportunities, quotes, orders, deliveries, invoices, collections, targets };
}
export type SalesState = ReturnType<typeof buildSalesDemo>;
