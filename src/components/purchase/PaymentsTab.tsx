import { Download } from "lucide-react";
import { Panel } from "@/components/app/ui-bits";
import { Btn } from "@/components/budget/ui";
import { downloadCsv } from "@/components/stock/ui";
import { toCsv } from "@/lib/stock/model";
import { usePurchase } from "@/lib/purchase/store";
import { invoiceTtc, paidAmount, round2 } from "@/lib/purchase/model";
import { fdate, fmt2, rowCls, Table, Td, Th } from "./ui";

export function PaymentsTab() {
  const { payments, invoices, suppliers } = usePurchase();
  const rows = [...payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p) => {
      const inv = invoices.find((i) => i.id === p.invoiceId);
      // reste après ce règlement = TTC − règlements jusqu'à celui-ci (inclus)
      const upTo = payments.filter((x) => x.invoiceId === p.invoiceId && (x.date < p.date || (x.date === p.date && x.id <= p.id)));
      const rest = inv ? Math.max(0, round2(invoiceTtc(inv) - upTo.reduce((a, x) => a + x.amount, 0))) : 0;
      return { p, inv, supplier: suppliers.find((s) => s.id === inv?.supplierId)?.name ?? "—", rest };
    });
  const total = round2(payments.reduce((a, p) => a + p.amount, 0));

  return (
    <Panel
      title="Règlements fournisseurs"
      subtitle={`Suivi des paiements enregistrés — total ${fmt2(total)}. Aucune connexion bancaire : les règlements sont saisis depuis l'onglet Factures.`}
      action={
        <Btn variant="ghost" onClick={() => downloadCsv("reglements.csv", toCsv(["Date", "Fournisseur", "Facture", "Montant", "Mode", "Référence", "Reste après règlement"], rows.map((r) => [r.p.date, r.supplier, r.inv?.reference ?? "", r.p.amount, r.p.method, r.p.reference, r.rest])))}>
          <Download className="h-4 w-4" /> Export CSV
        </Btn>
      }
    >
      <Table empty={rows.length === 0} head={<><Th>Date</Th><Th>Fournisseur</Th><Th>Facture</Th><Th right>Montant</Th><Th>Mode</Th><Th>Référence</Th><Th right>Reste après règlement</Th><Th right>Reste actuel</Th></>}>
        {rows.map(({ p, inv, supplier, rest }) => (
          <tr key={p.id} className={rowCls}>
            <Td muted>{fdate(p.date)}</Td>
            <Td>{supplier}</Td>
            <Td strong>{inv?.reference ?? "—"}</Td>
            <Td right strong>{fmt2(p.amount)}</Td>
            <Td muted>{p.method}</Td>
            <Td muted>{p.reference || "—"}</Td>
            <Td right>{fmt2(rest)}</Td>
            <Td right muted>{inv ? fmt2(Math.max(0, round2(invoiceTtc(inv) - paidAmount(inv.id, payments)))) : "—"}</Td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
