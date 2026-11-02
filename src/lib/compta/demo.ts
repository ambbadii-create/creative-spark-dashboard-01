// Jeu de données de démonstration — Société Atlas SA (fictif). Toutes les écritures sont équilibrées par construction :
// les états financiers, SIG, CAF et ratios en découlent intégralement.
import { round2, type Entry, type EntryLine, type JournalCode } from "./model";

export const DEMO_CUSTOMERS = [
  { name: "Marjane Distribution (démo)", weight: 0.38, terms: 2 },
  { name: "Grossiste Derb Omar (démo)", weight: 0.22, terms: 1 },
  { name: "Hôtel Atlas Agadir (démo)", weight: 0.12, terms: 1 },
  { name: "Épicerie Fine Gueliz (démo)", weight: 0.08, terms: 0 },
  { name: "Cantine Centrale Rabat (démo)", weight: 0.2, terms: 3 },
];
export const IS_RATE = 20; // taux d'IS utilisé pour la provision mensuelle de démonstration
export const LAST_DATA = { year: 2026, month: 9 };

type L = [account: string, label: string, debit: number, credit: number, tiers?: string];
type Item = { entryId: string; lineId: string; amount: number; due: number; tiers: string };

export function buildComptaDemo() {
  let ln = 0;
  const entries: Entry[] = [];
  const counters = new Map<string, number>();
  const pretax = new Map<string, number>();
  const letters = new Map<string, number>();

  const mk = (journal: JournalCode, date: string, label: string, ref: string, lines: L[], status: Entry["status"] = "Validée") => {
    const y = date.slice(0, 4);
    const k = `${journal}-${y}`;
    const n = (counters.get(k) ?? 0) + 1;
    counters.set(k, n);
    const e: Entry = {
      id: `E-${journal}-${y}-${n}`,
      piece: `${journal}${y.slice(2)}-${String(n).padStart(4, "0")}`,
      date, journal, label, ref, status,
      lines: lines.filter((l) => round2(l[2]) !== 0 || round2(l[3]) !== 0).map(([account, lbl, d, c, tiers]): EntryLine => ({ id: `L${++ln}`, account, label: lbl, tiers, debit: round2(d), credit: round2(c) })),
    };
    entries.push(e);
    const pk = date.slice(0, 7);
    for (const l of e.lines) if (/^[67]/.test(l.account) && !l.account.startsWith("67")) pretax.set(pk, (pretax.get(pk) ?? 0) + l.credit - l.debit);
    return e;
  };
  const d = (y: number, m: number, day: number) => {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  const letter = (acc: string, a1: EntryLine, a2: EntryLine) => {
    const i = letters.get(acc) ?? 0;
    letters.set(acc, i + 1);
    const code = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
    a1.letter = code; a2.letter = code;
  };

  const clients: Item[] = [];
  const suppliers: Item[] = [];
  const SUP_TERMS: Record<string, number> = { "Lesieur Cristal": 2, "COSUMAR": 2, "Centrale Danone": 1, "Transports Atlas Logistique": 1, "Agence Média Casablanca": 1, "SCI Aïn Sebaâ": 0, "Wafa Assurance": 0, "Équipements Industriels du Maroc": 1 };

  /* ---------- Ouverture 2025 */
  const an25: L[] = [
    ["1111", "Capital social", 0, 10_000_000], ["1140", "Réserve légale", 0, 1_000_000],
    ["1481", "Emprunt BMCE 2023", 0, 6_000_000],
    ["2321", "Bâtiments", 9_000_000, 0], ["2332", "Matériel et outillage", 6_500_000, 0], ["2340", "Matériel de transport", 1_800_000, 0], ["2355", "Matériel informatique", 500_000, 0],
    ["2832", "Amortissements constructions et matériel", 0, 2_600_000], ["2834", "Amortissements matériel de transport", 0, 700_000],
    ["3111", "Stock de marchandises", 2_400_000, 0], ["3121", "Stock de matières", 1_600_000, 0], ["3455", "TVA récupérable", 300_000, 0],
    ["4441", "CNSS", 0, 250_000], ["4455", "TVA facturée", 0, 450_000],
    ["5141", "Banque Attijariwafa", 1_900_000, 0], ["5161", "Caisse siège", 100_000, 0],
  ];
  DEMO_CUSTOMERS.forEach((c) => an25.push(["3421", "Solde client à nouveau", round2(4_200_000 * c.weight), 0, c.name]));
  const anSup: [string, number][] = [["Lesieur Cristal", 1_500_000], ["COSUMAR", 1_000_000], ["Centrale Danone", 600_000]];
  anSup.forEach(([s, v]) => an25.push(["4411", "Solde fournisseur à nouveau", 0, v, s]));
  const diff = round2(an25.reduce((s, l) => s + l[2] - l[3], 0));
  an25.push(["1161", "Report à nouveau", 0, diff]);
  const e0 = mk("AN", "2025-01-01", "À-nouveaux exercice 2025", "Bilan d'ouverture 2025", an25);
  e0.lines.forEach((l) => {
    if (l.account === "3421") clients.push({ entryId: e0.id, lineId: l.id, amount: l.debit, due: -1, tiers: l.tiers! });
    if (l.account === "4411") suppliers.push({ entryId: e0.id, lineId: l.id, amount: l.credit, due: -1, tiers: l.tiers! });
  });

  const lineOf = (entryId: string, lineId: string) => entries.find((e) => e.id === entryId)!.lines.find((l) => l.id === lineId)!;
  const SEASON = [0.92, 0.9, 1.0, 1.05, 1.0, 0.95, 1.1, 1.12, 1.0, 1.02, 0.98, 1.15];
  let loan = 6_000_000;
  let tvaPrev = { col: 450_000, ded: 300_000 };
  let cnssPrev = 250_000;
  let isBalance = 0;
  let result2025 = 0;

  for (const y of [2025, 2026]) {
    const lastM = y === 2025 ? 11 : LAST_DATA.month;
    if (y === 2026) {
      // Ouverture 2026 : report des soldes de bilan + résultat 2025 en 1191.
      const sums = new Map<string, number>();
      for (const e of entries) for (const l of e.lines) if (/^[1-5]/.test(l.account) && l.account !== "3421" && l.account !== "4411") sums.set(l.account, (sums.get(l.account) ?? 0) + l.debit - l.credit);
      const lines: L[] = [...sums].filter(([, v]) => Math.abs(v) > 0.004).sort().map(([acc, v]) => [acc, "Report à nouveau", v > 0 ? v : 0, v < 0 ? -v : 0]);
      result2025 = round2([...pretax].filter(([k]) => k.startsWith("2025")).reduce((s, [, v]) => s + v, 0) - entries.filter((e) => e.date.startsWith("2025")).flatMap((e) => e.lines).filter((l) => l.account.startsWith("67")).reduce((s, l) => s + l.debit - l.credit, 0));
      lines.push(["1191", "Résultat net 2025 en instance d'affectation", 0, result2025]);
      const openC = clients.splice(0), openS = suppliers.splice(0);
      openC.forEach((it) => lines.push(["3421", "Facture client non réglée au 31/12/2025", it.amount, 0, it.tiers]));
      openS.forEach((it) => lines.push(["4411", "Facture fournisseur non réglée au 31/12/2025", 0, it.amount, it.tiers]));
      const e = mk("AN", "2026-01-01", "À-nouveaux exercice 2026", "Balance de clôture 2025", lines);
      const cl = e.lines.filter((l) => l.account === "3421"), sl = e.lines.filter((l) => l.account === "4411");
      openC.forEach((it, i) => clients.push({ ...it, entryId: e.id, lineId: cl[i]!.id, due: it.due - 12 }));
      openS.forEach((it, i) => suppliers.push({ ...it, entryId: e.id, lineId: sl[i]!.id, due: it.due - 12 }));
    }
    const g = y === 2025 ? 1 : 1.08;
    for (let m = 0; m <= lastM; m++) {
      const S = round2(4_150_000 * g * SEASON[m]!);
      const noLetter = y === 2026 && m >= 8;
      // Encaissements clients
      for (const it of clients.filter((x) => x.due <= m - DEMO_CUSTOMERS.find((c) => c.name === x.tiers)!.terms)) {
        const e = mk("BQ", d(y, m, 10), `Règlement ${it.tiers}`, `VIR-${y}${String(m + 1).padStart(2, "0")}-${it.lineId}`, [["5141", "Encaissement client", it.amount, 0], ["3421", "Règlement facture", 0, it.amount, it.tiers]]);
        if (!noLetter) letter("3421", lineOf(it.entryId, it.lineId), e.lines[1]!);
        clients.splice(clients.indexOf(it), 1);
      }
      // Paiements fournisseurs
      for (const it of suppliers.filter((x) => x.due <= m - (SUP_TERMS[x.tiers] ?? 1))) {
        const e = mk("BQ", d(y, m, 12), `Paiement ${it.tiers}`, `VIR-F-${it.lineId}`, [["4411", "Règlement fournisseur", it.amount, 0, it.tiers], ["5141", "Décaissement fournisseur", 0, it.amount]]);
        if (!noLetter) letter("4411", lineOf(it.entryId, it.lineId), e.lines[0]!);
        suppliers.splice(suppliers.indexOf(it), 1);
      }
      // TVA du mois précédent, CNSS
      mk("BQ", d(y, m, 15), "Déclaration et paiement TVA", `DGI-TVA-${y}-${m}`, [["4455", "TVA facturée", tvaPrev.col, 0], ["3455", "TVA récupérable", 0, tvaPrev.ded], ["5141", "Paiement TVA", 0, round2(tvaPrev.col - tvaPrev.ded)]]);
      mk("BQ", d(y, m, 10), "Paiement CNSS", `CNSS-${y}-${m}`, [["4441", "CNSS", cnssPrev, 0], ["5141", "Paiement CNSS", 0, cnssPrev]]);
      tvaPrev = { col: 0, ded: 0 };

      // Ventes
      DEMO_CUSTOMERS.forEach((c, i) => {
        const ht = round2(S * c.weight), tva = round2(ht * 0.2);
        const e = mk("VT", d(y, m, 25), `Facture ${c.name}`, `FA-${y}-${String(m * 5 + i + 1).padStart(4, "0")}`, [
          ["3421", "Facture client", round2(ht + tva), 0, c.name], ["7111", "Ventes de marchandises", 0, round2(ht * 0.6)], ["7121", "Ventes de produits", 0, round2(ht - round2(ht * 0.6))], ["4455", "TVA facturée 20 %", 0, tva],
        ]);
        tvaPrev.col += tva;
        clients.push({ entryId: e.id, lineId: e.lines[0]!.id, amount: e.lines[0]!.debit, due: m, tiers: c.name });
      });
      // Achats
      const ext = y === 2026 ? 1.25 : 1;
      const purchases: [string, string, string, number][] = [
        ["Lesieur Cristal", "6111", "Achats de marchandises", S * 0.3],
        ["Centrale Danone", "6111", "Achats de marchandises", S * 0.12],
        ["COSUMAR", "6121", "Achats de matières", S * 0.17],
        ["Transports Atlas Logistique", "6142", "Transports sur ventes", S * 0.022],
        ["Agence Média Casablanca", "6144", "Campagne publicitaire", S * 0.012 * ext],
        ["SCI Aïn Sebaâ", "6131", "Loyer entrepôt", 120_000],
      ];
      if (m % 3 === 0) purchases.push(["Wafa Assurance", "6134", "Prime d'assurance trimestrielle", 45_000]);
      if (y === 2026 && m === 2) purchases.push(["Équipements Industriels du Maroc", "2332", "Ligne de conditionnement", 800_000]);
      purchases.forEach(([s, acc, lbl, v], i) => {
        const ht = round2(v), tva = round2(ht * 0.2);
        const e = mk("HA", d(y, m, 20), `${lbl} — ${s}`, `${s.slice(0, 3).toUpperCase()}-${y}${String(m + 1).padStart(2, "0")}-${i + 1}`, [[acc, lbl, ht, 0], ["3455", "TVA récupérable 20 %", tva, 0], ["4411", "Facture fournisseur", 0, round2(ht + tva), s]]);
        tvaPrev.ded += tva;
        suppliers.push({ entryId: e.id, lineId: e.lines[2]!.id, amount: e.lines[2]!.credit, due: m, tiers: s });
      });
      tvaPrev = { col: round2(tvaPrev.col), ded: round2(tvaPrev.ded) };

      // Paie
      const G = round2(560_000 * (y === 2026 ? 1.05 : 1)), ch = round2(G * 0.21), net = round2(G * 0.88);
      cnssPrev = round2(G - net + ch);
      mk("OD", d(y, m, 28), `Paie ${["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"][m]} ${y}`, `PAIE-${y}-${m + 1}`, [["6171", "Salaires bruts", G, 0], ["6174", "Charges patronales", ch, 0], ["4432", "Net à payer", 0, net], ["4441", "CNSS et retenues", 0, cnssPrev]]);
      mk("BQ", d(y, m, 30), "Virement des salaires", `VIR-PAIE-${y}-${m + 1}`, [["4432", "Salaires nets", net, 0], ["5141", "Virement salaires", 0, net]]);
      // Impôts et taxes, emprunt, produits financiers, caisse
      mk("BQ", d(y, m, 18), "Taxe professionnelle et taxes locales", `TP-${y}-${m}`, [["6161", "Impôts et taxes", 30_000, 0], ["5141", "Paiement", 0, 30_000]]);
      const interest = round2((loan * 0.055) / 12);
      mk("BQ", d(y, m, 5), "Échéance emprunt BMCE", `ECH-${y}-${m + 1}`, [["6311", "Intérêts", interest, 0], ["1481", "Remboursement capital", 100_000, 0], ["5141", "Prélèvement échéance", 0, round2(interest + 100_000)]]);
      loan -= 100_000;
      if (m % 3 === 2) mk("BQ", d(y, m, 30), "Intérêts sur placement", `PLAC-${y}-${m}`, [["5141", "Intérêts reçus", 12_000, 0], ["7381", "Produits financiers", 0, 12_000]]);
      mk("BQ", d(y, m, 3), "Alimentation caisse", `CHQ-${y}-${m}`, [["5161", "Alimentation caisse", 15_000, 0], ["5141", "Retrait", 0, 15_000]]);
      mk("CA", d(y, m, 22), "Frais de transport divers", m % 4 === 1 ? "" : `BC-${y}-${m}`, [["6142", "Petits transports", 14_000, 0], ["5161", "Sortie caisse", 0, 14_000]]);
      // Variation de stocks, dotations
      const dv = round2(((m % 3) - 1) * S * 0.008);
      if (dv !== 0) mk("OD", d(y, m, 31), "Variation des stocks de marchandises", `INV-${y}-${m}`, dv > 0 ? [["6114", "Variation de stocks", dv, 0], ["3111", "Stock de marchandises", 0, dv]] : [["3111", "Stock de marchandises", -dv, 0], ["6114", "Variation de stocks", 0, -dv]]);
      mk("OD", d(y, m, 31), "Dotations aux amortissements", `AMORT-${y}-${m + 1}`, [["6193", "Dotation du mois", y === 2026 && m >= 2 ? 101_000 : 88_000, 0], ["2832", "Constructions et matériel", 0, y === 2026 && m >= 2 ? 83_000 : 70_000], ["2834", "Matériel de transport", 0, 18_000]]);
      // Événements ponctuels
      if (y === 2025 && m === 5) mk("BQ", d(y, m, 14), "Acquisition serveurs informatiques", "FA-INFO-2025-06", [["2355", "Matériel informatique", 400_000, 0], ["5141", "Paiement", 0, 400_000]]);
      if (y === 2025 && m === 8) mk("BQ", d(y, m, 9), "Pénalité de retard DGI", "AVIS-DGI-0925", [["6581", "Pénalités", 40_000, 0], ["5141", "Paiement", 0, 40_000]]);
      if (y === 2026 && m === 2) { mk("BQ", d(y, m, 8), "Déblocage emprunt d'investissement", "CONTRAT-CIH-2026", [["5141", "Fonds reçus", 600_000, 0], ["1481", "Emprunt CIH", 0, 600_000]]); loan += 600_000; }
      if (y === 2026 && m === 4) mk("BQ", d(y, m, 16), "Indemnité d'assurance sinistre", "SIN-2026-04", [["5141", "Encaissement", 25_000, 0], ["7581", "Produits non courants", 0, 25_000]]);
      if (y === 2026 && m === 5) {
        const leg = round2(result2025 * 0.05);
        mk("OD", "2026-06-30", "Affectation du résultat 2025 (AGO)", "PV-AGO-2026", [["1191", "Résultat 2025", result2025, 0], ["1140", "Dotation réserve légale", 0, leg], ["1161", "Report à nouveau", 0, round2(result2025 - leg)]]);
      }
      // Provision IS mensuelle (estimation) et acomptes trimestriels
      const pt = pretax.get(d(y, m, 1).slice(0, 7)) ?? 0;
      const is = round2(Math.max(0, pt) * (IS_RATE / 100));
      if (is > 0) { mk("OD", d(y, m, 31), "Provision IS du mois (estimation)", `IS-${y}-${m + 1}`, [["6701", "Impôt sur les résultats", is, 0], ["4453", "État IS", 0, is]]); isBalance += is; }
      if (m % 3 === 2 && isBalance > 0) { mk("BQ", d(y, m, 31), "Acompte IS trimestriel", `DGI-IS-${y}-${m}`, [["4453", "Acompte IS", round2(isBalance), 0], ["5141", "Paiement", 0, round2(isBalance)]]); isBalance = 0; }
    }
  }
  // Brouillons à traiter (contrôles de clôture)
  mk("OD", "2026-10-29", "Régularisation honoraires conseil", "", [["6131", "Honoraires à régulariser", 18_000, 0], ["4411", "Cabinet Conseil Fès", 0, 18_000, "Cabinet Conseil Fès"]], "Brouillon");
  mk("CA", "2026-10-30", "Note de frais — à compléter", "NDF-2026-41", [["6142", "Frais de déplacement", 3_200, 0], ["5161", "Caisse", 0, 3_000]], "Brouillon");

  entries.sort((x, y) => x.date.localeCompare(y.date) || x.piece.localeCompare(y.piece));
  const closed: string[] = [];
  for (let m = 0; m < 12; m++) closed.push(`2025-${String(m + 1).padStart(2, "0")}`);
  for (let m = 0; m < LAST_DATA.month; m++) closed.push(`2026-${String(m + 1).padStart(2, "0")}`);
  return { entries, closed };
}
