import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { DemoBadge, PageHeader } from "@/components/app/ui-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BudgetProvider, useBudgets } from "@/lib/budget/store";
import { ALL_MONTHS, CATEGORIES, CENTRES, DEPARTMENTS, MONTHS, centreDept, centreLabel, type BudgetLine } from "@/lib/budget/model";
import { Btn, Select } from "@/components/budget/ui";
import { OverviewTab } from "@/components/budget/OverviewTab";
import { LinesTab } from "@/components/budget/LinesTab";
import { ActualsTab } from "@/components/budget/ActualsTab";
import { VarianceTab } from "@/components/budget/VarianceTab";
import { ForecastTab } from "@/components/budget/ForecastTab";
import { ActionsTab } from "@/components/budget/ActionsTab";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets & Prévisions — Pilotage CG" },
      { name: "description", content: "Budgets par centre de coûts, saisie du réalisé, analyse des écarts et prévisions de fin d'année en MAD." },
      { property: "og:title", content: "Budgets & Prévisions — Pilotage CG" },
      { property: "og:description", content: "Budget vs réalisé, écarts et prévisions pour le contrôle de gestion." },
    ],
  }),
  component: () => (
    <BudgetProvider>
      <BudgetsPage />
    </BudgetProvider>
  ),
});

function BudgetsPage() {
  const { budgets, lines, reset } = useBudgets();
  const years = [...new Set(budgets.map((b) => b.year))].sort();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState("all");
  const [dept, setDept] = useState("all");
  const [centre, setCentre] = useState("all");
  const [cat, setCat] = useState("all");
  const [creating, setCreating] = useState(false);

  const budgetOf = useMemo(() => new Map(budgets.map((b) => [b.id, b])), [budgets]);
  const centreOf = (l: BudgetLine) => centreLabel(budgetOf.get(l.budgetId)?.centre ?? "");
  const months = month === "all" ? ALL_MONTHS : [Number(month)];

  const filtered = lines.filter((l) => {
    const b = budgetOf.get(l.budgetId);
    if (!b || b.year !== year) return false;
    if (dept !== "all" && centreDept(b.centre) !== dept) return false;
    if (centre !== "all" && b.centre !== centre) return false;
    if (cat !== "all" && l.category !== cat) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Budgets & Prévisions"
        subtitle="Planification budgétaire, suivi des réalisations et analyse des écarts."
        actions={
          <div className="flex items-center gap-3">
            <DemoBadge />
            <Btn variant="ghost" onClick={reset} title="Restaurer les données de démonstration"><RotateCcw className="h-4 w-4" />Réinitialiser</Btn>
            <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Créer un budget</Btn>
          </div>
        }
      />

      <div className="card-elevated grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
        <Select label="Société" value="atlas" onChange={() => {}}>
          <option value="atlas">Société Atlas SA</option>
        </Select>
        <Select label="Exercice" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select label="Mois" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">Cumul annuel</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </Select>
        <Select label="Département" value={dept} onChange={(e) => { setDept(e.target.value); setCentre("all"); }}>
          <option value="all">Tous</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <Select label="Centre de coûts" value={centre} onChange={(e) => setCentre(e.target.value)}>
          <option value="all">Tous</option>
          {CENTRES.filter((c) => dept === "all" || c.department === dept).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        <Select label="Compte / catégorie" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">Toutes</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.compte} · {c.label}</option>)}
        </Select>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="lines">Lignes budgétaires</TabsTrigger>
          <TabsTrigger value="actuals">Saisie du réalisé</TabsTrigger>
          <TabsTrigger value="variance">Analyse des écarts</TabsTrigger>
          <TabsTrigger value="forecast">Prévisions</TabsTrigger>
          <TabsTrigger value="actions">Actions correctives</TabsTrigger>
        </TabsList>
        <div className="mt-5">
          <TabsContent value="overview"><OverviewTab lines={filtered} months={months} centreOf={(l) => budgetOf.get(l.budgetId)?.centre ?? ""} /></TabsContent>
          <TabsContent value="lines"><LinesTab lines={filtered} year={year} /></TabsContent>
          <TabsContent value="actuals"><ActualsTab lines={filtered} year={year} /></TabsContent>
          <TabsContent value="variance"><VarianceTab lines={filtered} months={months} centreOf={centreOf} /></TabsContent>
          <TabsContent value="forecast"><ForecastTab lines={filtered} /></TabsContent>
          <TabsContent value="actions"><ActionsTab lines={filtered} centreOf={centreOf} /></TabsContent>
        </div>
      </Tabs>
      <p className="text-center text-xs text-muted-foreground">
        Données de démonstration fictives. Vos modifications sont conservées uniquement dans ce navigateur.
      </p>

      {creating && <CreateBudgetDialog year={year} onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateBudgetDialog({ year, onClose }: { year: number; onClose: () => void }) {
  const { budgets, addBudget } = useBudgets();
  const [y, setY] = useState(year);
  const [centre, setCentre] = useState(CENTRES[0]!.id);
  const [err, setErr] = useState("");
  const years = [...new Set([...budgets.map((b) => b.year), 2026, 2027])].sort();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un budget</DialogTitle>
          <DialogDescription>Un budget regroupe les lignes budgétaires d'un centre de coûts pour un exercice.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (budgets.some((b) => b.year === y && b.centre === centre)) {
              setErr("Un budget existe déjà pour ce centre et cet exercice.");
              return;
            }
            addBudget({ year: y, centre });
            onClose();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Select label="Exercice" value={y} onChange={(e) => setY(Number(e.target.value))}>
              {years.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
            <Select label="Centre de coûts" value={centre} onChange={(e) => setCentre(e.target.value)}>
              {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground">Ajoutez ensuite les lignes budgétaires dans l'onglet « Lignes budgétaires ».</p>
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="ghost" onClick={onClose}>Annuler</Btn>
            <Btn type="submit">Créer</Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
