import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/app/ui-bits";
import { useStock } from "@/lib/stock/store";
import { monthlyStockValues, movementDelta, movementValue, stockStatus, stockValue, turnoverRatio, warehouseLabel, WAREHOUSES } from "@/lib/stock/model";
import { fmt, StatCard } from "@/components/budget/ui";

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function OverviewTab() {
  const { products, movements, orders } = useStock();

  const kpis = useMemo(() => {
    const totalValue = products.reduce((a, p) => a + stockValue(p), 0);
    const faibles = products.filter((p) => stockStatus(p) === "faible").length;
    const ruptures = products.filter((p) => stockStatus(p) === "rupture").length;
    const openOrders = orders.filter((o) => o.status !== "Reçue" && o.status !== "Annulée").length;
    const monthly = monthlyStockValues(products, movements);
    const avgValue = monthly.length ? monthly.reduce((a, m) => a + m.value, 0) / monthly.length : 0;
    const rotation = turnoverRatio(movements, avgValue);
    return { totalValue, faibles, ruptures, openOrders, monthly, rotation };
  }, [products, movements, orders]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.category, (map.get(p.category) ?? 0) + stockValue(p));
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [products]);

  const byWarehouse = useMemo(
    () =>
      WAREHOUSES.map((w) => {
        const items = products.filter((p) => p.warehouseId === w.id);
        return { id: w.id, label: warehouseLabel(w.id), refs: items.length, value: items.reduce((a, p) => a + stockValue(p), 0) };
      }),
    [products],
  );

  const topProducts = useMemo(() => [...products].sort((a, b) => stockValue(b) - stockValue(a)).slice(0, 5), [products]);

  const flows = useMemo(() => {
    const rows = MONTH_LABELS.map((mois) => ({ mois, entrees: 0, sorties: 0 }));
    for (const m of movements) {
      const row = rows[new Date(m.date).getMonth()];
      if (!row) continue;
      const v = movementValue(m);
      if (movementDelta(m.type, m.quantity) >= 0) row.entrees += v;
      else row.sorties += v;
    }
    const last = Math.max(-1, ...movements.map((m) => new Date(m.date).getMonth()));
    return rows.slice(0, last + 1);
  }, [movements]);

  const slowMovers = useMemo(() => {
    if (movements.filter((m) => m.type === "sortie").length < 3) return null;
    const moved = new Set(movements.filter((m) => m.type === "sortie").map((m) => m.productId));
    return products.filter((p) => p.stock > 0 && !moved.has(p.id)).sort((a, b) => stockValue(b) - stockValue(a)).slice(0, 5);
  }, [products, movements]);

  const chartData = kpis.monthly.map((m) => ({ mois: MONTH_LABELS[m.mois], value: m.value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Valeur totale du stock" value={fmt(kpis.totalValue)} sub="Valorisation CMUP" />
        <StatCard label="Références en stock" value={String(products.length)} sub={`${WAREHOUSES.length} entrepôts`} />
        <StatCard label="Stock faible" value={String(kpis.faibles)} sub="Sous le seuil minimum" tone={kpis.faibles > 0 ? "bad" : "good"} />
        <StatCard label="Ruptures de stock" value={String(kpis.ruptures)} sub="Stock disponible nul" tone={kpis.ruptures > 0 ? "bad" : "good"} />
        <StatCard label="Commandes en cours" value={String(kpis.openOrders)} sub="Non réceptionnées" />
        <StatCard
          label="Rotation des stocks"
          value={kpis.rotation === null ? "n.c." : `${kpis.rotation.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}×`}
          sub="Sorties / stock moyen"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Évolution de la valeur du stock" subtitle="Valeur mensuelle reconstituée à partir des mouvements (données de démonstration)">
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune donnée historique disponible.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} width={48} />
                  <Tooltip formatter={(v) => [fmt(Number(v)), "Valeur du stock"]} />
                  <Area type="monotone" dataKey="value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} strokeWidth={2} name="Valeur du stock" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Répartition du stock" subtitle="Valeur par catégorie de produits">
          {byCategory.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucun article en stock.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {byCategory.map((c, i) => (
                      <Cell key={c.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Legend formatter={(v: string) => <span className="text-xs text-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">Total : {fmt(kpis.totalValue)}</p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Valeur par catégorie">
          <table className="w-full text-sm">
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.name} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 text-foreground">{c.name}</td>
                  <td className="py-2 text-right font-semibold text-foreground">{fmt(c.value)}</td>
                  <td className="py-2 pl-3 text-right text-xs text-muted-foreground">
                    {kpis.totalValue > 0 ? `${((c.value / kpis.totalValue) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Produits les plus valorisés" subtitle="Top 5 par valeur de stock">
          <table className="w-full text-sm">
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">
                    <p className="text-foreground">{p.designation}</p>
                    <p className="text-xs text-muted-foreground">{p.ref}</p>
                  </td>
                  <td className="py-2 text-right font-semibold text-foreground">{fmt(stockValue(p))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Stock par entrepôt">
          <table className="w-full text-sm">
            <tbody>
              {byWarehouse.map((w) => (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">
                    <p className="text-foreground">{w.label}</p>
                    <p className="text-xs text-muted-foreground">{w.refs} référence(s)</p>
                  </td>
                  <td className="py-2 text-right font-semibold text-foreground">{fmt(w.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Historique des entrées et sorties" subtitle="Valeur mensuelle en DH (données de démonstration)" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="entrees" name="Entrées" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sorties" name="Sorties" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Produits à faible rotation" subtitle="Aucune sortie enregistrée sur la période">
          {slowMovers === null ? (
            <p className="text-sm text-muted-foreground">Pas assez de mouvements pour évaluer la rotation.</p>
          ) : slowMovers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tous les articles ont eu des sorties.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {slowMovers.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">
                      <p className="text-foreground">{p.designation}</p>
                      <p className="text-xs text-muted-foreground">{p.ref}</p>
                    </td>
                    <td className="py-2 text-right font-semibold text-foreground">{fmt(stockValue(p))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
