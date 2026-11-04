import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSales } from "@/lib/sales/store";
import { usePurchase } from "@/lib/purchase/store";
import { useCompta } from "@/lib/compta/store";
import { movementEntry, transferEntry } from "./integration";
import { invoiceTotals, collected as salesCollected } from "@/lib/sales/model";
import { invoiceTtc, paidAmount } from "@/lib/purchase/model";
import { buildTreasuryDemo, type TreasuryState } from "./demo";
import {
  approvalError, autoMatch, findDuplicate, isDuplicateStatement, validateAmount,
  isValidRib, availableBalance, type Account, type Action, type Movement, type PayRequest, type Role, type StatementLine, type PaymentMethod,
} from "./model";

const KEY = "pilotage-cg-tresorerie-v1";
const nid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const todayIso = () => new Date().toISOString().slice(0, 10);
type R = string | null;

type Ctx = TreasuryState & {
  /** Mouvements de trésorerie + règlements issus de Ventes / Achats (source unique, sans duplication). */
  allMovements: Movement[];
  can: (a: Action) => boolean;
  setRole: (r: Role) => void;
  upsertAccount: (a: Account) => R;
  toggleCash: (id: string) => R;
  saveMovement: (m: Movement, force?: boolean) => R;
  validateMovement: (id: string) => R;
  cancelMovement: (id: string, reason: string) => R;
  transmit: () => R;
  registerCollection: (invoiceId: string, amount: number, date: string, method: PaymentMethod, accountId: string, reference: string) => R;
  setDispute: (invoiceId: string, on: boolean) => void;
  setExpectedDate: (invoiceId: string, date: string) => void;
  saveRequest: (r: PayRequest, force?: boolean) => R;
  approveRequest: (id: string) => R;
  rejectRequest: (id: string, reason: string) => R;
  executeRequest: (id: string, amount: number, date: string, paymentRef: string) => R;
  importStatement: (lines: Omit<StatementLine, "id">[]) => { added: number; duplicates: number };
  runAutoMatch: () => number;
  manualMatch: (statementIds: string[], movementIds: string[]) => R;
  unmatch: (matchId: string) => R;
  flagStatement: (id: string) => void;
  update: (patch: Partial<TreasuryState>, what: string) => R;
  reset: () => void;
};
const C = createContext<Ctx | null>(null);

export function TreasuryProvider({ children }: { children: ReactNode }) {
  const sales = useSales();
  const purchase = usePurchase();
  const compta = useCompta();
  const [s, setS] = useState<TreasuryState>(buildTreasuryDemo);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as TreasuryState;
        setS({ ...saved, loans: saved.loans.filter((l) => !l.demo), movements: saved.movements.filter((m) => !(m.source === "Financements" && saved.loans.some((l) => l.demo && l.id === m.sourceId))) });
      }
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(s));
  }, [s]);

  const log = (st: TreasuryState, action: string, detail: string): TreasuryState => ({
    ...st,
    updatedAt: new Date().toISOString(),
    audit: [{ id: nid("A"), at: new Date().toISOString(), role: st.role, action, detail }, ...st.audit].slice(0, 300),
  });
  const can = (a: Action) => s.permissions[s.role].includes(a);
  const deny = (a: Action, msg: string): R => (can(a) ? null : msg);
  const locked = (date: string) => date <= s.rules.lockedUntil;
  const defaultBank = s.accounts.find((a) => a.kind === "Banque" && a.status === "Actif")?.id ?? "BQ-1";

  const allMovements = useMemo<Movement[]>(() => {
    const cust = new Map(sales.customers.map((c) => [c.id, c.name]));
    const sup = new Map(purchase.suppliers.map((x) => [x.id, x.name]));
    const linked: Movement[] = [
      ...sales.collections.map((c): Movement => {
        const inv = sales.invoices.find((i) => i.id === c.invoiceId);
        const link = s.links[c.id];
        return { id: `LNK-${c.id}`, ref: c.reference, date: c.date, valueDate: c.date, label: `Encaissement ${inv?.number ?? ""}`, direction: "in", category: "Encaissements clients", accountId: link?.accountId ?? defaultBank, counterparty: cust.get(inv?.customerId ?? "") ?? "Client", amount: c.amount, currency: "MAD", method: c.method, status: "Validé", source: "Ventes", sourceId: c.invoiceId, comptaStatus: link?.transmitted || c.date < "2026-10-01" ? "Transmis" : "À transmettre" };
      }),
      ...purchase.payments.map((p): Movement => {
        const inv = purchase.invoices.find((i) => i.id === p.invoiceId);
        const link = s.links[p.id];
        return { id: `LNK-${p.id}`, ref: p.reference, date: p.date, valueDate: p.date, label: `Règlement facture ${inv?.reference ?? ""}`, direction: "out", category: "Paiements fournisseurs", accountId: link?.accountId ?? defaultBank, counterparty: sup.get(inv?.supplierId ?? "") ?? "Fournisseur", amount: p.amount, currency: "MAD", method: p.method, status: "Validé", source: "Achats", sourceId: p.invoiceId, comptaStatus: link?.transmitted || p.date < "2026-10-01" ? "Transmis" : "À transmettre" };
      }),
    ];
    return [...s.movements, ...linked].sort((a, b) => b.date.localeCompare(a.date));
  }, [s.movements, s.links, sales.collections, sales.invoices, sales.customers, purchase.payments, purchase.invoices, purchase.suppliers, defaultBank]);

  const ctx: Ctx = {
    ...s,
    allMovements,
    can,
    setRole: (role) => setS((x) => ({ ...x, role })),
    upsertAccount: (a) => {
      const e = deny("comptes", "Votre rôle ne permet pas de gérer les comptes.");
      if (e) return e;
      if (!a.name.trim()) return "Le nom du compte est obligatoire.";
      if (a.kind === "Banque" && a.number && !isValidRib(a.number)) return "Le RIB marocain doit comporter 24 chiffres.";
      if (![a.openingBalance, a.minBalance, a.restricted].every(Number.isFinite) || a.minBalance < 0 || a.restricted < 0) return "Soldes et seuils invalides.";
      const prev = s.accounts.find((x) => x.id === a.id);
      setS((x) => log({ ...x, accounts: prev ? x.accounts.map((y) => (y.id === a.id ? a : y)) : [...x.accounts, a] }, prev ? "Modification compte" : "Création compte", a.name));
      return null;
    },
    toggleCash: (id) => {
      const e = deny("comptes", "Votre rôle ne permet pas d'ouvrir ou clôturer une caisse.");
      if (e) return e;
      const a = s.accounts.find((x) => x.id === id);
      if (!a) return "Caisse introuvable.";
      setS((x) => log({ ...x, accounts: x.accounts.map((y) => (y.id === id ? { ...y, cashOpen: !y.cashOpen } : y)) }, a.cashOpen ? "Clôture caisse" : "Ouverture caisse", a.name));
      return null;
    },
    saveMovement: (m, force) => {
      const e = deny("saisir", "Votre rôle ne permet pas de saisir des mouvements.");
      if (e) return e;
      const prev = s.movements.find((x) => x.id === m.id);
      if (prev && prev.status !== "Brouillon") return "Seuls les mouvements en brouillon sont modifiables.";
      if (locked(m.date)) return `Période verrouillée jusqu'au ${s.rules.lockedUntil}.`;
      if (!m.label.trim() || !m.counterparty.trim()) return "Libellé et contrepartie sont obligatoires.";
      if (!(m.amount > 0)) return "Le montant doit être strictement positif.";
      const acc = s.accounts.find((a) => a.id === m.accountId);
      if (!acc || acc.status !== "Actif") return "Le compte sélectionné n'est pas actif.";
      if (acc.kind === "Caisse" && !acc.cashOpen) return "La caisse est fermée : ouvrez-la avant toute opération.";
      const dup = findDuplicate(m, allMovements);
      if (dup && !force) return `DOUBLON:${dup.ref} du ${dup.date}`;
      const mv = { ...m, currency: acc.currency };
      setS((x) => log({ ...x, movements: prev ? x.movements.map((y) => (y.id === m.id ? mv : y)) : [...x.movements, mv] }, prev ? "Modification mouvement" : "Saisie mouvement", `${m.ref} — ${m.label}${dup ? " (doublon confirmé)" : ""}`));
      return null;
    },
    validateMovement: (id) => {
      const e = deny("valider", "Votre rôle ne permet pas de valider des mouvements.");
      if (e) return e;
      const m = s.movements.find((x) => x.id === id);
      if (!m || m.status !== "Brouillon") return "Mouvement non validable.";
      if (locked(m.date)) return `Période verrouillée jusqu'au ${s.rules.lockedUntil}.`;
      setS((x) => log({ ...x, movements: x.movements.map((y) => (y.id === id ? { ...y, status: "Validé" } : y)) }, "Validation mouvement", m.ref));
      return null;
    },
    cancelMovement: (id, reason) => {
      const e = deny("valider", "Votre rôle ne permet pas d'annuler des mouvements.");
      if (e) return e;
      const m = s.movements.find((x) => x.id === id);
      if (!m) return "Les règlements issus de Ventes / Achats s'annulent dans leur module d'origine.";
      if (m.status === "Annulé") return "Déjà annulé.";
      if (locked(m.date)) return `Période verrouillée jusqu'au ${s.rules.lockedUntil}.`;
      if (!reason.trim()) return "Le motif d'annulation est obligatoire.";
      if (s.matches.some((x) => x.movementIds.includes(id))) return "Mouvement rapproché : défaites d'abord le rapprochement.";
      const ids = m.transferId ? s.movements.filter((y) => y.transferId === m.transferId).map((y) => y.id) : [id];
      setS((x) => log({ ...x, movements: x.movements.map((y) => (ids.includes(y.id) ? { ...y, status: "Annulé", cancelReason: reason } : y)) }, "Annulation mouvement", `${m.ref} — ${reason}`));
      return null;
    },
    transmit: () => {
      const e = deny("valider", "Votre rôle ne permet pas de transmettre à la comptabilité.");
      if (e) return e;
      const pending = allMovements.filter((m) => m.status === "Validé" && m.comptaStatus === "À transmettre");
      const entries = pending.filter((m) => !m.transferId).map((m) => movementEntry(m, s.accounts, s.fx)).filter((e) => e !== null);
      for (const transferId of new Set(pending.flatMap((m) => m.transferId ? [m.transferId] : []))) {
        const entry = transferEntry(allMovements.filter((m) => m.transferId === transferId), s.accounts, s.fx);
        if (entry) entries.push(entry);
      }
      if (!entries.length) return "Aucun mouvement transmissible : vérifiez les catégories et cours de change.";
      const err = compta.receiveTreasuryEntries(entries);
      if (err) return err;
      const sent = pending.filter((m) => entries.some((e) => e.id === `TREASURY-${m.id}` || (m.transferId && e.id === `TREASURY-${m.transferId}`)));
      const own = sent.filter((m) => !m.id.startsWith("LNK-")).map((m) => m.id);
      const linked = sent.filter((m) => m.id.startsWith("LNK-"));
      setS((x) => {
        const links = { ...x.links };
        for (const m of linked) {
          const key = m.id.replace("LNK-", "");
          links[key] = { accountId: links[key]?.accountId ?? m.accountId, transmitted: true };
        }
        return log({ ...x, links, movements: x.movements.map((y) => (own.includes(y.id) ? { ...y, comptaStatus: "Transmis" } : y)) }, "Transmission comptabilité", `${own.length + linked.length} mouvement(s) transmis`);
      });
      return null;
    },
    registerCollection: (invoiceId, amount, date, method, accountId, reference) => {
      const e = deny("saisir", "Votre rôle ne permet pas d'enregistrer un encaissement.");
      if (e) return e;
      const inv = sales.invoices.find((i) => i.id === invoiceId);
      if (!inv) return "Facture introuvable.";
      if (locked(date)) return `Période verrouillée jusqu'au ${s.rules.lockedUntil}.`;
      const account = s.accounts.find((a) => a.id === accountId);
      if (!account || account.status !== "Actif" || account.currency !== "MAD" || (account.kind === "Caisse" && !account.cashOpen)) return "Choisissez un compte MAD actif ou une caisse ouverte.";
      if (!["Virement", "Chèque", "Effet (LCN)", "Espèces"].includes(method)) return "Mode de règlement non pris en charge par Ventes.";
      const rest = invoiceTotals(inv).ttc - salesCollected(invoiceId, sales.collections);
      const v = validateAmount(amount, rest);
      if (v) return v;
      const id = nid("E");
      const err = sales.addCollection({ id, invoiceId, date, amount, method: method as never, reference: reference || id });
      if (err) return err;
      setS((x) => log({ ...x, links: { ...x.links, [id]: { accountId, transmitted: false } } }, "Encaissement", `${inv.number} — ${amount.toLocaleString("fr-FR")} DH`));
      return null;
    },
    setDispute: (invoiceId, on) => setS((x) => log({ ...x, disputes: on ? [...x.disputes, invoiceId] : x.disputes.filter((d) => d !== invoiceId) }, on ? "Mise en litige" : "Levée du litige", invoiceId)),
    setExpectedDate: (invoiceId, date) => setS((x) => ({ ...x, expectedDates: { ...x.expectedDates, [invoiceId]: date } })),
    saveRequest: (r, force) => {
      const e = deny("demander", "Votre rôle ne permet pas de créer des demandes de paiement.");
      if (e) return e;
      if (!r.beneficiary.trim()) return "Le bénéficiaire est obligatoire.";
      if (!(r.amount > 0)) return "Le montant doit être strictement positif.";
      const account = s.accounts.find((a) => a.id === r.accountId);
      if (!account || account.status !== "Actif" || (r.invoiceId && account.currency !== "MAD")) return "Compte de paiement invalide (factures fournisseurs en MAD).";
      const previous = s.requests.find((x) => x.id === r.id);
      if (previous && previous.status !== "En attente de validation") return "Demande déjà traitée : modification refusée.";
      if (r.invoiceId) {
        const inv = purchase.invoices.find((i) => i.id === r.invoiceId);
        if (!inv) return "Facture introuvable.";
        const pending = s.requests.filter((x) => x.invoiceId === r.invoiceId && x.id !== r.id && (x.status === "En attente de validation" || x.status === "Programmé")).reduce((a, x) => a + x.amount, 0);
        const v = validateAmount(r.amount, invoiceTtc(inv) - paidAmount(inv.id, purchase.payments) - pending);
        if (v) return v;
      }
      const dup = s.requests.find((x) => x.id !== r.id && x.status !== "Annulé" && x.status !== "Rejeté" && x.beneficiary === r.beneficiary && Math.abs(x.amount - r.amount) < 0.01 && x.invoiceRef === r.invoiceRef);
      if (dup && !force) return `DOUBLON:${dup.ref}`;
      setS((x) => log({ ...x, requests: [...x.requests.filter((y) => y.id !== r.id), { ...r, requestedBy: x.role, status: "En attente de validation" }] }, "Demande de paiement", `${r.ref} — ${r.beneficiary} — ${r.amount.toLocaleString("fr-FR")} DH`));
      return null;
    },
    approveRequest: (id) => {
      const r = s.requests.find((x) => x.id === id);
      if (!r || r.status !== "En attente de validation") return "Demande non approuvable.";
      const e = approvalError(s.role, s.permissions, r, s.rules);
      if (e) return e;
      setS((x) => log({ ...x, requests: x.requests.map((y) => (y.id === id ? { ...y, status: "Programmé", approvedBy: x.role } : y)) }, "Approbation paiement", r.ref));
      return null;
    },
    rejectRequest: (id, reason) => {
      const r = s.requests.find((x) => x.id === id);
      if (!r) return "Demande introuvable.";
      if (r.status !== "En attente de validation" && r.status !== "Programmé") return "Demande déjà traitée.";
      if (!can("approuver") && r.requestedBy !== s.role) return "Votre rôle ne permet pas de rejeter cette demande.";
      if (!reason.trim()) return "Le motif est obligatoire.";
      const status = r.requestedBy === s.role ? "Annulé" : "Rejeté";
      setS((x) => log({ ...x, requests: x.requests.map((y) => (y.id === id ? { ...y, status, note: reason } : y)) }, status === "Annulé" ? "Annulation demande" : "Rejet paiement", `${r.ref} — ${reason}`));
      return null;
    },
    executeRequest: (id, amount, date, paymentRef) => {
      const e = deny("executer", "Votre rôle ne permet pas d'exécuter des paiements.");
      if (e) return e;
      const r = s.requests.find((x) => x.id === id);
      if (!r || r.status !== "Programmé") return "Seuls les paiements approuvés (programmés) sont exécutables.";
      if (r.approvedBy === s.role && s.role !== "Administrateur") return "Séparation des tâches : l'approbateur ne peut pas exécuter le paiement.";
      const v = validateAmount(amount, r.amount);
      if (v) return v;
      if (locked(date)) return `Période verrouillée jusqu'au ${s.rules.lockedUntil}.`;
      const acc = s.accounts.find((a) => a.id === r.accountId);
      if (!acc || acc.status !== "Actif") return "Le compte de paiement n'est pas actif.";
      if (acc.kind === "Caisse" && !acc.cashOpen) return "La caisse est fermée.";
      if (amount > availableBalance(acc, allMovements, date)) return "Solde disponible insuffisant.";
      const ref = paymentRef.trim() || nid("PAY");
      if (r.invoiceId) {
        const inv = purchase.invoices.find((i) => i.id === r.invoiceId);
        if (!inv) return "Facture introuvable.";
        const remainingError = validateAmount(amount, invoiceTtc(inv) - paidAmount(inv.id, purchase.payments));
        if (remainingError) return remainingError;
        const pid = nid("PAY");
        purchase.addPayment({ id: pid, invoiceId: r.invoiceId, date, amount, method: (["Virement", "Chèque", "Effet (LCN)", "Espèces"].includes(r.method) ? r.method : "Virement") as never, reference: ref });
        setS((x) => log({ ...x, links: { ...x.links, [pid]: { accountId: r.accountId, transmitted: false } }, requests: x.requests.map((y) => (y.id === id ? { ...y, status: amount < r.amount ? "Programmé" : "Payé", amount: amount < r.amount ? y.amount - amount : y.amount, paidDate: date, paymentRef: ref } : y)) }, "Exécution paiement", `${r.ref} — ${amount.toLocaleString("fr-FR")} DH`));
      } else {
        const mv: Movement = { id: nid("M"), ref, date, valueDate: date, label: `Paiement ${r.invoiceRef || r.ref}`, direction: "out", category: r.category, accountId: r.accountId, counterparty: r.beneficiary, amount, currency: acc.currency, method: r.method, status: "Validé", source: "Trésorerie", sourceId: r.id, comptaStatus: "À transmettre" };
        setS((x) => log({ ...x, movements: [...x.movements, mv], requests: x.requests.map((y) => (y.id === id ? { ...y, status: amount < r.amount ? "Programmé" : "Payé", amount: amount < r.amount ? y.amount - amount : y.amount, paidDate: date, paymentRef: ref } : y)) }, "Exécution paiement", `${r.ref} — ${amount.toLocaleString("fr-FR")} DH`));
      }
      return null;
    },
    importStatement: (lines) => {
      if (!can("rapprocher")) return { added: 0, duplicates: 0 };
      let duplicates = 0;
      const fresh: StatementLine[] = [];
      for (const l of lines) {
        if (isDuplicateStatement(l, [...s.statements, ...fresh])) duplicates++;
        else fresh.push({ ...l, id: nid("RL") });
      }
      setS((x) => log({ ...x, statements: [...x.statements, ...fresh] }, "Import relevé", `${fresh.length} ligne(s), ${duplicates} doublon(s) ignoré(s)`));
      return { added: fresh.length, duplicates };
    },
    runAutoMatch: () => {
      if (!can("rapprocher")) return -1;
      const found = autoMatch(s.statements, allMovements, s.matches);
      if (found.length)
        setS((x) => log({ ...x, matches: [...x.matches, ...found.map((f) => ({ id: nid("RAP"), statementIds: [f.statementId], movementIds: [f.movementId], at: new Date().toISOString(), role: x.role, kind: "Automatique" as const }))] }, "Rapprochement automatique", `${found.length} correspondance(s)`));
      return found.length;
    },
    manualMatch: (statementIds, movementIds) => {
      const e = deny("rapprocher", "Votre rôle ne permet pas de rapprocher.");
      if (e) return e;
      if (!statementIds.length || !movementIds.length) return "Sélectionnez au moins une ligne de relevé et un mouvement.";
      const statements = s.statements.filter((l) => statementIds.includes(l.id));
      const movements = allMovements.filter((m) => movementIds.includes(m.id));
      if (statements.length !== statementIds.length || movements.length !== movementIds.length || movements.some((m) => m.status !== "Validé")) return "Lignes introuvables ou mouvements non validés.";
      if (new Set([...statements, ...movements].map((l) => l.accountId)).size !== 1) return "Le rapprochement doit concerner un seul compte bancaire.";
      if (s.matches.some((m) => m.statementIds.some((x) => statementIds.includes(x)) || m.movementIds.some((x) => movementIds.includes(x)))) return "Une des lignes est déjà rapprochée.";
      setS((x) => log({ ...x, matches: [...x.matches, { id: nid("RAP"), statementIds, movementIds, at: new Date().toISOString(), role: x.role, kind: "Manuel" }], statements: x.statements.map((l) => (statementIds.includes(l.id) ? { ...l, flagged: false } : l)) }, "Rapprochement manuel", `${statementIds.length} relevé ↔ ${movementIds.length} mouvement(s)`));
      return null;
    },
    unmatch: (matchId) => {
      const e = deny("rapprocher", "Votre rôle ne permet pas de défaire un rapprochement.");
      if (e) return e;
      setS((x) => log({ ...x, matches: x.matches.filter((m) => m.id !== matchId) }, "Annulation rapprochement", matchId));
      return null;
    },
    flagStatement: (id) => setS((x) => log({ ...x, statements: x.statements.map((l) => (l.id === id ? { ...l, flagged: !l.flagged } : l)) }, "Ligne à vérifier", id)),
    update: (patch, what) => {
      const e = deny("parametrer", "Votre rôle ne permet pas de modifier le paramétrage.");
      if (e) return e;
      setS((x) => log({ ...x, ...patch }, "Paramétrage", what));
      return null;
    },
    reset: () => setS(buildTreasuryDemo()),
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}

export function useTreasury() {
  const c = useContext(C);
  if (!c) throw new Error("useTreasury hors TreasuryProvider");
  return c;
}
