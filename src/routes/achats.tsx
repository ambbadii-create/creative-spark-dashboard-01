import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FilePlus2, RotateCcw, ShoppingCart } from "lucide-react";
import { DemoBadge, PageHeader } from "@/components/app/ui-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Btn } from "@/components/budget/ui";
import { StockProvider } from "@/lib/stock/store";
import { PurchaseProvider, usePurchase } from "@/lib/purchase/store";
import { PurchaseOverview } from "@/components/purchase/OverviewTab";
import { RequestsTab } from "@/components/purchase/RequestsTab";
import { OrdersTab, type OrderSeed } from "@/components/purchase/OrdersTab";
import { ReceiptsTab } from "@/components/purchase/ReceiptsTab";
import { SuppliersTab } from "@/components/purchase/SuppliersTab";
import { InvoicesTab } from "@/components/purchase/InvoicesTab";
import { PaymentsTab } from "@/components/purchase/PaymentsTab";
import { AnalysisTab } from "@/components/purchase/AnalysisTab";

export const Route = createFileRoute("/achats")({
  head: () => ({
    meta: [
      { title: "Achats & Fournisseurs — Pilotage CG" },
      { name: "description", content: "Demandes d'achat, commandes, réceptions, factures et règlements fournisseurs en MAD (HT, TVA, TTC)." },
      { property: "og:title", content: "Achats & Fournisseurs — Pilotage CG" },
      { property: "og:description", content: "Gestion des achats et des fournisseurs pour entreprises marocaines : ICE, IF, RC, TVA configurable." },
    ],
  }),
  component: () => (
    <StockProvider>
      <PurchaseProvider>
        <AchatsPage />
      </PurchaseProvider>
    </StockProvider>
  ),
});

function AchatsPage() {
  const { reset } = usePurchase();
  const [tab, setTab] = useState("overview");
  const [seed, setSeed] = useState<OrderSeed | null>(null);
  const openOrder = (s: OrderSeed = {}) => {
    setSeed(s);
    setTab("orders");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Achats & Fournisseurs"
        subtitle="Du besoin interne au règlement fournisseur : demandes, commandes, réceptions, factures et paiements."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DemoBadge />
            <Btn variant="ghost" onClick={reset} title="Restaurer les données de démonstration (achats et stocks)">
              <RotateCcw className="h-4 w-4" /> Réinitialiser
            </Btn>
            <Btn variant="ghost" onClick={() => setTab("requests")}>
              <FilePlus2 className="h-4 w-4" /> Demandes d'achat
            </Btn>
            <Btn onClick={() => openOrder()}>
              <ShoppingCart className="h-4 w-4" /> Nouvelle commande
            </Btn>
          </div>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="requests">Demandes d'achat</TabsTrigger>
          <TabsTrigger value="orders">Commandes fournisseurs</TabsTrigger>
          <TabsTrigger value="receipts">Réceptions</TabsTrigger>
          <TabsTrigger value="suppliers">Fournisseurs</TabsTrigger>
          <TabsTrigger value="invoices">Factures fournisseurs</TabsTrigger>
          <TabsTrigger value="payments">Règlements</TabsTrigger>
          <TabsTrigger value="analysis">Analyse des achats</TabsTrigger>
        </TabsList>
        <div className="mt-5">
          <TabsContent value="overview"><PurchaseOverview /></TabsContent>
          <TabsContent value="requests"><RequestsTab onConvert={openOrder} /></TabsContent>
          <TabsContent value="orders"><OrdersTab seed={seed} onSeedConsumed={() => setSeed(null)} /></TabsContent>
          <TabsContent value="receipts"><ReceiptsTab /></TabsContent>
          <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="payments"><PaymentsTab /></TabsContent>
          <TabsContent value="analysis"><AnalysisTab /></TabsContent>
        </div>
      </Tabs>
      <p className="text-center text-xs text-muted-foreground">
        Données de démonstration fictives (identifiants ICE/IF/RC factices). Les commandes et réceptions sont partagées avec Stocks & Approvisionnements. Données conservées uniquement dans ce navigateur.
      </p>
    </div>
  );
}
