import { describe, expect, it } from "vitest";
import { capDelivery, conversionRate, creditCheck, invoiceableLines, invoiceStatus, orderStatus, totals, validateCollection, type SalesInvoice, type SalesOrder } from "./model";

const order = (lines: SalesOrder["lines"]): SalesOrder => ({ id: "o", number: "BC", customerId: "c", date: "2026-10-01", deliveryDate: "2026-10-08", cancelled: false, lines });

describe("ventes", () => {
  it("taux de conversion = gagnées / qualifiées (hors prospection)", () => {
    expect(conversionRate([{ stage: "Prospection" }, { stage: "Gagnée" }, { stage: "Perdue" }, { stage: "Négociation" }, { stage: "Gagnée" }])).toBe(50);
    expect(conversionRate([{ stage: "Prospection" }])).toBeNull();
  });
  it("totaux HT/TVA/TTC avec remise", () => {
    expect(totals([{ productId: "a", quantity: 10, unitPrice: 100, discount: 10, vatRate: 20 }])).toEqual({ ht: 900, tva: 180, ttc: 1080 });
  });
  it("livraison plafonnée au reste à livrer et au stock", () => {
    const o = order([{ productId: "a", quantity: 10, unitPrice: 1, delivered: 4, invoiced: 0 }, { productId: "b", quantity: 5, unitPrice: 1, delivered: 0, invoiced: 0 }]);
    const r = capDelivery(o, { a: 50, b: 5 }, { a: 100, b: 2 });
    expect(r.qty).toEqual({ a: 6, b: 2 });
    expect(r.short).toEqual(["b"]);
  });
  it("statut commande et facturation du seul livré", () => {
    const o = order([{ productId: "a", quantity: 10, unitPrice: 5, delivered: 6, invoiced: 2 }]);
    expect(orderStatus(o)).toBe("Partiellement livrée");
    expect(invoiceableLines(o)).toEqual([{ productId: "a", quantity: 4, unitPrice: 5, discount: undefined, vatRate: undefined }]);
    expect(orderStatus(order([{ productId: "a", quantity: 1, unitPrice: 5, delivered: 1, invoiced: 1 }]))).toBe("Facturée");
  });
  it("encaissement : pas au-delà du reste dû", () => {
    expect(validateCollection(1200.01, 1200)).not.toBeNull();
    expect(validateCollection(1200, 1200)).toBeNull();
    expect(validateCollection(0, 1200)).not.toBeNull();
  });
  it("statut facture : partielle, retard, réglée", () => {
    const inv: SalesInvoice = { id: "i", number: "FA", customerId: "c", orderId: "o", date: "2026-09-01", dueDate: "2026-10-01", lines: [{ productId: "a", quantity: 1, unitPrice: 1000, vatRate: 20 }] };
    expect(invoiceStatus(inv, [], "2026-09-15")).toBe("Émise");
    expect(invoiceStatus(inv, [{ id: "e", invoiceId: "i", date: "", amount: 600, method: "Virement", reference: "" }], "2026-09-15")).toBe("Partiellement réglée");
    expect(invoiceStatus(inv, [], "2026-10-02")).toBe("En retard");
    expect(invoiceStatus(inv, [{ id: "e", invoiceId: "i", date: "", amount: 1200, method: "Virement", reference: "" }], "2026-10-02")).toBe("Réglée");
  });
  it("plafond de crédit", () => {
    expect(creditCheck({ creditLimit: 100_000 }, 90_000, 20_000)).not.toBeNull();
    expect(creditCheck({ creditLimit: 100_000 }, 80_000, 20_000)).toBeNull();
    expect(creditCheck({ creditLimit: 0 }, 1e9, 1e9)).toBeNull();
  });
});
