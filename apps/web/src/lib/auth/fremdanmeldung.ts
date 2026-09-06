import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";

/**
 * Eine Supabase-Identität mit einem Velvova-Konto verbinden.
 *
 * ── Warum Supabase nicht die Sitzung führt ────────────────────
 *
 * Diese Anwendung hat eine eigene Anmeldung: eine `sessions`-Tabelle,
 * ein eigenes Cookie, und — das ist der entscheidende Punkt — die
 * Zeilenrechte hängen daran. Jede Abfrage auf Nutzerdaten läuft durch
 * `withUser(db, user.id, …)`, und das setzt die Sitzung für die
 * Postgres-Policies.
 *
 * Supabase Auth durch dieses Fundament zu ersetzen hiesse, die
 * Rechteprüfung jeder Tabelle neu zu bauen. Das ist nicht die Aufgabe
 * und wäre der teuerste Weg zu zwei neuen Anmeldeknöpfen.
 *
 * Supabase ist deshalb **Ausweisstelle, nicht Türsteher**: Es
 * beantwortet die Frage „gehört diese Google-Adresse wirklich dieser
 * Person" und „wurde diese SMS wirklich empfangen". Was daraus folgt —
 * die Sitzung — bleibt bei uns. So gibt es weiterhin genau eine
 * Sitzung und genau eine Stelle, die sie ausstellt.
 *
 * ── Warum `auth_accounts` ─────────────────────────────────────
 *
 * Die Tabelle steht seit dem ersten Entwurf im Schema und wurde nie
 * benutzt — mit `provider` und `provider_account_id` und einem
 * eindeutigen Index über beide. Genau dieser Index ist es, der
 * doppelte Profile verhindert: Ein zweiter Anmeldeversuch derselben
 * Google-Kennung findet die vorhandene Zeile, statt ein Konto
 * anzulegen.
 */

export type FremdIdentitaet = {
  /** Die Kennung des Nutzers bei Supabase. Stabil über alle Anmeldungen. */
  supabaseId: string;
  provider: "google" | "phone";
  email: string | null;
  phone: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Findet das Konto zu einer Identität — oder legt es genau einmal an.
 *
 * Die Reihenfolge der drei Versuche ist keine Geschmacksfrage:
 *
 *   1. **Über `auth_accounts`.** Das ist der direkte Weg und der
 *      einzige, der auch dann stimmt, wenn jemand seine Adresse
 *      geändert hat.
 *
 *   2. **Über E-Mail beziehungsweise Telefonnummer.** Wer sich bisher
 *      mit Adresse und Passwort angemeldet hat und jetzt „Weiter mit
 *      Google" drückt, soll nicht in einem zweiten, leeren Konto
 *      landen. Die Verknüpfung wird dabei nachgetragen.
 *
 *   3. **Neu anlegen.**
 *
 * Ohne Schritt 2 entstünden genau die doppelten Profile, die es nicht
 * geben soll — und zwar unbemerkt, weil beide Konten funktionieren.
 */
export async function verknuepfeIdentitaet(id: FremdIdentitaet): Promise<{
  userId: string;
  neu: boolean;
}> {
  const db = await getDb();

  /* 1 · Die Verknüpfung selbst. */
  const [verknuepft] = await db
    .select({ userId: schema.authAccounts.userId })
    .from(schema.authAccounts)
    .where(
      and(
        eq(schema.authAccounts.provider, id.provider),
        eq(schema.authAccounts.providerAccountId, id.supabaseId),
      ),
    )
    .limit(1);

  if (verknuepft) {
    await ergaenzeStammdaten(verknuepft.userId, id);
    return { userId: verknuepft.userId, neu: false };
  }

  /* 2 · Ein vorhandenes Konto mit derselben Kennung. */
  const kennung = id.provider === "phone" ? id.phone : id.email;
  if (kennung) {
    const spalte = id.provider === "phone" ? schema.users.phone : schema.users.email;
    const [vorhanden] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(spalte, kennung), isNull(schema.users.deletedAt)))
      .limit(1);

    if (vorhanden) {
      await db
        .insert(schema.authAccounts)
        .values({
          userId: vorhanden.id,
          provider: id.provider,
          providerAccountId: id.supabaseId,
        })
        /*
         * `onConflictDoNothing`, obwohl gerade nachgesehen wurde.
         *
         * Zwischen der Abfrage oben und diesem Einfügen liegt ein
         * Moment, und zwei Anmeldeversuche gleichzeitig — Doppelklick,
         * zwei Tabs — sind keine Seltenheit. Ohne das hier wäre der
         * zweite ein Fehler auf der Anmeldeseite.
         */
        .onConflictDoNothing();
      await ergaenzeStammdaten(vorhanden.id, id);
      return { userId: vorhanden.id, neu: false };
    }
  }

  /* 3 · Neu. */
  const [angelegt] = await db
    .insert(schema.users)
    .values({
      email: id.email,
      phone: id.phone,
      /*
       * Als bestätigt eingetragen — aber nur, was der Anbieter
       * tatsächlich bestätigt hat.
       *
       * Google hat die Adresse geprüft, bevor es sie herausgibt; eine
       * SMS ist der Beleg für die Nummer. Beides hier noch einmal
       * bestätigen zu lassen wäre eine Prüfung ohne Erkenntnis.
       */
      emailVerifiedAt: id.provider === "google" && id.email ? new Date() : null,
      phoneVerifiedAt: id.provider === "phone" && id.phone ? new Date() : null,
      displayName: id.displayName,
      /* Kein Passwort. Wer eines will, setzt es über „Passwort
         vergessen" — dieselbe Strecke wie beim Zurücksetzen. */
      passwordHash: null,
    })
    .returning({ id: schema.users.id });

  const userId = angelegt!.id;

  await db.insert(schema.authAccounts).values({
    userId,
    provider: id.provider,
    providerAccountId: id.supabaseId,
  });

  /*
   * Die Einstellungszeile gehört zum Konto, nicht zur Anmeldung.
   *
   * Ohne sie hat das Konto keine Sprache, kein Land und keine Region —
   * und die Anwendung liest an vielen Stellen genau daraus. Ein Konto
   * ohne diese Zeile sieht aus wie eines mit lauter leeren
   * Einstellungen, und das ist etwas anderes als Voreinstellungen.
   */
  await db
    .insert(schema.userSettings)
    .values({ userId, avatarUrl: id.avatarUrl })
    .onConflictDoNothing();

  return { userId, neu: true };
}

/**
 * Was der Anbieter mitschickt, nachtragen — aber nichts überschreiben.
 *
 * Ein Name, den die Person selbst gesetzt hat, wiegt schwerer als der,
 * der in ihrem Google-Konto steht. Deshalb wird nur gefüllt, was leer
 * ist. Dasselbe gilt für das Bild: Ein hochgeladenes bleibt.
 */
async function ergaenzeStammdaten(userId: string, id: FremdIdentitaet): Promise<void> {
  const db = await getDb();

  const [nutzer] = await db
    .select({
      email: schema.users.email,
      phone: schema.users.phone,
      displayName: schema.users.displayName,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!nutzer) return;

  const nachtrag: Partial<typeof schema.users.$inferInsert> = {};
  if (!nutzer.email && id.email) {
    nachtrag.email = id.email;
    nachtrag.emailVerifiedAt = new Date();
  }
  if (!nutzer.phone && id.phone) {
    nachtrag.phone = id.phone;
    nachtrag.phoneVerifiedAt = new Date();
  }
  if (!nutzer.displayName && id.displayName) nachtrag.displayName = id.displayName;

  if (Object.keys(nachtrag).length > 0) {
    await db
      .update(schema.users)
      .set({ ...nachtrag, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      /*
       * Ein Nachtrag darf die Anmeldung nicht scheitern lassen.
       *
       * Der häufigste Grund für einen Fehlschlag hier ist der
       * eindeutige Index: Die Google-Adresse gehört bereits einem
       * anderen Konto. Dann bleibt die Adresse eben, wie sie war — die
       * Anmeldung ist davon nicht betroffen.
       */
      .catch(() => undefined);
  }

  if (id.avatarUrl) {
    await db
      .insert(schema.userSettings)
      .values({ userId, avatarUrl: id.avatarUrl })
      .onConflictDoUpdate({
        target: schema.userSettings.userId,
        set: { avatarUrl: id.avatarUrl },
      })
      .catch(() => undefined);
  }
}

/**
 * Aus einem Supabase-Nutzer wird eine Identität.
 *
 * `user_metadata` ist ein loses Objekt — was darin steht, entscheidet
 * der Anbieter, nicht wir. Google liefert `full_name`, `name`,
 * `avatar_url` und `picture`, und welche davon gesetzt sind, schwankt.
 * Deshalb hier die Reihenfolge statt eines einzelnen Feldes, und
 * `typeof === "string"` statt eines Typs, den niemand garantiert.
 */
export function ausSupabaseNutzer(user: {
  id: string;
  email?: string | null;
  phone?: string | null;
  app_metadata?: { provider?: string } | null;
  user_metadata?: Record<string, unknown> | null;
}): FremdIdentitaet {
  const meta = user.user_metadata ?? {};
  const text = (...schluessel: string[]): string | null => {
    for (const s of schluessel) {
      const wert = meta[s];
      if (typeof wert === "string" && wert.trim()) return wert.trim();
    }
    return null;
  };

  const anbieter = user.app_metadata?.provider === "phone" ? "phone" : "google";

  return {
    supabaseId: user.id,
    provider: anbieter,
    email: user.email?.trim().toLowerCase() || null,
    /* Supabase gibt die Nummer ohne Pluszeichen zurück. E.164 hat
       eines, und unsere Spalte auch — sonst fände der Abgleich in
       Schritt 2 dieselbe Nummer nicht wieder. */
    phone: user.phone ? (user.phone.startsWith("+") ? user.phone : `+${user.phone}`) : null,
    displayName: text("full_name", "name", "preferred_username"),
    avatarUrl: text("avatar_url", "picture"),
  };
}
