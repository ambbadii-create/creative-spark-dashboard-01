// Trésorerie — types et calculs purs (testables).
// La trésorerie possède : comptes & caisses, mouvements, exécution des paiements,
// suivi des encaissements, rapprochement bancaire et prévisions.
// Les factures clients/fournisseurs restent la propriété des modules Ventes / Achats.
import { round2, addDays, type PaymentMethod as BasePaymentMethod } from "@/lib/purchase/model";

export { round2, addDays };

/* ------------------------------------------------------------------ Devises */
export type Currency = "MAD" | "EUR" | "USD";
export const CURRENCIES: Currency[] = ["MAD", "EUR", "USD"];
/** 1 unité de devise = `rate` MAD, au `date` indiqué. */
export type FxRate = { currency: Currency; rate: number; date: string };
export function toMad(amount: number, currency: Currency, fx: FxRate[]): number | null {
  if (currency === "MAD") return amount;
  const r = fx.find((f) => f.currency === currency);
  return r && r.rate > 0 ? round2(amount * r.rate) : null;
}

/* ------------------------------------------------------------------ Comptes */
export type AccountKind = "Banque" | "Caisse";
export type AccountStatus = "Actif" | "Bloqué" | "Clôturé";
export type Account = {
  id: string;
  kind: AccountKind;
  name: string;
  bank?: string | undefined;
  branch?: string | undefined;
  /** RIB complet (24 chiffres au Maroc) — jamais affiché sans droit dédié. */
  number?: string | undefined;
  currency: Currency;
  openingBalance: number;
  openingDate: string;
  minBalance: number;
  /** Fonds indisponibles (cautions, dépôts de garantie, nantissements). */
  restricted: number;
  status: AccountStatus;
  responsible?: string | undefined;
  location?: string | undefined;
  /** Caisse : ouverte pour la journée ? */
  cashOpen?: boolean | undefined;
};
export const maskNumber = (n?: string) => (n ? `•••• •••• ${n.replace(/\s/g, "").slice(-4)}` : "—");
export const isValidRib = (n: string) => /^\d{24}$/.test(n.replace(/\s/g, ""));

/* ------------------------------------------------------------------ Mouvements */
export type Direction = "in" | "out";
export const IN_CATEGORIES = [
  "Encaissements clients",
  "Autres encaissements d'exploitation",
  "Produits financiers",
  "Apports en capital",
  "Emprunts reçus",
  "Autres encaissements",
] as const;
export const OUT_CATEGORIES = [
  "Paiements fournisseurs",
  "Salaires",
  "Impôts et taxes",
  "Charges sociales (CNSS / AMO)",
  "Loyers",
  "Charges d'exploitation",
  "Remboursements d'emprunts",
  "Intérêts",
  "Investissements",
  "Autres décaissements",
] as const;
export const TRANSFER = "Virement interne";
export type Category = (typeof IN_CATEGORIES)[number] | (typeof OUT_CATEGORIES)[number] | typeof TRANSFER;

export type PaymentMethod = BasePaymentMethod | "Versement espèces" | "Prélèvement" | "Carte bancaire";
export const PAYMENT_METHODS: PaymentMethod[] = ["Virement", "Chèque", "Effet (LCN)", "Espèces", "Versement espèces", "Prélèvement", "Carte bancaire"];

export type MovementStatus = "Brouillon" | "Validé" | "Annulé";
export type SourceModule = "Trésorerie" | "Ventes" | "Achats" | "Financements";
export type Movement = {
  id: string;
  ref: string;
  date: string;
  valueDate: string;
  label: string;
  direction: Direction;
  category: Category;
  accountId: string;
  counterparty: string;
  /** Montant positif, dans la devise du compte. */
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  document?: string | undefined;
  status: MovementStatus;
  source: SourceModule;
  sourceId?: string | undefined;
  transferId?: string | undefined;
  cancelReason?: string | undefined;
  comptaStatus: "À transmettre" | "Transmis";
};
export const signed = (m: Pick<Movement, "direction" | "amount">) => (m.direction === "in" ? m.amount : -m.amount);
export const isTransfer = (m: Pick<Movement, "category">) => m.category === TRANSFER;

/** Solde comptable d'un compte (devise du compte) : ouverture + mouvements validés jusqu'à `upTo` inclus. */
export function accountBalance(acc: Account, movements: Movement[], upTo?: string): number {
  return round2(
    movements
      .filter((m) => m.accountId === acc.id && m.status === "Validé" && (!upTo || m.date <= upTo))
      .reduce((a, m) => a + signed(m), acc.openingBalance),
  );
}
/** Solde disponible = solde − fonds indisponibles (jamais pour un compte bloqué/clôturé). */
export function availableBalance(acc: Account, movements: Movement[], upTo?: string): number {
  if (acc.status !== "Actif") return 0;
  return round2(accountBalance(acc, movements, upTo) - acc.restricted);
}

export type Position = { bank: number; cash: number; restricted: number; available: number; missingFx: Currency[] };
/** Position consolidée en MAD. Les comptes dont le cours manque sont exclus et signalés (jamais remplacés par 0). */
export function consolidatedPosition(accounts: Account[], movements: Movement[], fx: FxRate[], upTo?: string): Position {
  const p: Position = { bank: 0, cash: 0, restricted: 0, available: 0, missingFx: [] };
  for (const a of accounts) {
    if (a.status === "Clôturé") continue;
    const bal = toMad(accountBalance(a, movements, upTo), a.currency, fx);
    const restricted = toMad(a.status === "Actif" ? a.restricted : accountBalance(a, movements, upTo), a.currency, fx);
    if (bal === null || restricted === null) {
      if (!p.missingFx.includes(a.currency)) p.missingFx.push(a.currency);
      continue;
    }
    if (a.kind === "Banque") p.bank += bal;
    else p.cash += bal;
    p.restricted += restricted;
  }
  p.bank = round2(p.bank);
  p.cash = round2(p.cash);
  p.restricted = round2(p.restricted);
  p.available = round2(p.bank + p.cash - p.restricted);
  return p;
}

/** Flux de la période en MAD, hors virements internes (évite le double comptage). */
export function periodFlows(movements: Movement[], accounts: Account[], fx: FxRate[], from: string, to: string) {
  let inflow = 0, outflow = 0;
  const cur = new Map(accounts.map((a) => [a.id, a.currency]));
  for (const m of movements) {
    if (m.status !== "Validé" || isTransfer(m) || m.date < from || m.date > to) continue;
    const v = toMad(m.amount, cur.get(m.accountId) ?? m.currency, fx);
    if (v === null) continue;
    if (m.direction === "in") inflow += v;
    else outflow += v;
  }
  return { inflow: round2(inflow), outflow: round2(outflow), net: round2(inflow - outflow) };
}

/** Doublon probable : même compte, sens, montant et contrepartie à ±3 jours, ou même référence. */
export function findDuplicate(m: Pick<Movement, "id" | "accountId" | "direction" | "amount" | "counterparty" | "date" | "ref">, list: Movement[]): Movement | undefined {
  return list.find(
    (x) =>
      x.id !== m.id &&
      x.status !== "Annulé" &&
      ((x.ref && x.ref === m.ref) ||
        (x.accountId === m.accountId && x.direction === m.direction && Math.abs(x.amount - m.amount) < 0.01 &&
          x.counterparty.trim().toLowerCase() === m.counterparty.trim().toLowerCase() && Math.abs(daysBetween(x.date, m.date)) <= 3)),
  );
}

export const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/* ------------------------------------------------------------------ Rôles & contrôle interne */
export const ROLES = ["Trésorier", "Comptable", "Contrôleur de gestion", "Responsable financier", "Directeur financier", "Administrateur"] as const;
export type Role = (typeof ROLES)[number];
export const ACTIONS = {
  saisir: "Saisir des mouvements",
  valider: "Valider des mouvements",
  demander: "Créer des demandes de paiement",
  approuver: "Approuver les paiements",
  executer: "Exécuter les paiements",
  rapprocher: "Rapprocher les relevés",
  comptes: "Gérer comptes & caisses",
  voir_rib: "Voir les RIB complets",
  parametrer: "Paramétrer (droits, seuils, clôture)",
} as const;
export type Action = keyof typeof ACTIONS;
export type Permissions = Record<Role, Action[]>;
export const DEFAULT_PERMISSIONS: Permissions = {
  Trésorier: ["saisir", "demander", "executer", "rapprocher", "comptes"],
  Comptable: ["saisir", "valider", "rapprocher"],
  "Contrôleur de gestion": [],
  "Responsable financier": ["saisir", "valider", "demander", "approuver", "rapprocher", "comptes"],
  "Directeur financier": ["valider", "approuver", "comptes", "voir_rib", "parametrer"],
  Administrateur: Object.keys(ACTIONS) as Action[],
};

export type Rules = {
  /** Seuil de trésorerie minimale consolidée (MAD). */
  minCash: number;
  /** Au-delà, l'approbation exige le Directeur financier (ou l'Administrateur). */
  approvalThreshold: number;
  /** Échéances fournisseurs à signaler (jours). */
  upcomingDays: number;
  /** Mouvement inhabituel : montant > facteur × moyenne de sa catégorie. */
  unusualFactor: number;
  /** Mouvements datés jusqu'à cette date inclus sont verrouillés. */
  lockedUntil: string;
};

/** Contrôle de l'approbation d'une demande de paiement (séparation des tâches + seuil). */
export function approvalError(role: Role, perms: Permissions, req: Pick<PayRequest, "requestedBy" | "amount">, rules: Rules): string | null {
  if (!perms[role].includes("approuver")) return "Votre rôle ne permet pas d'approuver des paiements.";
  if (req.requestedBy === role && role !== "Administrateur") return "Séparation des tâches : le demandeur ne peut pas approuver sa propre demande.";
  if (req.amount >= rules.approvalThreshold && role !== "Directeur financier" && role !== "Administrateur")
    return `Montant ≥ ${rules.approvalThreshold.toLocaleString("fr-FR")} DH : approbation du Directeur financier requise.`;
  return null;
}

/* ------------------------------------------------------------------ Décaissements */
export type PayRequestStatus = "En attente de validation" | "Programmé" | "Payé" | "Rejeté" | "Annulé";
export type PayRequest = {
  id: string;
  ref: string;
  beneficiary: string;
  /** Facture fournisseur du module Achats, si le paiement s'y rattache. */
  invoiceId?: string | undefined;
  invoiceRef: string;
  invoiceDate?: string | undefined;
  dueDate: string;
  amount: number;
  plannedDate: string;
  accountId: string;
  method: PaymentMethod;
  category: Category;
  document?: string | undefined;
  status: PayRequestStatus;
  requestedBy: Role;
  approvedBy?: Role | undefined;
  paymentRef?: string | undefined;
  paidDate?: string | undefined;
  note?: string | undefined;
};
export type PayableStatus = "À payer" | "Programmé" | "En attente de validation" | "Partiellement payé" | "Payé" | "En retard" | "Annulé";
export function payableStatus(total: number, paid: number, dueDate: string, today: string, openRequest?: PayRequest): PayableStatus {
  const rest = round2(total - paid);
  if (rest <= 0.005) return "Payé";
  if (openRequest?.status === "En attente de validation") return "En attente de validation";
  if (openRequest?.status === "Programmé") return "Programmé";
  if (dueDate < today) return "En retard";
  return paid > 0 ? "Partiellement payé" : "À payer";
}

/* ------------------------------------------------------------------ Encaissements */
export type CollectionStatus = "À encaisser" | "Partiellement encaissé" | "Encaissé" | "En retard" | "Litige";
export function collectionStatus(total: number, collectedAmt: number, dueDate: string, today: string, dispute: boolean): CollectionStatus {
  if (round2(total - collectedAmt) <= 0.005) return "Encaissé";
  if (dispute) return "Litige";
  if (dueDate < today) return "En retard";
  return collectedAmt > 0 ? "Partiellement encaissé" : "À encaisser";
}
export function validateAmount(amount: number, remaining: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Le montant doit être strictement positif.";
  if (amount > remaining + 0.005) return `Le montant dépasse le reste dû (${remaining.toLocaleString("fr-FR")} DH).`;
  return null;
}

/* ------------------------------------------------------------------ Financements */
export type LoanKind = "Crédit moyen terme" | "Crédit-bail" | "Crédit de trésorerie";
export type Loan = {
  id: string;
  lender: string;
  ref: string;
  kind: LoanKind;
  principal: number;
  /** Taux annuel nominal (%). */
  rate: number;
  start: string;
  /** Nombre d'échéances. */
  installments: number;
  frequency: "Mensuelle" | "Trimestrielle";
  accountId: string;
  status: "En cours" | "Soldé";
  demo?: boolean | undefined;
};
export type ScheduleRow = { n: number; date: string; principal: number; interest: number; total: number; remaining: number };
const addMonths = (iso: string, m: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
};
/** Tableau d'amortissement à échéances constantes. */
export function loanSchedule(l: Loan): ScheduleRow[] {
  const step = l.frequency === "Mensuelle" ? 1 : 3;
  const r = l.rate / 100 / (12 / step);
  const n = l.installments;
  const pmt = r === 0 ? l.principal / n : (l.principal * r) / (1 - Math.pow(1 + r, -n));
  let rem = l.principal;
  const rows: ScheduleRow[] = [];
  for (let i = 1; i <= n; i++) {
    const interest = round2(rem * r);
    let principal = round2(pmt - interest);
    if (i === n) principal = round2(rem);
    rem = round2(rem - principal);
    rows.push({ n: i, date: addMonths(l.start, i * step), principal, interest, total: round2(principal + interest), remaining: Math.max(0, rem) });
  }
  return rows;
}
export function loanOutstanding(l: Loan, today: string) {
  const past = loanSchedule(l).filter((r) => r.date <= today);
  return past.at(-1)?.remaining ?? l.principal;
}

/* ------------------------------------------------------------------ Rapprochement */
export type StatementLine = {
  id: string;
  accountId: string;
  ref: string;
  date: string;
  valueDate: string;
  label: string;
  debit: number;
  credit: number;
  balance?: number | undefined;
  flagged?: boolean | undefined;
};
export type Match = { id: string; statementIds: string[]; movementIds: string[]; at: string; role: Role; kind: "Automatique" | "Manuel" };
export type ReconStatus = "Rapproché" | "Non rapproché" | "Partiellement rapproché" | "À vérifier";
export const stmtAmount = (s: Pick<StatementLine, "debit" | "credit">) => round2(s.credit - s.debit);

/** Un rapprochement n'est valide que si les montants concordent ; sinon il est partiel. */
export function matchGap(stmts: StatementLine[], mvts: Movement[]) {
  return round2(stmts.reduce((a, s) => a + stmtAmount(s), 0) - mvts.reduce((a, m) => a + signed(m), 0));
}
export function statementStatus(s: StatementLine, matches: Match[], stmts: StatementLine[], mvts: Movement[]): ReconStatus {
  const m = matches.find((x) => x.statementIds.includes(s.id));
  if (!m) return s.flagged ? "À vérifier" : "Non rapproché";
  const gap = matchGap(stmts.filter((x) => m.statementIds.includes(x.id)), mvts.filter((x) => m.movementIds.includes(x.id)));
  return Math.abs(gap) < 0.01 ? "Rapproché" : "Partiellement rapproché";
}

/** Rapprochement automatique : montant identique, même compte, et référence commune ou dates à ±3 jours, correspondance unique. */
export function autoMatch(stmts: StatementLine[], mvts: Movement[], matches: Match[]): { statementId: string; movementId: string }[] {
  const usedS = new Set(matches.flatMap((m) => m.statementIds));
  const usedM = new Set(matches.flatMap((m) => m.movementIds));
  const out: { statementId: string; movementId: string }[] = [];
  for (const s of stmts) {
    if (usedS.has(s.id)) continue;
    const amt = stmtAmount(s);
    const cands = mvts.filter(
      (m) => !usedM.has(m.id) && m.status === "Validé" && m.accountId === s.accountId && Math.abs(signed(m) - amt) < 0.01 &&
        ((m.ref && (s.ref === m.ref || s.label.includes(m.ref))) || Math.abs(daysBetween(m.date, s.date)) <= 3),
    );
    const byRef = cands.filter((m) => m.ref && (s.ref === m.ref || s.label.includes(m.ref)));
    const pick = byRef.length === 1 ? byRef[0] : cands.length === 1 ? cands[0] : undefined;
    if (pick) {
      out.push({ statementId: s.id, movementId: pick.id });
      usedS.add(s.id);
      usedM.add(pick.id);
    }
  }
  return out;
}

/** Import CSV de relevé : colonnes date;date valeur;référence;libellé;débit;crédit;solde (séparateur ; ou ,). */
export function parseStatementCsv(text: string, accountId: string): { lines: Omit<StatementLine, "id">[]; errors: string[] } {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const errors: string[] = [];
  const lines: Omit<StatementLine, "id">[] = [];
  const sep = rows[0]?.includes(";") ? ";" : ",";
  const num = (v?: string) => {
    if (!v || !v.trim()) return 0;
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };
  const date = (v?: string) => {
    if (!v) return null;
    const t = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  };
  rows.forEach((r, i) => {
    const c = r.split(sep);
    if (i === 0 && !date(c[0])) return; // en-tête
    const d = date(c[0]);
    const debit = num(c[4]), credit = num(c[5]);
    if (!d || Number.isNaN(debit) || Number.isNaN(credit) || (debit === 0 && credit === 0)) {
      errors.push(`Ligne ${i + 1} ignorée : format invalide.`);
      return;
    }
    const bal = c[6] ? num(c[6]) : undefined;
    lines.push({ accountId, date: d, valueDate: date(c[1]) ?? d, ref: (c[2] ?? "").trim(), label: (c[3] ?? "").trim(), debit: Math.abs(debit), credit: Math.abs(credit), balance: bal !== undefined && !Number.isNaN(bal) ? bal : undefined });
  });
  return { lines, errors };
}
export const isDuplicateStatement = (l: Omit<StatementLine, "id">, existing: StatementLine[]) =>
  existing.some((e) => e.accountId === l.accountId && e.date === l.date && e.debit === l.debit && e.credit === l.credit && e.ref === l.ref && e.label === l.label);

/* ------------------------------------------------------------------ Prévisions */
export type Commitment = { id: string; label: string; category: Category; amount: number; dayOfMonth: number; active: boolean };
export type Scenario = { collectionDelay: number; paymentDelay: number; salesPct: number; opexPct: number; extraNeed: number };
export type ScenarioName = "Optimiste" | "Central" | "Pessimiste";
export const DEFAULT_SCENARIOS: Record<ScenarioName, Scenario> = {
  Optimiste: { collectionDelay: 0, paymentDelay: 0, salesPct: 5, opexPct: -3, extraNeed: 0 },
  Central: { collectionDelay: 10, paymentDelay: 0, salesPct: 0, opexPct: 0, extraNeed: 0 },
  Pessimiste: { collectionDelay: 25, paymentDelay: -5, salesPct: -10, opexPct: 5, extraNeed: 150_000 },
};
export type Flow = { date: string; amount: number; bucket: ForecastBucket; origin: "Données" | "Hypothèse" };
export type ForecastBucket = "collections" | "otherIn" | "supplier" | "payroll" | "taxes" | "opex" | "debt" | "otherOut";
export const BUCKET_LABEL: Record<ForecastBucket, string> = {
  collections: "Encaissements clients attendus",
  otherIn: "Autres encaissements attendus",
  supplier: "Paiements fournisseurs prévus",
  payroll: "Salaires",
  taxes: "Impôts, taxes et charges sociales",
  opex: "Charges d'exploitation",
  debt: "Remboursements de dettes",
  otherOut: "Autres décaissements",
};
export const IN_BUCKETS: ForecastBucket[] = ["collections", "otherIn"];
export const OUT_BUCKETS: ForecastBucket[] = ["supplier", "payroll", "taxes", "opex", "debt", "otherOut"];
export function bucketOf(c: Category): ForecastBucket {
  if (c === "Salaires") return "payroll";
  if (c === "Impôts et taxes" || c === "Charges sociales (CNSS / AMO)") return "taxes";
  if (c === "Loyers" || c === "Charges d'exploitation") return "opex";
  if (c === "Remboursements d'emprunts" || c === "Intérêts") return "debt";
  if (c === "Paiements fournisseurs") return "supplier";
  if (c === "Encaissements clients") return "collections";
  return (IN_CATEGORIES as readonly string[]).includes(c) ? "otherIn" : "otherOut";
}
/** Occurrences mensuelles d'un engagement récurrent entre deux dates incluses. */
export function commitmentFlows(c: Commitment, from: string, to: string): string[] {
  if (!c.active) return [];
  const out: string[] = [];
  const d = new Date(from.slice(0, 7) + "-01T00:00:00Z");
  while (d.toISOString().slice(0, 10) <= to) {
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), Math.min(c.dayOfMonth, last))).toISOString().slice(0, 10);
    if (iso >= from && iso <= to) out.push(iso);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/** Applique un scénario aux flux attendus (décalage des dates, variation des montants). */
export function applyScenario(flows: Flow[], s: Scenario, today: string, horizonEnd: string): Flow[] {
  const out: Flow[] = flows.map((f) => {
    let date = f.date < today ? today : f.date;
    let amount = f.amount;
    if (f.bucket === "collections") {
      date = addDays(date, s.collectionDelay);
      amount = round2(amount * (1 + s.salesPct / 100));
    } else if (f.bucket === "supplier") date = addDays(date, s.paymentDelay);
    else if (f.bucket === "opex" || f.bucket === "payroll") amount = round2(amount * (1 + s.opexPct / 100));
    if (date < today) date = today;
    return { ...f, date, amount };
  });
  if (s.extraNeed > 0) out.push({ date: addDays(today, 15) <= horizonEnd ? addDays(today, 15) : horizonEnd, amount: s.extraNeed, bucket: "otherOut", origin: "Hypothèse" });
  return out;
}

export type Granularity = "Jour" | "Semaine" | "Mois";
export type ForecastRow = { label: string; from: string; to: string; opening: number; inflow: number; outflow: number; net: number; closing: number } & Record<ForecastBucket, number>;
/** Solde de clôture = ouverture + entrées − sorties, période par période. */
export function buildForecast(opening: number, flows: Flow[], today: string, horizonDays: number, gran: Granularity): ForecastRow[] {
  const end = addDays(today, horizonDays - 1);
  const rows: ForecastRow[] = [];
  let cur = today, bal = opening;
  while (cur <= end) {
    let to: string;
    if (gran === "Jour") to = cur;
    else if (gran === "Semaine") to = addDays(cur, 6);
    else {
      const d = new Date(cur + "T00:00:00Z");
      to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    }
    if (to > end) to = end;
    const row = { label: labelOf(cur, to, gran), from: cur, to, opening: round2(bal), collections: 0, otherIn: 0, supplier: 0, payroll: 0, taxes: 0, opex: 0, debt: 0, otherOut: 0, inflow: 0, outflow: 0, net: 0, closing: 0 } as ForecastRow;
    for (const f of flows) if (f.date >= cur && f.date <= to) row[f.bucket] = round2(row[f.bucket] + f.amount);
    row.inflow = round2(IN_BUCKETS.reduce((a, b) => a + row[b], 0));
    row.outflow = round2(OUT_BUCKETS.reduce((a, b) => a + row[b], 0));
    row.net = round2(row.inflow - row.outflow);
    row.closing = round2(row.opening + row.net);
    bal = row.closing;
    rows.push(row);
    cur = addDays(to, 1);
  }
  return rows;
}
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function labelOf(from: string, to: string, g: Granularity) {
  const dm = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
  if (g === "Jour") return dm(from);
  if (g === "Semaine") return `${dm(from)} – ${dm(to)}`;
  return `${MONTHS[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`;
}

/** Précision de prévision = 1 − |réel − prévu| / |réel| (null si réel nul). */
export function forecastAccuracy(forecast: number, actual: number): number | null {
  if (actual === 0) return null;
  return round2(Math.max(0, 1 - Math.abs(actual - forecast) / Math.abs(actual)) * 100);
}

/* ------------------------------------------------------------------ Analyse */
export type FlowNature = "Exploitation" | "Investissement" | "Financement";
export function natureOf(c: Category): FlowNature | null {
  if (c === TRANSFER) return null;
  if (c === "Investissements") return "Investissement";
  if (c === "Apports en capital" || c === "Emprunts reçus" || c === "Remboursements d'emprunts" || c === "Intérêts") return "Financement";
  return "Exploitation";
}

export type AuditEvent = { id: string; at: string; role: Role; action: string; detail: string };
