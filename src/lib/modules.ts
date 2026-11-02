import {
  LayoutDashboard, Target, Boxes, ShoppingCart, Users, Calculator, PieChart, Wallet, FileBarChart, Settings,
  type LucideIcon,
} from "lucide-react";

export type ModuleDef = {
  to: string;
  title: string;
  icon: LucideIcon;
  description: string;
  features: string[];
};

export const modules: ModuleDef[] = [
  { to: "/", title: "Tableau de bord", icon: LayoutDashboard, description: "Vue d'ensemble de la performance.", features: [] },
  { to: "/budgets", title: "Budgets & Prévisions", icon: Target, description: "Élaborez vos budgets annuels, suivez les réalisations et analysez les écarts.", features: ["Budget annuel par centre de responsabilité", "Révisions et forecasts trimestriels", "Analyse des écarts budget / réalisé", "Scénarios et simulations"] },
  { to: "/stocks", title: "Stocks & Approvisionnements", icon: Boxes, description: "Pilotez vos niveaux de stock, la valorisation et les réapprovisionnements.", features: ["Valorisation (CMUP, FIFO)", "Seuils d'alerte et stock de sécurité", "Rotation et couverture des stocks", "Plan d'approvisionnement"] },
  { to: "/achats", title: "Achats & Fournisseurs", icon: ShoppingCart, description: "Suivez vos commandes, vos fournisseurs et leurs délais de paiement.", features: ["Suivi des commandes fournisseurs", "Évaluation des fournisseurs", "Délais de paiement (loi 69-21)", "Analyse des dépenses par catégorie"] },
  { to: "/ventes", title: "Ventes & Clients", icon: Users, description: "Analysez votre chiffre d'affaires, vos clients et vos créances.", features: ["CA par client, produit et région", "Balance âgée des créances", "Analyse de la marge commerciale", "Suivi des objectifs commerciaux"] },
  { to: "/comptabilite", title: "Comptabilité & Analyse financière", icon: Calculator, description: "Exploitez vos états de synthèse selon le CGNC.", features: ["Bilan et CPC (normes CGNC)", "État des soldes de gestion (ESG)", "Ratios financiers", "Tableau de financement"] },
  { to: "/couts", title: "Coûts & Rentabilité", icon: PieChart, description: "Calculez vos coûts de revient et la rentabilité par activité.", features: ["Méthode des sections homogènes", "Coûts complets et coûts partiels", "Seuil de rentabilité", "Rentabilité par produit et par client"] },
  { to: "/tresorerie", title: "Trésorerie", icon: Wallet, description: "Anticipez vos flux et pilotez vos positions bancaires.", features: ["Plan de trésorerie glissant", "Positions par banque", "Rapprochements bancaires", "Prévisions d'encaissements / décaissements"] },
  { to: "/reporting", title: "Reporting", icon: FileBarChart, description: "Produisez vos tableaux de bord et rapports de gestion.", features: ["Reporting mensuel de direction", "Tableaux de bord personnalisés", "Export PDF et Excel", "Diffusion programmée"] },
  { to: "/administration", title: "Administration", icon: Settings, description: "Gérez les utilisateurs, les droits et les paramètres de la société.", features: ["Utilisateurs et rôles", "Paramètres société (ICE, IF, RC)", "Exercices comptables", "Plan de comptes et axes analytiques"] },
];

export const getModule = (to: string) => modules.find((m) => m.to === to)!;
