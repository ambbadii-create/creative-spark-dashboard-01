import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeftRight, PackagePlus, RotateCcw, ShoppingCart } from "lucide-react";
import { DemoBadge, PageHeader } from "@/components/app/ui-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockProvider, useStock } from "@/lib/stock/store";
import type { MovementType } from "@/lib/stock/model";
import { Btn, Select } from "@/components/budget/ui";
import { OverviewTab } from "@/components/stock/OverviewTab";
import { InventoryTab } from "@/components/stock/InventoryTab";
import { MovementsTab } from "@/components/stock/MovementsTab";
import { OrdersTab, type OrderDraft } from "@/components/stock/OrdersTab";
import { AlertsTab } from "@/components/stock/AlertsTab";

export const Route = createFileRoute("/stocks")({
  head: () => ({
    meta: [
      { title: "Stocks & Approvisionnements — Pilotage CG" },
      { name: "description", content: "Suivi des stocks, gestion des mouvements et optimisation des approvisionnements en MAD." },
      { property: "og:title", content: "Stocks & Approvisionnements — Pilotage CG" },
      { property: "og:description", content: "État des stocks, mouvements, commandes fournisseurs et alertes de réapprovisionnement." },
    ],
  }),
  component: () => (
    <StockProvider>
      <StocksPage />
    </StockProvider>
  ),
});

function StocksPage() {
  const { reset } = useStock();
  const [tab, setTab] = useState("overview");
  const [movementPreset, setMovementPreset] = useState<MovementType | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);

  const openMovement = (type?: MovementType) => {
    setMovementPreset(type ?? "entree");
    setTab("movements");
  };
  const openOrder = (draft?: OrderDraft) => {
    setOrderDraft(draft ?? {});
    setTab("orders");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stocks & Approvisionnements"
        subtitle="Suivi des stocks, gestion des mouvements et optimisation des approvisionnements."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DemoBadge />
            <Btn variant="ghost" onClick={reset} title="Restaurer les données de démonstration">
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </Btn>
            <Btn variant="ghost" onClick={() => openMovement()}>
              <ArrowLeftRight className="h-4 w-4" />
              Nouveau mouvement
            </Btn>
            <Btn variant="ghost" onClick={() => openOrder()}>
              <ShoppingCart className="h-4 w-4" />
              Nouvelle commande
            </Btn>
            <Btn onClick={() => openMovement("entree")}>
              <PackagePlus className="h-4 w-4" />
              Nouvelle entrée
            </Btn>
          </div>
        }
      />

      <div className="card-elevated grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Select label="Société" value="atlas" onChange={() => {}}>
          <option value="atlas">Société Atlas SA</option>
        </Select>
        <Select label="Exercice" value="2026" onChange={() => {}}>
          <option value="2026">2026</option>
        </Select>
        <Select label="Valorisation" value="cmup" onChange={() => {}}>
          <option value="cmup">Coût unitaire moyen pondéré (CMUP)</option>
        </Select>
        <Select label="Devise" value="mad" onChange={() => {}}>
          <option value="mad">Dirham marocain (MAD)</option>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="inventory">État des stocks</TabsTrigger>
          <TabsTrigger value="movements">Mouvements</TabsTrigger>
          <TabsTrigger value="orders">Approvisionnements</TabsTrigger>
          <TabsTrigger value="alerts">Alertes</TabsTrigger>
        </TabsList>
        <div className="mt-5">
          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryTab onAdjust={() => openMovement()} />
          </TabsContent>
          <TabsContent value="movements">
            <MovementsTab preset={movementPreset} onPresetConsumed={() => setMovementPreset(null)} />
          </TabsContent>
          <TabsContent value="orders">
            <OrdersTab draft={orderDraft} onDraftConsumed={() => setOrderDraft(null)} />
          </TabsContent>
          <TabsContent value="alerts">
            <AlertsTab onCreateOrder={(productId, quantity) => openOrder({ productId, quantity })} />
          </TabsContent>
        </div>
      </Tabs>
      <p className="text-center text-xs text-muted-foreground">
        Données de démonstration fictives. Vos modifications sont conservées uniquement dans ce navigateur.
      </p>
    </div>
  );
}
