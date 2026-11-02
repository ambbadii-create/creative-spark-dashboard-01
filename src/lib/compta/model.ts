// Comptabilité & Analyse financière — référentiel CGNC, écritures et calculs financiers (purs, testables).
// Tous les états sont dérivés des écritures VALIDÉES : une seule source de vérité.

export const round2 = (v: number) => Math.round(v * 100) / 100;
const EPS = 0.005;

/* ------------------------------------------------------------------ Plan comptable */

export type AccountNature = "Bilan" | "Gestion";
export type AccountType = "Actif" | "Passif" | "Charge" | "Produit";
export type Account = { number: string; label: string; parent: string; status: "Actif" | "Inactif" };

export const CLASSES: Record<string, string> = {
  "1": "Comptes de financement permanent",
  "2": "Comptes d'actif immobilisé",
  "3": "Comptes d'actif circulant (hors trésorerie)",
  "4": "Comptes de passif circulant (hors trésorerie)",
  "5": "Comptes de trésorerie",
  "6": "Comptes de charges",
  "7": "Comptes de produits",
};

const a = (number: string, label: string, parent: string): Account => ({ number, label, parent, status: "Actif" });
export const CHART: Account[] = [
  a("1111", "Capital social", "111"),
  a("1140", "Réserve légale", "114"),
  a("1161", "Report à nouveau (solde créditeur)", "116"),
  a("1191", "Résultat net de l'exercice (bénéficiaire)", "119"),
  a("1481", "Emprunts auprès des établissements de crédit", "148"),
  a("2321", "Bâtiments", "232"),
  a("2332", "Matériel et outillage", "233"),
  a("2340", "Matériel de transport", "234"),
  a("2355", "Matériel informatique", "235"),
  a("2832", "Amortissements des constructions et matériel", "283"),
  a("2834", "Amortissements du matériel de transport", "283"),
  a("3111", "Marchandises", "311"),
  a("3121", "Matières et fournitures consommables", "312"),
  a("3421", "Clients", "342"),
  a("3455", "État — TVA récupérable", "345"),
  a("4411", "Fournisseurs", "441"),
  a("4432", "Rémunérations dues au personnel", "443"),
  a("4441", "Caisse nationale de sécurité sociale", "444"),
  a("4453", "État — impôts sur les résultats", "445"),
  a("4455", "État — TVA facturée", "445"),
  a("5141", "Banques (soldes débiteurs)", "514"),
  a("5161", "Caisses", "516"),
  a("5520", "Crédits de trésorerie", "552"),
  a("6111", "Achats de marchandises", "611"),
  a("6114", "Variation des stocks de marchandises", "611"),
  a("6121", "Achats de matières et fournitures", "612"),
  a("6131", "Locations et charges locatives", "613"),
  a("6134", "Primes d'assurances", "613"),
  a("6142", "Transports", "614"),
  a("6144", "Publicité, publications et relations publiques", "614"),
  a("6161", "Impôts et taxes", "616"),
  a("6171", "Rémunérations du personnel", "617"),
  a("6174", "Charges sociales", "617"),
  a("6193", "Dotations d'exploitation aux amortissements des immobilisations corporelles", "619"),
  a("6311", "Intérêts des emprunts et dettes", "631"),
  a("6581", "Pénalités et amendes fiscales ou pénales", "658"),
  a("6701", "Impôts sur les résultats", "670"),
  a("7111", "Ventes de marchandises au Maroc", "711"),
  a("7121", "Ventes de biens produits au Maroc", "712"),
  a("7381", "Intérêts et produits assimilés", "738"),
  a("7581", "Autres produits non courants", "758"),
];

export const accountClass = (n: string) => n.charAt(0);
export const accountNature = (n: string): AccountNature => (Number(accountClass(n)) <= 5 ? "Bilan" : "Gestion");
export function accountType(n: string): AccountType {
  const c = accountClass(n);
  if (c === "6") return "Charge";
  if (c === "7") return "Produit";
  if (c === "1" || c === "4" || n.startsWith("55") || n.startsWith("28")) return "Passif";
  return "Actif";
}
export const accountLabel = (n: string, chart: Account[] = CHART) => chart.find((x) => x.number === n)?.label ?? "Compte non référencé";
export const isValidAccountNumber = (n: string) => /^[1-7]\d{3,7}$/.test(n);

/* ------------------------------------------------------------------ Journaux & écritures */

export const JOURNALS = [
  { code: "HA", label: "Journal des achats" },
  { code: "VT", label: "Journal des ventes" },
  { code: "BQ", label: "Journal de banque" },
  { code: "CA", label: "Journal de caisse" },
  { code: "OD", label: "Journal des opérations diverses" },
  { code: "AN", label: "Journal d'ouverture (à-nouveaux)" },
  { code: "CL", label: "Journal de clôture" },
] as const;
export type JournalCode = (typeof JOURNALS)[number]["code"];
export const journalLabel = (c: string) => JOURNALS.find((j) => j.code === c)?.label ?? c;

export type EntryLine = { id: string; account: string; label: string; tiers?: string | undefined; debit: number; credit: number; letter?: string | undefined };
export type EntryStatus = "Brouillon" | "Validée";
export type Entry = {
  id: string;
  piece: string;
  date: string; // ISO
  journal: JournalCode;
  label: string;
  ref: string; // référence documentaire ("" = pièce justificative manquante)
  status: EntryStatus;
  lines: EntryLine[];
};

export const entryTotals = (e: Pick<Entry, "lines">) => ({
  debit: round2(e.lines.reduce((s, l) => s + l.debit, 0)),
  credit: round2(e.lines.reduce((s, l) => s + l.credit, 0)),
});
export const isBalanced = (e: Pick<Entry, "lines">) => {
  const t = entryTotals(e);
  return Math.abs(t.debit - t.credit) < EPS && t.debit > 0;
};

/** Contrôles bloquants avant validation d'une écriture. Retourne la liste des anomalies (vide = validable). */
export function validateEntry(e: Pick<Entry, "lines" | "date" | "journal">, chart: Account[] = CHART): string[] {
  const errs: string[] = [];
  if (!e.date) errs.push("Date obligatoire.");
  if (e.lines.length < 2) errs.push("Une écriture comporte au moins deux lignes.");
  e.lines.forEach((l, i) => {
    if (!chart.some((c) => c.number === l.account)) errs.push(`Ligne ${i + 1} : compte ${l.account || "—"} absent du plan comptable.`);
    if (l.debit < 0 || l.credit < 0) errs.push(`Ligne ${i + 1} : montants négatifs interdits.`);
    if (l.debit > 0 && l.credit > 0) errs.push(`Ligne ${i + 1} : une ligne est soit au débit, soit au crédit.`);
    if (l.debit === 0 && l.credit === 0) errs.push(`Ligne ${i + 1} : montant nul.`);
  });
  const t = entryTotals(e);
  if (Math.abs(t.debit - t.credit) >= EPS) errs.push(`Écriture déséquilibrée : débit ${t.debit} ≠ crédit ${t.credit}.`);
  return errs;
}

/* ------------------------------------------------------------------ Périodes */

export const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
export const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const periodKey = (date: string) => date.slice(0, 7); // AAAA-MM
export const yearOf = (date: string) => Number(date.slice(0, 4));
export const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;

export type Scope = { year: number; from?: number; to: number; onlyOpening?: boolean };
/** Écritures validées d'un exercice, du mois `from` (défaut 0) au mois `to` inclus. */
export function inScope(e: Entry, s: Scope) {
  if (e.status !== "Validée" || yearOf(e.date) !== s.year) return false;
  if (s.onlyOpening) return e.journal === "AN";
  const m = monthOf(e.date);
  return m >= (s.from ?? 0) && m <= s.to;
}

/* ------------------------------------------------------------------ Balances */

export type Bal = Map<string, { debit: number; credit: number }>;
export function balances(entries: Entry[], s: Scope): Bal {
  const map: Bal = new Map();
  for (const e of entries) {
    if (!inScope(e, s)) continue;
    for (const l of e.lines) {
      const cur = map.get(l.account) ?? { debit: 0, credit: 0 };
      cur.debit += l.debit;
      cur.credit += l.credit;
      map.set(l.account, cur);
    }
  }
  return map;
}
/** Solde (débit − crédit) des comptes commençant par l'un des préfixes. */
export function net(bal: Bal, ...prefixes: string[]) {
  let s = 0;
  for (const [acc, v] of bal) if (prefixes.some((p) => acc.startsWith(p))) s += v.debit - v.credit;
  return round2(s);
}
/** Mouvements débit / crédit des comptes préfixés, hors à-nouveaux si `entries` filtré. */
export function movements(entries: Entry[], s: Scope, prefix: string, excludeOpening = true) {
  let debit = 0, credit = 0;
  for (const e of entries) {
    if (!inScope(e, s) || (excludeOpening && e.journal === "AN")) continue;
    for (const l of e.lines) if (l.account.startsWith(prefix)) { debit += l.debit; credit += l.credit; }
  }
  return { debit: round2(debit), credit: round2(credit) };
}

export type TrialRow = { account: string; label: string; openD: number; openC: number; movD: number; movC: number; closeD: number; closeC: number };
/** Balance générale : solde initial (à-nouveaux + mouvements antérieurs à `from`), mouvements de la période, solde final. */
export function trialBalance(entries: Entry[], s: Scope, chart: Account[] = CHART): TrialRow[] {
  const from = s.from ?? 0;
  const open = new Map<string, number>();
  const mov = new Map<string, { d: number; c: number }>();
  for (const e of entries) {
    if (e.status !== "Validée" || yearOf(e.date) !== s.year) continue;
    const m = monthOf(e.date);
    if (m > s.to) continue;
    const isOpen = e.journal === "AN" || m < from;
    for (const l of e.lines) {
      if (isOpen) open.set(l.account, (open.get(l.account) ?? 0) + l.debit - l.credit);
      else {
        const c = mov.get(l.account) ?? { d: 0, c: 0 };
        c.d += l.debit; c.c += l.credit;
        mov.set(l.account, c);
      }
    }
  }
  const accounts = [...new Set([...open.keys(), ...mov.keys()])].sort();
  return accounts.map((acc) => {
    const o = round2(open.get(acc) ?? 0);
    const m = mov.get(acc) ?? { d: 0, c: 0 };
    const close = round2(o + m.d - m.c);
    return {
      account: acc, label: accountLabel(acc, chart),
      openD: o > 0 ? o : 0, openC: o < 0 ? -o : 0,
      movD: round2(m.d), movC: round2(m.c),
      closeD: close > 0 ? close : 0, closeC: close < 0 ? -close : 0,
    };
  });
}

export type LedgerLine = { entryId: string; piece: string; date: string; journal: string; label: string; tiers?: string | undefined; debit: number; credit: number; balance: number; letter?: string | undefined };
/** Grand livre d'un compte : solde d'ouverture puis mouvements chronologiques avec solde progressif. */
export function ledger(entries: Entry[], account: string, s: Scope) {
  const from = s.from ?? 0;
  let opening = 0;
  const rows: Omit<LedgerLine, "balance">[] = [];
  for (const e of entries) {
    if (e.status !== "Validée" || yearOf(e.date) !== s.year || monthOf(e.date) > s.to) continue;
    const isOpen = e.journal === "AN" || monthOf(e.date) < from;
    for (const l of e.lines) {
      if (l.account !== account) continue;
      if (isOpen) opening += l.debit - l.credit;
      else rows.push({ entryId: e.id, piece: e.piece, date: e.date, journal: e.journal, label: l.label || e.label, tiers: l.tiers, debit: l.debit, credit: l.credit, letter: l.letter });
    }
  }
  rows.sort((x, y) => x.date.localeCompare(y.date) || x.piece.localeCompare(y.piece));
  let run = opening;
  const lines: LedgerLine[] = rows.map((r) => ({ ...r, balance: round2((run += r.debit - r.credit)) }));
  return { opening: round2(opening), lines, closing: round2(run) };
}

/* ------------------------------------------------------------------ CPC & SIG (CGNC) */

export type Cpc = {
  produitsExploitation: number; chargesExploitation: number; resultatExploitation: number;
  produitsFinanciers: number; chargesFinancieres: number; resultatFinancier: number;
  resultatCourant: number; produitsNonCourants: number; chargesNonCourantes: number; resultatNonCourant: number;
  resultatAvantImpots: number; impots: number; resultatNet: number;
};
export function cpc(bal: Bal): Cpc {
  const pe = -net(bal, "71"), ce = net(bal, "61");
  const pf = -net(bal, "73"), cf = net(bal, "63");
  const pnc = -net(bal, "75"), cnc = net(bal, "65");
  const is = net(bal, "67");
  const re = round2(pe - ce), rf = round2(pf - cf), rc = round2(re + rf), rnc = round2(pnc - cnc), rai = round2(rc + rnc);
  return {
    produitsExploitation: pe, chargesExploitation: ce, resultatExploitation: re,
    produitsFinanciers: pf, chargesFinancieres: cf, resultatFinancier: rf, resultatCourant: rc,
    produitsNonCourants: pnc, chargesNonCourantes: cnc, resultatNonCourant: rnc,
    resultatAvantImpots: rai, impots: is, resultatNet: round2(rai - is),
  };
}

export type SigLine = { key: string; label: string; value: number; formula: string; total?: boolean };
/** Tableau de formation des résultats (TFR) — ESG du CGNC. */
export function sig(bal: Bal): SigLine[] {
  const v = (p: string) => -net(bal, p); // produit (solde créditeur)
  const c = (p: string) => net(bal, p); // charge (solde débiteur)
  const ventesM = v("711"), achatsRev = c("611");
  const margeBrute = round2(ventesM - achatsRev);
  const production = round2(v("712") + v("713") + v("714"));
  const consommation = round2(c("612") + c("613") + c("614"));
  const va = round2(margeBrute + production - consommation);
  const subv = v("716"), impots = c("616"), perso = c("617");
  const ebe = round2(va + subv - impots - perso);
  const autresP = v("718"), autresC = c("618"), reprises = v("719"), dotations = c("619");
  const rex = round2(ebe + autresP - autresC + reprises - dotations);
  const rfi = round2(v("73") - c("63"));
  const rco = round2(rex + rfi);
  const rnc = round2(v("75") - c("65"));
  const is = c("67");
  const rn = round2(rco + rnc - is);
  return [
    { key: "ventesM", label: "Ventes de marchandises (en l'état)", value: ventesM, formula: "Compte 711" },
    { key: "achatsRev", label: "− Achats revendus de marchandises", value: achatsRev, formula: "Comptes 611 (achats ± variation de stocks)" },
    { key: "margeBrute", label: "I. Marge brute sur ventes en l'état", value: margeBrute, formula: "711 − 611", total: true },
    { key: "production", label: "II. Production de l'exercice", value: production, formula: "712 + 713 + 714" },
    { key: "consommation", label: "III. Consommation de l'exercice", value: consommation, formula: "612 + 613 + 614" },
    { key: "va", label: "IV. Valeur ajoutée", value: va, formula: "I + II − III", total: true },
    { key: "subv", label: "+ Subventions d'exploitation", value: subv, formula: "Compte 716" },
    { key: "impots", label: "− Impôts et taxes", value: impots, formula: "Compte 616" },
    { key: "perso", label: "− Charges de personnel", value: perso, formula: "Compte 617" },
    { key: "ebe", label: "V. Excédent brut d'exploitation (EBE)", value: ebe, formula: "IV + 716 − 616 − 617", total: true },
    { key: "autresP", label: "+ Autres produits d'exploitation", value: autresP, formula: "Compte 718" },
    { key: "autresC", label: "− Autres charges d'exploitation", value: autresC, formula: "Compte 618" },
    { key: "reprises", label: "+ Reprises d'exploitation, transferts de charges", value: reprises, formula: "Compte 719" },
    { key: "dotations", label: "− Dotations d'exploitation", value: dotations, formula: "Compte 619" },
    { key: "rex", label: "VI. Résultat d'exploitation", value: rex, formula: "V + 718 − 618 + 719 − 619", total: true },
    { key: "rfi", label: "VII. Résultat financier", value: rfi, formula: "73 − 63", total: true },
    { key: "rco", label: "VIII. Résultat courant", value: rco, formula: "VI + VII", total: true },
    { key: "rnc", label: "IX. Résultat non courant", value: rnc, formula: "75 − 65", total: true },
    { key: "is", label: "− Impôts sur les résultats", value: is, formula: "Compte 67" },
    { key: "rn", label: "X. Résultat net de l'exercice", value: rn, formula: "VIII + IX − 67", total: true },
  ];
}
export const sigValue = (lines: SigLine[], key: string) => lines.find((l) => l.key === key)?.value ?? 0;

export type CafLine = { label: string; value: number; sign: 1 | -1; formula: string };
/** CAF — méthode additive du CGNC (tableau de calcul de la capacité d'autofinancement). */
export function caf(bal: Bal) {
  const rn = cpc(bal).resultatNet;
  const items: CafLine[] = [
    { label: "Résultat net de l'exercice", value: rn, sign: 1, formula: "CPC" },
    { label: "Dotations d'exploitation (hors actif circulant)", value: net(bal, "619"), sign: 1, formula: "619" },
    { label: "Dotations financières", value: net(bal, "639"), sign: 1, formula: "639" },
    { label: "Dotations non courantes", value: net(bal, "659"), sign: 1, formula: "659" },
    { label: "Reprises d'exploitation", value: -net(bal, "719"), sign: -1, formula: "719" },
    { label: "Reprises financières", value: -net(bal, "739"), sign: -1, formula: "739" },
    { label: "Reprises non courantes", value: -net(bal, "759"), sign: -1, formula: "759" },
    { label: "Produits des cessions d'immobilisations", value: -net(bal, "751"), sign: -1, formula: "751" },
    { label: "Valeurs nettes d'amortissements des immobilisations cédées", value: net(bal, "651"), sign: 1, formula: "651" },
  ];
  const total = round2(items.reduce((s, i) => s + i.sign * i.value, 0));
  return { items, caf: total };
}

/* ------------------------------------------------------------------ Bilan & équilibre financier */

export type Bilan = {
  actifImmobilise: number; immoBrut: number; amortissements: number;
  stocks: number; creancesClients: number; autresCreances: number; actifCirculant: number; tresorerieActif: number; totalActif: number;
  capitauxPropres: number; resultatEnCours: number; dettesFinancement: number; financementPermanent: number;
  fournisseurs: number; autresDettes: number; passifCirculant: number; tresoreriePassif: number; totalPassif: number;
  unclassified: string[];
};
export function bilan(bal: Bal): Bilan {
  const resultatEnCours = round2(-net(bal, "7") - net(bal, "6"));
  const immoBrut = round2(net(bal, "2") - net(bal, "28"));
  const amortissements = -net(bal, "28");
  const actifImmobilise = net(bal, "2");
  const stocks = net(bal, "31"), creancesClients = net(bal, "342");
  const actifCirculant = net(bal, "3");
  const tresorerieActif = net(bal, "51");
  const capitauxPropres = round2(-net(bal, "11") + resultatEnCours);
  const dettesFinancement = -net(bal, "14");
  const financementPermanent = round2(-net(bal, "1") + resultatEnCours);
  const fournisseurs = -net(bal, "441");
  const passifCirculant = -net(bal, "4");
  const tresoreriePassif = -net(bal, "55");
  const unclassified = [...bal.keys()].filter((k) => !/^[1-7]/.test(k) || (k.startsWith("5") && !k.startsWith("51") && !k.startsWith("55")));
  return {
    actifImmobilise, immoBrut, amortissements, stocks, creancesClients, autresCreances: round2(actifCirculant - stocks - creancesClients), actifCirculant, tresorerieActif,
    totalActif: round2(actifImmobilise + actifCirculant + tresorerieActif),
    capitauxPropres, resultatEnCours, dettesFinancement, financementPermanent,
    fournisseurs, autresDettes: round2(passifCirculant - fournisseurs), passifCirculant, tresoreriePassif,
    totalPassif: round2(financementPermanent + passifCirculant + tresoreriePassif),
    unclassified,
  };
}

/** FRNG, BFR et trésorerie nette (null si la classification des comptes est incomplète). */
export function equilibre(b: Bilan) {
  if (b.unclassified.length) return null;
  const frng = round2(b.financementPermanent - b.actifImmobilise);
  const bfr = round2(b.actifCirculant - b.passifCirculant);
  const tn = round2(b.tresorerieActif - b.tresoreriePassif);
  return { frng, bfr, tn, coherent: Math.abs(round2(frng - bfr) - tn) < 0.01 };
}

/* ------------------------------------------------------------------ Tableau de financement */

export function tableauFinancement(entries: Entry[], s: Scope) {
  const bal = balances(entries, s);
  const open = bilan(balances(entries, { ...s, onlyOpening: true }));
  const close = bilan(bal);
  const immo = movements(entries, s, "2");
  const amortDebit = movements(entries, s, "28"); // sorties d'amortissements (cessions)
  const dettes = movements(entries, s, "14");
  const capital = movements(entries, s, "111");
  const dividendes = movements(entries, s, "1191").debit - movements(entries, s, "1140").credit - movements(entries, s, "1161").credit;
  const cafV = caf(bal).caf;
  const ressources = [
    { label: "Autofinancement (CAF)", value: cafV },
    { label: "Augmentation des capitaux propres", value: round2(capital.credit - capital.debit) },
    { label: "Augmentation des dettes de financement", value: dettes.credit },
  ];
  const emplois = [
    { label: "Acquisitions d'immobilisations", value: round2(immo.debit - amortDebit.debit) },
    { label: "Remboursement des dettes de financement", value: dettes.debit },
    { label: "Distributions de bénéfices", value: round2(Math.max(0, dividendes)) },
  ];
  const totR = round2(ressources.reduce((x, r) => x + r.value, 0));
  const totE = round2(emplois.reduce((x, r) => x + r.value, 0));
  const eqO = equilibre(open), eqC = equilibre(close);
  const deltaFr = eqO && eqC ? round2(eqC.frng - eqO.frng) : null;
  return { ressources, emplois, totalRessources: totR, totalEmplois: totE, variationFr: round2(totR - totE), deltaFrBilan: deltaFr };
}

/* ------------------------------------------------------------------ Ratios */

export const safeDiv = (n: number, d: number): number | null => (Math.abs(d) < EPS ? null : n / d);
export const variationPct = (cur: number | null, prev: number | null) =>
  cur === null || prev === null || Math.abs(prev) < EPS ? null : ((cur - prev) / Math.abs(prev)) * 100;

export type RatioFamily = "Rentabilité" | "Liquidité" | "Solvabilité" | "Gestion et efficacité";
export type RatioDef = { id: string; family: RatioFamily; name: string; formula: string; unit: "%" | "x" | "jours"; higherIsBetter: boolean; benchmark: number | null; interpretation: string };
export const RATIOS: RatioDef[] = [
  { id: "roe", family: "Rentabilité", name: "ROE — rentabilité financière", formula: "Résultat net / Capitaux propres", unit: "%", higherIsBetter: true, benchmark: 10, interpretation: "Rémunération des capitaux investis par les associés." },
  { id: "roa", family: "Rentabilité", name: "ROA — rentabilité économique", formula: "Résultat net / Total actif", unit: "%", higherIsBetter: true, benchmark: 5, interpretation: "Capacité de l'actif total à générer du résultat." },
  { id: "mEbe", family: "Rentabilité", name: "Marge d'EBE (proxy EBITDA)", formula: "EBE / Chiffre d'affaires", unit: "%", higherIsBetter: true, benchmark: null, interpretation: "Performance opérationnelle avant amortissements et politique financière." },
  { id: "mOp", family: "Rentabilité", name: "Marge opérationnelle", formula: "Résultat d'exploitation / Chiffre d'affaires", unit: "%", higherIsBetter: true, benchmark: null, interpretation: "Part du CA conservée après toutes les charges d'exploitation." },
  { id: "mNet", family: "Rentabilité", name: "Marge nette", formula: "Résultat net / Chiffre d'affaires", unit: "%", higherIsBetter: true, benchmark: null, interpretation: "Part du CA convertie en résultat après impôt." },
  { id: "lg", family: "Liquidité", name: "Liquidité générale", formula: "(Actif circulant + Trésorerie-actif) / (Passif circulant + Trésorerie-passif)", unit: "x", higherIsBetter: true, benchmark: 1.2, interpretation: "Couverture des dettes à court terme par les actifs à court terme." },
  { id: "lr", family: "Liquidité", name: "Liquidité réduite", formula: "(Actif circulant − Stocks + Trésorerie-actif) / Dettes à court terme", unit: "x", higherIsBetter: true, benchmark: 1, interpretation: "Même couverture sans compter sur l'écoulement des stocks." },
  { id: "li", family: "Liquidité", name: "Liquidité immédiate", formula: "Trésorerie-actif / Dettes à court terme", unit: "x", higherIsBetter: true, benchmark: null, interpretation: "Capacité à honorer immédiatement les dettes courantes." },
  { id: "af", family: "Solvabilité", name: "Autonomie financière", formula: "Capitaux propres / Financement permanent", unit: "%", higherIsBetter: true, benchmark: 50, interpretation: "Indépendance vis-à-vis des prêteurs." },
  { id: "ef", family: "Solvabilité", name: "Endettement financier", formula: "(Dettes de financement + Trésorerie-passif) / Total passif", unit: "%", higherIsBetter: false, benchmark: null, interpretation: "Poids des financements bancaires dans le passif." },
  { id: "de", family: "Solvabilité", name: "Debt-to-equity (gearing)", formula: "(Dettes de financement + Trésorerie-passif − Trésorerie-actif) / Capitaux propres", unit: "x", higherIsBetter: false, benchmark: 1, interpretation: "Endettement net rapporté aux fonds propres." },
  { id: "dso", family: "Gestion et efficacité", name: "Délai moyen de règlement clients", formula: "Créances clients TTC / CA TTC × nombre de jours", unit: "jours", higherIsBetter: false, benchmark: 60, interpretation: "Délai moyen d'encaissement (plafond légal usuel : 60 jours, à confirmer selon la loi 69-21)." },
  { id: "dpo", family: "Gestion et efficacité", name: "Délai moyen de règlement fournisseurs", formula: "Dettes fournisseurs TTC / Achats TTC × nombre de jours", unit: "jours", higherIsBetter: true, benchmark: 60, interpretation: "Délai moyen de paiement des fournisseurs." },
  { id: "rotS", family: "Gestion et efficacité", name: "Rotation des stocks", formula: "Achats consommés / Stock moyen", unit: "x", higherIsBetter: true, benchmark: null, interpretation: "Nombre de renouvellements du stock sur la période." },
  { id: "rotA", family: "Gestion et efficacité", name: "Rotation des actifs", formula: "Chiffre d'affaires / Total actif", unit: "x", higherIsBetter: true, benchmark: null, interpretation: "Chiffre d'affaires généré par dirham d'actif." },
];

export type RatioInputs = { bal: Bal; openBal: Bal; days: number; vatRate: number };
export function computeRatios({ bal, openBal, days, vatRate }: RatioInputs): Record<string, number | null> {
  const b = bilan(bal), bo = bilan(openBal), s = sig(bal), r = cpc(bal);
  const ca = chiffreAffaires(bal);
  const caTtc = ca * (1 + vatRate / 100);
  const achatsTtc = (net(bal, "6111") + net(bal, "6121") + net(bal, "613") + net(bal, "614")) * (1 + vatRate / 100);
  const dct = b.passifCirculant + b.tresoreriePassif;
  const pct = (x: number | null) => (x === null ? null : x * 100);
  const stockMoyen = (b.stocks + bo.stocks) / 2;
  return {
    roe: pct(safeDiv(r.resultatNet, b.capitauxPropres)),
    roa: pct(safeDiv(r.resultatNet, b.totalActif)),
    mEbe: pct(safeDiv(sigValue(s, "ebe"), ca)),
    mOp: pct(safeDiv(r.resultatExploitation, ca)),
    mNet: pct(safeDiv(r.resultatNet, ca)),
    lg: safeDiv(b.actifCirculant + b.tresorerieActif, dct),
    lr: safeDiv(b.actifCirculant - b.stocks + b.tresorerieActif, dct),
    li: safeDiv(b.tresorerieActif, dct),
    af: pct(safeDiv(b.capitauxPropres, b.financementPermanent)),
    ef: pct(safeDiv(b.dettesFinancement + b.tresoreriePassif, b.totalPassif)),
    de: safeDiv(b.dettesFinancement + b.tresoreriePassif - b.tresorerieActif, b.capitauxPropres),
    dso: (() => { const x = safeDiv(b.creancesClients, caTtc); return x === null ? null : x * days; })(),
    dpo: (() => { const x = safeDiv(b.fournisseurs, achatsTtc); return x === null ? null : x * days; })(),
    rotS: safeDiv(net(bal, "611") + net(bal, "612"), stockMoyen),
    rotA: safeDiv(ca, b.totalActif),
  };
}
export const chiffreAffaires = (bal: Bal) => round2(-net(bal, "711") - net(bal, "712"));
export const periodDays = (toMonth: number, fromMonth = 0) => Math.round(((toMonth - fromMonth + 1) * 365) / 12);

/* ------------------------------------------------------------------ Lettrage */

export function canLetter(lines: Pick<EntryLine, "debit" | "credit" | "letter">[]) {
  if (lines.length < 2) return "Sélectionnez au moins deux lignes.";
  if (lines.some((l) => l.letter)) return "Une ou plusieurs lignes sont déjà lettrées.";
  const d = round2(lines.reduce((s, l) => s + l.debit, 0)), c = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(d - c) >= EPS) return `Lettrage impossible : débit ${d} ≠ crédit ${c}.`;
  return null;
}
/** Code de lettrage suivant : A…Z, AA…ZZ. */
export function nextLetter(used: string[]) {
  const set = new Set(used);
  for (let i = 0; ; i++) {
    const code = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
    if (!set.has(code)) return code;
  }
}

/* ------------------------------------------------------------------ Antériorité (aging) */

export const AGING_BUCKETS = ["Non échues", "1–30 jours", "31–60 jours", "61–90 jours", "Plus de 90 jours"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export function daysLate(dueDate: string, today: string) {
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000));
}
export function agingBucket(days: number): AgingBucket {
  if (days <= 0) return "Non échues";
  if (days <= 30) return "1–30 jours";
  if (days <= 60) return "31–60 jours";
  if (days <= 90) return "61–90 jours";
  return "Plus de 90 jours";
}

/* ------------------------------------------------------------------ Format */

export const fmtMad = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "Données non disponibles" : `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)} MAD`;
export const fmtNum = (v: number, digits = 2) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
export const fmtK = (v: number | null) => (v === null ? "n.d." : `${(v / 1e6).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M MAD`);
export const fmtPct = (v: number | null, digits = 1) => (v === null ? "n.d." : `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`);
export function fmtRatio(v: number | null, unit: RatioDef["unit"]) {
  if (v === null) return "Données non disponibles";
  if (unit === "%") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
  if (unit === "jours") return `${Math.round(v)} j`;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}
