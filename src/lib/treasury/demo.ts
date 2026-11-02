// Données de démonstration — Trésorerie (fictives).
// Les RIB, contrats de financement et taux d'intérêt sont factices et servent uniquement à la démonstration.
import {
  DEFAULT_PERMISSIONS, DEFAULT_SCENARIOS, loanSchedule, round2,
  type Account, type Commitment, type FxRate, type Loan, type Match, type Movement, type PayRequest, type Permissions,
  type Rules, type Scenario, type ScenarioName, type StatementLine, type AuditEvent, type Role, type Category, type PaymentMethod,
} from "./model";

export type ForecastSnapshot = { month: string; forecastIn: number; forecastOut: number };
export type Link = { accountId: string; transmitted: boolean };
export type TreasuryState = {
  accounts: Account[];
  movements: Movement[];
  requests: PayRequest[];
  loans: Loan[];
  statements: StatementLine[];
  matches: Match[];
  commitments: Commitment[];
  scenarios: Record<ScenarioName, Scenario>;
  snapshots: ForecastSnapshot[];
  /** Compte de trésorerie et statut de transmission des règlements issus de Ventes / Achats (clé = id du règlement). */
  links: Record<string, Link>;
  disputes: string[];
  expectedDates: Record<string, string>;
  fx: FxRate[];
  rules: Rules;
  permissions: Permissions;
  role: Role;
  audit: AuditEvent[];
  updatedAt: string;
};

const accounts: Account[] = [
  { id: "BQ-1", kind: "Banque", name: "Compte courant principal", bank: "Attijariwafa bank", branch: "Casablanca Anfa", number: "007780000123456789012345", currency: "MAD", openingBalance: 1_450_000, openingDate: "2026-01-01", minBalance: 300_000, restricted: 0, status: "Actif" },
  { id: "BQ-2", kind: "Banque", name: "Compte exploitation", bank: "Bank of Africa", branch: "Casablanca Maârif", number: "011780000987654321098765", currency: "MAD", openingBalance: 620_000, openingDate: "2026-01-01", minBalance: 150_000, restricted: 120_000, status: "Actif" },
  { id: "BQ-3", kind: "Banque", name: "Compte devises import", bank: "CIH Bank", branch: "Tanger Ville", number: "230640000555666777888999", currency: "EUR", openingBalance: 38_000, openingDate: "2026-01-01", minBalance: 5_000, restricted: 0, status: "Actif" },
  { id: "BQ-4", kind: "Banque", name: "Compte garantie marchés", bank: "Banque Populaire", branch: "Rabat Agdal", number: "190810000111222333444555", currency: "MAD", openingBalance: 200_000, openingDate: "2026-01-01", minBalance: 0, restricted: 0, status: "Bloqué" },
  { id: "CA-1", kind: "Caisse", name: "Caisse siège", currency: "MAD", openingBalance: 18_000, openingDate: "2026-01-01", minBalance: 5_000, restricted: 0, status: "Actif", responsible: "N. Chraibi", location: "Casablanca", cashOpen: true },
  { id: "CA-2", kind: "Caisse", name: "Caisse dépôt", currency: "MAD", openingBalance: 6_500, openingDate: "2026-01-01", minBalance: 2_000, restricted: 0, status: "Actif", responsible: "H. Ouazzani", location: "Agadir", cashOpen: false },
];

const loans: Loan[] = [
  { id: "L-1", lender: "Attijariwafa bank", ref: "CMT-2025-0417", kind: "Crédit moyen terme", principal: 1_200_000, rate: 5.4, start: "2025-04-15", installments: 60, frequency: "Mensuelle", accountId: "BQ-1", status: "En cours", demo: true },
  { id: "L-2", lender: "Maroc Leasing", ref: "CB-2024-1182", kind: "Crédit-bail", principal: 480_000, rate: 6.2, start: "2024-09-05", installments: 16, frequency: "Trimestrielle", accountId: "BQ-2", status: "En cours", demo: true },
];

const commitments: Commitment[] = [
  { id: "C-1", label: "Salaires nets", category: "Salaires", amount: 168_000, dayOfMonth: 28, active: true },
  { id: "C-2", label: "CNSS / AMO", category: "Charges sociales (CNSS / AMO)", amount: 41_500, dayOfMonth: 10, active: true },
  { id: "C-3", label: "IR sur salaires", category: "Impôts et taxes", amount: 23_800, dayOfMonth: 15, active: true },
  { id: "C-4", label: "TVA due (déclaration mensuelle)", category: "Impôts et taxes", amount: 36_000, dayOfMonth: 20, active: true },
  { id: "C-5", label: "Loyer entrepôt", category: "Loyers", amount: 28_000, dayOfMonth: 5, active: true },
  { id: "C-6", label: "Énergie, télécoms, carburant", category: "Charges d'exploitation", amount: 31_000, dayOfMonth: 12, active: true },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function buildTreasuryDemo(): TreasuryState {
  const movements: Movement[] = [];
  let n = 0;
  const add = (date: string, label: string, direction: "in" | "out", category: Category, accountId: string, counterparty: string, amount: number, method: PaymentMethod, extra: Partial<Movement> = {}) => {
    n++;
    const acc = accounts.find((a) => a.id === accountId)!;
    movements.push({ id: `M-${pad(n)}${n}`, ref: `TR-2026-${String(n).padStart(4, "0")}`, date, valueDate: date, label, direction, category, accountId, counterparty, amount: round2(amount), currency: acc.currency, method, status: "Validé", source: "Trésorerie", comptaStatus: date < "2026-10-01" ? "Transmis" : "À transmettre", ...extra });
  };

  // Encaissements grands comptes (hors périmètre du module Ventes de démonstration) et charges récurrentes
  for (let m = 1; m <= 10; m++) {
    const mm = pad(m), v = 1 + (((m * 37) % 11) - 5) / 100;
    add(`2026-${mm}-08`, "Règlement contrat cadre distribution", "in", "Encaissements clients", "BQ-1", "Marjane Holding", 245_000 * v, "Virement");
    add(`2026-${mm}-18`, "Règlement commandes CHR", "in", "Encaissements clients", "BQ-2", "Groupe hôtelier Atlas", 132_000 * (2 - v), "Chèque");
    add(`2026-${mm}-05`, "Loyer entrepôt", "out", "Loyers", "BQ-2", "SCI Ain Sebaâ", 28_000, "Virement");
    add(`2026-${mm}-10`, "CNSS / AMO", "out", "Charges sociales (CNSS / AMO)", "BQ-1", "CNSS", 41_500 * (m > 6 ? 1.02 : 1), "Prélèvement");
    add(`2026-${mm}-15`, "IR sur salaires", "out", "Impôts et taxes", "BQ-1", "DGI", 23_800, "Virement");
    add(`2026-${mm}-20`, "TVA due", "out", "Impôts et taxes", "BQ-1", "DGI", 36_000 * v, "Virement");
    add(`2026-${mm}-12`, "Énergie, télécoms, carburant", "out", "Charges d'exploitation", "BQ-2", "Divers fournisseurs de services", 31_000 * v, "Prélèvement");
    add(`2026-${mm}-28`, "Paie du mois", "out", "Salaires", "BQ-1", "Personnel", 168_000 * (m > 6 ? 1.03 : 1), "Virement");
    add(`2026-${mm}-03`, "Ventes comptoir", "in", "Encaissements clients", "CA-1", "Clients comptoir", 14_000 * v, "Espèces");
    add(`2026-${mm}-14`, "Petites dépenses", "out", "Charges d'exploitation", "CA-1", "Divers", 3_200 * v, "Espèces");
    // Versement des espèces en banque (virement interne : deux mouvements liés, exclus des flux)
    const tid = `T-${mm}`;
    add(`2026-${mm}-25`, "Versement espèces en banque", "out", "Virement interne", "CA-1", "Attijariwafa bank", 10_000, "Versement espèces", { transferId: tid });
    add(`2026-${mm}-25`, "Versement espèces caisse siège", "in", "Virement interne", "BQ-1", "Caisse siège", 10_000, "Versement espèces", { transferId: tid });
    if (m % 3 === 0) add(`2026-${mm}-22`, "Règlement importation emballages", "out", "Paiements fournisseurs", "BQ-3", "Emballages Iberia SL", 9_500, "Virement");
  }
  add("2026-03-16", "Acquisition chariot élévateur", "out", "Investissements", "BQ-1", "Manutention Maroc", 186_000, "Virement");
  add("2026-07-08", "Placement à terme — intérêts", "in", "Produits financiers", "BQ-1", "Attijariwafa bank", 12_400, "Virement");
  add("2026-09-23", "Prime exceptionnelle de rentrée", "out", "Salaires", "BQ-1", "Personnel", 96_000, "Virement");
  add("2026-11-02", "Règlement contrat cadre distribution", "in", "Encaissements clients", "BQ-1", "Marjane Holding", 251_000, "Virement", { status: "Brouillon", comptaStatus: "À transmettre" });

  // Échéances d'emprunts passées (générées depuis les tableaux d'amortissement)
  for (const l of loans) {
    for (const r of loanSchedule(l)) {
      if (r.date < "2026-01-01" || r.date > "2026-11-02") continue;
      add(r.date, `Échéance ${l.ref} n°${r.n} — capital`, "out", "Remboursements d'emprunts", l.accountId, l.lender, r.principal, "Prélèvement", { source: "Financements", sourceId: l.id });
      add(r.date, `Échéance ${l.ref} n°${r.n} — intérêts`, "out", "Intérêts", l.accountId, l.lender, r.interest, "Prélèvement", { source: "Financements", sourceId: l.id });
    }
  }

  // Relevé bancaire d'octobre (BQ-1) : reprend les mouvements, avec écarts réalistes
  const statements: StatementLine[] = [];
  const oct = movements.filter((m) => m.accountId === "BQ-1" && m.date >= "2026-10-01" && m.date <= "2026-10-31" && m.status === "Validé").sort((a, b) => a.date.localeCompare(b.date));
  oct.forEach((m, i) => {
    if (m.label === "Paie du mois") return; // virement de paie pas encore débité sur le relevé
    const shift = m.category === "Encaissements clients" ? 2 : 0; // crédit en valeur J+2
    const d = new Date(m.date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + shift);
    const date = d.toISOString().slice(0, 10);
    statements.push({ id: `RL-${i + 1}`, accountId: "BQ-1", ref: i % 3 === 0 ? m.ref : "", date, valueDate: date, label: m.label.toUpperCase(), debit: m.direction === "out" ? m.amount : 0, credit: m.direction === "in" ? m.amount : 0 });
  });
  statements.push({ id: "RL-F1", accountId: "BQ-1", ref: "", date: "2026-10-31", valueDate: "2026-10-31", label: "FRAIS TENUE DE COMPTE ET COMMISSIONS", debit: 412.8, credit: 0 });

  const requests: PayRequest[] = [
    { id: "PR-1", ref: "DP-2026-001", beneficiary: "Divers fournisseurs de services", invoiceRef: "AVOCAT-2026-118", invoiceDate: "2026-10-20", dueDate: "2026-11-10", amount: 18_000, plannedDate: "2026-11-09", accountId: "BQ-2", method: "Virement", category: "Charges d'exploitation", status: "En attente de validation", requestedBy: "Trésorier", note: "Honoraires juridiques" },
  ];

  const snapshots: ForecastSnapshot[] = [
    { month: "2026-06", forecastIn: 610_000, forecastOut: 560_000 },
    { month: "2026-07", forecastIn: 590_000, forecastOut: 575_000 },
    { month: "2026-08", forecastIn: 600_000, forecastOut: 540_000 },
    { month: "2026-09", forecastIn: 620_000, forecastOut: 600_000 },
    { month: "2026-10", forecastIn: 640_000, forecastOut: 580_000 },
  ];

  return {
    accounts,
    movements,
    requests,
    loans,
    statements,
    matches: [],
    commitments,
    scenarios: structuredClone(DEFAULT_SCENARIOS),
    snapshots,
    links: {},
    disputes: [],
    expectedDates: {},
    fx: [
      { currency: "EUR", rate: 10.82, date: "2026-10-31" },
      { currency: "USD", rate: 9.94, date: "2026-10-31" },
    ],
    rules: { minCash: 600_000, approvalThreshold: 50_000, upcomingDays: 10, unusualFactor: 2.5, lockedUntil: "2026-09-30" },
    permissions: structuredClone(DEFAULT_PERMISSIONS),
    role: "Responsable financier",
    audit: [],
    updatedAt: "2026-11-02T08:00:00.000Z",
  };
}
