import { useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, Banknote, Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field, Select } from "@/components/budget/ui";
import { useStock, sid } from "@/lib/stock/store";
import { usePurchase } from "@/lib/purchase/store";
import {
  addDays, INVOICE_STATUSES, invoiceStatus, invoiceTtc, linesTotals, matchInvoice, outstanding, paidAmount, PAYMENT_METHODS, round2, termDays, validatePayment,
  type Invoice, type Payment, type PaymentMethod,
} from "@/lib/purchase/model";
import { Badge, fdate, fmt2, IconBtn, InvoiceBadge, rowCls, Table, Td, Th, today } from "./ui";

export function InvoicesTab() {
  const { invoices, payments, suppliers, upsertInvoice } = usePurchase();
  const { orders } = useStock();
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Invoice | "new" | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const sName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const rows = useMemo(
    () => invoices.map((i) => ({ i, st: invoiceStatus(i, payments, today()) })).filter((r) => status === "all" || r.st === status).sort((a, b) => b.i.date.localeCompare(a.i.date)),
    [invoices, payments, status],
  );

  return (
    <Panel title="Factures fournisseurs" subtitle="Rapprochement facture ↔ commande ↔ réception sur le montant HT" action={<Btn onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouvelle facture</Btn>}>
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 max-w-xs">
        <option value="all">Tous les statuts</option>
        {INVOICE_STATUSES.map((s) => <option key={s}>{s}</option>)}
      </Select>
      <Table empty={rows.length === 0} head={<><Th>Référence</Th><Th>Fournisseur</Th><Th>Commande</Th><Th>Date</Th><Th>Échéance</Th><Th right>HT</Th><Th right>TVA</Th><Th right>TTC</Th><Th right>Payé</Th><Th right>Reste</Th><Th>Rapprochement</Th><Th>Statut</Th><Th /></>}>
        {rows.map(({ i, st }) => {
          const order = orders.find((o) => o.id === i.orderId);
          const m = matchInvoice(i, order);
          return (
            <tr key={i.id} className={rowCls}>
              <Td strong>{i.reference}</Td>
              <Td>{sName(i.supplierId)}</Td>
              <Td muted>{order?.number ?? "—"}</Td>
              <Td muted>{fdate(i.date)}</Td>
              <Td muted>{fdate(i.dueDate)}</Td>
              <Td right>{fmt2(i.ht)}</Td>
              <Td right muted>{fmt2(i.tva)}</Td>
              <Td right strong>{fmt2(invoiceTtc(i))}</Td>
              <Td right muted>{fmt2(paidAmount(i.id, payments))}</Td>
              <Td right strong>{fmt2(outstanding(i, payments))}</Td>
              <Td>{!m ? <Badge t="muted">Sans commande</Badge> : Math.abs(m.gap) < 0.01 ? <Badge t="good">Conforme</Badge> : <Badge t="warn" >{m.gap > 0 ? "+" : ""}{fmt2(m.gap)} vs reçu</Badge>}</Td>
              <Td><InvoiceBadge s={st} /></Td>
              <Td className="whitespace-nowrap">
                {!i.validated && <IconBtn title="Valider la facture" onClick={() => upsertInvoice({ ...i, validated: true })}><BadgeCheck className="h-4 w-4" /></IconBtn>}
                {paidAmount(i.id, payments) === 0 && <IconBtn title="Modifier" onClick={() => setEditing(i)}><Pencil className="h-4 w-4" /></IconBtn>}
                {i.validated && st !== "Payée" && <IconBtn title="Enregistrer un règlement" onClick={() => setPaying(i)}><Banknote className="h-4 w-4" /></IconBtn>}
              </Td>
            </tr>
          );
        })}
      </Table>
      {editing && <InvoiceDialog invoice={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {paying && <PaymentDialog invoice={paying} onClose={() => setPaying(null)} />}
    </Panel>
  );
}

function InvoiceDialog({ invoice, onClose }: { invoice?: Invoice | undefined; onClose: () => void }) {
  const { invoices, suppliers, upsertInvoice } = usePurchase();
  const { orders } = useStock();
  const [f, setF] = useState<Invoice>(() => invoice ?? { id: sid("F"), reference: "", supplierId: "", date: today(), dueDate: addDays(today(), 60), ht: 0, tva: 0, validated: false });
  const [err, setErr] = useState("");
  const set = <K extends keyof Invoice>(k: K, v: Invoice[K]) => setF((x) => ({ ...x, [k]: v }));
  const supplier = suppliers.find((s) => s.id === f.supplierId);
  const supplierOrders = orders.filter((o) => o.supplier === supplier?.name && o.status !== "Annulée");

  const pickOrder = (id: string) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return setF((x) => ({ ...x, orderId: undefined }));
    // pré-remplit avec le montant réceptionné (facturation sur reçu)
    const t = linesTotals(o.lines.map((l) => ({ ...l, quantity: l.received })));
    setF((x) => ({ ...x, orderId: id, ht: t.ht, tva: t.tva }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.reference.trim() || !f.supplierId) return setErr("Référence et fournisseur obligatoires.");
    if (invoices.some((i) => i.id !== f.id && i.supplierId === f.supplierId && i.reference.trim().toLowerCase() === f.reference.trim().toLowerCase())) return setErr("Cette facture est déjà enregistrée pour ce fournisseur.");
    if (!(f.ht > 0) || f.tva < 0) return setErr("Montant HT > 0 et TVA positive obligatoires.");
    if (f.dueDate < f.date) return setErr("L'échéance ne peut pas précéder la date de facture.");
    upsertInvoice({ ...f, reference: f.reference.trim(), ht: round2(f.ht), tva: round2(f.tva) });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{invoice ? `Modifier ${invoice.reference}` : "Nouvelle facture fournisseur"}</DialogTitle>
          <DialogDescription>Liez la facture à une commande pour contrôler l'écart avec les quantités réceptionnées.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="N° de facture fournisseur *" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
            <Select
              label="Fournisseur *"
              value={f.supplierId}
              onChange={(e) => {
                const s = suppliers.find((x) => x.id === e.target.value);
                setF((x) => ({ ...x, supplierId: e.target.value, orderId: undefined, dueDate: addDays(x.date, termDays(s?.paymentTerms ?? "60")) }));
              }}
            >
              <option value="">— Choisir —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Commande liée" value={f.orderId ?? ""} onChange={(e) => pickOrder(e.target.value)} disabled={!supplier}>
              <option value="">Aucune</option>
              {supplierOrders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
            </Select>
            <Field label="Date de facture" type="date" value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value, dueDate: addDays(e.target.value, termDays(supplier?.paymentTerms ?? "60")) }))} />
            <Field label="Montant HT (DH) *" type="number" step="0.01" min={0} value={f.ht} onChange={(e) => set("ht", Number(e.target.value))} />
            <Field label="TVA (DH)" type="number" step="0.01" min={0} value={f.tva} onChange={(e) => set("tva", Number(e.target.value))} />
            <Field label="Échéance" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            <div className="flex items-end pb-2 text-sm font-semibold text-foreground">TTC : {fmt2(invoiceTtc(f))}</div>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">{invoice ? "Enregistrer" : "Enregistrer la facture"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { payments, addPayment } = usePurchase();
  const rest = outstanding(invoice, payments);
  const [f, setF] = useState<Payment>(() => ({ id: sid("PAY"), invoiceId: invoice.id, date: today(), amount: rest, method: "Virement", reference: "" }));
  const [err, setErr] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Règlement — {invoice.reference}</DialogTitle>
          <DialogDescription>Enregistrement comptable uniquement : aucun virement bancaire n'est exécuté. Reste à payer : {fmt2(rest)}.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validatePayment(f.amount, rest);
            if (v) return setErr(v);
            addPayment({ ...f, amount: round2(f.amount) });
            onClose();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <Field label="Montant (DH)" type="number" step="0.01" min={0} max={rest} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
            <Select label="Mode de paiement" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentMethod })}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </Select>
            <Field label="Référence (n° chèque, virement…)" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">Enregistrer le règlement</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
