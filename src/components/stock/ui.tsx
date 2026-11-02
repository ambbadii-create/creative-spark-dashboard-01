import { cn } from "@/lib/utils";
import { STATUS_LABEL, type OrderStatus, type StockStatus } from "@/lib/stock/model";

const STATUS_TONE: Record<StockStatus, string> = {
  disponible: "bg-success-soft text-success",
  faible: "bg-warning-soft text-warning",
  rupture: "bg-destructive-soft text-destructive",
  surstock: "bg-accent text-accent-foreground",
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

const ORDER_TONE: Record<OrderStatus, string> = {
  Brouillon: "bg-muted text-muted-foreground",
  "En attente de validation": "bg-warning-soft text-warning",
  Validée: "bg-accent text-accent-foreground",
  Envoyée: "bg-accent text-accent-foreground",
  "Partiellement reçue": "bg-accent text-accent-foreground",
  Reçue: "bg-success-soft text-success",
  Annulée: "bg-destructive-soft text-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", ORDER_TONE[status])}>{status}</span>;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
