import { describe, expect, it } from "vitest";
import { buildComptaDemo } from "./demo";
import {
  agingBucket, balances, bilan, caf, canLetter, computeRatios, cpc, equilibre, isBalanced, safeDiv, sig, sigValue, tableauFinancement, trialBalance, validateEntry, type Entry,
} from "./model";

const e = (lines: [string, number, number][]): Entry => ({
  id: "x", piece: "OD", date: "2026-01-15", journal: "OD", label: "t", ref: "r", status: "Validée",
  lines: lines.map(([account, debit, credit], i) => ({ id: `${i}`, account, label: "", debit, credit })),
});

describe("écritures", () => {
  it("refuse une écriture déséquilibrée", () => {
    expect(isBalanced(e([["6111", 100, 0], ["4411", 0, 90]]))).toBe(false);
    expect(validateEntry(e([["6111", 100, 0], ["4411", 0, 90]])).some((m) => m.includes("déséquilibrée"))).toBe(true);
  });
  it("accepte une écriture équilibrée sur comptes du plan", () => {
    expect(validateEntry(e([["6111", 100, 0], ["3455", 20, 0], ["4411", 0, 120]]))).toEqual([]);
  });
  it("refuse un compte hors plan comptable", () => {
    expect(validateEntry(e([["9999", 100, 0], ["4411", 0, 100]])).length).toBeGreaterThan(0);
  });
});

describe("SIG et CAF", () => {
  const bal = balances([e([["3421", 1200, 0], ["7111", 0, 1000], ["4455", 0, 200]]), e([["6111", 400, 0], ["6121", 100, 0], ["6171", 200, 0], ["6193", 50, 0], ["5141", 0, 750]])], { year: 2026, to: 11 });
  it("calcule marge brute, VA, EBE, RE et RN", () => {
    const s = sig(bal);
    expect(sigValue(s, "margeBrute")).toBe(600);
    expect(sigValue(s, "va")).toBe(500);
    expect(sigValue(s, "ebe")).toBe(300);
    expect(sigValue(s, "rex")).toBe(250);
    expect(sigValue(s, "rn")).toBe(cpc(bal).resultatNet);
  });
  it("CAF = résultat net + dotations", () => {
    expect(caf(bal).caf).toBe(300);
  });
});

describe("jeu de démonstration", () => {
  const { entries } = buildComptaDemo();
  const validated = entries.filter((x) => x.status === "Validée");
  it("toutes les écritures validées sont équilibrées", () => {
    expect(validated.every(isBalanced)).toBe(true);
  });
  for (const year of [2025, 2026]) {
    it(`bilan ${year} équilibré et FRNG − BFR = trésorerie nette`, () => {
      const b = bilan(balances(entries, { year, to: year === 2025 ? 11 : 9 }));
      expect(Math.abs(b.totalActif - b.totalPassif)).toBeLessThan(0.01);
      expect(equilibre(b)?.coherent).toBe(true);
    });
    it(`balance générale ${year} : total débit = total crédit`, () => {
      const t = trialBalance(entries, { year, to: 11 });
      const d = t.reduce((s, r) => s + r.closeD, 0), c = t.reduce((s, r) => s + r.closeC, 0);
      expect(Math.abs(d - c)).toBeLessThan(0.01);
    });
  }
  it("tableau de financement réconcilié avec la variation du FRNG", () => {
    const tf = tableauFinancement(entries, { year: 2026, to: 9 });
    expect(tf.deltaFrBilan).not.toBeNull();
    expect(Math.abs(tf.variationFr - tf.deltaFrBilan!)).toBeLessThan(0.01);
  });
  it("le résultat 2025 reporté à l'ouverture 2026 égale le résultat du CPC 2025", () => {
    const rn = cpc(balances(entries, { year: 2025, to: 11 })).resultatNet;
    const an = entries.find((x) => x.journal === "AN" && x.date.startsWith("2026"))!;
    expect(an.lines.find((l) => l.account === "1191")!.credit).toBeCloseTo(rn, 2);
  });
  it("ratios calculés sans dénominateur nul", () => {
    const r = computeRatios({ bal: balances(entries, { year: 2026, to: 9 }), openBal: balances(entries, { year: 2026, to: 9, onlyOpening: true }), days: 304, vatRate: 20 });
    expect(Object.values(r).every((v) => v === null || Number.isFinite(v))).toBe(true);
    expect(r["roe"]).not.toBeNull();
  });
});

describe("outils", () => {
  it("division protégée", () => expect(safeDiv(1, 0)).toBeNull());
  it("lettrage seulement si débit = crédit", () => {
    expect(canLetter([{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }])).toBeNull();
    expect(canLetter([{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }])).not.toBeNull();
  });
  it("tranches d'antériorité", () => {
    expect(agingBucket(0)).toBe("Non échues");
    expect(agingBucket(30)).toBe("1–30 jours");
    expect(agingBucket(61)).toBe("61–90 jours");
    expect(agingBucket(91)).toBe("Plus de 90 jours");
  });
});
