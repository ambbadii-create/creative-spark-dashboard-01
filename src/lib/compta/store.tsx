import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { buildComptaDemo } from "./demo";
import { canLetter, nextLetter, periodKey, validateEntry, type Entry } from "./model";

export const ROLES = ["Comptable", "Chef comptable", "Directeur financier"] as const;
export type Role = (typeof ROLES)[number];
/** Droits : saisie (tous), validation & lettrage (chef comptable, DAF), clôture & réouverture (DAF). */
export const can = (role: Role, action: "saisir" | "valider" | "lettrer" | "cloturer") =>
  action === "saisir" ? true : action === "cloturer" ? role === "Directeur financier" : role !== "Comptable";

export type AuditEvent = { id: string; at: string; role: Role; action: string; detail: string };
type State = { entries: Entry[]; closed: string[]; audit: AuditEvent[]; role: Role; vatRate: number; benchmarks: Record<string, number | null>; updatedAt: string };
const KEY = "pilotage-cg-compta-v1";

const initial = (): State => {
  const d = buildComptaDemo();
  return { ...d, audit: [], role: "Chef comptable", vatRate: 20, benchmarks: {}, updatedAt: "2026-10-31T18:00:00.000Z" };
};

type Result = string | null; // message d'erreur ou null
type Ctx = State & {
  isClosed: (date: string) => boolean;
  saveEntry: (e: Entry) => Result;
  validate: (id: string) => Result;
  deleteDraft: (id: string) => Result;
  letterLines: (lineIds: string[]) => Result;
  unletter: (account: string, letter: string) => Result;
  closePeriod: (key: string) => Result;
  reopenPeriod: (key: string, reason: string) => Result;
  setRole: (r: Role) => void;
  setVatRate: (v: number) => void;
  setBenchmark: (id: string, v: number | null) => void;
  reset: () => void;
};
const C = createContext<Ctx | null>(null);
const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function ComptaProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS(JSON.parse(raw));
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(s));
  }, [s]);

  const isClosed = (date: string) => s.closed.includes(periodKey(date));
  const log = (st: State, action: string, detail: string): State => ({
    ...st, updatedAt: new Date().toISOString(),
    audit: [{ id: id(), at: new Date().toISOString(), role: st.role, action, detail }, ...st.audit].slice(0, 500),
  });

  const ctx: Ctx = {
    ...s,
    isClosed,
    saveEntry: (e) => {
      const prev = s.entries.find((x) => x.id === e.id);
      if (prev?.status === "Validée") return "Une écriture validée ne peut plus être modifiée : passez une écriture d'extourne.";
      if (isClosed(e.date) || (prev && isClosed(prev.date))) return `La période ${periodKey(e.date)} est clôturée.`;
      setS((st) => log({ ...st, entries: prev ? st.entries.map((x) => (x.id === e.id ? { ...e, status: "Brouillon" } : x)) : [...st.entries, { ...e, status: "Brouillon" }] }, prev ? "Modification" : "Création", `${e.piece} — ${e.label}`));
      return null;
    },
    validate: (eid) => {
      const e = s.entries.find((x) => x.id === eid);
      if (!e) return "Écriture introuvable.";
      if (!can(s.role, "valider")) return "Votre rôle ne permet pas de valider des écritures.";
      if (isClosed(e.date)) return "Période clôturée.";
      const errs = validateEntry(e);
      if (errs.length) return errs.join(" ");
      setS((st) => log({ ...st, entries: st.entries.map((x) => (x.id === eid ? { ...x, status: "Validée" } : x)) }, "Validation", `${e.piece} — ${e.label}`));
      return null;
    },
    deleteDraft: (eid) => {
      const e = s.entries.find((x) => x.id === eid);
      if (!e || e.status !== "Brouillon") return "Seuls les brouillons peuvent être supprimés.";
      if (isClosed(e.date)) return "Période clôturée.";
      setS((st) => log({ ...st, entries: st.entries.filter((x) => x.id !== eid) }, "Suppression brouillon", e.piece));
      return null;
    },
    letterLines: (ids) => {
      if (!can(s.role, "lettrer")) return "Votre rôle ne permet pas le lettrage.";
      const lines = s.entries.flatMap((e) => e.lines).filter((l) => ids.includes(l.id));
      const accs = new Set(lines.map((l) => l.account));
      if (accs.size !== 1) return "Les lignes doivent appartenir au même compte.";
      const err = canLetter(lines);
      if (err) return err;
      const acc = [...accs][0]!;
      const used = s.entries.flatMap((e) => e.lines).filter((l) => l.account === acc && l.letter).map((l) => l.letter!);
      const code = nextLetter(used);
      setS((st) => log({ ...st, entries: st.entries.map((e) => ({ ...e, lines: e.lines.map((l) => (ids.includes(l.id) ? { ...l, letter: code } : l)) })) }, "Lettrage", `${acc} — code ${code} (${ids.length} lignes)`));
      return null;
    },
    unletter: (acc, letter) => {
      if (!can(s.role, "lettrer")) return "Votre rôle ne permet pas le délettrage.";
      setS((st) => log({ ...st, entries: st.entries.map((e) => ({ ...e, lines: e.lines.map((l) => (l.account === acc && l.letter === letter ? { ...l, letter: undefined } : l)) })) }, "Délettrage", `${acc} — code ${letter}`));
      return null;
    },
    closePeriod: (key) => {
      if (!can(s.role, "cloturer")) return "Seul le directeur financier peut clôturer une période.";
      const drafts = s.entries.filter((e) => periodKey(e.date) === key && e.status === "Brouillon").length;
      if (drafts) return `${drafts} écriture(s) en brouillon sur la période : validez-les ou supprimez-les avant clôture.`;
      setS((st) => log({ ...st, closed: [...st.closed, key].sort() }, "Clôture de période", key));
      return null;
    },
    reopenPeriod: (key, reason) => {
      if (!can(s.role, "cloturer")) return "Seul le directeur financier peut rouvrir une période.";
      if (reason.trim().length < 10) return "Motif de réouverture obligatoire (10 caractères minimum).";
      setS((st) => log({ ...st, closed: st.closed.filter((k) => k !== key) }, "Réouverture de période", `${key} — motif : ${reason.trim()}`));
      return null;
    },
    setRole: (role) => setS((st) => ({ ...st, role })),
    setVatRate: (vatRate) => setS((st) => log({ ...st, vatRate }, "Paramètre", `Taux de TVA d'analyse : ${vatRate} %`)),
    setBenchmark: (rid, v) => setS((st) => ({ ...st, benchmarks: { ...st.benchmarks, [rid]: v } })),
    reset: () => setS(initial()),
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}

export function useCompta() {
  const c = useContext(C);
  if (!c) throw new Error("useCompta hors ComptaProvider");
  return c;
}
