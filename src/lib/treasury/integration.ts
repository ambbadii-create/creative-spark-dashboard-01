import type { Entry } from "@/lib/compta/model";
import { round2, signed, type Account, type Movement, type FxRate } from "./model";
import { toMad } from "./model";

export function movementEntry(m: Movement, accounts: Account[], fx: FxRate[]): Entry | null {
  const account = accounts.find((a) => a.id === m.accountId);
  const amount = toMad(m.amount, m.currency, fx);
  if (!account || amount === null || m.status !== "Validé") return null;
  const cash = account.kind === "Caisse" ? "5161" : "5141";
  const counterpart: Record<string, string> = {
    "Encaissements clients": "3421", "Paiements fournisseurs": "4411", "Salaires": "4432",
    "Charges sociales (CNSS / AMO)": "4441", "Impôts et taxes": "4453", "Loyers": "6131",
    "Charges d'exploitation": "6134", "Remboursements d'emprunts": "1481", "Intérêts": "6311",
    "Investissements": "2332", "Produits financiers": "7381", "Apports en capital": "1111", "Emprunts reçus": "1481",
    "Virement interne": "5141",
  };
  // Unknown categories require an explicit accounting mapping, never a guessed journal line.
  const other = counterpart[m.category];
  if (!other || m.category === "Virement interne") return null;
  return { id: `TREASURY-${m.id}`, piece: `TR-${m.ref}`, date: m.date, journal: account.kind === "Caisse" ? "CA" : "BQ", label: m.label, ref: m.ref, status: "Brouillon", lines: [
    { id: `${m.id}-cash`, account: cash, label: m.label, tiers: m.counterparty, debit: m.direction === "in" ? amount : 0, credit: m.direction === "out" ? amount : 0 },
    { id: `${m.id}-other`, account: other, label: m.label, tiers: m.counterparty, debit: m.direction === "out" ? amount : 0, credit: m.direction === "in" ? amount : 0 },
  ] };
}

export function transferEntry(movements: Movement[], accounts: Account[], fx: FxRate[]): Entry | null {
  const first = movements[0];
  if (!first?.transferId || movements.length !== 2 || movements.some((m) => m.status !== "Validé")) return null;
  const values = movements.map((m) => toMad(m.amount, m.currency, fx));
  if (values.some((v) => v === null)) return null;
  const gap = movements.reduce((sum, m, i) => sum + signed({ direction: m.direction, amount: values[i] ?? 0 }), 0);
  if (Math.abs(round2(gap)) > 0.01) return null;
  const lines = movements.map((m, i) => ({ id: `${m.id}-cash`, account: accounts.find((a) => a.id === m.accountId)?.kind === "Caisse" ? "5161" : "5141", label: m.label, debit: m.direction === "in" ? values[i] ?? 0 : 0, credit: m.direction === "out" ? values[i] ?? 0 : 0 }));
  return { id: `TREASURY-${first.transferId}`, piece: first.transferId, date: first.date, journal: "BQ", label: first.label, ref: first.ref, status: "Brouillon", lines };
}