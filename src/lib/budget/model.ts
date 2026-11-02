// Budgets & Prévisions — types, référentiels et calculs (purs, testables).

export type Category = "revenus" | "achats" | "personnel" | "externes" | "amortissements" | "autres";

export const CATEGORIES: { id: Category; label: string; compte: string }[] = [
  { id: "revenus", label: "Chiffre d'affaires", compte: "711" },
  { id: "achats", label: "Achats consommés", compte: "612" },
  { id: "personnel", label: "Charges de personnel", compte: "617" },
  { id: "externes", label: "Charges externes", compte: "613/614" },
  { id: "amortissements", label: "Dotations aux amortissements", compte: "619" },
  { id: "autres", label: "Autres charges", compte: "618" },
];
export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)?.label ?? c;

export const DEPARTMENTS = ["Commercial", "Production", "Administration & Finance"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const CENTRES: { id: string; label: string; department: Department }[] = [
  { id: "CC-COM", label: "Direction commerciale", department: "Commercial" },
  { id: "CC-MKT", label: "Marketing", department: "Commercial" },
  { id: "CC-USK", label: "Usine Kénitra", department: "Production" },
  { id: "CC-LOG", label: "Logistique", department: "Production" },
  { id: "CC-DAF", label: "Direction financière", department: "Administration & Finance" },
];
export const centreLabel = (id: string) => CENTRES.find((c) => c.id === id)?.label ?? id;
export const centreDept = (id: string) => CENTRES.find((c) => c.id === id)?.department;

export const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
export const ALL_MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export type Budget = { id: string; year: number; centre: string };
export type BudgetLine = {
  id: string;
  budgetId: string;
  category: Category;
  label: string;
  budget: number[]; // 12 montants mensuels
  actual: (number | null)[]; // null = réalisé non saisi
};
export type ActionStatus = "À lancer" | "En cours" | "Terminée";
export type CorrectiveAction = {
  id: string;
  lineId: string;
  cause: string;
  action: string;
  owner: string;
  deadline: string;
  status: ActionStatus;
};

export const isRevenue = (c: Category) => c === "revenus";

/** Écart (MAD) = Réel − Budget */
export const variance = (actual: number, budget: number) => actual - budget;
/** Taux de réalisation (%) = Réel / Budget × 100 ; null si budget nul */
export const achievementRate = (actual: number, budget: number) => (budget === 0 ? null : (actual / budget) * 100);
/** Taux d'écart (%) = (Réel − Budget) / |Budget| × 100 ; null si budget nul */
export const varianceRate = (actual: number, budget: number) =>
  budget === 0 ? null : ((actual - budget) / Math.abs(budget)) * 100;

/** Recettes : écart positif favorable. Charges : écart positif défavorable. */
export function varianceNature(category: Category, v: number): "favorable" | "defavorable" | "neutre" {
  if (v === 0) return "neutre";
  const positiveIsGood = isRevenue(category);
  return v > 0 === positiveIsGood ? "favorable" : "defavorable";
}

/** Analyse un montant saisi ("12 500,50"). Renvoie null si invalide ou négatif. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (s === "" || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export type Stats = { budgetYear: number; budgetToDate: number; actual: number; monthsWithActual: number };

/** Sur les mois donnés : budget total, budget des mois réalisés, réel. */
export function lineStats(line: BudgetLine, months: number[] = ALL_MONTHS): Stats {
  let budgetYear = 0, budgetToDate = 0, actual = 0, monthsWithActual = 0;
  for (const m of months) {
    const b = line.budget[m] ?? 0;
    budgetYear += b;
    const a = line.actual[m];
    if (a !== null && a !== undefined) {
      budgetToDate += b;
      actual += a;
      monthsWithActual++;
    }
  }
  return { budgetYear, budgetToDate, actual, monthsWithActual };
}

export function sumStats(list: Stats[]): Stats {
  return list.reduce(
    (a, s) => ({
      budgetYear: a.budgetYear + s.budgetYear,
      budgetToDate: a.budgetToDate + s.budgetToDate,
      actual: a.actual + s.actual,
      monthsWithActual: Math.max(a.monthsWithActual, s.monthsWithActual),
    }),
    { budgetYear: 0, budgetToDate: 0, actual: 0, monthsWithActual: 0 },
  );
}

/**
 * Prévision mensuelle d'une ligne.
 * Méthode : mois réalisés = réel ; mois restants = budget × taux de réalisation à date
 * de la ligne (borné entre 50 % et 150 %) ; sans réalisé, le budget est repris tel quel.
 */
export function forecastMonths(line: BudgetLine): { value: number; isActual: boolean }[] {
  const s = lineStats(line);
  const raw = s.budgetToDate > 0 ? s.actual / s.budgetToDate : 1;
  const ratio = Math.min(1.5, Math.max(0.5, raw));
  return ALL_MONTHS.map((m) => {
    const a = line.actual[m];
    if (a !== null && a !== undefined) return { value: a, isActual: true };
    return { value: (line.budget[m] ?? 0) * ratio, isActual: false };
  });
}

export const forecastYear = (line: BudgetLine) => forecastMonths(line).reduce((a, x) => a + x.value, 0);

/** Résultat = recettes − charges, pour un ensemble de lignes et une fonction de valeur. */
export function result(lines: BudgetLine[], value: (l: BudgetLine) => number) {
  let rev = 0, exp = 0;
  for (const l of lines) (isRevenue(l.category) ? (rev += value(l)) : (exp += value(l)));
  return { revenue: rev, expenses: exp, result: rev - exp };
}
