import { useMemo } from "react";
import { useSales } from "@/lib/sales/store";
import { usePurchase } from "@/lib/purchase/store";
import { invoiceTotals, collected } from "@/lib/sales/model";
import { invoiceTtc, paidAmount } from "@/lib/purchase/model";
import { useTreasury, todayIso } from "@/lib/treasury/store";
import {
  addDays, applyScenario, bucketOf, buildForecast, commitmentFlows, consolidatedPosition, loanSchedule, round2, toMad,
  type Flow, type Granularity, type Scenario,
} from "@/lib/treasury/model";

export type Receivable = { invoiceId: string; number: string; customer: string; date: string; dueDate: string; total: number; collected: number; rest: number; expected: string };
export type Payable = { invoiceId: string; ref: string; supplier: string; date: string; dueDate: string; total: number; paid: number; rest: number };

/** Données dérivées partagées par les onglets : créances, dettes, flux attendus, position. */
export function useTreasuryData() {
  const t = useTreasury();
  const sales = useSales();
  const purchase = usePurchase();
  const today = todayIso();

  return useMemo(() => {
    const cust = new Map(sales.customers.map((c) => [c.id, c.name]));
    const sup = new Map(purchase.suppliers.map((s) => [s.id, s.name]));
    const receivables: Receivable[] = sales.invoices.map((i) => {
      const total = invoiceTotals(i).ttc, col = collected(i.id, sales.collections);
      return { invoiceId: i.id, number: i.number, customer: cust.get(i.customerId) ?? "—", date: i.date, dueDate: i.dueDate, total, collected: col, rest: round2(Math.max(0, total - col)), expected: t.expectedDates[i.id] ?? i.dueDate };
    });
    const payables: Payable[] = purchase.invoices.map((i) => {
      const total = invoiceTtc(i), paid = paidAmount(i.id, purchase.payments);
      return { invoiceId: i.id, ref: i.reference, supplier: sup.get(i.supplierId) ?? "—", date: i.date, dueDate: i.dueDate, total, paid, rest: round2(Math.max(0, total - paid)) };
    });
    const position = consolidatedPosition(t.accounts, t.allMovements, t.fx, today);

    /** Flux attendus issus des données (créances, dettes, demandes programmées, échéances d'emprunt) + hypothèses (engagements récurrents). */
    const expectedFlows = (horizonEnd: string): Flow[] => {
      const flows: Flow[] = [];
      for (const r of receivables) if (r.rest > 0 && !t.disputes.includes(r.invoiceId)) flows.push({ date: r.expected, amount: r.rest, bucket: "collections", origin: "Données" });
      const reqByInv = new Map<string, number>();
      for (const q of t.requests) {
        if (q.status !== "Programmé" && q.status !== "En attente de validation") continue;
        if (q.invoiceId) reqByInv.set(q.invoiceId, (reqByInv.get(q.invoiceId) ?? 0) + q.amount);
        flows.push({ date: q.plannedDate, amount: toMad(q.amount, t.accounts.find((a) => a.id === q.accountId)?.currency ?? "MAD", t.fx) ?? q.amount, bucket: bucketOf(q.category), origin: "Données" });
      }
      for (const p of payables) {
        const rest = round2(p.rest - (reqByInv.get(p.invoiceId) ?? 0));
        if (rest > 0) flows.push({ date: p.dueDate, amount: rest, bucket: "supplier", origin: "Données" });
      }
      for (const l of t.loans) if (l.status === "En cours") for (const r of loanSchedule(l)) if (r.date > today && r.date <= horizonEnd) flows.push({ date: r.date, amount: r.total, bucket: "debt", origin: "Données" });
      for (const c of t.commitments) for (const d of commitmentFlows(c, addDays(today, 1), horizonEnd)) flows.push({ date: d, amount: c.amount, bucket: bucketOf(c.category), origin: "Hypothèse" });
      return flows;
    };
    const forecast = (days: number, gran: Granularity, sc: Scenario) => {
      const end = addDays(today, days - 1);
      return buildForecast(position.available, applyScenario(expectedFlows(end), sc, today, end), today, days, gran);
    };
    return { today, receivables, payables, position, expectedFlows, forecast };
  }, [t.accounts, t.allMovements, t.fx, t.requests, t.loans, t.commitments, t.disputes, t.expectedDates, sales.invoices, sales.collections, sales.customers, purchase.invoices, purchase.payments, purchase.suppliers, today]);
}

export type Alert = { level: "critique" | "attention" | "info"; title: string; detail: string };
export function useAlerts(): Alert[] {
  const t = useTreasury();
  const d = useTreasuryData();
  return useMemo(() => {
    const out: Alert[] = [];
    const { rules } = t;
    if (d.position.available < rules.minCash) out.push({ level: "critique", title: "Trésorerie disponible sous le seuil", detail: `${d.position.available.toLocaleString("fr-FR")} DH < seuil ${rules.minCash.toLocaleString("fr-FR")} DH` });
    for (const a of t.accounts) {
      if (a.status !== "Actif") continue;
      const bal = t.allMovements.filter((m) => m.accountId === a.id && m.status === "Validé").reduce((s, m) => s + (m.direction === "in" ? m.amount : -m.amount), a.openingBalance);
      if (bal < a.minBalance) out.push({ level: "attention", title: `${a.name} sous son solde minimum`, detail: `${Math.round(bal).toLocaleString("fr-FR")} ${a.currency} < ${a.minBalance.toLocaleString("fr-FR")}` });
    }
    const soon = addDays(d.today, rules.upcomingDays);
    const up = d.payables.filter((p) => p.rest > 0 && p.dueDate >= d.today && p.dueDate <= soon);
    if (up.length) out.push({ level: "attention", title: `${up.length} paiement(s) fournisseur sous ${rules.upcomingDays} jours`, detail: `${Math.round(up.reduce((s, p) => s + p.rest, 0)).toLocaleString("fr-FR")} DH à décaisser` });
    const late = d.receivables.filter((r) => r.rest > 0 && r.dueDate < d.today);
    if (late.length) out.push({ level: "attention", title: `${late.length} encaissement(s) client en retard`, detail: `${Math.round(late.reduce((s, r) => s + r.rest, 0)).toLocaleString("fr-FR")} DH échus non encaissés` });
    const fc = d.forecast(90, "Semaine", t.scenarios.Central);
    const neg = fc.find((r) => r.closing < 0);
    if (neg) out.push({ level: "critique", title: "Position prévisionnelle négative", detail: `Semaine ${neg.label} : ${Math.round(neg.closing).toLocaleString("fr-FR")} DH (scénario central)` });
    else {
      const low = fc.find((r) => r.closing < rules.minCash);
      if (low) out.push({ level: "attention", title: "Prévision sous le seuil minimum", detail: `Semaine ${low.label} : ${Math.round(low.closing).toLocaleString("fr-FR")} DH` });
    }
    const matched = new Set(t.matches.flatMap((m) => m.statementIds));
    const unrec = t.statements.filter((s) => !matched.has(s.id)).length;
    if (unrec) out.push({ level: "info", title: `${unrec} ligne(s) de relevé non rapprochée(s)`, detail: "À traiter dans Rapprochement bancaire" });
    const byCat = new Map<string, number[]>();
    for (const m of t.allMovements) if (m.status === "Validé" && m.category !== "Virement interne") byCat.set(m.category, [...(byCat.get(m.category) ?? []), m.amount]);
    for (const m of t.allMovements) {
      if (m.status !== "Validé" || m.date < addDays(d.today, -30)) continue;
      const arr = byCat.get(m.category) ?? [];
      if (arr.length < 4) continue;
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      if (m.amount > avg * rules.unusualFactor) out.push({ level: "info", title: "Mouvement inhabituel", detail: `${m.ref} — ${m.label} : ${Math.round(m.amount).toLocaleString("fr-FR")} (moyenne ${Math.round(avg).toLocaleString("fr-FR")})` });
    }
    return out;
  }, [t, d]);
}
