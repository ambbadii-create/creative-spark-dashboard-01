import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Ban, Eye, FileText, Plus, Search, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field, Select } from "@/components/budget/ui";
import { useStock } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import { addDays, invoiceableLines, lineNet, orderStatus, remainingToDeliver, totals, type Quote, type SalesLine, type SalesOrder } from "@/lib/sales/model";
import { DeliverDialog } from "./DeliverDialog";
import { LinesEditor } from "./LinesEditor";
import { fdate, fmt2, IconBtn, OrderBadge, rowCls, Table, Td, Th, today } from "./ui";

export function OrdersTab({ newSignal, seedQuote, onSeedConsumed }: { newSignal: number; seedQuote: Quote | null; onSeedConsumed: () => void }) {
  const { orders, customers } = useSales();
  const [q, setQ] = useState("");
  const [st, setSt] = useState("all");
  const [creating, setCreating] = useState<Quote | null | "new">(null);
  const [delivering, setDelivering] = useState<SalesOrder | null>(null);
  const [viewing, setViewing] = useState<SalesOrder | null>(null);
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";

  useEffect(() => {
    if (newSignal > 0) setCreating("new");
  }, [newSignal]);
  useEffect(() => {
    if (seedQuote) {
      setCreating(seedQuote);
      onSeedConsumed();
    }
  }, [seedQuote, onSeedConsumed]);

  const rows = useMemo(
    () =>
      orders
        .filter((o) => {
          const s = orderStatus(o);
          return (st === "all" || s === st) && `${o.number} ${cName(o.customerId)}`.toLowerCase().includes(q.toLowerCase());
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, q, st, customers],
  );

  return (
    <div className="space-y-5">
      <Panel title="Commandes clients" subtitle="Confirmation, livraison partielle, facturation — plafond de crédit contrôlé à la création" action={<Btn onClick={() => setCreating("new")}><Plus className="h-4 w-4" /> Nouvelle commande</Btn>}>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de commande, client" className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring" />
          </label>
          <Select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="all">Tous statuts</option>
            {["Confirmée", "Partiellement livrée", "Livrée", "Facturée", "Annulée"].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <Table empty={rows.length === 0} head={<><Th>N°</Th><Th>Client</Th><Th>Date</Th><Th>Livraison souhaitée</Th><Th right>TTC</Th><Th right>Livré</Th><Th>Statut</Th><Th /></>}>
          {rows.map((o) => {
            const s = orderStatus(o);
            const ordered = o.lines.reduce((a, l) => a + l.quantity, 0);
            const shipped = o.lines.reduce((a, l) => a + l.delivered, 0);
            return (
              <tr key={o.id} className={rowCls}>
                <Td strong>{o.number}</Td>
                <Td>{cName(o.customerId)}</Td>
                <Td muted>{fdate(o.date)}</Td>
                <Td muted>{fdate(o.deliveryDate)}</Td>
                <Td right>{fmt2(totals(o.lines).ttc)}</Td>
                <Td right muted>{ordered ? Math.round((shipped / ordered) * 100) : 0} %</Td>
                <Td><OrderBadge s={s} /></Td>
                <Td className="whitespace-nowrap">
                  <IconBtn title="Détail" onClick={() => setViewing(o)}><Eye className="h-4 w-4" /></IconBtn>
                  {(s === "Confirmée" || s === "Partiellement livrée") && <IconBtn title="Livrer" onClick={() => setDelivering(o)}><Truck className="h-4 w-4" /></IconBtn>}
                  {invoiceableLines(o).length > 0 && <InvoiceBtn order={o} />}
                  {s === "Confirmée" && <CancelBtn order={o} />}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      {creating && <OrderDialog quote={creating === "new" ? undefined : creating} onClose={() => setCreating(null)} />}
      {delivering && <DeliverDialog order={delivering} onClose={() => setDelivering(null)} />}
      {viewing && <OrderView order={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function InvoiceBtn({ order }: { order: SalesOrder }) {
  const { invoiceOrder } = useSales();
  const [err, setErr] = useState("");
  return (
    <span title={err || "Facturer le livré"}>
      <IconBtn title="Facturer le livré" onClick={() => setErr(invoiceOrder(order.id) ?? "")}>
        <FileText className="h-4 w-4" />
      </IconBtn>
    </span>
  );
}

function CancelBtn({ order }: { order: SalesOrder }) {
  const { cancelOrder } = useSales();
  return (
    <IconBtn title="Annuler la commande" danger onClick={() => { if (window.confirm(`Annuler la commande ${order.number} ?`)) cancelOrder(order.id); }}>
      <Ban className="h-4 w-4" />
    </IconBtn>
  );
}

function OrderDialog({ quote, onClose }: { quote?: Quote | undefined; onClose: () => void }) {
  const { customers, createOrder } = useSales();
  const now = today();
  const [customerId, setCustomerId] = useState(quote?.customerId ?? customers[0]?.id ?? "");
  const [deliveryDate, setDeliveryDate] = useState(addDays(now, 7));
  const [lines, setLines] = useState<SalesLine[]>(quote?.lines ?? []);
  const [err, setErr] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = createOrder(customerId, lines, deliveryDate, quote?.id);
    if (err) return setErr(err);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? `Convertir ${quote.number} en commande` : "Nouvelle commande client"}</DialogTitle>
          <DialogDescription>Le plafond de crédit du client est contrôlé avant confirmation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Select label="Client *" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={!!quote}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </Select>
            <Field label="Livraison souhaitée" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
          <LinesEditor lines={lines} onChange={setLines} />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">{quote ? "Convertir en commande" : "Créer la commande"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderView({ order: o, onClose }: { order: SalesOrder; onClose: () => void }) {
  const { products } = useStock();
  const { customers, quotes, deliveries, invoices } = useSales();
  const c = customers.find((x) => x.id === o.customerId);
  const t = totals(o.lines);
  const pName = (id: string) => { const p = products.find((x) => x.id === id); return p ? `${p.ref} · ${p.designation}` : id; };
  const oDel = deliveries.filter((d) => d.orderId === o.id);
  const oInv = invoices.filter((i) => i.orderId === o.id);
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{o.number} · {c?.name ?? "—"}</DialogTitle>
          <DialogDescription>
            Du {fdate(o.date)} · livraison souhaitée {fdate(o.deliveryDate)} · <OrderBadge s={orderStatus(o)} />
            {o.quoteId && <> · devis {quotes.find((q) => q.id === o.quoteId)?.number ?? ""}</>}
          </DialogDescription>
        </DialogHeader>
        <Table head={<><Th>Article</Th><Th right>Commandé</Th><Th right>Livré</Th><Th right>Reste</Th><Th right>Facturé</Th><Th right>Total HT</Th></>}>
          {o.lines.map((l, i) => (
            <tr key={i} className={rowCls}>
              <Td>{pName(l.productId)}</Td>
              <Td right>{l.quantity}</Td>
              <Td right>{l.delivered}</Td>
              <Td right>{remainingToDeliver(l)}</Td>
              <Td right>{l.invoiced}</Td>
              <Td right>{fmt2(lineNet(l))}</Td>
            </tr>
          ))}
        </Table>
        <div className="flex justify-end gap-6 text-sm">
          <span className="text-muted-foreground">HT <strong className="text-foreground">{fmt2(t.ht)}</strong></span>
          <span className="text-muted-foreground">TVA <strong className="text-foreground">{fmt2(t.tva)}</strong></span>
          <span className="text-muted-foreground">TTC <strong className="text-foreground">{fmt2(t.ttc)}</strong></span>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-lg bg-muted p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Bons de livraison</p>
            {oDel.length === 0 ? <p className="text-xs text-muted-foreground">Aucun.</p> : oDel.map((d) => <p key={d.id} className="text-foreground">{d.number} · {fdate(d.date)}</p>)}
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Factures</p>
            {oInv.length === 0 ? <p className="text-xs text-muted-foreground">Aucune.</p> : oInv.map((i) => <p key={i.id} className="text-foreground">{i.number} · {fdate(i.date)}</p>)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
