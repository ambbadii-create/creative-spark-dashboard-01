import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, Plus } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sid, useStock } from "@/lib/stock/store";
import { MOVEMENT_TYPES, movementDelta, movementLabel, movementValue, toCsv, warehouseLabel, WAREHOUSES, type Movement, type MovementType } from "@/lib/stock/model";
import { Btn, Field, fmt, Select, thead, trow } from "@/components/budget/ui";
import { cn } from "@/lib/utils";
import { downloadCsv } from "./ui";

export function MovementsTab({ preset, onPresetConsumed }: { preset: MovementType | null; onPresetConsumed: () => void }) {
  const { products, movements } = useStock();
  const [type, setType] = useState("all");
  const [wh, setWh] = useState("all");
  const [productId, setProductId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dialog, setDialog] = useState<MovementType | null>(null);

  useEffect(() => {
    if (preset) {
      setDialog(preset);
      onPresetConsumed();
    }
  }, [preset, onPresetConsumed]);

  const productOf = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(
    () =>
      movements
        .filter((m) => {
          if (type !== "all" && m.type !== type) return false;
          if (wh !== "all" && m.warehouseId !== wh) return false;
          if (productId !== "all" && m.productId !== productId) return false;
          if (from && m.date < from) return false;
          if (to && m.date > to) return false;
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [movements, type, wh, productId, from, to],
  );

  const exportCsv = () =>
    downloadCsv(
      "mouvements-de-stock.csv",
      toCsv(
        ["Date", "Numéro", "Type", "Référence", "Désignation", "Entrepôt", "Quantité", "Coût unitaire", "Valeur", "Document", "Utilisateur"],
        filtered.map((m) => {
          const p = productOf.get(m.productId);
          return [m.date, m.number, movementLabel(m.type), p?.ref ?? "", p?.designation ?? "", warehouseLabel(m.warehouseId), movementDelta(m.type, m.quantity), m.unitCost, Math.round(movementValue(m) * 100) / 100, m.document ?? "", m.user ?? ""];
        }),
      ),
    );

  return (
    <Panel
      title="Mouvements de stock"
      subtitle={`${filtered.length} mouvement(s) affiché(s) sur ${movements.length}`}
      action={
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Btn>
          <Btn onClick={() => setDialog("entree")}>
            <Plus className="h-4 w-4" />
            Nouveau mouvement
          </Btn>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Select label="Type de mouvement" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">Tous</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select label="Article" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="all">Tous</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.ref} · {p.designation}
            </option>
          ))}
        </Select>
        <Select label="Entrepôt" value={wh} onChange={(e) => setWh(e.target.value)}>
          <option value="all">Tous</option>
          {WAREHOUSES.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label} ({w.city})
            </option>
          ))}
        </Select>
        <Field label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={thead}>
            <tr>
              <th className="py-2.5 pr-3 font-medium">Date</th>
              <th className="py-2.5 pr-3 font-medium">Numéro</th>
              <th className="py-2.5 pr-3 font-medium">Type</th>
              <th className="py-2.5 pr-3 font-medium">Article</th>
              <th className="py-2.5 pr-3 font-medium">Entrepôt</th>
              <th className="py-2.5 pr-3 text-right font-medium">Quantité</th>
              <th className="py-2.5 pr-3 text-right font-medium">Coût unit.</th>
              <th className="py-2.5 pr-3 text-right font-medium">Valeur</th>
              <th className="py-2.5 pr-3 font-medium">Document</th>
              <th className="py-2.5 font-medium">Utilisateur</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const p = productOf.get(m.productId);
              const delta = movementDelta(m.type, m.quantity);
              return (
                <tr key={m.id} className={trow}>
                  <td className="py-2.5 pr-3 text-muted-foreground">{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{m.number}</td>
                  <td className="py-2.5 pr-3 text-foreground">{movementLabel(m.type)}</td>
                  <td className="py-2.5 pr-3">
                    <p className="text-foreground">{p?.designation ?? "Article supprimé"}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p?.ref ?? m.productId}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {warehouseLabel(m.warehouseId)}
                    {m.type === "transfert" && m.targetWarehouseId ? ` → ${warehouseLabel(m.targetWarehouseId)}` : ""}
                  </td>
                  <td className={cn("py-2.5 pr-3 text-right font-semibold", delta >= 0 ? "text-success" : "text-destructive")}>
                    {delta > 0 ? "+" : ""}
                    {delta.toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">{fmt(m.unitCost)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-foreground">{fmt(movementValue(m))}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{m.document ?? "—"}</td>
                  <td className="py-2.5 text-muted-foreground">{m.user ?? "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  Aucun mouvement ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dialog && <MovementDialog initialType={dialog} onClose={() => setDialog(null)} />}
    </Panel>
  );
}

function MovementDialog({ initialType, onClose }: { initialType: MovementType; onClose: () => void }) {
  const { products, movements, addMovement } = useStock();
  const [type, setType] = useState<MovementType>(initialType);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId);
  const [warehouseId, setWarehouseId] = useState(product?.warehouseId ?? WAREHOUSES[0]!.id);
  const [targetWarehouseId, setTargetWarehouseId] = useState(WAREHOUSES[1]?.id ?? WAREHOUSES[0]!.id);
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(product?.unitCost ?? 0);
  const [document, setDocument] = useState("");
  const [err, setErr] = useState("");

  const pickProduct = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setWarehouseId(p.warehouseId);
      setUnitCost(p.unitCost);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (type === "transfert" && targetWarehouseId === warehouseId) return setErr("L'entrepôt cible doit être différent de l'entrepôt source.");
    const m: Movement = {
      id: sid("M"),
      date: new Date().toISOString().slice(0, 10),
      number: `MVT-2026-${String(movements.length + 1).padStart(4, "0")}`,
      type,
      productId,
      warehouseId,
      targetWarehouseId: type === "transfert" ? targetWarehouseId : undefined,
      quantity,
      unitCost,
      document: document.trim() || undefined,
      user: "Contrôleur de gestion",
    };
    const error = addMovement(m);
    if (error) return setErr(error);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau mouvement de stock</DialogTitle>
          <DialogDescription>Le stock disponible est mis à jour immédiatement. Les sorties ne peuvent pas rendre le stock négatif.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type de mouvement" value={type} onChange={(e) => setType(e.target.value as MovementType)} className="col-span-2">
              {MOVEMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select label="Article" value={productId} onChange={(e) => pickProduct(e.target.value)} className="col-span-2">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ref} · {p.designation} — stock : {p.stock} {p.unit}
                </option>
              ))}
            </Select>
            <Select label={type === "transfert" ? "Entrepôt source" : "Entrepôt"} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {WAREHOUSES.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label} ({w.city})
                </option>
              ))}
            </Select>
            {type === "transfert" && (
              <Select label="Entrepôt cible" value={targetWarehouseId} onChange={(e) => setTargetWarehouseId(e.target.value)}>
                {WAREHOUSES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label} ({w.city})
                  </option>
                ))}
              </Select>
            )}
            <Field label="Quantité" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            <Field label="Coût unitaire (DH)" type="number" min={0} step="0.01" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} />
            <Field label="Document associé" value={document} onChange={(e) => setDocument(e.target.value)} placeholder="BL-2026-0000, FAC-2026-0000…" className="col-span-2" />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Btn>
            <Btn type="submit">Enregistrer le mouvement</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
