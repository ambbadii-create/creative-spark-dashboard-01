import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, Pencil, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field, Select } from "@/components/budget/ui";
import { sid } from "@/lib/stock/store";
import { useSales } from "@/lib/sales/store";
import {
  customerExposure, invoiceOutstanding, invoiceStatus, invoiceTotals, isValidIce, orderStatus, totals,
  PAYMENT_TERMS, SALES_REPS, SEGMENTS, ACTIVITIES, type Customer,
} from "@/lib/sales/model";
import { Badge, fdate, fmt2, IconBtn, OrderBadge, QuoteBadge, rowCls, SalesInvoiceBadge, Table, Td, Th, TextArea, today } from "./ui";

export function CustomersTab({ newSignal }: { newSignal: number }) {
  const { customers } = useSales();
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("all");
  const [st, setSt] = useState("all");
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

  useEffect(() => {
    if (newSignal > 0) setEditing("new");
  }, [newSignal]);

  const rows = useMemo(
    () =>
      customers.filter(
        (c) =>
          (seg === "all" || c.segment === seg) &&
          (st === "all" || (st === "active") === c.active) &&
          `${c.code} ${c.name} ${c.ice} ${c.city} ${c.contact}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [customers, q, seg, st],
  );

  return (
    <div className="space-y-5">
      <Panel title="Clients" subtitle="Référentiel clients — ICE, IF, RC, conditions et plafonds de crédit" action={<Btn onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouveau client</Btn>}>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px_150px]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, raison sociale, ICE, ville, contact" className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring" />
          </label>
          <Select value={seg} onChange={(e) => setSeg(e.target.value)}>
            <option value="all">Tous segments</option>
            {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </Select>
        </div>
        <Table empty={rows.length === 0} head={<><Th>Code</Th><Th>Raison sociale</Th><Th>ICE</Th><Th>Ville</Th><Th>Segment</Th><Th>Commercial</Th><Th>Conditions</Th><Th>Statut</Th><Th /></>}>
          {rows.map((c) => (
            <tr key={c.id} className={rowCls}>
              <Td strong>{c.code}</Td>
              <Td>{c.name}</Td>
              <Td muted>{c.ice || "—"}</Td>
              <Td muted>{c.city || "—"}</Td>
              <Td muted>{c.segment}</Td>
              <Td muted>{c.salesRep}</Td>
              <Td muted>{c.paymentTerms}</Td>
              <Td>{c.active ? <Badge t="good">Actif</Badge> : <Badge t="muted">Inactif</Badge>}</Td>
              <Td className="whitespace-nowrap">
                <IconBtn title="Fiche client" onClick={() => setViewing(c)}><Eye className="h-4 w-4" /></IconBtn>
                <IconBtn title="Modifier" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></IconBtn>
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>

      {editing && <CustomerDialog customer={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && <CustomerDetail customer={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function CustomerDialog({ customer, onClose }: { customer?: Customer | undefined; onClose: () => void }) {
  const { customers, upsertCustomer } = useSales();
  const [f, setF] = useState<Customer>(
    () =>
      customer ?? {
        id: sid("C"), code: `CLI-${String(customers.length + 1).padStart(3, "0")}`, name: "", segment: SEGMENTS[0]!, activity: ACTIVITIES[0]!,
        ice: "", if: "", rc: "", address: "", city: "", contact: "", email: "", phone: "", paymentTerms: "30 jours", creditLimit: 0, salesRep: SALES_REPS[0]!, active: true,
      },
  );
  const [err, setErr] = useState("");
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.code.trim() || !f.name.trim()) return setErr("Le code et la raison sociale sont obligatoires.");
    if (customers.some((c) => c.id !== f.id && c.code.toLowerCase() === f.code.trim().toLowerCase())) return setErr("Ce code client existe déjà.");
    if (customers.some((c) => c.id !== f.id && c.name.toLowerCase() === f.name.trim().toLowerCase())) return setErr("Un client porte déjà cette raison sociale.");
    if (f.ice && !isValidIce(f.ice)) return setErr("L'ICE doit comporter exactement 15 chiffres.");
    if (f.ice && customers.some((c) => c.id !== f.id && c.ice === f.ice.trim())) return setErr("Cet ICE est déjà attribué à un autre client.");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Adresse e-mail invalide.");
    if (f.creditLimit < 0) return setErr("Le plafond de crédit ne peut pas être négatif.");
    upsertCustomer({ ...f, code: f.code.trim(), name: f.name.trim(), ice: f.ice.trim() });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? `Modifier ${customer.name}` : "Nouveau client"}</DialogTitle>
          <DialogDescription>Identifiants fiscaux marocains : ICE (15 chiffres), IF et RC.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Code *" value={f.code} onChange={(e) => set("code", e.target.value)} />
            <Field label="Raison sociale *" value={f.name} onChange={(e) => set("name", e.target.value)} className="md:col-span-2" />
            <Field label="ICE" value={f.ice} onChange={(e) => set("ice", e.target.value)} placeholder="15 chiffres" />
            <Field label="IF" value={f.if} onChange={(e) => set("if", e.target.value)} />
            <Field label="RC" value={f.rc} onChange={(e) => set("rc", e.target.value)} />
            <Field label="Adresse" value={f.address} onChange={(e) => set("address", e.target.value)} className="md:col-span-2" />
            <Field label="Ville" value={f.city} onChange={(e) => set("city", e.target.value)} />
            <Field label="Contact principal" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
            <Field label="E-mail" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            <Field label="Téléphone" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            <Select label="Segment" value={f.segment} onChange={(e) => set("segment", e.target.value)}>
              {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Activité" value={f.activity} onChange={(e) => set("activity", e.target.value)}>
              {ACTIVITIES.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Commercial" value={f.salesRep} onChange={(e) => set("salesRep", e.target.value)}>
              {SALES_REPS.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Conditions de paiement" value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}>
              {PAYMENT_TERMS.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Field label="Plafond de crédit (DH TTC, 0 = aucun)" type="number" min={0} value={f.creditLimit} onChange={(e) => set("creditLimit", Number(e.target.value))} />
            <Select label="Statut" value={f.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
              <option value="1">Actif</option>
              <option value="0">Inactif</option>
            </Select>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">{customer ? "Enregistrer" : "Créer le client"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDetail({ customer: c, onClose }: { customer: Customer; onClose: () => void }) {
  const { customers, quotes, orders, invoices, collections } = useSales();
  const now = today();
  const cQuotes = quotes.filter((q) => q.customerId === c.id);
  const cOrders = orders.filter((o) => o.customerId === c.id && !o.cancelled);
  const cInvoices = invoices.filter((i) => i.customerId === c.id);
  const cCols = collections.filter((x) => cInvoices.some((i) => i.id === x.invoiceId));
  const exp = customerExposure(c.id, orders, invoices, collections);
  const info: [string, string][] = [
    ["ICE", c.ice], ["IF", c.if], ["RC", c.rc],
    ["Adresse", [c.address, c.city].filter(Boolean).join(", ")], ["Contact", c.contact], ["Téléphone", c.phone],
    ["E-mail", c.email], ["Segment", c.segment], ["Activité", c.activity],
    ["Commercial", c.salesRep], ["Conditions", c.paymentTerms], ["Plafond de crédit", c.creditLimit ? fmt2(c.creditLimit) : "Aucun"],
  ];
  void customers;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{c.code} · {c.name}</DialogTitle>
          <DialogDescription>Fiche client — {c.active ? "actif" : "inactif"}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Créances</p><p className="font-bold text-foreground">{fmt2(exp.receivable)}</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Commandes non facturées</p><p className="font-bold text-foreground">{fmt2(exp.uninvoiced)}</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Encours total</p><p className="font-bold text-foreground">{fmt2(exp.total)}</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Plafond</p><p className="font-bold text-foreground">{c.creditLimit ? fmt2(c.creditLimit) : "—"}</p></div>
        </div>
        <Tabs defaultValue="info">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="quotes">Devis ({cQuotes.length})</TabsTrigger>
            <TabsTrigger value="orders">Commandes ({cOrders.length})</TabsTrigger>
            <TabsTrigger value="invoices">Factures ({cInvoices.length})</TabsTrigger>
            <TabsTrigger value="payments">Encaissements ({cCols.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              {info.map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-foreground">{v || "—"}</dd></div>
              ))}
            </dl>
          </TabsContent>
          <TabsContent value="quotes" className="mt-4">
            <Table empty={cQuotes.length === 0} head={<><Th>Devis</Th><Th>Date</Th><Th>Validité</Th><Th right>TTC</Th><Th>Statut</Th></>}>
              {cQuotes.map((q) => (
                <tr key={q.id} className={rowCls}><Td strong>{q.number}</Td><Td muted>{fdate(q.date)}</Td><Td muted>{fdate(q.validUntil)}</Td><Td right>{fmt2(totals(q.lines).ttc)}</Td><Td><QuoteBadge s={q.status} /></Td></tr>
              ))}
            </Table>
          </TabsContent>
          <TabsContent value="orders" className="mt-4">
            <Table empty={cOrders.length === 0} head={<><Th>Commande</Th><Th>Date</Th><Th>Livraison</Th><Th right>TTC</Th><Th>Statut</Th></>}>
              {cOrders.map((o) => (
                <tr key={o.id} className={rowCls}><Td strong>{o.number}</Td><Td muted>{fdate(o.date)}</Td><Td muted>{fdate(o.deliveryDate)}</Td><Td right>{fmt2(totals(o.lines).ttc)}</Td><Td><OrderBadge s={orderStatus(o)} /></Td></tr>
              ))}
            </Table>
          </TabsContent>
          <TabsContent value="invoices" className="mt-4">
            <Table empty={cInvoices.length === 0} head={<><Th>Facture</Th><Th>Échéance</Th><Th right>TTC</Th><Th right>Reste</Th><Th>Statut</Th></>}>
              {cInvoices.map((i) => (
                <tr key={i.id} className={rowCls}><Td strong>{i.number}</Td><Td muted>{fdate(i.dueDate)}</Td><Td right>{fmt2(invoiceTotals(i).ttc)}</Td><Td right>{fmt2(invoiceOutstanding(i, collections))}</Td><Td><SalesInvoiceBadge s={invoiceStatus(i, collections, now)} /></Td></tr>
              ))}
            </Table>
          </TabsContent>
          <TabsContent value="payments" className="mt-4">
            <Table empty={cCols.length === 0} head={<><Th>Référence</Th><Th>Facture</Th><Th>Date</Th><Th>Mode</Th><Th right>Montant</Th></>}>
              {cCols.map((x) => (
                <tr key={x.id} className={rowCls}><Td strong>{x.reference || "—"}</Td><Td muted>{invoices.find((i) => i.id === x.invoiceId)?.number ?? "—"}</Td><Td muted>{fdate(x.date)}</Td><Td muted>{x.method}</Td><Td right>{fmt2(x.amount)}</Td></tr>
              ))}
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
