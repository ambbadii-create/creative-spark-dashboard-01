import { useCallback, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { cn } from "@/lib/utils";
import { useSales } from "@/lib/sales/store";
import { invoiceOutstanding } from "@/lib/sales/model";
import { chiffreAffaires, cpc, fmtK, fmtMad, fmtPct, MONTHS, net, safeDiv, sig, sigValue, variationPct, type Bal } from "@/lib/compta/model";
import { useFin, useMonthly, type Period } from "./ui";

const COLORS = ["var(--primary)", "var(--chart-2, oklch(0.65 0.12 220))", "var(--success)", "var(--warning)", "oklch(0.55 0.05 260)", "var(--destructive)"];
const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }, formatter: (v: number) => fmtMad(v, 0) };

export function OverviewTab({ p, go }: { p: Period; go: (s: "general" | "analysis" | "ar" | "ratios") => void }) {
  const { n, n1 } = useFin(p);
  const sales = useSales();
  const today = new Date().toISOString().slice(0, 10);

  const pickCa = useCallback((b: Bal) => chiffreAffaires(b), []);
  const pickRn = useCallback((b: Bal) => cpc(b).resultatNet, []);
  const pickEbe = useCallback((b: Bal) => sigValue(sig(b), "ebe"), []);
  const pickRe = useCallback((b: Bal) => cpc(b).resultatExploitation, []);
  const ca = useMonthly(p.year, p.to, pickCa), caP = useMonthly(p.year - 1, p.to, pickCa);
  const rn = useMonthly(p.year, p.to, pickRn), ebe = useMonthly(p.year, p.to, pickEbe), re = useMonthly(p.year, p.to, pickRe);

  const caN = chiffreAffaires(n.bal), caN1 = chiffreAffaires(n1.bal);
  const ebeN = sigValue(n.sig, "ebe"), ebeN1 = sigValue(n1.sig, "ebe");
  const kpis = [
    { label: "Chiffre d'affaires", cur: caN, prev: caN1, spark: ca, good: (d: number) => d >= 0 },
    { label: "Résultat net", cur: n.cpc.resultatNet, prev: n1.cpc.resultatNet, spark: rn, good: (d: number) => d >= 0 },
    { label: "EBE (≈ EBITDA)", cur: ebeN, prev: ebeN1, spark: ebe, good: (d: number) => d >= 0, hint: "EBE CGNC : avant dotations, après impôts et taxes" },
    { label: "BFR", cur: n.eq?.bfr ?? null, prev: n1.eq?.bfr ?? null, good: (d: number) => d <= 0, hint: "Actif circulant − passif circulant (hors trésorerie)" },
    { label: "Trésorerie nette", cur: n.eq?.tn ?? null, prev: n1.eq?.tn ?? null, good: (d: number) => d >= 0, hint: "Comptes 51 − 55 (module Trésorerie non encore disponible)" },
  ];

  const perf = ca.map((v, m) => ({ mois: MONTHS[m], CA: v, "CA N-1": caP[m], EBE: ebe[m], "Rés. exploitation": re[m], "Résultat net": rn[m], "Marge nette %": safeDiv(rn[m]!, v) === null ? null : (rn[m]! / v) * 100 }));
  const charges = [
    { name: "Achats consommés", value: net(n.bal, "611", "612") },
    { name: "Charges externes", value: net(n.bal, "613", "614") },
    { name: "Charges de personnel", value: net(n.bal, "617") },
    { name: "Impôts et taxes", value: net(n.bal, "616") },
    { name: "Dotations d'exploitation", value: net(n.bal, "619") },
    { name: "Charges financières", value: net(n.bal, "63") },
  ];
  const totCh = charges.reduce((s, c) => s + c.value, 0);
  const b = n.bilan;
  const structure = [
    { name: "Capitaux propres", value: b.capitauxPropres },
    { name: "Dettes de financement", value: b.dettesFinancement },
    { name: "Passif circulant", value: b.passifCirculant },
    { name: "Trésorerie-passif", value: b.tresoreriePassif },
  ];

  const overdue = sales.invoices.filter((i) => i.dueDate < today && invoiceOutstanding(i, sales.collections) > 0);
  const overdueAmt = overdue.reduce((s, i) => s + invoiceOutstanding(i, sales.collections), 0);

  const alerts = useMemo(() => {
    const out: { title: string; detail: string; tone: "bad" | "warn" }[] = [];
    if (!n1.has) return out;
    const mn = safeDiv(n.cpc.resultatNet, caN), mn1 = safeDiv(n1.cpc.resultatNet, caN1);
    if (mn !== null && mn1 !== null && mn < mn1) out.push({ title: "Diminution de la marge nette", detail: `${(mn * 100).toFixed(1)} % contre ${(mn1 * 100).toFixed(1)} % en N-1`, tone: "bad" });
    const chN = n.cpc.chargesExploitation, chN1 = n1.cpc.chargesExploitation;
    const gCh = variationPct(chN, chN1), gCa = variationPct(caN, caN1);
    if (gCh !== null && gCa !== null && gCh > gCa) out.push({ title: "Charges plus dynamiques que le CA", detail: `Charges d'exploitation ${fmtPct(gCh)} vs CA ${fmtPct(gCa)}`, tone: "warn" });
    const mo = safeDiv(n.cpc.resultatExploitation, caN), mo1 = safeDiv(n1.cpc.resultatExploitation, caN1);
    if (mo !== null && mo1 !== null && mo < mo1 - 0.005) out.push({ title: "Dégradation de la rentabilité d'exploitation", detail: `Marge opérationnelle ${(mo * 100).toFixed(1)} % (N-1 : ${(mo1 * 100).toFixed(1)} %)`, tone: "bad" });
    if (n.bilan.dettesFinancement > n1.bilan.dettesFinancement) out.push({ title: "Augmentation de l'endettement", detail: `Dettes de financement ${fmtK(n.bilan.dettesFinancement)} (N-1 : ${fmtK(n1.bilan.dettesFinancement)})`, tone: "warn" });
    if (n.eq && n1.eq) {
      const j = safeDiv(n.eq.bfr, caN), j1 = safeDiv(n1.eq.bfr, caN1);
      if (j !== null && j1 !== null && j > j1) out.push({ title: "Dégradation du BFR", detail: `BFR = ${(j * 100).toFixed(1)} % du CA (N-1 : ${(j1 * 100).toFixed(1)} %)`, tone: "warn" });
    }
    if (overdue.length) out.push({ title: "Créances clients en retard", detail: `${overdue.length} facture(s) échue(s) — ${fmtMad(overdueAmt, 0)} (module Ventes)`, tone: "bad" });
    return out;
  }, [n, n1, caN, caN1, overdue.length, overdueAmt]);

  const insights = useMemo(() => {
    if (!n1.has) return [];
    const groups = [
      { p: ["6144"], label: "Publicité" }, { p: ["6142"], label: "Transports" }, { p: ["617"], label: "Charges de personnel" },
      { p: ["611"], label: "Achats revendus de marchandises" }, { p: ["612"], label: "Achats de matières" }, { p: ["631"], label: "Charges financières" },
    ];
    const gCa = variationPct(caN, caN1) ?? 0;
    return groups
      .map((g) => ({ ...g, cur: net(n.bal, ...g.p), prev: net(n1.bal, ...g.p) }))
      .map((g) => ({ ...g, v: variationPct(g.cur, g.prev) }))
      .filter((g) => g.v !== null && g.v > gCa + 3)
      .sort((x, y) => y.v! - x.v!)
      .slice(0, 3)
      .map((g) => ({
        observation: `${g.label} : ${fmtPct(g.v)} sur un an, contre ${fmtPct(gCa)} pour le chiffre d'affaires.`,
        impact: `Surcoût de ${fmtMad(g.cur - g.prev * (1 + gCa / 100), 0)} par rapport à une évolution alignée sur le CA.`,
        explication: "Écart calculé sur les écritures validées ; la cause (prix, volumes, nouveau contrat) n'est pas identifiable dans les données comptables.",
        action: `Analyser les pièces du compte ${g.p.join("/")} dans le grand livre et rapprocher du budget.`,
      }));
  }, [n, n1, caN, caN1]);

  return (
    <div className="space-y-5">
      {!n1.has && <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Aucune écriture pour {p.year - 1} : les comparaisons N-1 sont indisponibles.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => {
          const d = k.cur !== null && k.prev !== null && n1.has ? k.cur - k.prev : null;
          const good = d === null ? null : k.good(d);
          return (
            <div key={k.label} className="card-elevated p-4" title={k.hint}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="mt-2 font-display text-xl font-extrabold text-foreground">{fmtK(k.cur)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">N-1 : {n1.has ? fmtK(k.prev) : "n.d."}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                {d === null ? <span className="text-muted-foreground">Variation n.d.</span> : (
                  <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold", good ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")}>
                    {d >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {fmtPct(variationPct(k.cur, k.prev))}
                  </span>
                )}
                {d !== null && <span className="text-muted-foreground">{d > 0 ? "+" : ""}{fmtK(d)}</span>}
              </div>
              {k.spark && (
                <div className="mt-2 h-8">
                  <ResponsiveContainer><AreaChart data={k.spark.map((v) => ({ v }))}><Area dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.08} strokeWidth={1.5} isAnimationActive={false} /></AreaChart></ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Performance financière" subtitle="Montants mensuels (MAD) — CA comparé à N-1" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={perf}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)} M`} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="CA N-1" fill="var(--muted-foreground)" fillOpacity={0.25} radius={[3, 3, 0, 0]} />
                <Bar dataKey="CA" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 h-48">
            <ResponsiveContainer>
              <LineChart data={perf}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e3).toFixed(0)} k`} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="EBE" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line dataKey="Rés. exploitation" stroke="var(--warning)" strokeWidth={2} dot={false} />
                <Line dataKey="Résultat net" stroke="var(--success)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Marge nette cumulée : {fmtPct(safeDiv(n.cpc.resultatNet, caN) === null ? null : (n.cpc.resultatNet / caN) * 100)} {n1.has && <>(N-1 : {fmtPct((n1.cpc.resultatNet / caN1) * 100)})</>}</p>
        </Panel>

        <Panel title="Structure des charges" subtitle={`Cumul ${p.year} — ${fmtK(totCh)}`}>
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={charges} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {charges.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {charges.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.name}</span>
                <span className="tabular-nums font-semibold">{totCh ? ((c.value / totCh) * 100).toFixed(1) : "—"} %</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Structure financière" subtitle={`Total bilan ${fmtK(b.totalActif)}`}>
          <div className="space-y-2.5">
            {structure.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{s.name}</span><span className="tabular-nums font-semibold">{fmtK(s.value)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(0, (s.value / b.totalPassif) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Équilibre financier" subtitle="Trésorerie nette = FRNG − BFR" action={<button onClick={() => go("analysis")} className="text-xs font-semibold text-primary hover:underline">Détail</button>}>
          {n.eq ? (
            <div className="space-y-3 text-sm">
              {[
                { k: "FRNG", v: n.eq.frng, f: "Financement permanent − Actif immobilisé" },
                { k: "BFR", v: n.eq.bfr, f: "Actif circulant HT − Passif circulant HT" },
                { k: "Trésorerie nette", v: n.eq.tn, f: "Trésorerie-actif − Trésorerie-passif" },
              ].map((x) => (
                <div key={x.k} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <div><p className="font-semibold">{x.k}</p><p className="text-xs text-muted-foreground">{x.f}</p></div>
                  <p className="tabular-nums font-bold">{fmtK(x.v)}</p>
                </div>
              ))}
              <p className={cn("text-xs", n.eq.coherent ? "text-success" : "text-destructive")}>{n.eq.coherent ? "Contrôle : FRNG − BFR = trésorerie nette ✓" : "Incohérence détectée entre FRNG, BFR et trésorerie"}</p>
            </div>
          ) : <p className="text-sm text-muted-foreground">Calcul impossible : comptes non classés ({n.bilan.unclassified.join(", ")}).</p>}
        </Panel>

        <Panel title="Alertes financières" subtitle="Calculées à partir des données disponibles">
          {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Aucune alerte sur la période.</p> : (
            <ul className="space-y-2.5">
              {alerts.map((a) => (
                <li key={a.title} className="flex gap-2.5">
                  <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", a.tone === "bad" ? "text-destructive" : "text-warning")} />
                  <div><p className="text-sm font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{a.detail}</p></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Analyse de la direction financière" subtitle="Écarts significatifs détectés automatiquement — à confirmer par l'analyse des pièces">
        {insights.length === 0 ? <p className="text-sm text-muted-foreground">Aucune dérive de charge significative par rapport à l'évolution du chiffre d'affaires.</p> : (
          <div className="grid gap-3 lg:grid-cols-3">
            {insights.map((i) => (
              <div key={i.observation} className="rounded-lg border border-border p-3 text-sm">
                <p className="flex gap-1.5 font-semibold"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{i.observation}</p>
                <dl className="mt-2 space-y-1.5 text-xs">
                  <div><dt className="font-semibold text-foreground">Impact financier</dt><dd className="text-muted-foreground">{i.impact}</dd></div>
                  <div><dt className="font-semibold text-foreground">Explication possible</dt><dd className="text-muted-foreground">{i.explication}</dd></div>
                  <div><dt className="font-semibold text-foreground">Action recommandée</dt><dd className="text-muted-foreground">{i.action}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
