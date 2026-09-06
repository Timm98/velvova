import { and, count, eq, isNull } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { getDb, schema, withUser } from "@paycheck/db";
import { currentUser, kennung } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { logoutAction } from "@/app/(auth)/actions";
import { profilbildKennung } from "@/lib/profilbild-kennung";
import { Kontobereich } from "./Kontobereich";

/**
 * Was der Kopf über den angemeldeten Menschen wissen muss.
 *
 * ── Warum als eigenes Modul ───────────────────────────────────
 *
 * Der Kopf ist auf jeder Seite derselbe — das ist eine Projektregel,
 * keine Absicht im Einzelfall. Öffentliche Seiten trugen ihn bisher
 * mit `angemeldet={false}` fest verdrahtet: Wer angemeldet war und auf
 * die Startseite ging, bekam „Anmelden" und „Konto anlegen"
 * angeboten.
 *
 * Der naheliegende Weg wäre, die paar Zeilen in jede öffentliche Seite
 * zu kopieren. Es sind aber nicht ein paar Zeilen, sondern zwei
 * Abfragen mit Zeilenrechten, die Übersetzung der Menüeinträge und ein
 * Abmeldeformular — und beim zweiten Ort weicht die Kopie ab. Genau so
 * ist auf der Startseite ein Kopf ohne Kontoknopf entstanden.
 *
 * ── Warum kein `requireUser` ──────────────────────────────────
 *
 * Diese Seiten sind für beide da. Ist niemand angemeldet, kommt
 * `angemeldet: false` zurück und der Kopf zeigt die beiden Knöpfe —
 * kein Ausweichen auf die Anmeldung.
 */
export type Kopfsitzung = {
  angemeldet: boolean;
  userName: string | null;
  userEmail: string;
  unreadCount: number;
  accountMenu: React.ReactNode;
  /**
   * Der Name für eine Begrüssung, oder `null`.
   *
   * `displayName` steht nicht immer — wer sich über den Magic Link
   * angemeldet hat, hat unter Umständen nie einen gesetzt. Dann der
   * Teil der Adresse vor dem @: Das ist kein erfundener Name, sondern
   * der, den die Person selbst geschrieben hat. Ein „Willkommen
   * zurück, Nutzer" als Ausweichlösung wäre keine Begrüssung.
   */
  anrede: string | null;
};

export async function kopfsitzung(): Promise<Kopfsitzung> {
  const nutzer = await currentUser();

  if (!nutzer) {
    return {
      angemeldet: false,
      userName: null,
      userEmail: "",
      unreadCount: 0,
      accountMenu: undefined,
      anrede: null,
    };
  }

  const db = await getDb();
  /*
   * `withUser` setzt die Sitzung für die Zeilenrechte. Ohne sie käme
   * entweder nichts zurück oder, schlimmer, alles.
   */
  const [zeilen, einstellungen] = await Promise.all([
    withUser(db, nutzer.id, (tx) =>
      tx
        .select({ value: count() })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, nutzer.id),
            isNull(schema.notifications.readAt),
            isNull(schema.notifications.dismissedAt),
          ),
        ),
    ).catch(() => []),
    withUser(db, nutzer.id, async (tx) =>
      (
        await tx
          .select({ avatarPfad: schema.userSettings.avatarPfad })
          .from(schema.userSettings)
          .where(eq(schema.userSettings.userId, nutzer.id))
          .limit(1)
      )[0],
    ).catch(() => undefined),
  ]);

  const { t } = await getPageContext();

  return {
    angemeldet: true,
    userName: nutzer.displayName,
    userEmail: kennung(nutzer),
    unreadCount: zeilen[0]?.value ?? 0,
    /*
      * `displayName`, sonst der Teil der Adresse vor dem @ — kein
      * erfundener Name, sondern der, den die Person selbst geschrieben
      * hat. Bei einem Konto aus der SMS-Anmeldung gibt es beides
      * nicht; dann bleibt die Begrüssung aus, statt jemanden mit
      * seiner Rufnummer anzusprechen.
      */
    anrede:
      nutzer.displayName?.trim() ||
      (nutzer.email?.includes("@") ? (nutzer.email.split("@")[0] ?? null) : null),
    /*
     * Nur Zeichenketten über die Grenze.
     *
     * Die Symbole der Menüeinträge sind Komponenten; die lassen sich
     * von hier — einer Server-Komponente — nicht an eine
     * Client-Komponente übergeben. `Kontobereich` baut die Liste
     * deshalb auf der anderen Seite. Siehe dort.
     */
    accountMenu: (
      <Kontobereich
        userName={nutzer.displayName}
        userEmail={kennung(nutzer)}
        bildKennung={profilbildKennung(einstellungen?.avatarPfad)}
        labels={{
          settings: t("nav.settings"),
          languageRegion: t("nav.languageRegion"),
          appearance: t("nav.appearance"),
          privacy: t("nav.privacyData"),
          help: t("nav.help"),
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
      />
    ),
  };
}
