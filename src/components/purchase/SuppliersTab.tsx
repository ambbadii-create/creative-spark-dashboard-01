import { useMemo, useState, type FormEvent } from "react";
import { Eye, Pencil, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field, Select } from "@/components/budget/ui";
import { OrderStatusBadge } from "@/components/stock/ui";
import { useStock, sid } from "@/lib/stock/store";
import { usePurchase } from "@/lib/purchase/store";
import { invoiceStatus, invoiceTtc, isValidIce, orderTotals, outstanding, PAYMENT_TERMS, SUPPLIER_CATEGORIES, type Supplier } from "@/lib/purchase/model";
import { Badge, fdate, fmt2, IconBtn, InvoiceBadge, rowCls, Table, Td, Th, today } from "./ui";

export function SuppliersTab() {
  const { suppliers, vatRates, setVatRates } = usePurchase();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [st, setSt] = useState("all");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [vatInput, setVatInput] = useState(vatRates.join(", "));

  const rows = useMemo(
    () =>
      suppliers.filter(
        (s) =>
          (cat === "all" || s.category === cat) &&
          (st === "all" || (st === "active") === s.active) &&
          `${s.code} ${s.name} ${s.ice} ${s.city}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [suppliers, q, cat, st],
  );

  return (
    <div className="space-y-5">
      <Panel title="Fournisseurs" subtitle="Référentiel fournisseurs — identifiants ICE, IF, RC" action={<Btn onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouveau fournisseur</Btn>}>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px_160px]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, raison sociale, ICE, ville" className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring" />
          </label>
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">Toutes catégories</option>
            {SUPPLIER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </Select>
        </div>
        <Table empty={rows.length === 0} head={<><Th>Code</Th><Th>Raison sociale</Th><Th>ICE</Th><Th>Ville</Th><Th>Catégorie</Th><Th>Conditions</Th><Th>Statut</Th><Th /></>}>
          {rows.map((s) => (
            <tr key={s.id} className={rowCls}>
              <Td strong>{s.code}</Td>
              <Td>{s.name}</Td>
              <Td muted>{s.ice || "—"}</Td>
              <Td muted>{s.city || "—"}</Td>
              <Td muted>{s.category}</Td>
              <Td muted>{s.paymentTerms}</Td>
              <Td>{s.active ? <Badge t="good">Actif</Badge> : <Badge t="muted">Inactif</Badge>}</Td>
              <Td className="whitespace-nowrap">
                <IconBtn title="Fiche fournisseur" onClick={() => setViewing(s)}><Eye className="h-4 w-4" /></IconBtn>
                <IconBtn title="Modifier" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></IconBtn>
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="Taux de TVA" subtitle="Taux proposés sur les lignes de commande (configurables)">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const rates = [...new Set(vatInput.split(/[,;\s]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 100))].sort((a, b) => b - a);
            if (rates.length) setVatRates(rates);
            setVatInput(rates.join(", "));
          }}
        >
          <Field label="Taux en % (séparés par des virgules)" value={vatInput} onChange={(e) => setVatInput(e.target.value)} className="w-72" />
          <Btn type="submit" variant="ghost">Enregistrer</Btn>
          <p className="text-xs text-muted-foreground">Actuels : {vatRates.map((r) => `${r} %`).join(" · ")}</p>
        </form>
      </Panel>

      {editing && <SupplierDialog supplier={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && <SupplierDetail supplier={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier?: Supplier | undefined; onClose: () => void }) {
  const { suppliers, upsertSupplier } = usePurchase();
  const [f, setF] = useState<Supplier>(
    () =>
      supplier ?? { id: sid("S"), code: `FRS-${String(suppliers.length + 1).padStart(3, "0")}`, name: "", ice: "", if: "", rc: "", address: "", city: "", contact: "", email: "", phone: "", paymentTerms: "60 jours", category: SUPPLIER_CATEGORIES[0]!, active: true },
  );
  const [err, setErr] = useState("");
  const set = <K extends keyof Supplier>(k: K, v: Supplier[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.code.trim() || !f.name.trim()) return setErr("Le code et la raison sociale sont obligatoires.");
    if (suppliers.some((s) => s.id !== f.id && s.code.toLowerCase() === f.code.trim().toLowerCase())) return setErr("Ce code fournisseur existe déjà.");
    if (suppliers.some((s) => s.id !== f.id && s.name.toLowerCase() === f.name.trim().toLowerCase())) return setErr("Un fournisseur porte déjà cette raison sociale.");
    if (f.ice && !isValidIce(f.ice)) return setErr("L'ICE doit comporter exactement 15 chiffres.");
    if (f.ice && suppliers.some((s) => s.id !== f.id && s.ice === f.ice.trim())) return setErr("Cet ICE est déjà attribué à un autre fournisseur.");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Adresse e-mail invalide.");
    upsertSupplier({ ...f, code: f.code.trim(), name: f.name.trim(), ice: f.ice.trim() });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier ? `Modifier ${supplier.name}` : "Nouveau fournisseur"}</DialogTitle>
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
            <Field label="Contact" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
            <Field label="E-mail" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            <Field label="Téléphone" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            <Select label="Catégorie" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {SUPPLIER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select label="Conditions de paiement" value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}>
              {PAYMENT_TERMS.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select label="Statut" value={f.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
              <option value="1">Actif</option>
              <option value="0">Inactif</option>
            </Select>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">{supplier ? "Enregistrer" : "Créer le fournisseur"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SupplierDetail({ supplier: s, onClose }: { supplier: Supplier; onClose: () => void }) {
  const { orders } = useStock();
  const { invoices, payments } = usePurchase();
  const sOrders = orders.filter((o) => o.supplier === s.name);
  const sInvoices = invoices.filter((i) => i.supplierId === s.id);
  const due = sInvoices.reduce((a, i) => a + outstanding(i, payments), 0);
  const info: [string, string][] = [["ICE", s.ice], ["IF", s.if], ["RC", s.rc], ["Adresse", [s.address, s.city].filter(Boolean).join(", ")], ["Contact", s.contact], ["E-mail", s.email], ["Téléphone", s.phone], ["Catégorie", s.category], ["Conditions", s.paymentTerms]];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{s.code} · {s.name}</DialogTitle>
          <DialogDescription>Fiche fournisseur — {s.active ? "actif" : "inactif"}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
          {info.map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-foreground">{v || "—"}</dd></div>
          ))}
        </dl>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Commandes</p><p className="font-bold text-foreground">{sOrders.length}</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Factures</p><p className="font-bold text-foreground">{sInvoices.length}</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Reste à payer</p><p className="font-bold text-foreground">{fmt2(due)}</p></div>
        </div>
        <Table empty={sOrders.length === 0} head={<><Th>Commande</Th><Th>Date</Th><Th right>TTC</Th><Th>Statut</Th></>}>
          {sOrders.map((o) => (
            <tr key={o.id} className={rowCls}><Td strong>{o.number}</Td><Td muted>{fdate(o.date)}</Td><Td right>{fmt2(orderTotals(o).ttc)}</Td><Td><OrderStatusBadge status={o.status} /></Td></tr>
          ))}
        </Table>
        <Table empty={sInvoices.length === 0} head={<><Th>Facture</Th><Th>Échéance</Th><Th right>TTC</Th><Th>Statut</Th></>}>
          {sInvoices.map((i) => (
            <tr key={i.id} className={rowCls}><Td strong>{i.reference}</Td><Td muted>{fdate(i.dueDate)}</Td><Td right>{fmt2(invoiceTtc(i))}</Td><Td><InvoiceBadge s={invoiceStatus(i, payments, today())} /></Td></tr>
          ))}
        </Table>
      </DialogContent>
    </Dialog>
  );
}
