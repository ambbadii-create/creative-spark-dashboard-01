import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { buildDemo } from "./demo";
import type { Budget, BudgetLine, CorrectiveAction } from "./model";

type State = { budgets: Budget[]; lines: BudgetLine[]; actions: CorrectiveAction[] };
const KEY = "pilotage-cg-budgets-v1";

type Ctx = State & {
  addBudget: (b: Omit<Budget, "id">) => Budget;
  upsertLine: (l: BudgetLine) => void;
  deleteLine: (id: string) => void;
  setActual: (lineId: string, month: number, value: number | null) => void;
  upsertAction: (a: CorrectiveAction) => void;
  deleteAction: (id: string) => void;
  reset: () => void;
};

const BudgetCtx = createContext<Ctx | null>(null);
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(buildDemo);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const ctx: Ctx = {
    ...state,
    addBudget: (b) => {
      const nb = { ...b, id: uid("B") };
      setState((s) => ({ ...s, budgets: [...s.budgets, nb] }));
      return nb;
    },
    upsertLine: (l) =>
      setState((s) => ({
        ...s,
        lines: s.lines.some((x) => x.id === l.id) ? s.lines.map((x) => (x.id === l.id ? l : x)) : [...s.lines, l],
      })),
    deleteLine: (id) =>
      setState((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== id), actions: s.actions.filter((a) => a.lineId !== id) })),
    setActual: (lineId, month, value) =>
      setState((s) => ({
        ...s,
        lines: s.lines.map((l) => (l.id === lineId ? { ...l, actual: l.actual.map((v, i) => (i === month ? value : v)) } : l)),
      })),
    upsertAction: (a) =>
      setState((s) => ({
        ...s,
        actions: s.actions.some((x) => x.id === a.id) ? s.actions.map((x) => (x.id === a.id ? a : x)) : [...s.actions, a],
      })),
    deleteAction: (id) => setState((s) => ({ ...s, actions: s.actions.filter((a) => a.id !== id) })),
    reset: () => setState(buildDemo()),
  };
  return <BudgetCtx.Provider value={ctx}>{children}</BudgetCtx.Provider>;
}

export function useBudgets() {
  const c = useContext(BudgetCtx);
  if (!c) throw new Error("useBudgets hors BudgetProvider");
  return c;
}
