import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import { DemoBadge, PageHeader } from "@/components/app/ui-bits";
import { Btn, Select } from "@/components/budget/ui";
import { StockProvider } from "@/lib/stock/store";
import { SalesProvider } from "@/lib/sales/store";
import { PurchaseProvider } from "@/lib/purchase/store";
import { BudgetProvider } from "@/lib/budget/store";
import { ComptaProvider, ROLES, useCompta, type Role } from "@/lib/compta/store";
import { MONTHS_LONG } from "@/lib/compta/model";
import { LAST_DATA } from "@/lib/compta/demo";
import { SubNav } from "@/components/compta/ui";
import { OverviewTab } from "@/components/compta/OverviewTab";
import { GeneralTab } from "@/components/compta/GeneralTab";
import { StatementsTab } from "@/components/compta/StatementsTab";
import { AnalysisTab } from "@/components/compta/AnalysisTab";
import { BudgetTab } from "@/components/compta/BudgetTab";
import { ReceivablesTab } from "@/components/compta/ReceivablesTab";
import { RatiosTab } from "@/components/compta/RatiosTab";
import { ClosingTab } from "@/components/compta/ClosingTab";

export const Route = createFileRoute("/comptabilite")({
  head: () => ({
    meta: [
      { title: "Comptabilité & Analyse financière — Pilotage CG" },
      { name: "description", content: "Comptabilité générale CGNC, états de synthèse, SIG, CAF, équilibre financier, ratios et clôture en MAD." },
      { property: "og:title", content: "Comptabilité & Analyse financière — Pilotage CG" },
      { property: "og:description", content: "Bilan, CPC, ESG, ratios financiers et contrôles de clôture pour les entreprises marocaines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StockProvider>
      <SalesProvider>
        <PurchaseProvider>
          <BudgetProvider>
            <ComptaProvider>
              <ComptaPage />
            </ComptaProvider>
          </BudgetProvider>
        </PurchaseProvider>
      </SalesProvider>
    </StockProvider>
  ),
});

const SECTIONS = [
  { id: "overview", label: "Vue d'ensemble financière" },
  { id: "general", label: "Comptabilité générale" },
  { id: "statements", label: "États financiers" },
  { id: "analysis", label: "Analyse financière" },
  { id: "budget", label: "Analyse budgétaire" },
  { id: "ar", label: "Créances & Dettes" },
  { id: "ratios", label: "Ratios financiers" },
  { id: "closing", label: "Clôture & Contrôle" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

function ComptaPage() {
  const { role, setRole, reset, updatedAt } = useCompta();
  const [section, setSection] = useState<Section>("overview");
  const [year, setYear] = useState(LAST_DATA.year);
  const [to, setTo] = useState(LAST_DATA.month);
  const p = { year, to };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comptabilité & Analyse financière"
        subtitle={`Exercice ${year} — cumul de janvier à fin ${MONTHS_LONG[to]}, comparé à la même période ${year - 1}. Montants en MAD.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <DemoBadge />
            <Btn variant="ghost" onClick={reset} title="Restaurer les données de démonstration"><RotateCcw className="h-4 w-4" />Réinitialiser</Btn>
            <Btn variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimer</Btn>
          </div>
        }
      />

      <div className="card-elevated grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6 print:hidden">
        <Select label="Société" value="atlas" onChange={() => {}}><option value="atlas">Société Atlas SA</option></Select>
        <Select label="Exercice" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setTo(y === LAST_DATA.year ? LAST_DATA.month : 11); }}>
          <option value={2026}>2026 (en cours)</option>
          <option value={2025}>2025 (clôturé)</option>
        </Select>
        <Select label="Période (cumul à fin de)" value={to} onChange={(e) => setTo(Number(e.target.value))}>
          {MONTHS_LONG.map((m, i) => <option key={m} value={i} disabled={year === LAST_DATA.year && i > LAST_DATA.month}>{m}</option>)}
        </Select>
        <Select label="Comparaison" value="n1" onChange={() => {}}><option value="n1">Même période N-1</option></Select>
        <Select label="Rôle (démonstration)" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </Select>
        <div className="text-xs text-muted-foreground">
          <span className="mb-1 block font-medium">Devise · mise à jour</span>
          <span className="flex h-9 items-center rounded-lg border border-border bg-muted/40 px-3 text-foreground">MAD · {new Date(updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
        </div>
      </div>

      <SubNav items={[...SECTIONS]} value={section} onChange={setSection} />

      {section === "overview" && <OverviewTab p={p} go={setSection} />}
      {section === "general" && <GeneralTab p={p} />}
      {section === "statements" && <StatementsTab p={p} />}
      {section === "analysis" && <AnalysisTab p={p} />}
      {section === "budget" && <BudgetTab p={p} />}
      {section === "ar" && <ReceivablesTab />}
      {section === "ratios" && <RatiosTab p={p} />}
      {section === "closing" && <ClosingTab p={p} />}

      <p className="text-center text-xs text-muted-foreground">
        Données de démonstration fictives (Société Atlas SA). Les états sont calculés à partir des écritures validées ; les mappings CGNC et règles fiscales doivent être validés par votre expert-comptable avant tout usage réglementaire.
      </p>
    </div>
  );
}
