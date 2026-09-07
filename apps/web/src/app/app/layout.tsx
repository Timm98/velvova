import { LogOut } from "lucide-react";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { bestandszahl } from "@/lib/jobs/bestandszahl";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { kennung, requireUser } from "@/lib/auth";
import { loadGate } from "@/lib/gate";
import { getPageContext } from "@/lib/locale";
import { AppShell } from "@/components/shell/AppShell";
import { zugangFür } from "@/lib/billing/zugang";
import { NinaProvider } from "@/components/nina/NinaProvider";
import { NinaDock } from "@/components/nina/NinaDock";
import { ensureWorkflowState } from "@/lib/nina/workflow-state";
import { logoutAction } from "@/app/(auth)/actions";
import { profilbildKennung } from "@/lib/profilbild-kennung";
import { BestandProvider } from "@/components/marketing/BestandProvider";

/**
 * Das App-Gerüst.
 *
 * Zwei Dinge hängen daran, dass dieses Layout beim Seitenwechsel
 * bestehen bleibt:
 *
 * 1. **Nina überlebt die Navigation.** Der Provider sitzt hier, also
 *    behält das Gespräch seinen Zustand, während die Seite darunter
 *    ausgetauscht wird. Läge er in einer einzelnen Seite, wäre er nach
 *    jedem Klick weg.
 *
 * 2. **Der Vorgangszustand wird einmal geladen**, nicht auf jeder
 *    Unterseite neu.
 *
 * Die Sprachumschaltung ist bewusst nicht hier: Sprache und Region
 * werden beim Onboarding gewählt und im Kontomenü geändert. Eine
 * Entscheidung, die man einmal trifft, gehört nicht in die Navigation,
 * die man hundertmal am Tag sieht.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, brand } = await getPageContext();
  const db = await getDb();

  const [unreadRows, workflow, einstellungen, hatAbo] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx
        .select({ value: count() })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, user.id),
            isNull(schema.notifications.readAt),
            isNull(schema.notifications.dismissedAt),
          ),
        ),
    ),
    ensureWorkflowState(user.id),
    // Die Voreinstellung fürs automatische Vorlesen. Sie gehört zur
    // Person, nicht zum Gerät — deshalb aus der Datenbank.
    withUser(db, user.id, async (tx) =>
      (
        await tx
          .select({
            voiceAutoplay: schema.userSettings.voiceAutoplay,
            /* Für die Regionsauswahl im Fussbereich. */
            jobMarketCountry: schema.userSettings.jobMarketCountry,
            /* Für das Kontomenü oben rechts. */
            avatarPfad: schema.userSettings.avatarPfad,
          })
          .from(schema.userSettings)
          .where(eq(schema.userSettings.userId, user.id))
          .limit(1)
      )[0],
    ),
    /*
     * Hat die Person ein Abo?
     *
     * ── Warum das die Leiste oben entscheidet ───────────────────
     *
     * Wer zahlt, ist drin — dem den Einstieg anzupreisen ist die
     * Sorte Werbung, die man wegklickt und danach auch die
     * nützlichen Hinweise.
     *
     * Bei einem Fehler gilt „hat eins": Lieber einmal die App
     * ankündigen als jemandem, der bezahlt, den Einstieg zeigen.
     */
    zugangFür(user.id)
      .then((z) => z.plan !== "free")
      .catch(() => true),
  ]);

  /*
   * Ein Zähler für alle Bereiche.
   *
   * Hier stand nur `(await bestandszahl()).text` — der fertig
   * formatierte Satz, ohne Zahl und ohne Rate. Die Kopfzeile im
   * Anwendungsbereich zeigte damit einen festen Wert, während dieselbe
   * Kopfzeile auf der Startseite, den Marketingseiten und im
   * Arbeitgeberbereich weiterlief.
   *
   * Auffallen musste das beim Wechsel: Man kommt von der Startseite,
   * wo die Zahl steigt, in die Anwendung, wo sie steht — und beim
   * Zurückgehen springt sie. `BestandProvider` sorgt dafür, dass alle
   * Stellen auf einer Seite denselben Zeitgeber lesen; die drei
   * anderen Rahmen benutzen ihn längst.
   */
  const bestand = await bestandszahl();

  return (
    <BestandProvider genau={bestand.genau} proSekunde={bestand.proSekunde}>
    <NinaProvider
      initialConversationId={workflow.activeConversationId}
      autoSpeak={einstellungen?.voiceAutoplay ?? false}
    >
      <AppShell
        /* Ohne laufenden Auftrag steht oben die nächtliche Suche,
           mit Auftrag die App. Die Leiste selbst sitzt in `AppShell`. */
        nachtsZiel={hatAbo ? null : "/app/jobs#nachts"}
        laender={await laenderbestand()}
        stellenzahl={bestand.text}
        stellenGenau={bestand.genau}
        proSekunde={bestand.proSekunde}
        gespraechBegonnen={(await loadGate(user.id)).hasAnySession}
        bildKennung={profilbildKennung(einstellungen?.avatarPfad)}
        /* Für die Regionsauswahl im Fussbereich — sie soll den
           aktuellen Stand zeigen und nicht immer „Deutschland". */
        land={einstellungen?.jobMarketCountry ?? "DE"}
        brandName={brand.name}
        assistantName={brand.assistantName}
        userEmail={kennung(user)}
        userName={user.displayName}
        unreadCount={unreadRows[0]?.value ?? 0}
        labels={{
          home: t("nav.home"),
          discover: t("nav.discover"),
          applications: t("nav.applications"),
          career: t("nav.career"),
          assistant: brand.assistantName,
          settings: t("nav.settings"),
          logout: t("nav.logout"),
          skipToContent: t("nav.skipToContent"),
          search: t("nav.search"),
          notifications: t("nav.notifications"),
          languageRegion: t("nav.languageRegion"),
          appearance: t("nav.appearance"),
          privacy: t("nav.privacyData"),
          help: t("nav.help"),
          expand: t("nav.expand"),
          collapse: t("nav.collapse"),
        }}
        onLogout={
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-(--radius-sm) px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
            >
              <LogOut className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
              {t("nav.logout")}
            </button>
          </form>
        }
      >
        {children}
      </AppShell>

      {/* Nina auf jeder authentifizierten Seite. Sie liegt außerhalb von
          <AppShell>, damit sie über allem schwebt und nicht im Raster
          des Inhalts steckt. */}
      <NinaDock assistantName={brand.assistantName} />
    </NinaProvider>
    </BestandProvider>
  );
}
