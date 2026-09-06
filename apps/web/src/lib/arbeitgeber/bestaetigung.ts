"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { mailBereit, versendeMail } from "@/lib/mail/versand";
import { bestaetigungsmail } from "@/lib/mail/bestaetigungsmail";
import {
  supabaseCodePruefen,
  supabaseCodeSenden,
  supabaseVersandMoeglich,
} from "./supabase-code";

/**
 * Die Marke für einen Code, den Supabase verschickt hat.
 *
 * Sie steht in `code_hash` — an der Stelle, an der sonst der Hash
 * steht. Das ist Absicht und braucht keine neue Spalte: `hashe()`
 * liefert Hexadezimalzeichen, „supabase" kann also mit keinem Hash
 * verwechselt werden.
 *
 * Wichtiger ist, WARUM die Marke in der Zeile steht und nicht in der
 * Konfiguration abgefragt wird: Zwischen Anfordern und Eingeben
 * liegen Minuten. Ändert sich in dieser Zeit die Einrichtung, muss
 * der Code trotzdem so geprüft werden, wie er entstanden ist. Die
 * Zeile weiss das, `isSupabaseConfigured()` weiss nur das Jetzt.
 */
const SUPABASE_MARKE = "supabase";

/**
 * Die E-Mail-Adresse bestätigen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sechs Ziffern und kein Link
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Link wechselt das Gerät: Wer sich am Rechner registriert und die
 * Mail auf dem Telefon öffnet, führt den Rest der Einrichtung dort
 * fort — mitten in einem Formular, das er am Rechner angefangen hat.
 * Ein Code lässt sich abtippen, ohne die Seite zu verlassen.
 *
 * ══════════════════════════════════════════════════════════════
 * Die vier Schranken
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Million Möglichkeiten durchprobiert ein Skript in Minuten.
 * Jede Schranke deckt einen anderen Angriff ab; einzeln reicht keine:
 *
 *   **Zehn Minuten Gültigkeit** gegen das lange Raten.
 *
 *   **Fünf Versuche, dann fünfzehn Minuten Sperre** gegen das schnelle
 *   Raten. Die Sperre gilt der Person, nicht dem Code — sonst fordert
 *   man einfach den nächsten an und hat wieder fünf.
 *
 *   **Fünf Codes je Stunde und Konto** gegen das Durchwechseln.
 *
 *   **Zwanzig Codes je Stunde und IP** gegen den Absender, der sich
 *   tausend Adressen nimmt. Eine Begrenzung nur nach Konto trifft das
 *   Opfer, nicht den Täter.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum `randomInt` und `timingSafeEqual`
 * ══════════════════════════════════════════════════════════════
 *
 * `Math.random` ist nicht kryptografisch: Aus wenigen beobachteten
 * Werten lässt sich der Zustand rekonstruieren und der nächste
 * vorhersagen.
 *
 * Und ein Vergleich mit `===` bricht beim ersten abweichenden Zeichen
 * ab. Über viele Versuche gemessen verrät die Dauer, wie viele Stellen
 * stimmten — bei sechs Ziffern reicht das, um sie einzeln zu erraten.
 */

const GUELTIG_MINUTEN = 10;
const MAX_VERSUCHE = 5;
const SPERRE_MINUTEN = 15;
/** Frühestens nach dieser Zeit darf ein neuer Code angefordert werden. */
const WARTEZEIT_SEKUNDEN = 60;
const MAX_CODES_JE_STUNDE = 5;
const MAX_CODES_JE_IP_STUNDE = 20;

function hashe(wert: string): string {
  return createHash("sha256").update(wert).digest("hex");
}

/** Vergleich in konstanter Zeit über die Hashes fester Länge. */
function gleich(a: string, b: string): boolean {
  const pa = Buffer.from(a, "hex");
  const pb = Buffer.from(b, "hex");
  return pa.length === pb.length && timingSafeEqual(pa, pb);
}

/**
 * Der Hash der anfragenden Adresse.
 *
 * Hinter einem Proxy steht die echte Adresse in `x-forwarded-for`, und
 * zwar als erster Eintrag. Fehlt der Kopf, gibt es keine Begrenzung
 * nach IP — das ist die richtige Richtung: lieber keine Begrenzung als
 * eine, die alle Anfragen für dieselbe hält und sich gegenseitig
 * aussperrt.
 */
async function ipHash(): Promise<string | null> {
  const h = await headers();
  const roh = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return roh ? hashe(roh) : null;
}

/** t***@unternehmen.de — genug zum Wiedererkennen, zu wenig zum Ablesen. */
export async function maskiere(adresse: string): Promise<string> {
  const [name, domain] = adresse.split("@");
  if (!name || !domain) return adresse;
  return `${name.slice(0, 1)}***@${domain}`;
}

export type CodeErgebnis = {
  ok: boolean;
  text: string;
  /** Sekunden bis zum nächsten möglichen Versand. */
  wartenBis?: number;
  /** Die maskierte Zieladresse. */
  ziel?: string;
  /** Nur ohne Maildienst und ausserhalb der Produktion. */
  entwurfsCode?: string;
  grund?: "gesperrt" | "abgelaufen" | "falsch" | "konfiguration" | "anbieter" | "zu_oft";
};

/* ══════════════════════════════════════════════════════════════
   Anfordern
   ══════════════════════════════════════════════════════════════ */

export async function codeAnfordern(adresse?: string): Promise<CodeErgebnis> {
  const user = await requireUser();
  const ziel = (adresse ?? user.email ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ziel)) {
    return { ok: false, text: "Diese E-Mail-Adresse sieht nicht vollständig aus." };
  }

  /*
   * Die Versandbereitschaft wird VOR dem Anlegen geprüft.
   *
   * Erst einen Code schreiben und dann am fehlenden Schlüssel
   * scheitern hiesse, einen Code zu erzeugen, den niemand je bekommt —
   * und die Sperre gegen zu viele Codes zählt ihn trotzdem mit.
   */
  /*
   * Supabase geht vor.
   *
   * `mailBereit()` prüft unseren eigenen Versandweg. Verschickt
   * Supabase, ist dieser Weg nicht beteiligt — und seine fehlende
   * Einrichtung darf den Vorgang dann nicht abbrechen.
   *
   * Genau hier lag der Fehler, wegen dem in Produktion kein Code
   * ankam: `MAIL_PROVIDER` war nicht gesetzt, `mailBereit()` lehnte
   * ab, und die Anfrage endete an dieser Stelle — obwohl Supabase
   * verbunden war und hätte schicken können.
   */
  if (!supabaseVersandMoeglich()) {
    const stand = mailBereit();
    if (!stand.bereit) {
      return {
        ok: false,
        grund: "konfiguration",
        text: "Der E-Mail-Versand ist auf diesem Server nicht eingerichtet. Bitte wende dich an den Support.",
      };
    }
  }

  const db = await getDb();
  const jetzt = new Date();
  const vorEinerStunde = new Date(Date.now() - 3_600_000);

  /*
   * Drei Prüfungen, eine Abfrage — und die vierte daneben statt danach.
   *
   * ── Warum das hier steht ──────────────────────────────────
   *
   * Vorher waren es vier `await` hintereinander: letzter Code,
   * Codes je Stunde, Codes je IP, offene Sperre. Jeder einzelne
   * korrekt, jeder einzelne ein eigener Netzweg.
   *
   * Gemessen gegen Supabase: ein `withUser` kostet 170 ms (BEGIN,
   * set_config, Abfrage, COMMIT), eine Abfrage ohne Transaktion
   * 42 ms. Vier davon nacheinander waren gut 550 ms, in denen
   * ausschliesslich gewartet wurde — und danach kam der Versand
   * noch gar nicht, sondern erst zwei weitere Vorgänge.
   *
   * Die drei nutzerbezogenen Werte stehen alle in derselben Tabelle
   * und derselben Zeilenmenge. Sie einzeln zu holen war nie eine
   * Entscheidung, sondern die Reihenfolge, in der die Regeln
   * geschrieben wurden.
   *
   * ── Warum die IP-Zählung daneben und nicht dabei steht ────
   *
   * Sie zählt über alle Konten hinweg — das ist ihr Zweck — und
   * käme unter der Zeilenrichtlinie nur an die eigenen Zeilen.
   * Sie läuft deshalb ohne Nutzersitzung und kann nicht in dieselbe
   * Abfrage. Gleichzeitig laufen kann sie aber: Sie hängt von
   * keinem der anderen Werte ab, und mit `Promise.all` kostet sie
   * nichts mehr.
   *
   * Gelesen wird dabei ausschliesslich eine Anzahl, keine Zeile.
   */
  const ip = await ipHash();

  const [eigene, jeIp] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx.execute(sql`
        SELECT
          max(created_at) AS letzter,
          count(*) FILTER (WHERE created_at > ${vorEinerStunde})::int AS je_stunde,
          (
            SELECT gesperrt_bis FROM bestaetigungscodes
            WHERE user_id = ${user.id} AND consumed_at IS NULL
            ORDER BY created_at DESC LIMIT 1
          ) AS gesperrt_bis
        FROM bestaetigungscodes
        WHERE user_id = ${user.id}
      `),
    ),
    ip
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.bestaetigungscodes)
          .where(
            and(
              eq(schema.bestaetigungscodes.ipHash, ip),
              gt(schema.bestaetigungscodes.createdAt, vorEinerStunde),
            ),
          )
      : Promise.resolve([{ n: 0 }]),
  ]);

  const stand = (eigene as unknown as { rows: {
    letzter: string | Date | null;
    je_stunde: number;
    gesperrt_bis: string | Date | null;
  }[] }).rows[0];

  /* Postgres liefert je nach Treiber Date oder Zeichenkette. Beides
     hier einmal vereinheitlichen statt an drei Stellen zu prüfen. */
  const alsDatum = (w: string | Date | null | undefined): Date | null =>
    w == null ? null : w instanceof Date ? w : new Date(w);

  const letzterAm = alsDatum(stand?.letzter);
  if (letzterAm) {
    const vergangen = (Date.now() - letzterAm.getTime()) / 1000;
    if (vergangen < WARTEZEIT_SEKUNDEN) {
      return {
        ok: false,
        grund: "zu_oft",
        text: "Es ist gerade schon ein Code unterwegs.",
        wartenBis: Math.ceil(WARTEZEIT_SEKUNDEN - vergangen),
        ziel: await maskiere(ziel),
      };
    }
  }

  if ((stand?.je_stunde ?? 0) >= MAX_CODES_JE_STUNDE) {
    return {
      ok: false,
      grund: "zu_oft",
      text: "Zu viele Codes in kurzer Zeit. Versuche es in einer Stunde noch einmal.",
      ziel: await maskiere(ziel),
    };
  }

  if ((jeIp[0]?.n ?? 0) >= MAX_CODES_JE_IP_STUNDE) {
    return {
      ok: false,
      grund: "zu_oft",
      text: "Zu viele Anfragen von diesem Anschluss. Versuche es später noch einmal.",
      ziel: await maskiere(ziel),
    };
  }

  /* Sechs Ziffern, führende Nullen erlaubt: 000042 ist ein gültiger
     Code. Ein Bereich ab 100000 wäre um zehn Prozent kleiner. */
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  /*
   * Ein neuer Code macht den vorherigen ungültig.
   *
   * Sonst gälten nach drei Anforderungen drei Codes gleichzeitig, und
   * jeder hätte seine eigenen Versuche — aus fünf würden fünfzehn.
   *
   * Eine laufende Sperre wird dabei übernommen: Sie gilt der Person.
   */
  /* Die laufende Sperre steht schon in der Abfrage von oben. Sie
     hier noch einmal zu holen wäre ein weiterer Netzweg für einen
     Wert, den wir haben. */
  const laufendeSperre = alsDatum(stand?.gesperrt_bis);

  /*
   * Wer den Code verschickt — und damit auch, wer ihn vergleicht.
   *
   * Ist Supabase eingerichtet, kennen wir den verschickten Code gar
   * nicht: Er entsteht dort und wird dort geprüft. Unser eigener,
   * eine Zeile weiter oben erzeugter Code wird dann nicht benutzt.
   *
   * Er wird trotzdem erzeugt, und zwar ohne Bedingung. Eine Erzeugung
   * im Zweig hiesse, dass der eigene Weg irgendwann eine Variable
   * benutzt, die im anderen Zweig nie gesetzt wurde — der Fehler
   * fiele erst auf, wenn jemand Supabase abschaltet.
   */
  const ueberSupabase = supabaseVersandMoeglich();

  /*
   * Aufbrauchen und Anlegen in EINER Transaktion.
   *
   * Zwei `withUser` hintereinander kosteten zwei BEGIN und zwei
   * COMMIT — vier Netzwege für nichts. Wichtiger als die 170 ms ist
   * aber, dass beides jetzt zusammen gilt oder gar nicht: Bricht die
   * Verbindung zwischen den beiden Schritten ab, stünde sonst ein
   * Konto ohne gültigen Code da, dessen Stundenzähler trotzdem
   * gestiegen ist.
   */
  /*
   * ══════════════════════════════════════════════════════════
   * Anlegen, senden, DANN den alten aufbrauchen
   * ══════════════════════════════════════════════════════════
   *
   * Hier stand Aufbrauchen und Anlegen in einer Transaktion, vor dem
   * Versand. Das war falsch, und der Fehler zeigte sich erst mit
   * einem Anbieter, der auch mal ablehnt:
   *
   * Jemand fordert einen Code an, bekommt ihn, tippt sich vertan und
   * fordert einen neuen an. Der Versand scheitert — Mailgrenze,
   * Netz, egal. Vorher war damit BEIDES weg: Der neue kam nie an,
   * und der alte, noch gültige, war aufgebraucht. Wer nachfragte,
   * bekam „Es ist gerade schon ein Code unterwegs" und hatte keinen.
   *
   * Die neue Reihenfolge:
   *
   *   1. Die Zeile anlegen. Sie zählt sofort für Wartezeit und
   *      Stundengrenze — sonst hämmerte ein gescheiterter Versand
   *      ungebremst gegen den Anbieter.
   *   2. Senden.
   *   3. Bei Erfolg alle ÄLTEREN offenen Codes aufbrauchen. Der neue
   *      bleibt als einziger stehen.
   *   4. Bei Misserfolg die eben angelegte Zeile selbst aufbrauchen.
   *      Sie ist tot; der vorherige Code lebt weiter und lässt sich
   *      noch eingeben.
   */
  const [angelegt] = await withUser(db, user.id, (tx) =>
    tx
      .insert(schema.bestaetigungscodes)
      .values({
        userId: user.id,
        email: ziel,
        codeHash: ueberSupabase ? SUPABASE_MARKE : hashe(code),
        ipHash: ip,
        /* Eine laufende Sperre wird übernommen: Sie gilt der Person,
           nicht dem einzelnen Code. */
        gesperrtBis: laufendeSperre,
        expiresAt: new Date(Date.now() + GUELTIG_MINUTEN * 60_000),
      })
      .returning({ id: schema.bestaetigungscodes.id }),
  );

  /** Die eben angelegte Zeile zurücknehmen, wenn der Versand scheitert. */
  const zuruecknehmen = async () => {
    if (!angelegt) return;
    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.bestaetigungscodes)
        .set({ consumedAt: new Date() })
        .where(eq(schema.bestaetigungscodes.id, angelegt.id)),
    ).catch(() => undefined);
  };

  /** Nach erfolgreichem Versand gilt nur noch der neue Code. */
  const aeltereAufbrauchen = async () => {
    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.bestaetigungscodes)
        .set({ consumedAt: jetzt })
        .where(
          and(
            eq(schema.bestaetigungscodes.userId, user.id),
            isNull(schema.bestaetigungscodes.consumedAt),
            angelegt ? ne(schema.bestaetigungscodes.id, angelegt.id) : sql`true`,
          ),
        ),
    );
  };

  if (ueberSupabase) {
    const versand = await supabaseCodeSenden(ziel);
    const maskiert = await maskiere(ziel);

    if (!versand.ok) {
      await zuruecknehmen();
      /* Die Zeile bleibt stehen und läuft ab — wie beim eigenen
         Versand. Sie zu löschen wäre sauberer und würde die Grenze
         „Codes je Stunde" umgehen. */
      /*
       * Auf unsere Begründungen abbilden statt sie zu erweitern.
       *
       * `grund` steuert, was die Oberfläche anbietet — einen zweiten
       * Versuch, eine andere Adresse, den Hinweis an den Betrieb. Ein
       * neuer Wert dort wäre überall ein unbehandelter Fall, und
       * unbehandelt heisst hier: gar kein Angebot.
       *
       * „abgelehnt" wird zu `konfiguration`, weil es genau das ist:
       * Supabase weist die Adresse ab, solange kein eigener
       * Versanddienst hinterlegt ist. Das ist unser Versäumnis und
       * nicht das der Adresse.
       */
      const grund =
        versand.grund === "gedrosselt"
          ? ("zu_oft" as const)
          : versand.grund === "fehler"
            ? ("anbieter" as const)
            : ("konfiguration" as const);

      return { ok: false, grund, text: versand.text, ziel: maskiert };
    }

    await aeltereAufbrauchen();
    return {
      ok: true,
      ziel: maskiert,
      text: `Wir haben dir einen Code an ${maskiert} geschickt.`,
      wartenBis: WARTEZEIT_SEKUNDEN,
    };
  }

  /*
   * Erst senden, dann melden.
   *
   * „Wir haben dir einen Code geschickt" darf erst dastehen, wenn der
   * Anbieter den Versand angenommen hat. Vorher gemeldet wartet jemand
   * auf eine Mail, die nie losgeschickt wurde — und hält den Schritt
   * für kaputt statt den Versand.
   */
  const mail = bestaetigungsmail({ code, minuten: GUELTIG_MINUTEN });
  const versand = await versendeMail({ ...mail, an: ziel });

  if (!versand.ok) {
    /* Dieselbe Rücknahme wie im Supabase-Zweig: Die eben angelegte
       Zeile wird aufgebraucht, der vorherige Code bleibt gültig. Die
       Zeile bleibt aber stehen und zählt für die Stundengrenze —
       sonst wäre ein scheiternder Versand ein Weg, ungebremst gegen
       den Anbieter zu laufen. */
    await zuruecknehmen();
    return {
      ok: false,
      grund: versand.grund,
      text: versand.text,
      ziel: await maskiere(ziel),
    };
  }

  await aeltereAufbrauchen();
  const maskiert = await maskiere(ziel);

  /*
   * Ohne Maildienst kommt der Code zurück — nur ausserhalb der
   * Produktion, und nur, weil `mailBereit` den Entwurfsmodus dort gar
   * nicht durchlässt. Sobald ein Dienst eingerichtet ist, geht der
   * Code per Mail und verschwindet aus der Antwort, ohne dass jemand
   * daran denken muss.
   */
  return {
    ok: true,
    ziel: maskiert,
    text: versand.entwurf
      ? `Kein Maildienst eingerichtet — der Code für ${maskiert} lautet ${code}.`
      : `Wir haben dir einen Code an ${maskiert} geschickt.`,
    ...(versand.entwurf ? { entwurfsCode: code } : {}),
    wartenBis: WARTEZEIT_SEKUNDEN,
  };
}

/* ══════════════════════════════════════════════════════════════
   Prüfen
   ══════════════════════════════════════════════════════════════ */

export async function codePruefen(eingabe: string): Promise<CodeErgebnis> {
  const user = await requireUser();
  const code = eingabe.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, text: "Der Code besteht aus sechs Ziffern." };

  const db = await getDb();
  const [offen] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.bestaetigungscodes)
      .where(
        and(
          eq(schema.bestaetigungscodes.userId, user.id),
          isNull(schema.bestaetigungscodes.consumedAt),
        ),
      )
      .orderBy(desc(schema.bestaetigungscodes.createdAt))
      .limit(1),
  );

  if (!offen) return { ok: false, text: "Es ist kein Code offen. Fordere einen neuen an." };

  if (offen.gesperrtBis && offen.gesperrtBis.getTime() > Date.now()) {
    const rest = Math.ceil((offen.gesperrtBis.getTime() - Date.now()) / 60_000);
    return {
      ok: false,
      grund: "gesperrt",
      text: `Zu viele Fehlversuche. Die Eingabe ist noch ${rest} ${rest === 1 ? "Minute" : "Minuten"} gesperrt.`,
    };
  }

  if (offen.expiresAt.getTime() < Date.now()) {
    return { ok: false, grund: "abgelaufen", text: "Der Code ist abgelaufen. Bitte fordere einen neuen an." };
  }

  /*
   * Der Zähler steigt VOR dem Vergleich.
   *
   * Zählte man erst nach einem Fehlversuch, liesse sich der Zähler
   * umgehen, indem man die Anfrage abbricht, bevor die Antwort kommt.
   * Vorher gezählt kostet jeder Versuch einen — auch der, dessen
   * Ergebnis niemand abwartet.
   */
  const versuche = offen.versuche + 1;
  const sperren = versuche >= MAX_VERSUCHE;

  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.bestaetigungscodes)
      .set({
        versuche,
        ...(sperren ? { gesperrtBis: new Date(Date.now() + SPERRE_MINUTEN * 60_000) } : {}),
      })
      .where(eq(schema.bestaetigungscodes.id, offen.id)),
  );

  /*
   * Wer vergleicht, entscheidet die Zeile — nicht die Konfiguration.
   *
   * Der Zähler oben ist schon gestiegen. Das gilt für beide Wege: Ein
   * Versuch gegen Supabase kostet genauso einen wie einer gegen den
   * eigenen Hash, sonst wäre der eine Weg die Lücke im anderen.
   */
  const stimmt =
    offen.codeHash === SUPABASE_MARKE
      ? await supabaseCodePruefen(offen.email, code)
      : gleich(hashe(code), offen.codeHash);

  if (!stimmt) {
    const rest = MAX_VERSUCHE - versuche;
    return {
      ok: false,
      grund: sperren ? "gesperrt" : "falsch",
      text: sperren
        ? `Zu viele Fehlversuche. Die Eingabe ist ${SPERRE_MINUTEN} Minuten gesperrt.`
        : `Der eingegebene Code ist nicht korrekt. Noch ${rest} ${rest === 1 ? "Versuch" : "Versuche"}.`,
    };
  }

  /*
   * Bestätigt — und die Adresse wandert ins Konto.
   *
   * Erst jetzt: Wer sie im zweiten Schritt korrigiert hat, hat sie
   * damit belegt. Vorher stünde eine unbelegte Adresse im Konto.
   */
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.bestaetigungscodes)
      .set({ consumedAt: new Date() })
      .where(eq(schema.bestaetigungscodes.id, offen.id)),
  );

  await db
    .update(schema.users)
    .set({ email: offen.email, emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
    /* Die Adresse gehört bereits einem anderen Konto. Die Bestätigung
       selbst bleibt gültig — nur die Übernahme unterbleibt. Die
       Meldung sagt das nicht: Sie verriete, dass es das andere Konto
       gibt. */
    .catch(() => undefined);

  return { ok: true, text: "Adresse bestätigt." };
}
