import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { InvoiceStatus, RequestStatus } from "@/lib/purchase/model";

export const today = () => new Date().toISOString().slice(0, 10);
export const fmt2 = (v: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} DH`;
export const fdate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");

const tone = {
  muted: "bg-muted text-muted-foreground",
  warn: "bg-warning-soft text-warning",
  info: "bg-accent text-accent-foreground",
  good: "bg-success-soft text-success",
  bad: "bg-destructive-soft text-destructive",
};
export function Badge({ t, children }: { t: keyof typeof tone; children: ReactNode }) {
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", tone[t])}>{children}</span>;
}

const REQ_TONE: Record<RequestStatus, keyof typeof tone> = {
  Brouillon: "muted",
  Soumise: "info",
  "En validation": "warn",
  Approuvée: "good",
  Rejetée: "bad",
  "Convertie en commande": "good",
};
export const RequestBadge = ({ s }: { s: RequestStatus }) => <Badge t={REQ_TONE[s]}>{s}</Badge>;

const INV_TONE: Record<InvoiceStatus, keyof typeof tone> = {
  "À vérifier": "warn",
  Validée: "info",
  "Partiellement payée": "info",
  Payée: "good",
  "En retard": "bad",
};
export const InvoiceBadge = ({ s }: { s: InvoiceStatus }) => <Badge t={INV_TONE[s]}>{s}</Badge>;

export function Table({ head, children, empty }: { head: ReactNode; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="py-8 text-center text-sm text-muted-foreground">Aucun élément à afficher.</p>}
    </div>
  );
}
export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => <th className={cn("py-2.5 pr-3 font-medium", right && "text-right")}>{children}</th>;
export const Td = ({ children, right, strong, muted, className }: { children?: ReactNode; right?: boolean; strong?: boolean; muted?: boolean; className?: string }) => (
  <td className={cn("py-2.5 pr-3", right && "text-right", strong ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground", className)}>{children}</td>
);
export const rowCls = "border-b border-border last:border-0 hover:bg-muted/50";

export function IconBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={cn("rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground", danger && "hover:bg-destructive-soft hover:text-destructive")}>
      {children}
    </button>
  );
}

export function TextArea({ label, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      <textarea className="min-h-16 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" {...p} />
    </label>
  );
}
