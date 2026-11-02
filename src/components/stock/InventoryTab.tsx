import { useMemo, useState, type FormEvent } from "react";
import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sid, useStock } from "@/lib/stock/store";
import { STOCK_CATEGORIES, STATUS_LABEL, stockStatus, stockValue, toCsv, warehouseLabel, WAREHOUSES, type Product, type StockStatus } from "@/lib/stock/model";
import { Btn, Field, fmt, Select, sortBy, SortTh, thead, trow, type Sort } from "@/components/budget/ui";
import { downloadCsv, StockStatusBadge } from "./ui";

type SortKey = "designation" | "stock" | "value";
const PAGE_SIZE = 10;

export function InventoryTab({ onAdjust }: { onAdjust: () => void }) {
  const { products } = useStock();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [wh, setWh] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort<SortKey>>({ key: "designation", dir: 1 });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = products.filter((p) => {
      if (q && !p.ref.toLowerCase().includes(q) && !p.designation.toLowerCase().includes(q)) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (wh !== "all" && p.warehouseId !== wh) return false;
      if (status !== "all" && stockStatus(p) !== status) return false;
      return true;
    });
    const get = (p: Product) => (sort.key === "designation" ? p.designation : sort.key === "stock" ? p.stock : stockValue(p));
    return sortBy(rows, get, sort.dir);
  }, [products, search, cat, wh, status, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const exportCsv = () =>
    downloadCsv(
      "etat-des-stocks.csv",
      toCsv(
        ["Référence", "Désignation", "Catégorie", "Entrepôt", "Stock", "Min", "Max", "Coût unitaire", "Valeur", "Statut"],
        filtered.map((p) => [p.ref, p.designation, p.category, warehouseLabel(p.warehouseId), p.stock, p.min, p.max, p.unitCost, Math.round(stockValue(p) * 100) / 100, STATUS_LABEL[stockStatus(p)]]),
      ),
    );

  return (
    <Panel
      title="État des stocks"
      subtitle={`${filtered.length} article(s) affiché(s) sur ${products.length}`}
      action={
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Btn>
          <Btn onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nouvel article
          </Btn>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="relative block text-xs font-medium text-muted-foreground">
          <span className="mb-1 block">Recherche</span>
          <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Référence ou désignation…"
            className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <Select label="Catégorie" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
          <option value="all">Toutes</option>
          {STOCK_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select label="Entrepôt" value={wh} onChange={(e) => { setWh(e.target.value); setPage(0); }}>
          <option value="all">Tous</option>
          {WAREHOUSES.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label} ({w.city})
            </option>
          ))}
        </Select>
        <Select label="Statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="all">Tous</option>
          {(Object.keys(STATUS_LABEL) as StockStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={thead}>
            <tr>
              <th className="py-2.5 pr-3 font-medium">Référence</th>
              <SortTh k="designation" sort={sort} setSort={setSort}>Désignation</SortTh>
              <th className="py-2.5 pr-3 font-medium">Catégorie</th>
              <th className="py-2.5 pr-3 font-medium">Entrepôt</th>
              <SortTh k="stock" sort={sort} setSort={setSort} right>Stock</SortTh>
              <th className="py-2.5 pr-3 text-right font-medium">Min / Max</th>
              <th className="py-2.5 pr-3 text-right font-medium">Coût unit.</th>
              <SortTh k="value" sort={sort} setSort={setSort} right>Valeur</SortTh>
              <th className="py-2.5 pr-3 font-medium">Statut</th>
              <th className="py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={trow}>
                <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{p.ref}</td>
                <td className="py-2.5 pr-3 font-medium text-foreground">{p.designation}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{p.category}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{warehouseLabel(p.warehouseId)}</td>
                <td className="py-2.5 pr-3 text-right font-semibold text-foreground">
                  {p.stock.toLocaleString("fr-FR")} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
                </td>
                <td className="py-2.5 pr-3 text-right text-muted-foreground">
                  {p.min.toLocaleString("fr-FR")} / {p.max.toLocaleString("fr-FR")}
                </td>
                <td className="py-2.5 pr-3 text-right text-muted-foreground">{fmt(p.unitCost)}</td>
                <td className="py-2.5 pr-3 text-right font-semibold text-foreground">{fmt(stockValue(p))}</td>
                <td className="py-2.5 pr-3">
                  <StockStatusBadge status={stockStatus(p)} />
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(p)} title="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={onAdjust} title="Ajuster le stock" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Plus className="h-4 w-4" />
                    </button>
                    <DeleteButton product={p} />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  Aucun article ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {current + 1} / {pages}
          </span>
          <div className="flex gap-2">
            <Btn variant="ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Précédent
            </Btn>
            <Btn variant="ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Suivant
            </Btn>
          </div>
        </div>
      )}

      {(creating || editing) && <ProductDialog product={editing ?? undefined} onClose={() => { setCreating(false); setEditing(null); }} />}
    </Panel>
  );
}

function DeleteButton({ product }: { product: Product }) {
  const { deleteProduct } = useStock();
  return (
    <button
      onClick={() => {
        if (window.confirm(`Supprimer « ${product.designation} » et ses mouvements associés ?`)) deleteProduct(product.id);
      }}
      title="Supprimer"
      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function ProductDialog({ product, onClose }: { product?: Product | undefined; onClose: () => void }) {
  const { products, upsertProduct } = useStock();
  const isEdit = !!product;
  const [f, setF] = useState<Product>(
    product ?? {
      id: sid("P"),
      ref: "",
      designation: "",
      category: STOCK_CATEGORIES[0],
      unit: "Unité",
      warehouseId: WAREHOUSES[0]!.id,
      stock: 0,
      min: 0,
      max: 0,
      unitCost: 0,
      supplier: "",
      barcode: "",
      expiry: null,
    },
  );
  const [err, setErr] = useState("");
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.ref.trim()) return setErr("La référence est obligatoire.");
    if (!f.designation.trim()) return setErr("La désignation est obligatoire.");
    if (products.some((p) => p.ref.toLowerCase() === f.ref.trim().toLowerCase() && p.id !== f.id))
      return setErr("Cette référence existe déjà pour un autre article.");
    if (f.min < 0 || f.max < 0 || f.stock < 0 || f.unitCost < 0) return setErr("Les quantités et le coût ne peuvent pas être négatifs.");
    if (f.max > 0 && f.min > f.max) return setErr("Le stock minimum ne peut pas dépasser le stock maximum.");
    upsertProduct({ ...f, ref: f.ref.trim(), designation: f.designation.trim(), supplier: f.supplier?.trim() || undefined, barcode: f.barcode?.trim() || undefined, expiry: f.expiry || null });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Le stock disponible se modifie via les mouvements de stock." : "Créez une fiche article avec son stock initial et ses seuils."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Référence unique *" value={f.ref} onChange={(e) => set("ref", e.target.value)} placeholder="HUI-001" />
            <Field label="Désignation *" value={f.designation} onChange={(e) => set("designation", e.target.value)} className="col-span-2" placeholder="Huile d'olive 5L" />
            <Select label="Catégorie" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {STOCK_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Field label="Unité de mesure" value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder="Bidon, Sac, Boîte…" />
            <Select label="Entrepôt" value={f.warehouseId} onChange={(e) => set("warehouseId", e.target.value)}>
              {WAREHOUSES.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label} ({w.city})
                </option>
              ))}
            </Select>
            <Field label={isEdit ? "Stock disponible (via mouvements)" : "Stock initial"} type="number" min={0} value={f.stock} disabled={isEdit} onChange={(e) => set("stock", num(e.target.value))} />
            <Field label="Stock minimum" type="number" min={0} value={f.min} onChange={(e) => set("min", num(e.target.value))} />
            <Field label="Stock maximum" type="number" min={0} value={f.max} onChange={(e) => set("max", num(e.target.value))} />
            <Field label="Coût unitaire (DH)" type="number" min={0} step="0.01" value={f.unitCost} onChange={(e) => set("unitCost", num(e.target.value))} />
            <Field label="Fournisseur habituel" value={f.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} />
            <Field label="Code-barres" value={f.barcode ?? ""} onChange={(e) => set("barcode", e.target.value)} />
            <Field label="Date d'expiration" type="date" value={f.expiry ?? ""} onChange={(e) => set("expiry", e.target.value || null)} />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Btn>
            <Btn type="submit">{isEdit ? "Enregistrer" : "Créer l'article"}</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
