"use client";

/**
 * Ereignisse melden — gebündelt, nicht bei jedem Klick.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum gebündelt
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Anfrage je Klick wäre eine Datenbankrunde je Mausbewegung. Der
 * Sammler hält Ereignisse ein paar Sekunden zurück und schickt sie
 * zusammen; beim Verlassen der Seite geht der Rest über
 * `sendBeacon` hinaus, das den Seitenwechsel überlebt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Fehler hier nichts kaputtmacht
 * ══════════════════════════════════════════════════════════════
 *
 * Weil ein verlorenes Ereignis nur bedeutet, dass Nina etwas nicht
 * bemerkt. Das Produkt funktioniert weiter — Suche, Treffer,
 * Bewerbungen hängen an keiner dieser Meldungen. Deshalb wird hier
 * nichts wiederholt und nichts angezeigt: Eine Fehlermeldung über
 * eine Beobachtung, die niemand angefordert hat, wäre Lärm.
 */

interface Meldung {
  art: string;
  jobId?: string | null;
  auftragId?: string | null;
  geschehenAm: string;
  kontext?: Record<string, string | number | boolean>;
  quelle?: "app" | "voice";
}

/** Wie lange gesammelt wird, bevor gesendet wird. */
const SAMMELN_MS = 4000;

/** Wie viele Ereignisse eine Meldung höchstens trägt — der Server nimmt 40. */
const STAPEL_MAX = 40;

const warteschlange: Meldung[] = [];
let wecker: ReturnType<typeof setTimeout> | null = null;
let sitzungId: string | null = null;

/**
 * Die Sitzungskennung.
 *
 * ── Warum sie im `sessionStorage` steht ───────────────────────
 *
 * Weil „dieselbe Sitzung" genau das heissen soll, was der Mensch
 * darunter versteht: dieser Besuch, in diesem Tab. Ein Wert im
 * `localStorage` überlebte Wochen, und Ninas Zurückhaltung — höchstens
 * drei Hinweise je Sitzung — gälte dann für immer.
 */
function sitzung(): string {
  if (sitzungId) return sitzungId;
  try {
    const vorhanden = sessionStorage.getItem("velvova.sitzung");
    if (vorhanden) {
      sitzungId = vorhanden;
      return vorhanden;
    }
    const neu = crypto.randomUUID();
    sessionStorage.setItem("velvova.sitzung", neu);
    sitzungId = neu;
    return neu;
  } catch {
    /* Privater Modus, gesperrter Speicher — dann eben ohne. */
    sitzungId = crypto.randomUUID();
    return sitzungId;
  }
}

async function senden(auswerten: boolean): Promise<void> {
  if (warteschlange.length === 0) return;
  const stapel = warteschlange.splice(0, STAPEL_MAX);
  const rumpf = JSON.stringify({ ereignisse: stapel, sitzungId: sitzung(), auswerten });

  try {
    await fetch("/api/ereignisse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rumpf,
      keepalive: true,
    });
  } catch {
    /* Siehe oben: ein verlorenes Ereignis ist kein Fehler des Produkts. */
  }
}

/**
 * Ein Ereignis melden.
 *
 * `auswerten` bittet den Server, danach zu prüfen, ob Nina etwas tun
 * möchte. Es gehört an das Ende einer Ansicht, nicht an jeden Klick.
 */
export function melde(
  art: string,
  einzelheiten: {
    jobId?: string | null;
    auftragId?: string | null;
    kontext?: Record<string, string | number | boolean>;
    sofort?: boolean;
    auswerten?: boolean;
  } = {},
): void {
  if (typeof window === "undefined") return;

  warteschlange.push({
    art,
    jobId: einzelheiten.jobId ?? null,
    auftragId: einzelheiten.auftragId ?? null,
    geschehenAm: new Date().toISOString(),
    kontext: einzelheiten.kontext,
  });

  if (einzelheiten.sofort) {
    if (wecker) clearTimeout(wecker);
    wecker = null;
    void senden(einzelheiten.auswerten === true);
    return;
  }

  if (wecker) return;
  wecker = setTimeout(() => {
    wecker = null;
    void senden(einzelheiten.auswerten === true);
  }, SAMMELN_MS);
}

/**
 * Alles Verbliebene hinausschicken, bevor die Seite verschwindet.
 *
 * `sendBeacon` statt `fetch`: Ein `fetch` beim Verlassen der Seite
 * wird vom Browser abgebrochen, ein Beacon nicht.
 */
export function spuelen(auswerten = true): void {
  if (typeof window === "undefined" || warteschlange.length === 0) return;
  const stapel = warteschlange.splice(0, STAPEL_MAX);
  const rumpf = JSON.stringify({ ereignisse: stapel, sitzungId: sitzung(), auswerten });

  try {
    const ging = navigator.sendBeacon?.(
      "/api/ereignisse",
      new Blob([rumpf], { type: "application/json" }),
    );
    if (!ging) void senden(auswerten);
  } catch {
    /* nichts */
  }
}
