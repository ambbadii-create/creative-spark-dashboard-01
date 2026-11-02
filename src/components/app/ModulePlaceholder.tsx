import { CheckCircle2, Construction } from "lucide-react";
import { getModule } from "@/lib/modules";
import { PageHeader } from "./ui-bits";

export function ModulePlaceholder({ to }: { to: string }) {
  const m = getModule(to);
  return (
    <div className="space-y-6">
      <PageHeader title={m.title} subtitle={m.description} />
      <div className="relative overflow-hidden rounded-2xl bg-hero p-8 text-primary-foreground">
        <m.icon className="absolute -right-6 -top-6 h-48 w-48 opacity-10" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
          <Construction className="h-3.5 w-3.5" /> Module en préparation
        </span>
        <h2 className="mt-4 max-w-xl text-2xl font-bold">Ce module sera bientôt disponible</h2>
        <p className="mt-2 max-w-xl text-sm opacity-85">
          L'interface est prête à accueillir les fonctionnalités ci-dessous. Aucune donnée n'est encore enregistrée ni calculée.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {m.features.map((f) => (
          <div key={f} className="card-elevated flex items-center gap-3 p-5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{f}</p>
              <p className="text-xs text-muted-foreground">Fonctionnalité prévue</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
