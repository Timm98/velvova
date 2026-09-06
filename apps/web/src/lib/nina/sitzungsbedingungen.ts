import { cookies } from "next/headers";
import { UserConstraintsSchema, type UserConstraints } from "@paycheck/domain";
import type { Bedingungsfeld } from "./bedingungen.ts";

/**
 * Bedingungen, die nur für diese Suche gelten.
 *
 * ── Warum das nicht in die Datenbank gehört ───────────────────
 *
 * „Zeig mir heute mal Stellen in Berlin" ist eine Suche, keine
 * Lebensentscheidung. Bis hierher landete beides an derselben Stelle:
 * in `user_constraints`, dauerhaft, gleichrangig mit „ich will
 * zukünftig nur noch in Berlin arbeiten".
 *
 * Wer einmal aus Neugier nach Berlin schaute, bekam Berlin ins Profil —
 * und Wochen später eine Jobliste ohne Stellen vor der eigenen Haustür.
 * Zurückverfolgen liess sich das nicht, weil im Profil nur „Berlin"
 * stand und nicht, aus welchem beiläufigen Satz es kam.
 *
 * Ein Keks ist hier das ehrlichere Behältnis als eine Tabelle:
 *
 *   **Er kann das Profil nicht beschädigen.** Was hier steht, wird beim
 *   Lesen über die dauerhaften Bedingungen gelegt und nie in sie
 *   hineingeschrieben. Ein Fehler in diesem Modul kostet eine Suche,
 *   nicht ein Profil.
 *
 *   **Er endet von selbst.** Ohne `maxAge` ist es ein Sitzungskeks: Er
 *   stirbt mit dem Browserfenster. Genau das bedeutet „nur für diese
 *   Suche" — und niemand muss daran denken, ihn aufzuräumen.
 *
 *   **Er braucht keine Wanderung.** Das Schema bleibt unberührt, und
 *   damit auch alles, was daran hängt.
 *
 * Die Kehrseite steht hier, damit sie niemand später entdecken muss:
 * Der Keks gilt je Browser, nicht je Konto. Wer das Gerät wechselt,
 * verliert die Sitzungsbedingung. Für eine Absicht, die „heute" meint,
 * ist das richtig; für alles andere gibt es den dauerhaften Weg.
 */

const KEKS = "paycheck_sitzungsbedingungen";

/**
 * Vier Kilobyte sind das Limit eines Kekses.
 *
 * Eine Sitzungsbedingung ist ein Ort oder eine Zahl und liegt weit
 * darunter. Die Grenze steht trotzdem hier, weil ein zu grosser Keks
 * nicht etwa abgeschnitten, sondern vom Browser stillschweigend
 * verworfen wird — und ein Fehler, der nichts sagt, ist der teuerste.
 */
const HOECHSTLAENGE = 3000;

/** Nur diese Felder dürfen eine Sitzung lang gelten. */
const ERLAUBT = new Set<Bedingungsfeld>([
  "baseLocation",
  "minSalaryPerYear",
  "maxCommuteMinutes",
  "acceptedWorkModels",
  "acceptedContractTypes",
  "maxTravelPercent",
  "acceptsShiftWork",
  /*
   * `hardNoGos` fehlt hier mit Absicht.
   *
   * Ein Ausschluss ist selten temporär gemeint. Wer sagt „auf keinen
   * Fall Kaltakquise", meint das nicht für heute — und wenn doch, ist
   * der Schaden gering, weil die Stelle morgen wieder auftaucht.
   * Umgekehrt wäre er gross: Ein Ausschluss, der nach dem Schliessen
   * des Fensters verschwindet, brächte genau die Stellen zurück, die
   * jemand nicht sehen wollte.
   */
]);

export type Sitzungsbedingungen = Partial<UserConstraints>;

/** Was gerade nur für diese Sitzung gilt. Leer, wenn nichts gesetzt ist. */
export async function ladeSitzungsbedingungen(): Promise<Sitzungsbedingungen> {
  const roh = (await cookies()).get(KEKS)?.value;
  if (!roh) return {};
  try {
    const geparst: unknown = JSON.parse(roh);
    if (typeof geparst !== "object" || geparst === null) return {};
    const raus: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(geparst as Record<string, unknown>)) {
      if (ERLAUBT.has(k as Bedingungsfeld)) raus[k] = v;
    }
    return raus as Sitzungsbedingungen;
  } catch {
    /*
     * Ein kaputter Keks ist kein Grund, die Suche scheitern zu lassen.
     *
     * Er kommt von aussen und kann alles enthalten. Was sich nicht
     * lesen lässt, gilt als nicht gesetzt — die dauerhaften Bedingungen
     * greifen weiter, und die Person merkt höchstens, dass ihr „nur für
     * heute" nicht mehr wirkt.
     */
    return {};
  }
}

/**
 * Die Sitzungsschicht über die dauerhaften Bedingungen legen.
 *
 * Die Richtung ist wichtig und nicht umkehrbar: Was für diese Suche
 * gilt, überschreibt für diese Suche — und nur dort. Die dauerhaften
 * Bedingungen bleiben unangetastet, weil sie aus einer anderen Quelle
 * kommen und einen anderen Anspruch haben.
 */
export function ueberlagern(
  dauerhaft: UserConstraints,
  sitzung: Sitzungsbedingungen,
): UserConstraints {
  if (Object.keys(sitzung).length === 0) return dauerhaft;
  const gemischt = { ...dauerhaft, ...sitzung };
  const geprueft = UserConstraintsSchema.safeParse(gemischt);
  /*
   * Kommt etwas Ungültiges heraus, gelten die dauerhaften Bedingungen.
   *
   * Die Alternative wäre, das ungültige Gemisch weiterzureichen und
   * irgendwo tiefer im Abgleich zu scheitern — weit weg von der
   * Ursache, mit einer Fehlermeldung über ein Feld, das niemand
   * angefasst hat.
   */
  return geprueft.success ? geprueft.data : dauerhaft;
}

/** Für diese Sitzung setzen. Verändert das Profil nicht. */
export async function setzeSitzungsbedingung(
  feld: Bedingungsfeld,
  wert: unknown,
): Promise<{ ok: boolean }> {
  if (!ERLAUBT.has(feld)) return { ok: false };
  const store = await cookies();
  const bisher = await ladeSitzungsbedingungen();
  const neu = JSON.stringify({ ...bisher, [feld]: wert });
  if (neu.length > HOECHSTLAENGE) return { ok: false };
  store.set(KEKS, neu, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    // Kein `maxAge`: Sitzungskeks. Er endet mit dem Browserfenster.
  });
  return { ok: true };
}

/** Alles zurücknehmen, was nur für diese Sitzung galt. */
export async function leereSitzungsbedingungen(): Promise<void> {
  (await cookies()).delete(KEKS);
}
