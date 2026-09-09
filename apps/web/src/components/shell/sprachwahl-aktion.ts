"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale } from "@paycheck/i18n";
import { SPRACH_COOKIE } from "@/lib/locale";

/**
 * Eine ausdrücklich gewählte Sprache festhalten.
 *
 * ══════════════════════════════════════════════════════════════════
 * Warum ein Cookie und kein Eintrag im Browser-Speicher
 * ══════════════════════════════════════════════════════════════════
 *
 * Weil der Server die Sprache kennen muss, bevor er die erste Zeile
 * ausliefert. Was im `localStorage` steht, erfährt er nie — die Seite
 * käme in der falschen Sprache an und spränge nach dem Laden um. Genau
 * dieses Flackern soll nicht entstehen.
 *
 * ══════════════════════════════════════════════════════════════════
 * Ein Jahr, und warum das lang genug ist
 * ══════════════════════════════════════════════════════════════════
 *
 * Die Wahl soll die Sitzung überleben — sonst wäre sie keine Wahl,
 * sondern eine Einstellung für diesen Nachmittag. Ein Jahr ist die
 * übliche Frist für eine Anzeigeeinstellung und verlängert sich bei
 * jedem Wechsel.
 *
 * `httpOnly` steht bewusst NICHT dabei: Es ist keine Sitzung und kein
 * Geheimnis, sondern eine Anzeigeeinstellung. `sameSite: "lax"` genügt
 * hier, denn ein fremder Seitenaufruf, der jemandem die Sprache
 * umstellt, ist ärgerlich und sonst nichts.
 *
 * ══════════════════════════════════════════════════════════════════
 * Was hier NICHT passiert
 * ══════════════════════════════════════════════════════════════════
 *
 * Kein Schreiben ins Konto. Das läuft über die vorhandenen
 * Einstellungen (`updateSettings`), die dabei denselben Keks setzen —
 * zwei Wege zum selben Ergebnis, aber nur einer davon braucht eine
 * Anmeldung. Diese Aktion muss auch für Besucher ohne Konto
 * funktionieren, und für die gibt es nichts zu speichern.
 */
export async function spracheWaehlen(code: string): Promise<{ ok: boolean }> {
  /*
   * Prüfen, bevor gespeichert wird.
   *
   * Der Wert kommt aus dem Browser und ist damit alles, was jemand
   * hineinschreiben will. `isLocale` lässt nur durch, wofür es
   * tatsächlich Texte gibt — sonst stünde im Keks eine Sprache, die
   * bei jedem Seitenaufruf still verworfen wird, und die Auswahl sähe
   * kaputt aus, ohne es zu sein.
   */
  if (!isLocale(code)) return { ok: false };

  const store = await cookies();
  store.set(SPRACH_COOKIE, code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  /* Die ganze Seite neu bewerten: Die Sprache steckt in jedem Text,
     nicht in einem Abschnitt. */
  revalidatePath("/", "layout");
  return { ok: true };
}
