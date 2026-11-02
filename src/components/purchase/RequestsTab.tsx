import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Pencil, Plus, Send, X, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Field, Select } from "@/components/budget/ui";
import { useStock, sid } from "@/lib/stock/store";
import { usePurchase } from "@/lib/purchase/store";
import { canTransition, DEFAULT_VAT, DEPARTMENTS, REQUEST_STATUSES, requestTotal, type PurchaseRequest, type RequestStatus } from "@/lib/purchase/model";
import { fdate, fmt2, IconBtn, RequestBadge, rowCls, Table, Td, TextArea, Th, today } from "./ui";
import type { OrderSeed } from "./OrdersTab";

export function RequestsTab({ onConvert }: { onConvert: (s: OrderSeed) => void }) {
  const { requests, upsertRequest } = usePurchase();
  const { products } = useStock();
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<PurchaseRequest | null | "new">(null);
  const rows = requests.filter((r) => status === "all" || r.status === status).sort((a, b) => b.date.localeCompare(a.date));
  const move = (r: PurchaseRequest, to: RequestStatus) => canTransition(r.status, to) && upsertRequest({ ...r, status: to });

  const convert = (r: PurchaseRequest) => {
    const supplier = products.find((p) => p.id === r.lines[0]?.productId)?.supplier;
    onConvert({ ...(supplier ? { supplier } : {}), requestId: r.id, lines: r.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, received: 0, unitCost: l.estimatedPrice, discount: 0, vatRate: DEFAULT_VAT })) });
  };

  return (
    <Panel
      title="Demandes d'achat"
      subtitle="Circuit : Brouillon → Soumise → En validation → Approuvée → Convertie en commande"
      action={<Btn onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouvelle demande</Btn>}
    >
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 max-w-xs">
        <option value="all">Tous les statuts</option>
        {REQUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
      </Select>
      <Table empty={rows.length === 0} head={<><Th>N°</Th><Th>Date</Th><Th>Demandeur</Th><Th>Service</Th><Th>Justification</Th><Th>Souhaitée le</Th><Th right>Estimation HT</Th><Th>Statut</Th><Th /></>}>
        {rows.map((r) => (
          <tr key={r.id} className={rowCls}>
            <Td strong>{r.number}</Td>
            <Td muted>{fdate(r.date)}</Td>
            <Td>{r.requester}</Td>
            <Td muted>{r.department}</Td>
            <Td muted className="max-w-[220px] truncate">{r.justification}</Td>
            <Td muted>{fdate(r.neededBy)}</Td>
            <Td right strong>{fmt2(requestTotal(r))}</Td>
            <Td><RequestBadge s={r.status} /></Td>
            <Td className="whitespace-nowrap">
              {r.status === "Brouillon" && <IconBtn title="Modifier" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></IconBtn>}
              {r.status === "Brouillon" && <IconBtn title="Soumettre" onClick={() => move(r, "Soumise")}><Send className="h-4 w-4" /></IconBtn>}
              {r.status === "Soumise" && <IconBtn title="Prendre en validation" onClick={() => move(r, "En validation")}><ArrowRight className="h-4 w-4" /></IconBtn>}
              {r.status === "En validation" && <IconBtn title="Approuver" onClick={() => move(r, "Approuvée")}><Check className="h-4 w-4" /></IconBtn>}
              {(r.status === "Soumise" || r.status === "En validation") && <IconBtn danger title="Rejeter" onClick={() => move(r, "Rejetée")}><XCircle className="h-4 w-4" /></IconBtn>}
              {r.status === "Approuvée" && <Btn variant="ghost" onClick={() => convert(r)}>Convertir en commande</Btn>}
            </Td>
          </tr>
        ))}
      </Table>
      {editing && <RequestDialog request={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function RequestDialog({ request, onClose }: { request?: PurchaseRequest | undefined; onClose: () => void }) {
  const { requests, upsertRequest } = usePurchase();
  const { products } = useStock();
  const [f, setF] = useState<PurchaseRequest>(
    () => request ?? { id: sid("R"), number: `DA-2026-${String(requests.length + 1).padStart(3, "0")}`, date: today(), requester: "", department: DEPARTMENTS[0]!, justification: "", neededBy: today(), status: "Brouillon", lines: [] },
  );
  const [err, setErr] = useState("");
  const set = <K extends keyof PurchaseRequest>(k: K, v: PurchaseRequest[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = (e: FormEvent, submit: boolean) => {
    e.preventDefault();
    if (!f.requester.trim()) return setErr("Le demandeur est obligatoire.");
    if (!f.justification.trim()) return setErr("La justification est obligatoire.");
    if (f.lines.length === 0 || f.lines.some((l) => !(l.quantity > 0) || l.estimatedPrice < 0)) return setErr("Ajoutez des lignes avec quantités > 0 et prix positifs.");
    upsertRequest({ ...f, requester: f.requester.trim(), status: submit ? "Soumise" : "Brouillon" });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{request ? `Modifier ${request.number}` : "Nouvelle demande d'achat"}</DialogTitle>
          <DialogDescription>Enregistrez en brouillon ou soumettez directement pour validation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => save(e, false)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Demandeur *" value={f.requester} onChange={(e) => set("requester", e.target.value)} />
            <Select label="Service" value={f.department} onChange={(e) => set("department", e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </Select>
            <Field label="Date de la demande" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
            <Field label="Livraison souhaitée" type="date" value={f.neededBy} onChange={(e) => set("neededBy", e.target.value)} />
          </div>
          <TextArea label="Justification *" value={f.justification} onChange={(e) => set("justification", e.target.value)} />
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Articles</p>
            <Btn type="button" variant="ghost" onClick={() => setF((x) => ({ ...x, lines: [...x.lines, { productId: products[0]?.id ?? "", quantity: 1, estimatedPrice: products[0]?.unitCost ?? 0 }] }))}>
              <Plus className="h-4 w-4" /> Ajouter
            </Btn>
          </div>
          {f.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px_32px] items-end gap-2">
              <Select value={l.productId} onChange={(e) => setF((x) => ({ ...x, lines: x.lines.map((y, j) => (j === i ? { ...y, productId: e.target.value, estimatedPrice: products.find((p) => p.id === e.target.value)?.unitCost ?? y.estimatedPrice } : y)) }))}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.designation}</option>)}
              </Select>
              <Field type="number" min={1} value={l.quantity} onChange={(e) => setF((x) => ({ ...x, lines: x.lines.map((y, j) => (j === i ? { ...y, quantity: Number(e.target.value) } : y)) }))} />
              <Field type="number" min={0} step="0.01" value={l.estimatedPrice} onChange={(e) => setF((x) => ({ ...x, lines: x.lines.map((y, j) => (j === i ? { ...y, estimatedPrice: Number(e.target.value) } : y)) }))} />
              <button type="button" onClick={() => setF((x) => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))} className="mb-1 rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <p className="text-right text-sm font-semibold text-foreground">Estimation HT : {fmt2(requestTotal(f))}</p>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit" variant="ghost">Enregistrer le brouillon</Btn>
            <Btn type="button" onClick={(e) => save(e as unknown as FormEvent, true)}><Send className="h-4 w-4" /> Soumettre</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
