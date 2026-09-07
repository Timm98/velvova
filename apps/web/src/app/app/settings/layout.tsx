import Link from "next/link";
import { brand } from "@paycheck/config";
import { SettingsNav } from "./SettingsNav";
import { Kontoleiste } from "@/components/shell/Kontoleiste";
import { getPageContext } from "@/lib/locale";
import { PageHeader } from "@/components/ui/states";

/**
 * Einstellungen.
 *
 * Ein Bereich je Entscheidungsart statt einer langen Seite. Wer Sprache
 * und Region ändern will, soll nicht an Einwilligungen und Löschknöpfen
 * vorbeiscrollen müssen — und wer sein Konto löschen will, soll das
 * nicht versehentlich neben einem Auswahlfeld tun.
 *
 * ── Warum hier zwei Ebenen in einer Leiste stehen ─────────────
 *
 * Links steht seit der Umstellung dieselbe Kontonavigation wie im
 * Klappmenü rechts oben — die Vorlage zeigt beides identisch, und wer
 * das Menü einmal benutzt hat, findet die Leiste ohne zu suchen.
 *
 * Darunter, durch eine Linie getrennt, die elf Einstellungsbereiche.
 * Die Vorlage kennt diese Ebene nicht, weil dort „Profil" die
 * Einstellungen SIND. Bei uns gibt es beides; sie in eine Liste zu
 * pressen hiesse, siebzehn gleichrangige Zeilen zu zeigen.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getPageContext();
  /* Nur Zeichenketten über die Grenze — die Leiste ist eine
     Client-Komponente und baut ihre Liste selbst. */
  const labels = {
    settings: t("nav.settings"),
    languageRegion: t("nav.languageRegion"),
    appearance: t("nav.appearance"),
    privacy: t("nav.privacyData"),
    help: t("nav.help"),
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Einstellungen"
        lead="Konto, Sprache, Suche, Datenschutz. Jede Änderung wirkt sofort."
      />

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <Kontoleiste
          labels={labels}
          assistent={brand.assistantName}
          zusatz={<SettingsNav />}
        />
        <div className="min-w-0">{children}</div>
      </div>

      <p className="text-xs text-ink-3">
        Fragen zur Verarbeitung?{" "}
        <Link href="/privacy" className="text-accent-text underline underline-offset-[3px]">
          Datenschutzerklärung
        </Link>
      </p>
    </div>
  );
}
