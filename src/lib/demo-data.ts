// Données de démonstration illustratives — aucune donnée réelle.
export const formatMAD = (v: number, compact = false) =>
  compact
    ? `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 1 }).format(v / 1_000_000)} M DH`
    : `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(v)} DH`;

export const kpis = [
  { label: "Chiffre d'affaires", value: 48_620_000, delta: 8.4, hint: "Cumul 2026" },
  { label: "Charges", value: 39_150_000, delta: 5.1, hint: "Cumul 2026", inverse: true },
  { label: "Résultat net", value: 6_870_000, delta: 12.3, hint: "Après IS" },
  { label: "Trésorerie", value: 9_340_000, delta: -3.2, hint: "Toutes banques" },
  { label: "Marge nette", value: 14.1, delta: 0.6, hint: "Résultat / CA", percent: true },
  { label: "Stock valorisé", value: 7_215_000, delta: 2.7, hint: "CMUP", inverse: true },
];

const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct"];
const rev = [4.1, 4.3, 4.7, 4.5, 4.9, 5.2, 4.6, 4.0, 5.1, 5.6];
const prof = [0.52, 0.58, 0.66, 0.61, 0.72, 0.8, 0.63, 0.49, 0.74, 0.86];
export const monthly = months.map((m, i) => ({ mois: m, ca: (rev[i] ?? 0) * 1e6, resultat: (prof[i] ?? 0) * 1e6 }));

export const budgetVsActual = [
  { poste: "Ventes", budget: 50.0, reel: 48.6 },
  { poste: "Achats", budget: 26.0, reel: 27.9 },
  { poste: "Personnel", budget: 7.5, reel: 7.2 },
  { poste: "Marketing", budget: 1.8, reel: 2.3 },
  { poste: "Logistique", budget: 2.4, reel: 2.2 },
];

export const expenses = [
  { name: "Achats consommés", value: 27_900_000 },
  { name: "Charges de personnel", value: 7_200_000 },
  { name: "Transport & logistique", value: 2_200_000 },
  { name: "Marketing", value: 2_300_000 },
  { name: "Autres charges", value: 1_550_000 },
];

export const stockAlerts = [
  { article: "Huile d'olive 5L", depot: "Casablanca", stock: 120, seuil: 400, level: "critique" },
  { article: "Semoule fine 25kg", depot: "Fès", stock: 310, seuil: 500, level: "bas" },
  { article: "Thé vert 500g", depot: "Tanger", stock: 860, seuil: 1000, level: "bas" },
  { article: "Sucre en pain 2kg", depot: "Marrakech", stock: 45, seuil: 300, level: "critique" },
] as const;

export const budgetAlerts = [
  { poste: "Marketing", centre: "Direction commerciale", ecart: 27.8 },
  { poste: "Achats matières", centre: "Production", ecart: 7.3 },
  { poste: "Énergie", centre: "Usine Kénitra", ecart: 11.5 },
];

export const transactions = [
  { date: "28/10/2026", ref: "FAC-2026-1184", tiers: "Marjane Holding", type: "Vente", montant: 342_500, statut: "Encaissé" },
  { date: "27/10/2026", ref: "ACH-2026-0732", tiers: "Lesieur Cristal", type: "Achat", montant: -186_200, statut: "Payé" },
  { date: "27/10/2026", ref: "FAC-2026-1183", tiers: "Label'Vie", type: "Vente", montant: 215_800, statut: "En attente" },
  { date: "25/10/2026", ref: "BQ-2026-0419", tiers: "Attijariwafa Bank", type: "Banque", montant: -48_000, statut: "Payé" },
  { date: "24/10/2026", ref: "ACH-2026-0729", tiers: "Cosumar", type: "Achat", montant: -97_450, statut: "En retard" },
  { date: "23/10/2026", ref: "FAC-2026-1179", tiers: "BIM Maroc", type: "Vente", montant: 128_900, statut: "Encaissé" },
];
