import { describe, expect, it } from "vitest";
import {
  movementDelta, monthlyStockValues, orderTotal, receiptStatus, remainingQty, replenishmentQty, stockStatus, stockValue, turnoverRatio,
  type Movement, type PurchaseOrder,
} from "./model";

describe("stockStatus", () => {
  it("rupture à zéro, faible sous le min, surstock au-dessus du max", () => {
    expect(stockStatus({ stock: 0, min: 10, max: 100 })).toBe("rupture");
    expect(stockStatus({ stock: 5, min: 10, max: 100 })).toBe("faible");
    expect(stockStatus({ stock: 150, min: 10, max: 100 })).toBe("surstock");
    expect(stockStatus({ stock: 50, min: 10, max: 100 })).toBe("disponible");
  });
});

describe("movementDelta", () => {
  it("entrées et retours client créditent, sorties et retours fournisseur débitent", () => {
    expect(movementDelta("entree", 10)).toBe(10);
    expect(movementDelta("retour_client", 10)).toBe(10);
    expect(movementDelta("ajustement_pos", 10)).toBe(10);
    expect(movementDelta("sortie", 10)).toBe(-10);
    expect(movementDelta("retour_fournisseur", 10)).toBe(-10);
    expect(movementDelta("ajustement_neg", 10)).toBe(-10);
    expect(movementDelta("transfert", 10)).toBe(-10);
  });
});

describe("commandes", () => {
  const order: PurchaseOrder = {
    id: "O", number: "CMD-1", supplier: "F", date: "2026-01-01", expected: "2026-01-10", status: "Validée",
    lines: [
      { productId: "A", quantity: 100, received: 40, unitCost: 10 },
      { productId: "B", quantity: 50, received: 50, unitCost: 20 },
    ],
  };
  it("calcule le total et le reste à recevoir", () => {
    expect(orderTotal(order)).toBe(2000);
    expect(remainingQty(order.lines[0]!)).toBe(60);
    expect(remainingQty(order.lines[1]!)).toBe(0);
  });
  it("statut après réception", () => {
    expect(receiptStatus(order)).toBe("Partiellement reçue");
    expect(receiptStatus({ ...order, lines: order.lines.map((l) => ({ ...l, received: l.quantity })) })).toBe("Reçue");
  });
});

describe("réapprovisionnement et valorisation", () => {
  it("ramène le stock au maximum", () => {
    expect(replenishmentQty({ stock: 120, max: 1200 })).toBe(1080);
    expect(replenishmentQty({ stock: 1500, max: 1200 })).toBe(0);
  });
  it("valeur du stock = quantité × coût unitaire", () => {
    expect(stockValue({ stock: 120, unitCost: 285 })).toBe(34200);
  });
});

describe("historique et rotation", () => {
  const products = [{ id: "A", stock: 90, unitCost: 10 }] as never;
  const movements: Movement[] = [
    { id: "1", date: "2026-03-10", number: "M1", type: "entree", productId: "A", warehouseId: "W", quantity: 100, unitCost: 10 },
    { id: "2", date: "2026-05-10", number: "M2", type: "sortie", productId: "A", warehouseId: "W", quantity: 10, unitCost: 10 },
  ];
  it("reconstitue les valeurs de fin de mois", () => {
    const v = monthlyStockValues(products as never, movements);
    // mois indexés à partir de 0 : fin février = 0, fin mars = 1000, fin mai = 900
    expect(v.find((x) => x.mois === 4)?.value).toBe(900);
    expect(v.find((x) => x.mois === 1)?.value).toBe(0);
    expect(v.find((x) => x.mois === 2)?.value).toBe(1000);
  });
  it("rotation = sorties / stock moyen, null sans sorties", () => {
    expect(turnoverRatio(movements, 500)).toBeCloseTo(0.2);
    expect(turnoverRatio([], 500)).toBeNull();
    expect(turnoverRatio(movements, 0)).toBeNull();
  });
});
