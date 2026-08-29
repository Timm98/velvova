import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { getPageContext } from "@/lib/locale";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Erscheinungsbild" };
export const dynamic = "force-dynamic";

/**
 * Erscheinungsbild.
 *
 * Die Wahl liegt in einem Cookie, nicht in der Datenbank: sie soll schon
 * beim ersten Byte der Antwort feststehen, damit die Seite nicht kurz in
 * der falschen Farbe aufblitzt.
 */
export default async function AppearancePage() {
  const { t } = await getPageContext();

  return (
    <div className="grid gap-6">
      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">Darstellung</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Standard ist hell. „System“ folgt der Einstellung deines Geräts und wechselt abends von
            allein.
          </p>
        </div>

        <ThemeToggle
          labels={{
            light: t("settings.themeLight"),
            dark: t("settings.themeDark"),
            system: t("settings.themeSystem"),
            group: t("settings.theme"),
          }}
        />
      </Card>

      <Card className="grid gap-3">
        <h2 className="text-lg font-semibold">Bewegung</h2>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Wenn dein Gerät „Bewegung reduzieren“ eingeschaltet hat, werden Übergänge und Animationen
          hier automatisch abgeschaltet. Dafür ist keine eigene Einstellung nötig — und eine, die
          der Systemeinstellung widerspräche, wäre schlechter als keine.
        </p>
      </Card>
    </div>
  );
}
