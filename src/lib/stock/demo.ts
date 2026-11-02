// Données de démonstration — Stocks & Approvisionnements (Société Atlas SA, fictif).
import type { Movement, Product, PurchaseOrder } from "./model";

const products: Product[] = [
  { id: "P-HUI1", ref: "HUI-001", designation: "Huile d'olive 5L", category: "Huiles & condiments", unit: "Bidon", warehouseId: "ENT-CASA", stock: 120, min: 400, max: 1200, unitCost: 285, supplier: "Coopérative Zaytouna", barcode: "6111250900017", expiry: "2027-06-30" },
  { id: "P-SEM1", ref: "SEM-001", designation: "Semoule fine 25kg", category: "Épicerie", unit: "Sac", warehouseId: "ENT-FES", stock: 310, min: 500, max: 1500, unitCost: 96, supplier: "Minoterie Al Manar", barcode: "6111250900024" },
  { id: "P-THE1", ref: "THE-001", designation: "Thé vert 500g", category: "Boissons", unit: "Boîte", warehouseId: "ENT-TGR", stock: 860, min: 1000, max: 3000, unitCost: 42, supplier: "Sultan Tea Import", barcode: "6111250900031" },
  { id: "P-SUC1", ref: "SUC-001", designation: "Sucre en pain 2kg", category: "Épicerie", unit: "Paquet", warehouseId: "ENT-MKE", stock: 45, min: 300, max: 900, unitCost: 18, supplier: "COSUMAR", barcode: "6111250900048" },
  { id: "P-FAR1", ref: "FAR-001", designation: "Farine T55 50kg", category: "Épicerie", unit: "Sac", warehouseId: "ENT-CASA", stock: 2400, min: 800, max: 3000, unitCost: 210, supplier: "Minoterie Al Manar", barcode: "6111250900055" },
  { id: "P-LAI1", ref: "LAI-001", designation: "Lait UHT 1L", category: "Boissons", unit: "Brique", warehouseId: "ENT-CASA", stock: 0, min: 600, max: 2400, unitCost: 7.5, supplier: "Centrale Danone", barcode: "6111250900062", expiry: "2026-12-20" },
  { id: "P-COU1", ref: "COU-001", designation: "Couscous moyen 10kg", category: "Épicerie", unit: "Sac", warehouseId: "ENT-FES", stock: 540, min: 300, max: 1200, unitCost: 85, supplier: "Dari", barcode: "6111250900079" },
  { id: "P-HUI2", ref: "HUI-002", designation: "Huile de tournesol 5L", category: "Huiles & condiments", unit: "Bidon", warehouseId: "ENT-TGR", stock: 980, min: 400, max: 1600, unitCost: 62, supplier: "Lesieur Cristal", barcode: "6111250900086" },
  { id: "P-CON1", ref: "CON-001", designation: "Concentré de tomate 400g", category: "Épicerie", unit: "Boîte", warehouseId: "ENT-CASA", stock: 3200, min: 1000, max: 4000, unitCost: 6.8, supplier: "Conserves Meknès", barcode: "6111250900093", expiry: "2026-12-15" },
  { id: "P-EAU1", ref: "EAU-001", designation: "Eau minérale 1,5L", category: "Boissons", unit: "Bouteille", warehouseId: "ENT-MKE", stock: 1800, min: 900, max: 3600, unitCost: 3.2, supplier: "Oulmès", barcode: "6111250900109" },
  { id: "P-SAV1", ref: "SAV-001", designation: "Savon liquide 5L", category: "Hygiène", unit: "Bidon", warehouseId: "ENT-CASA", stock: 210, min: 150, max: 600, unitCost: 74, supplier: "Procter Maroc", barcode: "6111250900116" },
  { id: "P-RIZ1", ref: "RIZ-001", designation: "Riz long 10kg", category: "Épicerie", unit: "Sac", warehouseId: "ENT-TGR", stock: 420, min: 350, max: 1400, unitCost: 98, supplier: "Dari", barcode: "6111250900123" },
  { id: "P-PAT1", ref: "PAT-001", designation: "Pâtes spaghetti 5kg", category: "Épicerie", unit: "Carton", warehouseId: "ENT-FES", stock: 690, min: 400, max: 1600, unitCost: 55, supplier: "Dari", barcode: "6111250900130" },
  { id: "P-SUR1", ref: "SUR-001", designation: "Légumes surgelés 2,5kg", category: "Surgelés", unit: "Sachet", warehouseId: "ENT-CASA", stock: 150, min: 200, max: 800, unitCost: 46, supplier: "Frigodar", barcode: "6111250900147", expiry: "2026-11-20" },
  { id: "P-MIE1", ref: "MIE-001", designation: "Miel d'oranger 1kg", category: "Épicerie", unit: "Pot", warehouseId: "ENT-MKE", stock: 950, min: 100, max: 400, unitCost: 120, supplier: "Ruchers du Moyen Atlas", barcode: "6111250900154", expiry: "2028-03-01" },
];

const mv = (id: string, date: string, type: Movement["type"], productId: string, warehouseId: string, quantity: number, unitCost: number, document?: string): Movement => ({
  id, date, number: `MVT-2026-${id}`, type, productId, warehouseId, quantity, unitCost, document, user: "S. Bennani",
});

const movements: Movement[] = [
  mv("0001", "2026-01-12", "entree", "P-FAR1", "ENT-CASA", 2000, 208, "BL-2026-0112"),
  mv("0002", "2026-01-20", "entree", "P-HUI1", "ENT-CASA", 800, 282, "BL-2026-0131"),
  mv("0003", "2026-02-04", "sortie", "P-HUI1", "ENT-CASA", 320, 285, "FAC-2026-0204"),
  mv("0004", "2026-02-18", "entree", "P-SEM1", "ENT-FES", 900, 94, "BL-2026-0208"),
  mv("0005", "2026-03-05", "sortie", "P-FAR1", "ENT-CASA", 600, 210, "FAC-2026-0311"),
  mv("0006", "2026-03-22", "transfert", "P-CON1", "ENT-CASA", 400, 6.8, "BT-2026-0041"),
  mv("0007", "2026-04-09", "entree", "P-THE1", "ENT-TGR", 1500, 41, "BL-2026-0277"),
  mv("0008", "2026-04-25", "sortie", "P-THE1", "ENT-TGR", 500, 42, "FAC-2026-0452"),
  mv("0009", "2026-05-11", "retour_client", "P-EAU1", "ENT-MKE", 120, 3.2, "AVO-2026-0018"),
  mv("0010", "2026-05-28", "sortie", "P-SUC1", "ENT-MKE", 400, 18, "FAC-2026-0587"),
  mv("0011", "2026-06-15", "entree", "P-HUI2", "ENT-TGR", 1000, 61, "BL-2026-0390"),
  mv("0012", "2026-06-29", "ajustement_neg", "P-SUR1", "ENT-CASA", 30, 46, "INV-2026-06"),
  mv("0013", "2026-07-14", "sortie", "P-LAI1", "ENT-CASA", 900, 7.5, "FAC-2026-0712"),
  mv("0014", "2026-07-30", "retour_fournisseur", "P-RIZ1", "ENT-TGR", 60, 98, "RET-2026-0007"),
  mv("0015", "2026-08-19", "entree", "P-PAT1", "ENT-FES", 700, 54, "BL-2026-0518"),
  mv("0016", "2026-09-02", "sortie", "P-HUI1", "ENT-CASA", 360, 285, "FAC-2026-0834"),
  mv("0017", "2026-09-21", "ajustement_pos", "P-SAV1", "ENT-CASA", 40, 74, "INV-2026-09"),
  mv("0018", "2026-10-06", "sortie", "P-SEM1", "ENT-FES", 450, 96, "FAC-2026-0951"),
  mv("0019", "2026-10-18", "sortie", "P-SUC1", "ENT-MKE", 255, 18, "FAC-2026-1002"),
  mv("0020", "2026-10-24", "entree", "P-MIE1", "ENT-MKE", 600, 118, "BL-2026-0633"),
];

const orders: PurchaseOrder[] = [
  {
    id: "O-041", number: "CMD-2026-041", supplier: "Coopérative Zaytouna", date: "2026-10-08", expected: "2026-10-20", status: "Partiellement reçue",
    lines: [
      { productId: "P-HUI1", quantity: 600, received: 300, unitCost: 284 },
    ],
  },
  {
    id: "O-042", number: "CMD-2026-042", supplier: "Centrale Danone", date: "2026-10-12", expected: "2026-10-26", status: "Validée",
    lines: [
      { productId: "P-LAI1", quantity: 1800, received: 0, unitCost: 7.4 },
    ],
  },
  {
    id: "O-043", number: "CMD-2026-043", supplier: "COSUMAR", date: "2026-09-15", expected: "2026-09-28", status: "Reçue",
    lines: [
      { productId: "P-SUC1", quantity: 500, received: 500, unitCost: 17.8 },
    ],
  },
  {
    id: "O-044", number: "CMD-2026-044", supplier: "Dari", date: "2026-10-21", expected: "2026-11-05", status: "En attente de validation",
    lines: [
      { productId: "P-COU1", quantity: 400, received: 0, unitCost: 84 },
      { productId: "P-PAT1", quantity: 600, received: 0, unitCost: 54.5 },
    ],
  },
  {
    id: "O-045", number: "CMD-2026-045", supplier: "Sultan Tea Import", date: "2026-10-24", expected: "2026-11-10", status: "Brouillon",
    lines: [
      { productId: "P-THE1", quantity: 1200, received: 0, unitCost: 41.5 },
    ],
  },
  {
    id: "O-046", number: "CMD-2026-046", supplier: "Frigodar", date: "2026-09-28", expected: "2026-10-12", status: "Validée",
    lines: [
      { productId: "P-SUR1", quantity: 500, received: 0, unitCost: 45.5 },
    ],
  },
];

export const buildStockDemo = () => ({ products, movements, orders });
