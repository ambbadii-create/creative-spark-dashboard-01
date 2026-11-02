import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FilePlus2, RotateCcw, ShoppingBag, UserPlus } from "lucide-react";
import { DemoBadge, PageHeader } from "@/components/app/ui-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Btn } from "@/components/budget/ui";
import { StockProvider } from "@/lib/stock/store";
import { SalesProvider, useSales } from "@/lib/sales/store";
import type { Quote } from "@/lib/sales/model";
import { SalesOverview } from "@/components/sales/OverviewTab";
import { CustomersTab } from "@/components/sales/CustomersTab";
import { OpportunitiesTab } from "@/components/sales/OpportunitiesTab";
import { QuotesTab } from "@/components/sales/QuotesTab";
import { OrdersTab } from "@/components/sales/OrdersTab";
import { DeliveriesTab } from "@/components/sales/DeliveriesTab";
import { InvoicesTab } from "@/components/sales/InvoicesTab";
import { CollectionsTab } from "@/components/sales/CollectionsTab";
import { AnalysisTab } from "@/components/sales/AnalysisTab";

export const Route = createFileRoute("/ventes")({
  head: () => ({
    meta: [
      { title: "Ventes & Clients — Pilotage CG" },
      { name: "description", content: "Cycle commercial complet : clients, opportunités, devis, commandes, livraisons, factures et encaissements en MAD (HT, TVA, TTC)." },
      { property: "og:title", content: "Ventes & Clients — Pilotage CG" },
      { property: "og:description", content: "Gestion commerciale pour entreprises marocaines : ICE, IF, RC, TVA configurable, plafonds de crédit et balance âgée." },
    ],
  }),
  component: () => (
    <StockProvider>
      <SalesProvider>
        <VentesPage />
      </SalesProvider>
    </StockProvider>
  ),
});

function VentesPage() {
  const { reset } = useSales();
  const [tab, setTab] = useState("overview");
  const [newClient, setNewClient] = useState(0);
  const [newQuote, setNewQuote] = useState(0);
  const [newOrder, setNewOrder] = useState(0);
  const [seedQuote, setSeedQuote] = useState<Quote | null>(null);

  const convertQuote = (q: Quote) => {
    setSeedQuote(q);
    setTab("orders");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ventes & Clients"
        subtitle="Gestion du cycle commercial, suivi du chiffre d'affaires et pilotage de la relation client."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DemoBadge />
            <Btn variant="ghost" onClick={reset} title="Restaurer les données de démonstration (ventes et stocks)">
              <RotateCcw className="h-4 w-4" /> Réinitialiser
            </Btn>
            <Btn variant="ghost" onClick={() => { setTab("customers"); setNewClient((n) => n + 1); }}>
              <UserPlus className="h-4 w-4" /> Nouveau client
            </Btn>
            <Btn variant="ghost" onClick={() => { setTab("quotes"); setNewQuote((n) => n + 1); }}>
              <FilePlus2 className="h-4 w-4" /> Nouveau devis
            </Btn>
            <Btn onClick={() => { setTab("orders"); setNewOrder((n) => n + 1); }}>
              <ShoppingBag className="h-4 w-4" /> Nouvelle vente
            </Btn>
          </div>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="customers">Clients</TabsTrigger>
          <TabsTrigger value="opportunities">Prospects & Opportunités</TabsTrigger>
          <TabsTrigger value="quotes">Devis</TabsTrigger>
          <TabsTrigger value="orders">Commandes clients</TabsTrigger>
          <TabsTrigger value="deliveries">Livraisons</TabsTrigger>
          <TabsTrigger value="invoices">Factures clients</TabsTrigger>
          <TabsTrigger value="collections">Encaissements</TabsTrigger>
          <TabsTrigger value="analysis">Analyse commerciale</TabsTrigger>
        </TabsList>
        <div className="mt-5">
          <TabsContent value="overview"><SalesOverview /></TabsContent>
          <TabsContent value="customers"><CustomersTab newSignal={newClient} /></TabsContent>
          <TabsContent value="opportunities"><OpportunitiesTab /></TabsContent>
          <TabsContent value="quotes"><QuotesTab newSignal={newQuote} onConvert={convertQuote} /></TabsContent>
          <TabsContent value="orders"><OrdersTab newSignal={newOrder} seedQuote={seedQuote} onSeedConsumed={() => setSeedQuote(null)} /></TabsContent>
          <TabsContent value="deliveries"><DeliveriesTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="collections"><CollectionsTab /></TabsContent>
          <TabsContent value="analysis"><AnalysisTab /></TabsContent>
        </div>
      </Tabs>
      <p className="text-center text-xs text-muted-foreground">
        Données de démonstration fictives (identifiants ICE/IF/RC factices). Les livraisons débitent le stock partagé avec Stocks & Approvisionnements. Données conservées uniquement dans ce navigateur.
      </p>
    </div>
  );
}
