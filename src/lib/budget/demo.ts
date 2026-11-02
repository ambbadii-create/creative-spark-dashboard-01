import type { Budget, BudgetLine, Category, CorrectiveAction } from "./model";
import { CENTRES } from "./model";

// Données de démonstration générées de façon déterministe.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const plan: Record<string, { category: Category; label: string; monthly: number }[]> = {
  "CC-COM": [
    { category: "revenus", label: "Ventes grande distribution", monthly: 2_600_000 },
    { category: "revenus", label: "Ventes export", monthly: 900_000 },
    { category: "personnel", label: "Force de vente", monthly: 310_000 },
    { category: "externes", label: "Déplacements & réceptions", monthly: 65_000 },
  ],
  "CC-MKT": [
    { category: "externes", label: "Campagnes publicitaires", monthly: 150_000 },
    { category: "personnel", label: "Équipe marketing", monthly: 95_000 },
    { category: "autres", label: "Salons & événements", monthly: 40_000 },
  ],
  "CC-USK": [
    { category: "achats", label: "Matières premières", monthly: 1_650_000 },
    { category: "achats", label: "Emballages", monthly: 260_000 },
    { category: "personnel", label: "Personnel de production", monthly: 280_000 },
    { category: "externes", label: "Énergie & fluides", monthly: 120_000 },
    { category: "amortissements", label: "Amortissement lignes de production", monthly: 140_000 },
  ],
  "CC-LOG": [
    { category: "externes", label: "Transport sur ventes", monthly: 160_000 },
    { category: "personnel", label: "Personnel logistique", monthly: 85_000 },
    { category: "amortissements", label: "Amortissement flotte", monthly: 45_000 },
  ],
  "CC-DAF": [
    { category: "personnel", label: "Personnel administratif", monthly: 130_000 },
    { category: "externes", label: "Honoraires & conseil", monthly: 55_000 },
    { category: "autres", label: "Frais bancaires", monthly: 18_000 },
  ],
};

const season = [0.92, 0.9, 1.05, 1.08, 1.0, 1.04, 0.95, 0.82, 1.02, 1.08, 1.03, 1.11];

export function buildDemo() {
  const r = rng(42);
  const budgets: Budget[] = [];
  const lines: BudgetLine[] = [];
  for (const year of [2025, 2026]) {
    const closed = year === 2025 ? 12 : 9; // 2026 : réalisé saisi jusqu'à septembre
    for (const c of CENTRES) {
      const id = `B-${year}-${c.id}`;
      budgets.push({ id, year, centre: c.id });
      plan[c.id]!.forEach((p, i) => {
        const growth = year === 2026 ? 1.06 : 1;
        const drift = 0.94 + r() * 0.14 + (p.label.startsWith("Campagnes") ? 0.2 : 0);
        const budget = season.map((s) => Math.round((p.monthly * s * growth) / 1000) * 1000);
        const actual = budget.map((b, m) =>
          m < closed ? Math.round((b * drift * (0.95 + r() * 0.1)) / 100) * 100 : null,
        );
        lines.push({ id: `${id}-L${i}`, budgetId: id, category: p.category, label: p.label, budget, actual });
      });
    }
  }
  const actions: CorrectiveAction[] = [
    {
      id: "A-1",
      lineId: "B-2026-CC-MKT-L0",
      cause: "Lancement anticipé de la campagne Ramadan",
      action: "Geler les dépenses digitales du T4 et renégocier l'agence",
      owner: "Salma Bennani",
      deadline: "2026-11-30",
      status: "En cours",
    },
  ];
  return { budgets, lines, actions };
}
