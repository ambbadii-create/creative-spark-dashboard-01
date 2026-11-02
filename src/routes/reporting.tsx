import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";
import { getModule } from "@/lib/modules";

const m = getModule("/reporting");

export const Route = createFileRoute("/reporting")({
  head: () => ({
    meta: [
      { title: `${m.title} — Pilotage CG` },
      { name: "description", content: m.description },
      { property: "og:title", content: `${m.title} — Pilotage CG` },
      { property: "og:description", content: m.description },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePlaceholder to="/reporting" />;
}
