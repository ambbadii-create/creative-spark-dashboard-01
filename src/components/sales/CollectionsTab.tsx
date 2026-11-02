import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Select, StatCard, fmt } from "@/components/budget/ui";
import { useSales } from "@/lib/sales/store";
import { avgCollectionDelay, invoiceOutstanding, invoiceStatus, round2, type Collection, type SalesInvoice } from "@/lib/sales/model";
import { CollectionDialog } from "./CollectionDialog";
import { fdate, fmt2, rowCls, SalesInvoiceBadge, Table, Td, Th, today } from "./ui";

const BUCKETS = ["Non échues", "1–30 jours", "31–60 jours", "61–90 jours", "Plus de 90 jours"] as const;

export function CollectionsTab() {
  const { collections, invoices, customers } = useSales();
  const [q, setQ] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [paying, setPaying] = useState<SalesInvoice | null>(null);
  const now = today();
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const invOf = (id: string) => invoices.find((i) => i.id === id);

  const unpaid = invoices.filter((i) => invoiceOutstanding(i, collections) > 0);
  const overdue = unpaid.filter((i) => i.dueDate < now);
  const totalDue = unpaid.reduce((a, i) => a + invoiceOutstanding(i, collections), 0);
  const totalLate = overdue.reduce((a, i) => a + invoiceOutstanding(i, collections), 0);
  const monthCollected = collections.filter((c) => c.date.startsWith(now.slice(0, 7))).reduce((a, c) => a + c.amount, 0);

  const aging = useMemo(() => {
    const buckets = BUCKETS.map((name) => ({ name, amount: 0, count: 0 }));
    for (const i of unpaid) {
      const rest = invoiceOutstanding(i, collections);
      const days = Math.floor((new Date(now).getTime() - new Date(i.dueDate).getTime()) / 86_400_000);
      const idx = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
      buckets[idx]!.amount = round2(buckets[idx]!.amount + rest);
      buckets[idx]!.count += 1;
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, collections, now]);

  const rows = useMemo(
    () =>
      collections
        .filter((c) => {
          const i = invOf(c.invoiceId);
          return `${c.reference} ${i?.number ?? ""} ${i ? cName(i.customerId) : ""}`.toLowerCase().includes(q.toLowerCase());
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collections, invoices, q, customers],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Encaissé ce mois" value={fmt(monthCollected)} sub="Tous modes de règlement" />
        <StatCard label="Créances en cours" value={fmt(totalDue)} sub={`${unpaid.length} facture(s) non soldée(s)`} />
        <StatCard label="Dont en retard" value={fmt(totalLate)} sub={`${overdue.length} facture(s) échue(s)`} tone={overdue.length > 0 ? "bad" : undefined} />
        <StatCard label="Délai moyen" value={avgDelay(invoices, collections)} sub="Entre facture et encaissement" />
      </div>

      <Panel title="Balance âgée des créances" subtitle="Reste dû par ancienneté de dépassement">
        <div className="grid gap-3 sm:grid-cols-5">
          {aging.map((b, i) => (
            <div key={b.name} className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">{b.name}</p>
              <p className={`mt-1 font-bold ${i >= 3 && b.amount > 0 ? "text-destructive" : "text-foreground"}`}>{fmt(b.amount)}</p>
              <p className="text-[11px] text-muted-foreground">{b.count} facture(s)</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Encaissements"
        subtitle="Règlements clients — virement, chèque, effet, espèces"
        action={
          <div className="flex items-center gap-2">
            <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-64">
              <option value="">Facture à encaisser…</option>
              {unpaid.map((i) => <option key={i.id} value={i.id}>{i.number} · {cName(i.customerId)} · {fmt2(invoiceOutstanding(i, collections))}</option>)}
            </Select>
            <Btn disabled={!invoiceId} onClick={() => { const inv = invOf(invoiceId); if (inv) setPaying(inv); }}>
              <Plus className="h-4 w-4" /> Encaisser
            </Btn>
          </div>
        }
      >
        <div className="mb-4 max-w-sm">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence, facture, client" className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring" />
          </label>
        </div>
        <Table empty={rows.length === 0} head={<><Th>Référence</Th><Th>Facture</Th><Th>Client</Th><Th>Date</Th><Th>Mode</Th><Th right>Montant</Th><Th>Statut facture</Th></>}>
          {rows.map((c) => {
            const i = invOf(c.invoiceId);
            return (
              <tr key={c.id} className={rowCls}>
                <Td strong>{c.reference || "—"}</Td>
                <Td muted>{i?.number ?? "—"}</Td>
                <Td>{i ? cName(i.customerId) : "—"}</Td>
                <Td muted>{fdate(c.date)}</Td>
                <Td muted>{c.method}</Td>
                <Td right>{fmt2(c.amount)}</Td>
                <Td>{i && <SalesInvoiceBadge s={invoiceStatus(i, collections, now)} />}</Td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      {paying && <CollectionDialog invoice={paying} onClose={() => { setPaying(null); setInvoiceId(""); }} />}
    </div>
  );
}

function avgDelay(invoices: SalesInvoice[], cols: Collection[]) {
  const d = avgCollectionDelay(invoices, cols);
  return d === null ? "n.c." : `${d} j`;
}
