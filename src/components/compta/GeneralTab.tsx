import { useMemo, useState } from "react";
import { CheckCircle2, Download, Lock, Pencil, Plus, Search, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/app/ui-bits";
import { Btn, Select, fieldCls, thead, trow } from "@/components/budget/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { can, useCompta } from "@/lib/compta/store";
import {
  CHART, CLASSES, JOURNALS, accountClass, accountLabel, accountNature, accountType, entryTotals, fmtNum, isBalanced, ledger, monthOf, periodKey, round2, trialBalance, validateEntry, yearOf,
  type Entry, type EntryLine, type JournalCode,
} from "@/lib/compta/model";
import { Amt, NoData, SubNav, Tag, downloadCsv, num, type Period } from "./ui";

type Sub = "plan" | "journaux" | "ecritures" | "gl" | "balance" | "lettrage";
const SUBS: { id: Sub; label: string }[] = [
  { id: "plan", label: "Plan comptable" }, { id: "journaux", label: "Journaux" }, { id: "ecritures", label: "Écritures" },
  { id: "gl", label: "Grand livre" }, { id: "balance", label: "Balance générale" }, { id: "lettrage", label: "Lettrage" },
];

export function GeneralTab({ p }: { p: Period }) {
  const [sub, setSub] = useState<Sub>("ecritures");
  const [glAccount, setGlAccount] = useState("5141");
  const [journal, setJournal] = useState<string>("all");
  return (
    <div className="space-y-4">
      <SubNav items={SUBS} value={sub} onChange={setSub} />
      {sub === "plan" && <PlanPanel onOpen={(a) => { setGlAccount(a); setSub("gl"); }} />}
      {sub === "journaux" && <JournalsPanel p={p} onOpen={(j) => { setJournal(j); setSub("ecritures"); }} />}
      {sub === "ecritures" && <EntriesPanel p={p} journal={journal} setJournal={setJournal} />}
      {sub === "gl" && <LedgerPanel p={p} account={glAccount} setAccount={setGlAccount} />}
      {sub === "balance" && <BalancePanel p={p} onOpen={(a) => { setGlAccount(a); setSub("gl"); }} />}
      {sub === "lettrage" && <LetteringPanel p={p} />}
    </div>
  );
}

/* ---------------------------------------------------------------- Plan comptable */
function PlanPanel({ onOpen }: { onOpen: (a: string) => void }) {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("all");
  const rows = CHART.filter((a) => (cls === "all" || accountClass(a.number) === cls) && (a.number.includes(q) || a.label.toLowerCase().includes(q.toLowerCase())));
  return (
    <Panel title="Plan comptable (CGNC)" subtitle="Comptes utilisés par la société — structure à 4 chiffres, mapping vers les postes des états de synthèse par classe et rubrique.">
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <label className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input className={cn(fieldCls, "pl-9")} placeholder="N° ou intitulé…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <Select value={cls} onChange={(e) => setCls(e.target.value)}><option value="all">Toutes les classes</option>{Object.entries(CLASSES).map(([k, v]) => <option key={k} value={k}>Classe {k} — {v}</option>)}</Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={thead}><tr><th className="py-2.5 pr-3">N° compte</th><th className="pr-3">Intitulé</th><th className="pr-3">Classe</th><th className="pr-3">Compte parent</th><th className="pr-3">Nature</th><th className="pr-3">Type</th><th className="pr-3">Statut</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.number} className={cn(trow, "cursor-pointer")} onClick={() => onOpen(a.number)}>
                <td className="py-2 pr-3 font-mono text-xs font-semibold">{a.number}</td><td className="pr-3">{a.label}</td>
                <td className="pr-3 text-muted-foreground">{accountClass(a.number)}</td><td className="pr-3 font-mono text-xs">{a.parent}</td>
                <td className="pr-3">{accountNature(a.number)}</td><td className="pr-3">{accountType(a.number)}</td><td className="pr-3"><Tag tone="good">{a.status}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <NoData>Aucun compte ne correspond.</NoData>}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Journaux */
function JournalsPanel({ p, onOpen }: { p: Period; onOpen: (j: string) => void }) {
  const { entries, isClosed } = useCompta();
  const period = `${p.year}-${String(p.to + 1).padStart(2, "0")}`;
  return (
    <Panel title="Journaux comptables" subtitle={`Exercice ${p.year} — statut de la période ${period} : ${isClosed(period + "-01") ? "clôturée" : "ouverte"}`}>
      <table className="w-full text-sm">
        <thead className={thead}><tr><th className="py-2.5 pr-3">Code</th><th className="pr-3">Journal</th><th className={num + " pr-3"}>Écritures</th><th className={num + " pr-3"}>Brouillons</th><th className={num + " pr-3"}>Total débit</th><th className="pr-3">Statut</th></tr></thead>
        <tbody>
          {JOURNALS.map((j) => {
            const es = entries.filter((e) => e.journal === j.code && yearOf(e.date) === p.year && monthOf(e.date) <= p.to);
            const drafts = es.filter((e) => e.status === "Brouillon").length;
            const tot = es.filter((e) => e.status === "Validée").reduce((s, e) => s + entryTotals(e).debit, 0);
            return (
              <tr key={j.code} className={cn(trow, "cursor-pointer")} onClick={() => onOpen(j.code)}>
                <td className="py-2 pr-3 font-mono text-xs font-semibold">{j.code}</td><td className="pr-3">{j.label}</td>
                <td className={num + " pr-3"}>{es.length}</td><td className={num + " pr-3"}>{drafts || "—"}</td><Amt v={tot} />
                <td className="pr-3">{es.length === 0 ? <Tag>Aucune écriture</Tag> : drafts ? <Tag tone="warn">À valider</Tag> : <Tag tone="good">À jour</Tag>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Écritures */
const PAGE = 25;
function EntriesPanel({ p, journal, setJournal }: { p: Period; journal: string; setJournal: (j: string) => void }) {
  const { entries, validate, deleteDraft, isClosed, role } = useCompta();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"date" | "montant">("date");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);
  const [detail, setDetail] = useState<Entry | null>(null);

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    const r = entries.filter((e) =>
      yearOf(e.date) === p.year && monthOf(e.date) <= p.to &&
      (journal === "all" || e.journal === journal) && (status === "all" || e.status === status) &&
      (!ql || e.piece.toLowerCase().includes(ql) || e.label.toLowerCase().includes(ql) || e.ref.toLowerCase().includes(ql) || e.lines.some((l) => l.account.startsWith(ql) || l.tiers?.toLowerCase().includes(ql))));
    return sort === "date" ? [...r].sort((a, b) => b.date.localeCompare(a.date) || b.piece.localeCompare(a.piece)) : [...r].sort((a, b) => entryTotals(b).debit - entryTotals(a).debit);
  }, [entries, p, journal, status, q, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  const doValidate = (e: Entry) => { const err = validate(e.id); err ? toast.error(err) : toast.success(`Écriture ${e.piece} validée`); };

  return (
    <Panel
      title="Écritures comptables"
      subtitle={`${rows.length} écriture(s) — seules les écritures validées alimentent le grand livre et les états.`}
      action={<div className="flex gap-2">
        <Btn variant="ghost" onClick={() => downloadCsv(`ecritures-${p.year}.csv`, ["Pièce", "Date", "Journal", "Compte", "Libellé", "Tiers", "Référence", "Débit", "Crédit", "Statut"], rows.flatMap((e) => e.lines.map((l) => [e.piece, e.date, e.journal, l.account, l.label || e.label, l.tiers ?? "", e.ref, l.debit, l.credit, e.status])))}><Download className="h-4 w-4" />Excel (CSV)</Btn>
        <Btn onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Nouvelle écriture</Btn>
      </div>}
    >
      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        <label className="relative block sm:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input className={cn(fieldCls, "pl-9")} placeholder="Pièce, libellé, compte, tiers, référence…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></label>
        <Select value={journal} onChange={(e) => { setJournal(e.target.value); setPage(0); }}><option value="all">Tous les journaux</option>{JOURNALS.map((j) => <option key={j.code} value={j.code}>{j.code} — {j.label}</option>)}</Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="all">Tous statuts</option><option>Brouillon</option><option>Validée</option></Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as "date")}><option value="date">Tri : date</option><option value="montant">Tri : montant</option></Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={thead}><tr><th className="py-2.5 pr-3">Pièce</th><th className="pr-3">Date</th><th className="pr-3">Jnl</th><th className="pr-3">Libellé</th><th className="pr-3">Tiers</th><th className="pr-3">Réf. doc.</th><th className={num + " pr-3"}>Débit</th><th className={num + " pr-3"}>Crédit</th><th className="pr-3">Statut</th><th /></tr></thead>
          <tbody>
            {shown.map((e) => {
              const t = entryTotals(e), bal = isBalanced(e), closed = isClosed(e.date);
              return (
                <tr key={e.id} className={trow}>
                  <td className="py-2 pr-3"><button className="font-mono text-xs font-semibold text-primary hover:underline" onClick={() => setDetail(e)}>{e.piece}</button></td>
                  <td className="pr-3 whitespace-nowrap text-muted-foreground">{new Date(e.date).toLocaleDateString("fr-FR")}</td>
                  <td className="pr-3 font-mono text-xs">{e.journal}</td>
                  <td className="pr-3">{e.label}</td>
                  <td className="pr-3 text-xs text-muted-foreground">{[...new Set(e.lines.map((l) => l.tiers).filter(Boolean))].join(", ") || "—"}</td>
                  <td className="pr-3 text-xs">{e.ref || <Tag tone="warn">Manquante</Tag>}</td>
                  <Amt v={t.debit} /><Amt v={t.credit} className={bal ? "" : "text-destructive"} />
                  <td className="pr-3">{e.status === "Validée" ? <Tag tone="good">Validée</Tag> : bal ? <Tag tone="warn">Brouillon</Tag> : <Tag tone="bad">Déséquilibrée</Tag>}</td>
                  <td className="whitespace-nowrap py-1 text-right">
                    {closed ? <Lock className="ml-auto h-4 w-4 text-muted-foreground" aria-label="Période clôturée" /> : e.status === "Brouillon" && (
                      <span className="inline-flex gap-1">
                        <button title="Modifier" className="rounded p-1 hover:bg-muted" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></button>
                        {can(role, "valider") && <button title="Valider" className="rounded p-1 text-success hover:bg-success-soft" onClick={() => doValidate(e)}><CheckCircle2 className="h-4 w-4" /></button>}
                        <button title="Supprimer" className="rounded p-1 text-destructive hover:bg-destructive-soft" onClick={() => { const err = deleteDraft(e.id); if (err) toast.error(err); }}><Trash2 className="h-4 w-4" /></button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <NoData>Aucune écriture pour ces critères.</NoData>}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Btn variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Btn>
          Page {page + 1} / {pages}
          <Btn variant="ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Suivant</Btn>
        </div>
      )}
      {editing && <EntryDialog entry={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {detail && <EntryDetail entry={detail} onClose={() => setDetail(null)} />}
    </Panel>
  );
}

function EntryDetail({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const t = entryTotals(entry);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Écriture {entry.piece}</DialogTitle>
          <DialogDescription>{entry.journal} · {new Date(entry.date).toLocaleDateString("fr-FR")} · {entry.label} · Réf. {entry.ref || "manquante"} · {entry.status}</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <thead className={thead}><tr><th className="py-2 pr-3">Compte</th><th className="pr-3">Libellé</th><th className="pr-3">Tiers</th><th className="pr-3">Lettre</th><th className={num + " pr-3"}>Débit</th><th className={num + " pr-3"}>Crédit</th></tr></thead>
          <tbody>
            {entry.lines.map((l) => (
              <tr key={l.id} className={trow}>
                <td className="py-2 pr-3"><span className="font-mono text-xs font-semibold">{l.account}</span> <span className="text-xs text-muted-foreground">{accountLabel(l.account)}</span></td>
                <td className="pr-3">{l.label}</td><td className="pr-3 text-xs">{l.tiers ?? "—"}</td><td className="pr-3 font-mono text-xs">{l.letter ?? ""}</td>
                <Amt v={l.debit || null} /><Amt v={l.credit || null} />
              </tr>
            ))}
            <tr className="font-semibold"><td colSpan={4} className="py-2 pr-3">Totaux</td><Amt v={t.debit} /><Amt v={t.credit} /></tr>
          </tbody>
        </table>
        {!isBalanced(entry) && <p className="text-xs text-destructive">Écriture déséquilibrée : écart de {fmtNum(t.debit - t.credit)} MAD. Elle ne peut pas être validée.</p>}
      </DialogContent>
    </Dialog>
  );
}

const blank = (): EntryLine => ({ id: `N${Math.random().toString(36).slice(2, 8)}`, account: "", label: "", debit: 0, credit: 0 });
function EntryDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const { entries, saveEntry, validate, role } = useCompta();
  const [e, setE] = useState<Entry>(() => entry ?? { id: `E-${Date.now().toString(36)}`, piece: "", date: "2026-10-31", journal: "OD", label: "", ref: "", status: "Brouillon", lines: [blank(), blank()] });
  const [errs, setErrs] = useState<string[]>([]);
  const t = entryTotals(e);
  const setLine = (i: number, patch: Partial<EntryLine>) => setE({ ...e, lines: e.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });

  const piece = () => {
    if (e.piece) return e.piece;
    const y = e.date.slice(0, 4);
    const n = entries.filter((x) => x.journal === e.journal && x.date.startsWith(y)).length + 1;
    return `${e.journal}${y.slice(2)}-${String(n).padStart(4, "0")}`;
  };
  const save = (andValidate: boolean) => {
    if (!e.label.trim()) return setErrs(["Libellé obligatoire."]);
    const final = { ...e, piece: piece(), lines: e.lines.map((l) => ({ ...l, debit: round2(l.debit), credit: round2(l.credit), tiers: l.tiers?.trim() || undefined })) };
    if (andValidate) { const v = validateEntry(final); if (v.length) return setErrs(v); }
    const err = saveEntry(final);
    if (err) return setErrs([err]);
    if (andValidate) {
      // la validation s'applique sur l'état enregistré au prochain rendu
      setTimeout(() => { const er = validate(final.id); er ? toast.error(er) : toast.success(`Écriture ${final.piece} validée`); }, 0);
    } else toast.success(`Brouillon ${final.piece} enregistré`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{entry ? `Modifier ${entry.piece}` : "Nouvelle écriture"}</DialogTitle>
          <DialogDescription>Total débit = total crédit est obligatoire pour valider. Les comptes doivent exister au plan comptable.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-4">
          <Select label="Journal" value={e.journal} onChange={(x) => setE({ ...e, journal: x.target.value as JournalCode })}>{JOURNALS.map((j) => <option key={j.code} value={j.code}>{j.code} — {j.label}</option>)}</Select>
          <label className="block text-xs font-medium text-muted-foreground"><span className="mb-1 block">Date</span><input type="date" className={fieldCls} value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} /></label>
          <label className="block text-xs font-medium text-muted-foreground sm:col-span-2"><span className="mb-1 block">Libellé</span><input className={fieldCls} value={e.label} onChange={(x) => setE({ ...e, label: x.target.value })} /></label>
          <label className="block text-xs font-medium text-muted-foreground sm:col-span-2"><span className="mb-1 block">Référence documentaire</span><input className={fieldCls} value={e.ref} placeholder="N° facture, relevé…" onChange={(x) => setE({ ...e, ref: x.target.value })} /></label>
        </div>
        <datalist id="cgnc-accounts">{CHART.map((a) => <option key={a.number} value={a.number}>{a.label}</option>)}</datalist>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className={thead}><tr><th className="py-2 pr-2">Compte</th><th className="pr-2">Libellé</th><th className="pr-2">Tiers</th><th className="pr-2 text-right">Débit</th><th className="pr-2 text-right">Crédit</th><th /></tr></thead>
            <tbody>
              {e.lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="py-1 pr-2"><input list="cgnc-accounts" className={cn(fieldCls, "w-24 font-mono")} value={l.account} onChange={(x) => setLine(i, { account: x.target.value.trim() })} title={accountLabel(l.account)} /></td>
                  <td className="pr-2"><input className={fieldCls} value={l.label} onChange={(x) => setLine(i, { label: x.target.value })} placeholder={l.account ? accountLabel(l.account) : ""} /></td>
                  <td className="pr-2"><input className={fieldCls} value={l.tiers ?? ""} onChange={(x) => setLine(i, { tiers: x.target.value })} /></td>
                  <td className="pr-2"><input type="number" min={0} step="0.01" className={cn(fieldCls, "w-32 text-right")} value={l.debit || ""} onChange={(x) => setLine(i, { debit: Number(x.target.value) || 0, credit: Number(x.target.value) ? 0 : l.credit })} /></td>
                  <td className="pr-2"><input type="number" min={0} step="0.01" className={cn(fieldCls, "w-32 text-right")} value={l.credit || ""} onChange={(x) => setLine(i, { credit: Number(x.target.value) || 0, debit: Number(x.target.value) ? 0 : l.debit })} /></td>
                  <td><button className="rounded p-1 text-destructive hover:bg-destructive-soft disabled:opacity-30" disabled={e.lines.length <= 2} onClick={() => setE({ ...e, lines: e.lines.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold"><td colSpan={3} className="pt-2"><button className="text-xs font-semibold text-primary hover:underline" onClick={() => setE({ ...e, lines: [...e.lines, blank()] })}>+ Ajouter une ligne</button></td><td className={num + " pr-2 pt-2"}>{fmtNum(t.debit)}</td><td className={num + " pr-2 pt-2"}>{fmtNum(t.credit)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
        <p className={cn("text-xs font-semibold", Math.abs(t.debit - t.credit) < 0.005 && t.debit > 0 ? "text-success" : "text-destructive")}>
          {Math.abs(t.debit - t.credit) < 0.005 && t.debit > 0 ? "Écriture équilibrée" : `Écart débit − crédit : ${fmtNum(t.debit - t.credit)} MAD`}
        </p>
        {errs.length > 0 && <ul className="space-y-0.5 text-xs text-destructive">{errs.map((x) => <li key={x}>• {x}</li>)}</ul>}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
          <Btn variant="ghost" onClick={() => save(false)}>Enregistrer le brouillon</Btn>
          {can(role, "valider") && <Btn onClick={() => save(true)}><CheckCircle2 className="h-4 w-4" />Enregistrer et valider</Btn>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Grand livre */
function LedgerPanel({ p, account, setAccount }: { p: Period; account: string; setAccount: (a: string) => void }) {
  const { entries } = useCompta();
  const [from, setFrom] = useState(0);
  const lg = useMemo(() => ledger(entries, account, { year: p.year, from, to: p.to }), [entries, account, p, from]);
  const d = lg.lines.reduce((s, l) => s + l.debit, 0), c = lg.lines.reduce((s, l) => s + l.credit, 0);
  return (
    <Panel title={`Grand livre — ${account} ${accountLabel(account)}`} subtitle="Solde d'ouverture (à-nouveaux et mois antérieurs), mouvements et solde progressif."
      action={<Btn variant="ghost" onClick={() => downloadCsv(`grand-livre-${account}.csv`, ["Date", "Pièce", "Journal", "Libellé", "Tiers", "Débit", "Crédit", "Solde"], lg.lines.map((l) => [l.date, l.piece, l.journal, l.label, l.tiers ?? "", l.debit, l.credit, l.balance]))}><Download className="h-4 w-4" />Excel (CSV)</Btn>}>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Select label="Compte" value={account} onChange={(e) => setAccount(e.target.value)}>{CHART.map((a) => <option key={a.number} value={a.number}>{a.number} — {a.label}</option>)}</Select>
        <Select label="À partir de" value={from} onChange={(e) => setFrom(Number(e.target.value))}>{Array.from({ length: p.to + 1 }, (_, i) => <option key={i} value={i}>{new Date(2026, i, 1).toLocaleDateString("fr-FR", { month: "long" })}</option>)}</Select>
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-4 text-sm">
        {[["Solde d'ouverture", lg.opening], ["Mouvements débit", d], ["Mouvements crédit", c], ["Solde de clôture", lg.closing]].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border border-border p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p><p className="mt-1 font-bold tabular-nums">{fmtNum(v as number)} <span className="text-xs font-normal text-muted-foreground">{(k as string).startsWith("Solde") ? ((v as number) >= 0 ? "D" : "C") : ""}</span></p></div>
        ))}
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className={cn(thead, "sticky top-0 bg-card")}><tr><th className="py-2.5 pr-3">Date</th><th className="pr-3">Pièce</th><th className="pr-3">Jnl</th><th className="pr-3">Libellé</th><th className="pr-3">Tiers</th><th className="pr-3">Let.</th><th className={num + " pr-3"}>Débit</th><th className={num + " pr-3"}>Crédit</th><th className={num + " pr-3"}>Solde</th></tr></thead>
          <tbody>
            {lg.lines.map((l, i) => (
              <tr key={i} className={trow}>
                <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{new Date(l.date).toLocaleDateString("fr-FR")}</td><td className="pr-3 font-mono text-xs">{l.piece}</td><td className="pr-3 font-mono text-xs">{l.journal}</td>
                <td className="pr-3">{l.label}</td><td className="pr-3 text-xs">{l.tiers ?? ""}</td><td className="pr-3 font-mono text-xs">{l.letter ?? ""}</td>
                <Amt v={l.debit || null} /><Amt v={l.credit || null} /><Amt v={l.balance} />
              </tr>
            ))}
          </tbody>
        </table>
        {!lg.lines.length && <NoData>Aucun mouvement validé sur ce compte pour la période.</NoData>}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Balance */
function BalancePanel({ p, onOpen }: { p: Period; onOpen: (a: string) => void }) {
  const { entries } = useCompta();
  const [cls, setCls] = useState("all");
  const all = useMemo(() => trialBalance(entries, { year: p.year, to: p.to }), [entries, p]);
  const rows = all.filter((r) => cls === "all" || accountClass(r.account) === cls);
  const sum = (k: keyof typeof rows[number]) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const ok = Math.abs(all.reduce((s, r) => s + r.closeD - r.closeC, 0)) < 0.01;
  return (
    <Panel title="Balance générale" subtitle={`Au ${new Date(p.year, p.to + 1, 0).toLocaleDateString("fr-FR")} — solde initial = à-nouveaux`}
      action={<Btn variant="ghost" onClick={() => downloadCsv(`balance-${p.year}.csv`, ["Compte", "Intitulé", "SI débit", "SI crédit", "Mvt débit", "Mvt crédit", "SF débit", "SF crédit"], rows.map((r) => [r.account, r.label, r.openD, r.openC, r.movD, r.movC, r.closeD, r.closeC]))}><Download className="h-4 w-4" />Excel (CSV)</Btn>}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select value={cls} onChange={(e) => setCls(e.target.value)}><option value="all">Toutes les classes</option>{Object.entries(CLASSES).map(([k, v]) => <option key={k} value={k}>Classe {k} — {v}</option>)}</Select>
        {ok ? <Tag tone="good">Balance équilibrée</Tag> : <Tag tone="bad">Balance déséquilibrée</Tag>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={thead}>
            <tr><th rowSpan={2} className="py-2 pr-3">Compte</th><th rowSpan={2} className="pr-3">Intitulé</th><th colSpan={2} className="pr-3 text-center">Solde initial</th><th colSpan={2} className="pr-3 text-center">Mouvements</th><th colSpan={2} className="pr-3 text-center">Solde final</th></tr>
            <tr>{["Débit", "Crédit", "Débit", "Crédit", "Débit", "Crédit"].map((h, i) => <th key={i} className={num + " pb-2 pr-3"}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account} className={cn(trow, "cursor-pointer")} onClick={() => onOpen(r.account)}>
                <td className="py-2 pr-3 font-mono text-xs font-semibold text-primary">{r.account}</td><td className="pr-3">{r.label}</td>
                <Amt v={r.openD || null} /><Amt v={r.openC || null} /><Amt v={r.movD || null} /><Amt v={r.movC || null} /><Amt v={r.closeD || null} /><Amt v={r.closeC || null} />
              </tr>
            ))}
            <tr className="border-t-2 border-border font-semibold"><td colSpan={2} className="py-2 pr-3">Totaux</td>
              <Amt v={sum("openD")} /><Amt v={sum("openC")} /><Amt v={sum("movD")} /><Amt v={sum("movC")} /><Amt v={sum("closeD")} /><Amt v={sum("closeC")} /></tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Lettrage */
function LetteringPanel({ p }: { p: Period }) {
  const { entries, letterLines, unletter, role } = useCompta();
  const [acc, setAcc] = useState("3421");
  const [tiers, setTiers] = useState("all");
  const [show, setShow] = useState<"open" | "all">("open");
  const [sel, setSel] = useState<string[]>([]);
  const lines = useMemo(() => entries.filter((e) => e.status === "Validée" && yearOf(e.date) === p.year).flatMap((e) => e.lines.filter((l) => l.account === acc).map((l) => ({ ...l, e }))), [entries, acc, p.year]);
  const tiersList = [...new Set(lines.map((l) => l.tiers).filter(Boolean))].sort() as string[];
  const rows = lines.filter((l) => (tiers === "all" || l.tiers === tiers) && (show === "all" || !l.letter)).sort((a, b) => a.e.date.localeCompare(b.e.date));
  const open = lines.filter((l) => !l.letter);
  const selLines = lines.filter((l) => sel.includes(l.id));
  const sd = selLines.reduce((s, l) => s + l.debit, 0), sc = selLines.reduce((s, l) => s + l.credit, 0);
  return (
    <Panel title="Lettrage des comptes de tiers" subtitle="Rapprochement des factures et des règlements — sélectionnez des lignes dont débit = crédit.">
      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        <Select label="Compte" value={acc} onChange={(e) => { setAcc(e.target.value); setSel([]); setTiers("all"); }}><option value="3421">3421 — Clients</option><option value="4411">4411 — Fournisseurs</option></Select>
        <Select label="Tiers" value={tiers} onChange={(e) => setTiers(e.target.value)}><option value="all">Tous</option>{tiersList.map((t) => <option key={t}>{t}</option>)}</Select>
        <Select label="Affichage" value={show} onChange={(e) => setShow(e.target.value as "open")}><option value="open">Non lettrées</option><option value="all">Toutes</option></Select>
        <div className="text-xs text-muted-foreground"><span className="mb-1 block font-medium">Statut</span><span className="flex h-9 items-center gap-2"><Tag tone="good">{lines.length - open.length} lettrées</Tag><Tag tone="warn">{open.length} non lettrées</Tag></span></div>
      </div>
      {sel.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <span>{sel.length} ligne(s) — débit {fmtNum(sd)} · crédit {fmtNum(sc)} · écart <b className={Math.abs(sd - sc) < 0.005 ? "text-success" : "text-destructive"}>{fmtNum(sd - sc)}</b></span>
          <Btn disabled={!can(role, "lettrer")} onClick={() => { const err = letterLines(sel); if (err) toast.error(err); else { toast.success("Lignes lettrées"); setSel([]); } }}>Lettrer</Btn>
          <Btn variant="ghost" onClick={() => setSel([])}>Effacer la sélection</Btn>
          {!can(role, "lettrer") && <span className="text-xs text-muted-foreground">Rôle Comptable : lettrage réservé au chef comptable.</span>}
        </div>
      )}
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className={cn(thead, "sticky top-0 bg-card")}><tr><th className="py-2.5 pr-3" /><th className="pr-3">Date</th><th className="pr-3">Pièce</th><th className="pr-3">Tiers</th><th className="pr-3">Libellé</th><th className={num + " pr-3"}>Débit</th><th className={num + " pr-3"}>Crédit</th><th className="pr-3">Lettre</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className={trow}>
                <td className="py-2 pr-3">{!l.letter && <input type="checkbox" checked={sel.includes(l.id)} onChange={(e) => setSel(e.target.checked ? [...sel, l.id] : sel.filter((x) => x !== l.id))} />}</td>
                <td className="pr-3 whitespace-nowrap text-muted-foreground">{new Date(l.e.date).toLocaleDateString("fr-FR")}</td><td className="pr-3 font-mono text-xs">{l.e.piece}</td>
                <td className="pr-3 text-xs">{l.tiers}</td><td className="pr-3">{l.label || l.e.label}</td><Amt v={l.debit || null} /><Amt v={l.credit || null} />
                <td className="pr-3">{l.letter ? <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold">{l.letter}{can(role, "lettrer") && !periodKey(l.e.date).startsWith("x") && <button title="Délettrer" onClick={() => unletter(acc, l.letter!)}><Unlink className="h-3 w-3 text-muted-foreground" /></button>}</span> : <Tag tone="warn">Non lettrée</Tag>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <NoData>Aucune ligne à afficher.</NoData>}
      </div>
    </Panel>
  );
}
