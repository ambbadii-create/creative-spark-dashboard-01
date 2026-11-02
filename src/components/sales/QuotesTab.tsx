import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Copy, Eye, Pencil, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field, Select } from "@/components/budget/ui";
import { sid, useStock } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import { addDays, isQuoteExpired, lineNet, QUOTE_NEXT, QUOTE_STATUSES, totals, type Quote, type QuoteStatus, type SalesLine } from "@/lib/sales/model";
import { LinesEditor } from "./LinesEditor";
import { Badge, fdate, fmt2, IconBtn, QuoteBadge, rowCls, Table, Td, Th, today } from "./ui";

export function QuotesTab({ newSignal, onConvert }: { newSignal: number; onConvert: (q: Quote) => void }) {
  const { quotes, customers, upsertQuote } = useSales();
  const [q, setQ] = useState("");
  const [st, setSt] = useState("all");
  const [editing, setEditing] = useState<Quote | "new" | null>(null);
  const [viewing, setViewing] = useState<Quote | null>(null);
  const now = today();
  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";

  useEffect(() => {
    if (newSignal > 0) setEditing("new");
  }, [newSignal]);

  const rows = useMemo(
    () =>
      quotes
        .filter((x) => (st === "all" || x.status === st) && `${x.number} ${cName(x.customerId)}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotes, q, st, customers],
  );

  const duplicate = (x: Quote) =>
    upsertQuote({ ...x, id: sid("Q"), number: `DV-2026-${String(quotes.length + 101).padStart(3, "0")}`, date: now, validUntil: addDays(now, 30), status: "Brouillon", orderId: undefined });

  return (
    <div className="space-y-5">
      <Panel title="Devis" subtitle="Offres commerciales — remises, TVA par ligne, conversion en commande" action={<Btn onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouveau devis</Btn>}>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de devis, client" className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring" />
          </label>
          <Select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="all">Tous statuts</option>
            {QUOTE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <Table empty={rows.length === 0} head={<><Th>N°</Th><Th>Client</Th><Th>Date</Th><Th>Validité</Th><Th right>HT</Th><Th right>TTC</Th><Th>Statut</Th><Th /></>}>
          {rows.map((x) => {
            const t = totals(x.lines);
            return (
              <tr key={x.id} className={rowCls}>
                <Td strong>{x.number}</Td>
                <Td>{cName(x.customerId)}</Td>
                <Td muted>{fdate(x.date)}</Td>
                <Td muted>{fdate(x.validUntil)}{isQuoteExpired(x, now) && <span className="ml-1"><Badge t="bad">Expiré</Badge></span>}</Td>
                <Td right>{fmt2(t.ht)}</Td>
                <Td right>{fmt2(t.ttc)}</Td>
                <Td><QuoteBadge s={x.status} /></Td>
                <Td className="whitespace-nowrap">
                  <IconBtn title="Aperçu" onClick={() => setViewing(x)}><Eye className="h-4 w-4" /></IconBtn>
                  {(x.status === "Brouillon" || x.status === "Envoyé") && <IconBtn title="Modifier" onClick={() => setEditing(x)}><Pencil className="h-4 w-4" /></IconBtn>}
                  <IconBtn title="Dupliquer" onClick={() => duplicate(x)}><Copy className="h-4 w-4" /></IconBtn>
                  {x.status === "Accepté" && <IconBtn title="Convertir en commande" onClick={() => onConvert(x)}><ArrowRight className="h-4 w-4" /></IconBtn>}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      {editing && <QuoteDialog quote={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && <QuoteView quote={viewing} onClose={() => setViewing(null)} onConvert={onConvert} />}
    </div>
  );
}

export function QuoteDialog({ quote, onClose }: { quote?: Quote | undefined; onClose: () => void }) {
  const { quotes, customers, opportunities, upsertQuote } = useSales();
  const now = today();
  const [f, setF] = useState<Quote>(
    () =>
      quote ?? {
        id: sid("Q"), number: `DV-2026-${String(quotes.length + 101).padStart(3, "0")}`, customerId: customers[0]?.id ?? "",
        date: now, validUntil: addDays(now, 30), status: "Brouillon", lines: [],
      },
  );
  const [err, setErr] = useState("");
  const open = opportunities.filter((o) => o.customerId === f.customerId && !["Gagnée", "Perdue"].includes(o.stage));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.customerId) return setErr("Sélectionnez un client.");
    const clean = f.lines.filter((l) => l.productId && l.quantity > 0);
    if (!clean.length) return setErr("Ajoutez au moins une ligne avec une quantité.");
    if (f.validUntil < f.date) return setErr("La date de validité doit être postérieure à la date du devis.");
    upsertQuote({ ...f, lines: clean });
    onClose();
  };

  const setLines = (lines: SalesLine[]) => setF((x) => ({ ...x, lines }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? `Modifier ${quote.number}` : "Nouveau devis"}</DialogTitle>
          <DialogDescription>Total HT = quantité × prix − remise ; TVA calculée par ligne.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="N°" value={f.number} disabled />
            <Select label="Client *" value={f.customerId} onChange={(e) => setF((x) => ({ ...x, customerId: e.target.value, opportunityId: undefined }))}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </Select>
            <Field label="Date" type="date" value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} />
            <Field label="Valide jusqu'au" type="date" value={f.validUntil} onChange={(e) => setF((x) => ({ ...x, validUntil: e.target.value }))} />
            {open.length > 0 && (
              <Select label="Opportunité liée" value={f.opportunityId ?? ""} onChange={(e) => setF((x) => ({ ...x, opportunityId: e.target.value || undefined }))} className="col-span-2">
                <option value="">Aucune</option>
                {open.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.title}</option>)}
              </Select>
            )}
          </div>
          <LinesEditor lines={f.lines} onChange={setLines} />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">{quote ? "Enregistrer" : "Créer le devis"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuoteView({ quote: x, onClose, onConvert }: { quote: Quote; onClose: () => void; onConvert: (q: Quote) => void }) {
  const { customers, upsertQuote } = useSales();
  const { products } = useStockNames();
  const c = customers.find((c) => c.id === x.customerId);
  const t = totals(x.lines);
  const next = QUOTE_NEXT[x.status];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{x.number} · {c?.name ?? "—"}</DialogTitle>
          <DialogDescription>Du {fdate(x.date)} — valable jusqu'au {fdate(x.validUntil)} · <QuoteBadge s={x.status} /></DialogDescription>
        </DialogHeader>
        {c && <p className="text-xs text-muted-foreground">ICE {c.ice || "—"} · {c.address} {c.city} · Conditions : {c.paymentTerms}</p>}
        <Table head={<><Th>Article</Th><Th right>Qté</Th><Th right>Prix HT</Th><Th right>Remise</Th><Th right>TVA</Th><Th right>Total HT</Th></>}>
          {x.lines.map((l, i) => (
            <tr key={i} className={rowCls}>
              <Td>{products[l.productId] ?? l.productId}</Td>
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
        <div className="flex flex-wrap justify-end gap-2">
          {next.filter((s) => s !== "Converti").map((s) => (
            <Btn key={s} variant="ghost" onClick={() => { upsertQuote({ ...x, status: s as QuoteStatus }); onClose(); }}>
              Marquer « {s} »
            </Btn>
          ))}
          {x.status === "Accepté" && <Btn onClick={() => { onClose(); onConvert(x); }}><ArrowRight className="h-4 w-4" /> Convertir en commande</Btn>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Nom d'article par id (petit helper local)
function useStockNames() {
  const { products } = useStock();
  return { products: Object.fromEntries(products.map((p) => [p.id, `${p.ref} · ${p.designation}`])) };
}
