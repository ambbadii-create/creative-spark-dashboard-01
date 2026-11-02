import { useMemo, useState } from "react";
import { Banknote, Eye, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Select } from "@/components/budget/ui";
import { useStock } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import { collected, invoiceOutstanding, invoiceStatus, invoiceTotals, lineNet, type SalesInvoice } from "@/lib/sales/model";
import { CollectionDialog } from "./CollectionDialog";
import { fdate, fmt2, IconBtn, rowCls, SalesInvoiceBadge, Table, Td, Th, today } from "./ui";

export function InvoicesTab() {
  const { invoices, customers, collections } = useSales();
  const [q, setQ] = useState("");
  const [st, setSt] = useState("all");
  const [paying, setPaying] = useState<SalesInvoice | null>(null);
  const [viewing, setViewing] = useState<SalesInvoice | null>(null);
  const now = today();
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";

  const rows = useMemo(
    () =>
      invoices
        .filter((i) => (st === "all" || invoiceStatus(i, collections, now) === st) && `${i.number} ${cName(i.customerId)}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, collections, q, st, customers, now],
  );

  return (
    <div className="space-y-5">
      <Panel title="Factures clients" subtitle="Facturation du livré — suivi des règlements et des restes dus">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de facture, client" className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring" />
          </label>
          <Select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="all">Tous statuts</option>
            {["Émise", "Partiellement réglée", "Réglée", "En retard"].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <Table empty={rows.length === 0} head={<><Th>N°</Th><Th>Client</Th><Th>Date</Th><Th>Échéance</Th><Th right>TTC</Th><Th right>Encaissé</Th><Th right>Reste</Th><Th>Statut</Th><Th /></>}>
          {rows.map((i) => {
            const t = invoiceTotals(i).ttc;
            const rest = invoiceOutstanding(i, collections);
            const s = invoiceStatus(i, collections, now);
            return (
              <tr key={i.id} className={rowCls}>
                <Td strong>{i.number}</Td>
                <Td>{cName(i.customerId)}</Td>
                <Td muted>{fdate(i.date)}</Td>
                <Td muted>{fdate(i.dueDate)}</Td>
                <Td right>{fmt2(t)}</Td>
                <Td right muted>{fmt2(t - rest)}</Td>
                <Td right strong={rest > 0}>{fmt2(rest)}</Td>
                <Td><SalesInvoiceBadge s={s} /></Td>
                <Td className="whitespace-nowrap">
                  <IconBtn title="Détail" onClick={() => setViewing(i)}><Eye className="h-4 w-4" /></IconBtn>
                  {rest > 0 && <IconBtn title="Encaisser" onClick={() => setPaying(i)}><Banknote className="h-4 w-4" /></IconBtn>}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      {paying && <CollectionDialog invoice={paying} onClose={() => setPaying(null)} />}
      {viewing && <InvoiceView invoice={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function InvoiceView({ invoice: i, onClose }: { invoice: SalesInvoice; onClose: () => void }) {
  const { products } = useStock();
  const { customers, orders, collections } = useSales();
  const c = customers.find((x) => x.id === i.customerId);
  const o = orders.find((x) => x.id === i.orderId);
  const t = invoiceTotals(i);
  const cols = collections.filter((x) => x.invoiceId === i.id);
  const pName = (id: string) => { const p = products.find((x) => x.id === id); return p ? `${p.ref} · ${p.designation}` : id; };
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{i.number} · {c?.name ?? "—"}</DialogTitle>
          <DialogDescription>
            Du {fdate(i.date)} · échéance {fdate(i.dueDate)} · <SalesInvoiceBadge s={invoiceStatus(i, collections, today())} />
            {o && <> · commande {o.number}</>}
          </DialogDescription>
        </DialogHeader>
        {c && <p className="text-xs text-muted-foreground">ICE {c.ice || "—"} · {c.address} {c.city} · Conditions : {c.paymentTerms}</p>}
        <Table head={<><Th>Article</Th><Th right>Qté</Th><Th right>Prix HT</Th><Th right>Remise</Th><Th right>TVA</Th><Th right>Total HT</Th></>}>
          {i.lines.map((l, x) => (
            <tr key={x} className={rowCls}>
              <Td>{pName(l.productId)}</Td>
              <Td right>{l.quantity}</Td>
              <Td right>{fmt2(l.unitPrice)}</Td>
              <Td right>{l.discount ? `${l.discount} %` : "—"}</Td>
              <Td right>{l.vatRate ?? 20} %</Td>
              <Td right>{fmt2(lineNet(l))}</Td>
            </tr>
          ))}
        </Table>
        <div className="flex justify-end gap-6 text-sm">
          <span className="text-muted-foreground">HT <strong className="text-foreground">{fmt2(t.ht)}</strong></span>
          <span className="text-muted-foreground">TVA <strong className="text-foreground">{fmt2(t.tva)}</strong></span>
          <span className="text-muted-foreground">TTC <strong className="text-foreground">{fmt2(t.ttc)}</strong></span>
        </div>
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Encaissements ({fmt2(collected(i.id, collections))} / {fmt2(t.ttc)})</p>
          {cols.length === 0 ? <p className="text-xs text-muted-foreground">Aucun règlement.</p> : cols.map((x) => (
            <p key={x.id} className="text-foreground">{fdate(x.date)} · {x.method} · {x.reference} · <strong>{fmt2(x.amount)}</strong></p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
