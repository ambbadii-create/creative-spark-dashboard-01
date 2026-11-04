import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Btn, thead, trow } from "@/components/budget/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { downloadCsv } from "@/components/compta/ui";
import { Empty, Pager, usePager } from "./ui";

export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export function Workspace({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><div className="flex flex-wrap gap-2">{actions}</div></div>{children}</section>;
}
export function DataTable({ headers, rows, filename }: { headers: string[]; rows: { id: string; cells: ReactNode[]; export?: (string | number)[] }[]; filename?: string }) {
  const pager = usePager(rows);
  return <div className="min-w-0"><div className="mb-2 flex justify-end">{filename && <Btn variant="ghost" onClick={() => downloadCsv(`${filename}.csv`, headers, rows.map((r) => r.export ?? r.cells.map((c) => typeof c === "string" || typeof c === "number" ? c : "")))}><Download className="h-4 w-4"/>CSV</Btn>}</div><div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead className={thead}><tr>{headers.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead><tbody>{pager.slice.map((r) => <tr key={r.id} className={trow}>{r.cells.map((c, i) => <td key={i} className="px-3 py-3 align-top">{c}</td>)}</tr>)}</tbody></table>{!rows.length && <Empty>Aucune donnée pour cette sélection.</Empty>}</div><Pager {...pager}/></div>;
}
export function Editor({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Société Atlas SA · Trésorerie</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}
export function FormError({ message }: { message: string | null }) { return message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null; }