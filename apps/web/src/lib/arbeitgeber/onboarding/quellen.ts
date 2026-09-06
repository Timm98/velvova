import "server-only";

import { resolve4, resolve6 } from "node:dns/promises";
import { verifyUrl } from "@paycheck/sources";
import { pruefeDatei } from "@/lib/documents/dateipruefung";
import { textAuszug } from "@/lib/documents/textauszug";
import { verstehe } from "./deutung";
import type { Fund } from "./leser";
import { AGENT, robotsPruefen } from "./robots";

/**
 * Angaben aus einer Website oder einem Dokument.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das kein Scraper ist
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Adresse, vom Arbeitgeber eingegeben, einmal abgerufen, mit
 * offenem Namen im User-Agent, nach Rückfrage bei robots.txt, ohne
 * Weiterleitungen, ohne Anmeldung, ohne Umgehung von irgendetwas.
 *
 * Was hier NICHT passiert und auch nicht dazukommen darf: Stellen-
 * portale absuchen, Profile einsammeln, wiederkehrend abrufen,
 * Schutzmassnahmen umgehen. Das ist keine Frage der Umsetzung,
 * sondern der Sache: Dieses Produkt lebt davon, dass Menschen ihre
 * Daten selbst hergeben.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum Funde von hier eine andere Quelle tragen
 * ══════════════════════════════════════════════════════════════
 *
 * `quelle: "website"` statt `"gespraech"`. Der Unterschied steht
 * später in der Oberfläche: „Von eurer Website“ ist etwas anderes als
 * „hast du mir gesagt“ — die Website kann fünf Jahre alt sein.
 */

/** Der Text einer Seite, ohne die Seite. */
export function textAusHtml(html: string): string {
  return (
    html
      /* Erst raus, was nie Text war. Ohne diesen Schritt landet
         JavaScript-Quelltext in der Extraktion und wird dort zu
         Behauptungen über das Unternehmen. */
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      /* Blockenden werden zu Zeilenumbrüchen, sonst klebt die
         Überschrift am ersten Satz und die Satzerkennung verliert die
         Grenze. */
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)\s*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&(?:quot|#34);/g, '"')
      .replace(/&(?:#39|apos);/g, "'")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export type Quellergebnis = {
  ok: boolean;
  funde: Fund[];
  /** Was der Person gesagt wird. */
  text: string;
  /** Wie viele Zeichen gelesen wurden — für die Einordnung. */
  zeichen?: number;
};

const MAX_SEITE = 1.5 * 1024 * 1024;
const MAX_TEXT = 60_000;

async function aufloesen(host: string): Promise<string[]> {
  const [v4, v6] = await Promise.allSettled([resolve4(host), resolve6(host)]);
  return [
    ...(v4.status === "fulfilled" ? v4.value : []),
    ...(v6.status === "fulfilled" ? v6.value : []),
  ];
}

/** Eine Seite lesen. */
export async function vonWebsite(rohAdresse: string): Promise<Quellergebnis> {
  const urteil = await verifyUrl(rohAdresse, aufloesen);
  if (!urteil.ok || !urteil.url) {
    return { ok: false, funde: [], text: urteil.message ?? "Diese Adresse kann ich nicht abrufen." };
  }
  const ziel = urteil.url;

  if (ziel.protocol !== "https:") {
    /*
     * Nur HTTPS. Über http käme der Inhalt ungeschützt an, und was
     * hier gelesen wird, landet anschliessend im Profil des
     * Unternehmens — eine veränderte Antwort unterwegs wäre nicht zu
     * bemerken.
     */
    return {
      ok: false,
      funde: [],
      text: "Ich rufe nur über https ab. Gibt es die Seite auch verschlüsselt?",
    };
  }

  const robots = await robotsPruefen(ziel);
  if (!robots.erlaubt) return { ok: false, funde: [], text: robots.grund! };

  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 12_000);
  let html: string;
  try {
    const antwort = await fetch(ziel, {
      /*
       * Weiterleitungen werden nicht verfolgt — dieselbe Begründung
       * wie beim Anzeigenimport: Die Adressprüfung gilt für die
       * geprüfte Adresse, und ein 302 auf eine interne Adresse hebelt
       * sie aus.
       */
      redirect: "manual",
      signal: abbruch.signal,
      headers: {
        "user-agent": `${AGENT}/1.0 (+https://velvova.com/bot)`,
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (antwort.status >= 300 && antwort.status < 400) {
      return {
        ok: false,
        funde: [],
        text: "Die Adresse leitet weiter. Gib mir die Zieladresse direkt.",
      };
    }
    if (antwort.status === 401 || antwort.status === 403) {
      /* Kein zweiter Versuch, keine andere Kennung. Ein Nein ist ein
         Nein — auch von einem Server. */
      return {
        ok: false,
        funde: [],
        text: "Die Seite lässt mich nicht herein. Kopier mir den Text, dann arbeite ich damit.",
      };
    }
    if (!antwort.ok) {
      return { ok: false, funde: [], text: `Die Seite antwortet mit ${antwort.status}.` };
    }

    const typ = antwort.headers.get("content-type") ?? "";
    if (!typ.includes("html") && !typ.includes("text/plain")) {
      return { ok: false, funde: [], text: "Unter der Adresse liegt keine Textseite." };
    }

    html = (await antwort.text()).slice(0, MAX_SEITE);
  } catch {
    return {
      ok: false,
      funde: [],
      text: "Die Seite hat nicht geantwortet. Versuch es später noch einmal.",
    };
  } finally {
    clearTimeout(uhr);
  }

  const text = textAusHtml(html).slice(0, MAX_TEXT);
  if (text.length < 200) {
    return {
      ok: false,
      funde: [],
      text:
        "Auf der Seite steht fast kein Text — vermutlich wird sie erst im Browser " +
        "zusammengebaut. Kopier mir, was dort steht.",
    };
  }

  const { funde } = await verstehe({ text });
  return {
    ok: true,
    funde: funde.map((f) => ({ ...f, quelle: "website" as const })),
    text:
      funde.length > 0
        ? `Ich habe ${funde.length} Angaben von eurer Website übernommen. Schau sie dir an — Websites sind oft älter, als man denkt.`
        : "Von der Seite konnte ich nichts Konkretes übernehmen. Erzähl es mir lieber selbst.",
    zeichen: text.length,
  };
}

/** Ein Dokument lesen. */
export async function vonDokument(opt: {
  mime: string;
  name: string;
  daten: Uint8Array;
}): Promise<Quellergebnis> {
  const geprueft = pruefeDatei(opt.mime, opt.name, opt.daten);
  if (!geprueft.ok || !geprueft.typ) {
    return { ok: false, funde: [], text: geprueft.grund ?? "Diese Datei kann ich nicht lesen." };
  }

  /* Bilder haben keinen Text. Sie hier abzulehnen ist ehrlicher, als
     eine Texterkennung anzudeuten, die es nicht gibt. */
  if (geprueft.typ === "png" || geprueft.typ === "jpeg") {
    return {
      ok: false,
      funde: [],
      text: "Aus einem Bild kann ich keinen Text lesen. Schick mir die Datei als PDF oder DOCX.",
    };
  }

  const auszug = textAuszug(geprueft.typ, opt.daten);
  if (!auszug.ok || !auszug.text) {
    return { ok: false, funde: [], text: auszug.grund ?? "Aus der Datei kam kein Text heraus." };
  }

  const text = auszug.text.slice(0, MAX_TEXT);
  const { funde } = await verstehe({ text });

  return {
    ok: true,
    funde: funde.map((f) => ({ ...f, quelle: "dokument" as const })),
    text:
      funde.length > 0
        ? `Ich habe ${funde.length} Angaben aus „${opt.name}“ übernommen.`
        : `Aus „${opt.name}“ konnte ich nichts Konkretes übernehmen.`,
    zeichen: text.length,
  };
}
