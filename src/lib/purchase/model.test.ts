import { describe, expect, it } from "vitest";
import {
  avgPaymentDelay, canTransition, capReceipt, concentration, invoiceStatus, isValidIce, linesTotals, outstanding, termDays, validatePayment,
  type Invoice, type Payment,
} from "./model";
import type { PurchaseOrder } from "@/lib/stock/model";

describe("totaux HT / TVA / TTC", () => {
  it("applique remise et taux de TVA par ligne", () => {
    const t = linesTotals([
      { productId: "A", quantity: 10, received: 0, unitCost: 100, discount: 10, vatRate: 20 }, // 900 HT, 180 TVA
      { productId: "B", quantity: 5, received: 0, unitCost: 40, vatRate: 7 }, // 200 HT, 14 TVA
    ]);
    expect(t).toEqual({ ht: 1100, tva: 194, ttc: 1294 });
  });
  it("TVA à 20 % par défaut", () => {
    expect(linesTotals([{ productId: "A", quantity: 1, received: 0, unitCost: 50 }]).ttc).toBe(60);
  });
});

describe("réceptions", () => {
  const order: PurchaseOrder = { id: "O", number: "C", supplier: "S", date: "2026-10-01", expected: "2026-10-10", status: "Validée", lines: [{ productId: "A", quantity: 100, received: 60, unitCost: 1 }] };
  it("plafonne au reste à recevoir pour éviter une double réception", () => {
    expect(capReceipt(order, { A: 80 })).toEqual({ A: 40 });
    expect(capReceipt(order, { A: -5 })).toEqual({ A: 0 });
  });
});

describe("factures et règlements", () => {
  const inv: Invoice = { id: "F", reference: "F1", supplierId: "S", date: "2026-09-01", dueDate: "2026-10-31", ht: 1000, tva: 200, validated: true };
  const pay = (amount: number, date = "2026-09-21"): Payment => ({ id: String(amount), invoiceId: "F", date, amount, method: "Virement", reference: "" });
  it("reste à payer = TTC − règlements", () => {
    expect(outstanding(inv, [pay(500)])).toBe(700);
  });
  it("statuts : validée, partiellement payée, payée, en retard", () => {
    expect(invoiceStatus(inv, [], "2026-10-15")).toBe("Validée");
    expect(invoiceStatus({ ...inv, validated: false }, [], "2026-10-15")).toBe("À vérifier");
    expect(invoiceStatus(inv, [pay(500)], "2026-10-15")).toBe("Partiellement payée");
    expect(invoiceStatus(inv, [pay(1200)], "2026-11-15")).toBe("Payée");
    expect(invoiceStatus(inv, [pay(500)], "2026-11-15")).toBe("En retard");
  });
  it("refuse un règlement supérieur au reste à payer", () => {
    expect(validatePayment(800, 700)).not.toBeNull();
    expect(validatePayment(0, 700)).not.toBeNull();
    expect(validatePayment(700, 700)).toBeNull();
  });
  it("délai moyen de paiement en jours", () => {
    expect(avgPaymentDelay([inv], [pay(100, "2026-09-21"), pay(100, "2026-10-01")])).toBe(25);
    expect(avgPaymentDelay([inv], [])).toBeNull();
  });
});

describe("règles diverses", () => {
  it("circuit de validation des demandes", () => {
    expect(canTransition("Brouillon", "Soumise")).toBe(true);
    expect(canTransition("Brouillon", "Approuvée")).toBe(false);
    expect(canTransition("Rejetée", "Convertie en commande")).toBe(false);
  });
  it("ICE à 15 chiffres", () => {
    expect(isValidIce("001234567000089")).toBe(true);
    expect(isValidIce("12345")).toBe(false);
  });
  it("échéance déduite des conditions de paiement", () => {
    expect(termDays("60 jours fin de mois")).toBe(60);
    expect(termDays("Comptant")).toBe(0);
  });
  it("concentration fournisseurs", () => {
    expect(concentration([50, 30, 10, 10])).toEqual({ top1: 50, top3: 90 });
    expect(concentration([])).toBeNull();
  });
});
