// Éditeur de lignes commerciales (devis, commandes) : article, quantité, prix, remise, TVA.
import { Plus, Trash2 } from "lucide-react";
import { Btn } from "@/components/budget/ui";
import { useStock, sid } from "@/lib/stock/store";
import { lineNet, round2, totals, DEFAULT_VAT, type SalesLine } from "@/lib/sales/model";
import { fmt2, IconBtn } from "./ui";

const num = "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

export function LinesEditor({ lines, onChange }: { lines: SalesLine[]; onChange: (l: SalesLine[]) => void }) {
  const { products } = useStock();
  const set = (i: number, patch: Partial<SalesLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const add = () => onChange([...lines, { productId: products[0]?.id ?? "", quantity: 1, unitPrice: products[0] ? round2(products[0].unitCost * 1.3) : 0, discount: 0, vatRate: DEFAULT_VAT }]);
  const t = totals(lines.filter((l) => l.productId && l.quantity > 0));

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_80px_100px_70px_70px_90px_36px] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
        <span>Article</span><span>Qté</span><span>Prix HT</span><span>Rem. %</span><span>TVA %</span><span className="text-right">Total HT</span><span />
      </div>
      {lines.map((l, i) => {
        const p = products.find((x) => x.id === l.productId);
        return (
          <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_80px_100px_70px_70px_90px_36px]">
            <select className={num} value={l.productId} onChange={(e) => {
              const np = products.find((x) => x.id === e.target.value);
              set(i, { productId: e.target.value, unitPrice: np ? round2(np.unitCost * 1.3) : l.unitPrice });
            }}>
              {products.map((x) => <option key={x.id} value={x.id}>{x.ref} · {x.designation}</option>)}
            </select>
            <input className={num} type="number" min={0} value={l.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} />
            <input className={num} type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} />
            <input className={num} type="number" min={0} max={100} value={l.discount ?? 0} onChange={(e) => set(i, { discount: Number(e.target.value) })} />
            <input className={num} type="number" min={0} max={100} value={l.vatRate ?? DEFAULT_VAT} onChange={(e) => set(i, { vatRate: Number(e.target.value) })} />
            <span className="self-center text-right text-sm font-semibold text-foreground">{fmt2(lineNet(l))}</span>
            <IconBtn title="Retirer la ligne" danger onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></IconBtn>
            {p && <span className="col-span-2 text-[11px] text-muted-foreground md:col-span-7">Stock disponible : {p.stock} {p.unit}</span>}
          </div>
        );
      })}
      <Btn type="button" variant="ghost" onClick={add} disabled={!products.length}><Plus className="h-4 w-4" /> Ajouter une ligne</Btn>
      <div className="flex justify-end gap-6 border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Total HT <strong className="text-foreground">{fmt2(t.ht)}</strong></span>
        <span className="text-muted-foreground">TVA <strong className="text-foreground">{fmt2(t.tva)}</strong></span>
        <span className="text-muted-foreground">Total TTC <strong className="text-foreground">{fmt2(t.ttc)}</strong></span>
      </div>
    </div>
  );
}

/** Nouvel id local pour les lignes éditables. */
export const lineId = () => sid("L");
