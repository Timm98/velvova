import Link from "next/link";
import { SettingsNav } from "./SettingsNav";
import { PageHeader } from "@/components/ui/states";

/**
 * Einstellungen.
 *
 * Ein Bereich je Entscheidungsart statt einer langen Seite. Wer Sprache
 * und Region ändern will, soll nicht an Einwilligungen und Löschknöpfen
 * vorbeiscrollen müssen — und wer sein Konto löschen will, soll das
 * nicht versehentlich neben einem Auswahlfeld tun.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Einstellungen"
        lead="Konto, Sprache, Suche, Datenschutz. Jede Änderung wirkt sofort."
      />

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <SettingsNav />
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
