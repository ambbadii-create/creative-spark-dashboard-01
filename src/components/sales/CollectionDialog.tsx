import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Btn, Field, Select } from "@/components/budget/ui";
import { sid } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import { invoiceOutstanding, invoiceTotals, PAYMENT_METHODS, type PaymentMethod, type SalesInvoice } from "@/lib/sales/model";
import { fdate, fmt2, today } from "./ui";

/** Encaissement total ou partiel sur une facture (jamais au-delà du reste dû). */
export function CollectionDialog({ invoice, onClose }: { invoice: SalesInvoice; onClose: () => void }) {
  const { customers, collections, addCollection } = useSales();
  const rest = invoiceOutstanding(invoice, collections);
  const [amount, setAmount] = useState(rest);
  const [method, setMethod] = useState<PaymentMethod>("Virement");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState("");
  const c = customers.find((x) => x.id === invoice.customerId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = addCollection({ id: sid("E"), invoiceId: invoice.id, date, amount, method, reference: reference.trim() || `ENC-${invoice.number}` });
    if (err) return setErr(err);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Encaisser {invoice.number}</DialogTitle>
          <DialogDescription>
            {c?.name ?? "—"} · TTC {fmt2(invoiceTotals(invoice).ttc)} · échéance {fdate(invoice.dueDate)} · reste dû <strong>{fmt2(rest)}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant (DH) *" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select label="Mode de règlement" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </Select>
            <Field label="Référence (chèque, virement…)" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">Enregistrer l'encaissement</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
