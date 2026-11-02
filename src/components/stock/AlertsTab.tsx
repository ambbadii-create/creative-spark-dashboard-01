import { useMemo } from "react";
import { AlertTriangle, CalendarClock, PackageX, ShoppingCart, TrendingUp, Truck } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { useStock } from "@/lib/stock/store";
import { daysToExpiry, replenishmentQty, stockStatus, warehouseLabel, type Product } from "@/lib/stock/model";
import { Btn, fmt } from "@/components/budget/ui";
import { cn } from "@/lib/utils";

type Severity = "critique" | "avertissement" | "info";
const SEVERITY_CLS: Record<Severity, string> = {
  critique: "bg-destructive-soft text-destructive",
  avertissement: "bg-warning-soft text-warning",
  info: "bg-accent text-accent-foreground",
};
const SEVERITY_LABEL: Record<Severity, string> = { critique: "Critique", avertissement: "Avertissement", info: "Information" };

const EXPIRY_THRESHOLD_DAYS = 90; // seuil configurable : alerte si expiration < 90 jours

type AlertRow = {
  key: string;
  icon: typeof PackageX;
  title: string;
  detail: string;
  severity: Severity;
  action: string;
  productId?: string;
  quantity?: number;
};

export function AlertsTab({ onCreateOrder }: { onCreateOrder: (productId: string, quantity: number) => void }) {
  const { products, orders } = useStock();
  const today = new Date().toISOString().slice(0, 10);

  const alerts = useMemo<AlertRow[]>(() => {
    const rows: AlertRow[] = [];
    for (const p of products) {
      const st = stockStatus(p);
      const qty = replenishmentQty(p);
      if (st === "rupture")
        rows.push({
          key: `rup-${p.id}`,
          icon: PackageX,
          title: `Rupture : ${p.designation}`,
          detail: `Stock 0 ${p.unit} · min ${p.min} · ${warehouseLabel(p.warehouseId)}`,
          severity: "critique",
          action: `Commander ${qty.toLocaleString("fr-FR")} ${p.unit} pour atteindre le stock maximum`,
          productId: p.id,
          quantity: qty,
        });
      else if (st === "faible")
        rows.push({
          key: `low-${p.id}`,
          icon: AlertTriangle,
          title: `Stock faible : ${p.designation}`,
          detail: `Stock ${p.stock} ${p.unit} · min ${p.min} · ${warehouseLabel(p.warehouseId)}`,
          severity: "avertissement",
          action: `Réapprovisionner ${qty.toLocaleString("fr-FR")} ${p.unit}`,
          productId: p.id,
          quantity: qty,
        });
      else if (st === "surstock")
        rows.push({
          key: `over-${p.id}`,
          icon: TrendingUp,
          title: `Surstock : ${p.designation}`,
          detail: `Stock ${p.stock} ${p.unit} · max ${p.max} · valeur ${fmt(p.stock * p.unitCost)}`,
          severity: "info",
          action: "Suspendre les commandes et écouler l'excédent",
        });
      const d = daysToExpiry(p);
      if (d !== null && d >= 0 && d < EXPIRY_THRESHOLD_DAYS)
        rows.push({
          key: `exp-${p.id}`,
          icon: CalendarClock,
          title: `Expiration proche : ${p.designation}`,
          detail: `Expire le ${new Date(p.expiry!).toLocaleDateString("fr-FR")} (dans ${d} j) · stock ${p.stock} ${p.unit}`,
          severity: d < 30 ? "critique" : "avertissement",
          action: "Écouler en priorité (FEFO) ou retour fournisseur",
        });
    }
    for (const o of orders) {
      if ((o.status === "Validée" || o.status === "Partiellement reçue") && o.expected < today)
        rows.push({
          key: `late-${o.id}`,
          icon: Truck,
          title: `Livraison en retard : ${o.number}`,
          detail: `${o.supplier} · prévue le ${new Date(o.expected).toLocaleDateString("fr-FR")}`,
          severity: "avertissement",
          action: "Relancer le fournisseur",
        });
    }
    const rank: Record<Severity, number> = { critique: 0, avertissement: 1, info: 2 };
    return rows.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [products, orders, today]);

  const counts = useMemo(
    () => ({
      critique: alerts.filter((a) => a.severity === "critique").length,
      avertissement: alerts.filter((a) => a.severity === "avertissement").length,
      info: alerts.filter((a) => a.severity === "info").length,
    }),
    [alerts],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-elevated p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Alertes critiques</p>
          <p className="mt-2 font-display text-xl font-extrabold text-destructive">{counts.critique}</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Avertissements</p>
          <p className="mt-2 font-display text-xl font-extrabold text-warning">{counts.avertissement}</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Informations</p>
          <p className="mt-2 font-display text-xl font-extrabold text-accent-foreground">{counts.info}</p>
        </div>
      </div>

      <Panel title="Alertes de stock" subtitle="Ruptures, seuils, expirations, surstocks et livraisons en retard">
        {alerts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune alerte : tous les stocks sont dans leurs seuils.</p>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center gap-3 py-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", SEVERITY_CLS[a.severity])}>
                  <a.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Action suggérée :</span> {a.action}
                  </p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", SEVERITY_CLS[a.severity])}>{SEVERITY_LABEL[a.severity]}</span>
                {a.productId && a.quantity !== undefined && a.quantity > 0 && (
                  <Btn variant="ghost" onClick={() => onCreateOrder(a.productId!, a.quantity!)}>
                    <ShoppingCart className="h-4 w-4" />
                    Créer une commande
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">
        Règle de réapprovisionnement : quantité recommandée = stock maximum − stock disponible. Seuil d'expiration : {EXPIRY_THRESHOLD_DAYS} jours (configurable).
      </p>
    </div>
  );
}
