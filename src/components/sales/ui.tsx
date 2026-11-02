// Ventes & Clients — helpers et badges partagés (même langage visuel que Achats).
import type { ReactNode } from "react";
import { Badge } from "@/components/purchase/ui";
import type { InvoiceStatus, OrderStatus, QuoteStatus, Stage } from "@/lib/sales/model";

export { Badge, fmt2, fdate, today, Table, Th, Td, rowCls, IconBtn, TextArea } from "@/components/purchase/ui";

const Q_TONE: Record<QuoteStatus, Parameters<typeof Badge>[0]["t"]> = {
  Brouillon: "muted",
  Envoyé: "info",
  Accepté: "good",
  Refusé: "bad",
  Converti: "good",
};
export const QuoteBadge = ({ s }: { s: QuoteStatus }) => <Badge t={Q_TONE[s]}>{s}</Badge>;

const O_TONE: Record<OrderStatus, Parameters<typeof Badge>[0]["t"]> = {
  Confirmée: "info",
  "Partiellement livrée": "warn",
  Livrée: "good",
  Facturée: "good",
  Annulée: "bad",
};
export const OrderBadge = ({ s }: { s: OrderStatus }) => <Badge t={O_TONE[s]}>{s}</Badge>;

const I_TONE: Record<InvoiceStatus, Parameters<typeof Badge>[0]["t"]> = {
  Émise: "info",
  "Partiellement réglée": "warn",
  Réglée: "good",
  "En retard": "bad",
};
export const SalesInvoiceBadge = ({ s }: { s: InvoiceStatus }) => <Badge t={I_TONE[s]}>{s}</Badge>;

const S_TONE: Record<Stage, Parameters<typeof Badge>[0]["t"]> = {
  Prospection: "muted",
  Qualification: "info",
  Proposition: "info",
  Négociation: "warn",
  Gagnée: "good",
  Perdue: "bad",
};
export const StageBadge = ({ s }: { s: Stage }) => <Badge t={S_TONE[s]}>{s}</Badge>;

/** Export CSV (séparateur « ; », compatible Excel fr). */
export function downloadCsv(filename: string, head: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const body = [head, ...rows].map((r) => r.map(esc).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Empty({ children }: { children?: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children ?? "Aucun élément à afficher."}</p>;
}
