import { describe, expect, it } from "vitest";
import {
  achievementRate, forecastYear, lineStats, parseAmount, variance, varianceNature, varianceRate, type BudgetLine,
} from "./model";

const line = (budget: number[], actual: (number | null)[], category: BudgetLine["category"] = "achats"): BudgetLine => ({
  id: "x", budgetId: "b", category, label: "t",
  budget: [...budget, ...Array(12 - budget.length).fill(0)],
  actual: [...actual, ...Array(12 - actual.length).fill(null)],
});

describe("calculs d'écarts", () => {
  it("écart = réel − budget", () => expect(variance(120, 100)).toBe(20));
  it("taux de réalisation = réel / budget × 100", () => expect(achievementRate(80, 100)).toBe(80));
  it("taux d'écart utilise la valeur absolue du budget", () => expect(varianceRate(-50, -100)).toBe(50));
  it("budget nul : taux non calculés", () => {
    expect(achievementRate(10, 0)).toBeNull();
    expect(varianceRate(10, 0)).toBeNull();
  });
  it("écart positif favorable pour les recettes", () => expect(varianceNature("revenus", 5)).toBe("favorable"));
  it("écart positif défavorable pour les charges", () => expect(varianceNature("achats", 5)).toBe("defavorable"));
});

describe("réalisé et prévision", () => {
  it("budget à date ne compte que les mois réalisés", () => {
    const s = lineStats(line([100, 100, 100], [90, null, null]));
    expect(s.budgetToDate).toBe(100);
    expect(s.actual).toBe(90);
    expect(s.budgetYear).toBe(300);
  });
  it("prévision = réel + budget restant × taux de réalisation", () => {
    expect(forecastYear(line([100, 100, 100], [110, null, null]))).toBeCloseTo(110 + 220);
  });
});

describe("saisie des montants", () => {
  it("accepte espaces et virgule", () => expect(parseAmount("12 500,5")).toBe(12500.5));
  it("refuse texte et négatifs", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
});
