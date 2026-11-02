import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/app/ui-bits";
import { Select, thead, trow } from "@/components/budget/ui";
import { cn } from "@/lib/utils";
import { useSales } from "@/lib/sales/store";
import { collected, invoiceTotals } from "@/lib/sales/model";
import { usePurchase } from "@/lib/purchase/store";
import { invoiceTtc, paidAmount } from "@/lib/purchase/model";
import { useCompta } from "@/lib/compta/store";
import { AGING_BUCKETS, agingBucket, daysLate, fmtMad, net, balances, type AgingBucket } from "@/lib/compta/model";
import { Amt, NoData, Note, SubNav, Tag, num } from "./ui";

type Row = { tiers: string; ref: string; date: string; due: string; initial: number; paid: number; rest: number; late: number; bucket: AgingBucket; status: string };

export function ReceivablesTab() {
  const sales = useSales();
  const purchase = usePurchase();
  const { entries } = useCompta();
  const [side, setSide] = useState<"clients" | "fournisseurs">("clients");
  const [filter, setFilter] = useState<"all" | AgingBucket>("all");
  const today = new Date().toISOString().slice(0, 10);

  const clients: Row[] = useMemo(() => sales.invoices.map((i) => {
    const initial = invoiceTotals(i).ttc, paid = collected(i.id, sales.collections), rest = Math.max(0, initial - paid), late = rest > 0 ? daysLate(i.dueDate, today) : 0;
    return { tiers: sales.customers.find((c) => c.id === i.customerId)?.name ?? "Client inconnu", ref: i.number, date: i.date, due: i.dueDate, initial, paid, rest, late, bucket: agingBucket(late), status: rest <= 0 ? "Réglée" : late > 0 ? "En retard" : paid > 0 ? "Partielle" : "Non échue" };
  }), [sales, today]);
  const suppliers: Row[] = useMemo(() => purchase.invoices.map((i) => {
    const initial = invoiceTtc(i), paid = paidAmount(i.id, purchase.payments), rest = Math.max(0, initial - paid), late = rest > 0 ? daysLate(i.dueDate, today) : 0;
    return { tiers: purchase.suppliers.find((s) => s.id === i.supplierId)?.name ?? "Fournisseur inconnu", ref: i.reference, date: i.date, due: i.dueDate, initial, paid, rest, late, bucket: agingBucket(late), status: rest <= 0 ? "Payée" : late > 0 ? "En retard" : paid > 0 ? "Partielle" : "Non échue" };
  }), [purchase, today]);

  const rows = side === "clients" ? clients : suppliers;
  const open = rows.filter((r) => r.rest > 0);
  const shown = rows.filter((r) => filter === "all" || (r.rest > 0 && r.bucket === filter)).sort((a, b) => b.late - a.late);
  const aging = AGING_BUCKETS.map((b) => ({ b, v: open.filter((r) => r.bucket === b).reduce((s, r) => s + r.rest, 0), n: open.filter((r) => r.bucket === b).length }));
  const totalOpen = open.reduce((s, r) => s + r.rest, 0);
  const glBal = useMemo(() => { const bal = balances(entries, { year: 2026, to: 11 }); return side === "clients" ? net(bal, "342") : -net(bal, "441"); }, [entries, side]);

  return (
    <div className="space-y-5">
      <SubNav items={[{ id: "clients", label: "Créances clients" }, { id: "fournisseurs", label: "Dettes fournisseurs" }]} value={side} onChange={(v) => { setSide(v); setFilter("all"); }} />
      <Note>Source : factures et règlements des modules <Link to={side === "clients" ? "/ventes" : "/achats"} className="font-semibold text-primary hover:underline">{side === "clients" ? "Ventes & Clients" : "Achats & Fournisseurs"}</Link>. La création des factures et l'enregistrement des règlements restent dans ces modules.</Note>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {aging.map((a) => (
          <button key={a.b} onClick={() => setFilter(filter === a.b ? "all" : a.b)} className={cn("card-elevated p-4 text-left transition-colors", filter === a.b && "ring-2 ring-primary")}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{a.b}</p>
            <p className={cn("mt-2 font-display text-lg font-extrabold", a.b !== "Non échues" && a.v > 0 && "text-destructive")}>{fmtMad(a.v, 0)}</p>
            <p className="text-xs text-muted-foreground">{a.n} facture(s) · {totalOpen ? ((a.v / totalOpen) * 100).toFixed(0) : 0} %</p>
          </button>
        ))}
        <div className="card-elevated p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total ouvert</p>
          <p className="mt-2 font-display text-lg font-extrabold">{fmtMad(totalOpen, 0)}</p>
          <p className="text-xs text-muted-foreground">Compte {side === "clients" ? "3421" : "4411"} (GL) : {fmtMad(glBal, 0)}</p>
        </div>
      </div>
      <Note tone="warn">Rapprochement : les factures des modules Ventes/Achats ({fmtMad(totalOpen, 0)}) ne sont pas encore comptabilisées automatiquement dans le grand livre ({fmtMad(glBal, 0)}). L'écart de {fmtMad(Math.abs(glBal - totalOpen), 0)} doit être justifié avant clôture.</Note>
      <Panel title={side === "clients" ? "Créances clients" : "Dettes fournisseurs"} subtitle={`${shown.length} facture(s)${filter !== "all" ? ` — tranche ${filter}` : ""}`} action={<Select value={filter} onChange={(e) => setFilter(e.target.value as "all")}><option value="all">Toutes</option>{AGING_BUCKETS.map((b) => <option key={b}>{b}</option>)}</Select>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={thead}><tr><th className="py-2.5 pr-3">{side === "clients" ? "Client" : "Fournisseur"}</th><th className="pr-3">Référence</th><th className="pr-3">Date</th><th className="pr-3">Échéance</th><th className={num + " pr-3"}>Montant initial</th><th className={num + " pr-3"}>Réglé</th><th className={num + " pr-3"}>Solde</th><th className={num + " pr-3"}>Retard</th><th className="pr-3">Statut</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.ref} className={trow}>
                  <td className="py-2 pr-3">{r.tiers}</td><td className="pr-3 font-mono text-xs">{r.ref}</td>
                  <td className="pr-3 text-muted-foreground">{new Date(r.date).toLocaleDateString("fr-FR")}</td><td className="pr-3 text-muted-foreground">{new Date(r.due).toLocaleDateString("fr-FR")}</td>
                  <Amt v={r.initial} /><Amt v={r.paid} /><Amt v={r.rest} className="font-semibold" />
                  <td className={cn("pr-3", num, r.late > 0 && "text-destructive")}>{r.late > 0 ? `${r.late} j` : "—"}</td>
                  <td className="pr-3"><Tag tone={r.status === "En retard" ? "bad" : r.status === "Réglée" || r.status === "Payée" ? "good" : r.status === "Partielle" ? "warn" : "muted"}>{r.status}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <NoData>Aucune facture dans cette tranche.</NoData>}
        </div>
      </Panel>
    </div>
  );
}
