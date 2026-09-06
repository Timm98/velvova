/**
 * Orte zu Koordinaten, Koordinaten zu Fahrzeiten.
 *
 * ── Warum eine Abstraktion und kein direkter Aufruf ───────────
 *
 * Routing ist der Teil des Produkts, der am ehesten den Anbieter
 * wechselt: heute etwas Kostenloses, später etwas mit Vertrag und
 * besserer Abdeckung. Zwei Funktionen mit klarer Signatur kosten heute
 * nichts und ersparen später einen Umbau quer durch die Oberfläche.
 *
 * ── Warum OSM und nicht Google ────────────────────────────────
 *
 * Weil kein Schlüssel hinterlegt ist und ich keinen erfinde. Nominatim
 * und OSRM sind öffentlich, brauchen keine Anmeldung und liefern für
 * Deutschland brauchbare Werte.
 *
 * Ihre Nutzungsregeln verlangen zwei Dinge, und beide sind eingehalten:
 * einen aussagekräftigen `User-Agent` und geringe Last. Deshalb liegt
 * VOR jedem Aufruf ein Zwischenspeicher in der Datenbank — dieselbe
 * Strecke wird genau einmal erfragt.
 *
 * Sobald jemand `ROUTING_URL` und `GEOCODING_URL` setzt, gehen die
 * Anfragen dorthin. Der Code darüber merkt davon nichts.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Keine Luftlinie als Fahrzeit. Zwischen zwei Punkten derselben Stadt
 * liegt je nach Verbindung eine Viertel- oder eine Dreiviertelstunde;
 * beide Zahlen sähen gleich seriös aus. Wenn kein Weg gefunden wird,
 * steht das da — geschätzt wird nicht.
 */

export interface Koordinate {
  lat: number;
  lon: number;
  name?: string;
}

export type Verkehrsmittel = "auto" | "oepnv" | "rad" | "roller" | "fuss";

export interface Wegstrecke {
  modus: Verkehrsmittel;
  minuten: number;
  kilometer: number;
}

const KENNUNG = "Velvova/1.0 (Karriereplattform; Kontakt über paycheck.example)";

function basis(name: string, standard: string): string {
  const wert = process.env[name]?.trim();
  return wert && wert.length > 0 ? wert.replace(/\/$/, "") : standard;
}

/** Einen Ortsnamen in eine Koordinate übersetzen. `null`, wenn unbekannt. */
/**
 * Einen Ortsnamen zu Koordinaten — im Land der Stelle, wenn bekannt.
 *
 * ── Warum das Land nicht optional-egal ist ────────────────────
 *
 * „Hamburg, Hamburg" löste Nominatim zu „Village of Hamburg, Erie
 * County, New York, Vereinigte Staaten von Amerika" auf. Von Karlsruhe
 * dorthin gibt es keine Autoroute, also stand auf der Stellenseite kein
 * Arbeitsweg — für eine Stelle in Hamburg.
 *
 * Das fiel erst auf, als der Bestand international wurde. Solange nur
 * deutsche Anzeigen darin standen, traf der erste Treffer meistens.
 * Bei 50.785 britischen und 37.284 amerikanischen Stellen trifft er es
 * nicht mehr — und der gefährlichere Fall ist nicht die fehlende
 * Route, sondern die plausible falsche: „Springfield" gibt es in
 * beiden Ländern, und eine Fahrzeit nach Springfield, Illinois sähe
 * aus wie eine Auskunft.
 *
 * `countrycodes` schneidet das ab. Jede Stelle trägt ihr Land in
 * `jobs.country`.
 */
export async function geokodieren(ort: string, land?: string | null): Promise<Koordinate | null> {
  const q = ort.trim();
  if (q.length < 2) return null;

  const kuerzel = land?.trim().toLowerCase();
  const url =
    `${basis("GEOCODING_URL", "https://nominatim.openstreetmap.org")}/search` +
    `?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(q)}` +
    (kuerzel && /^[a-z]{2}$/.test(kuerzel) ? `&countrycodes=${kuerzel}` : "");

  try {
    const antwort = await fetch(url, {
      headers: { "User-Agent": KENNUNG, "Accept-Language": "de" },
      signal: AbortSignal.timeout(6000),
    });
    if (!antwort.ok) return null;
    const daten = (await antwort.json()) as { lat: string; lon: string; display_name?: string }[];
    const erster = daten[0];
    if (!erster) return null;
    const lat = Number(erster.lat);
    const lon = Number(erster.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, name: erster.display_name };
  } catch {
    /*
     * Ein Ausfall des Dienstes ist kein Fehler der Seite.
     *
     * Die Jobseite muss auch dann stehen, wenn Nominatim gerade nicht
     * antwortet — dann fehlt eben der Arbeitsweg, und die Oberfläche
     * sagt das.
     */
    return null;
  }
}

/*
 * OSRM kennt drei Profile. Der öffentliche Demo-Dienst bietet nur
 * `driving` an; die anderen beiden stehen hier, damit ein eigener
 * Server sie sofort nutzen kann.
 */
const PROFIL: Record<Verkehrsmittel, string | null> = {
  auto: "driving",
  rad: "cycling",
  /*
   * OSRM kennt kein Rollerprofil. Ein Auto-Wert unter anderem Namen
   * wäre schlimmer als keine Antwort.
   */
  roller: null,
  fuss: "foot",
  /*
   * Öffentlicher Verkehr fehlt bewusst.
   *
   * OSRM kann ihn nicht — dafür braucht es Fahrpläne (GTFS), nicht nur
   * Strassen. Eine „ÖPNV-Zeit" aus einer Autoroute mal Faktor 1,4 wäre
   * eine erfundene Zahl an genau der Stelle, an der jemand entscheidet,
   * ob er den Weg jeden Tag fahren will.
   */
  oepnv: null,
};

/**
 * OpenRouteService — der Dienst, der die Profile ernst nimmt.
 *
 * ── Warum es ihn hier braucht ─────────────────────────────────
 *
 * Der öffentliche OSRM-Demodienst beantwortet jedes Profil mit
 * derselben Autoroute (siehe `verfuegbareModi`). Damit gab es genau ein
 * Verkehrsmittel: das Auto. Wer wissen wollte, ob der Weg mit dem Rad
 * geht, bekam keine Antwort — nicht weil die Frage schwer ist, sondern
 * weil kein Dienst sie beantwortete.
 *
 * Geprüft am 3.9.2026: Valhalla (öffentliche OSM-Instanz) antwortet
 * nicht, OpenRouteService antwortet mit
 * `401 Authorization field missing`. Also offen und kostenlos, aber
 * registrierungspflichtig — dieselbe Lage wie beim Entgeltatlas.
 *
 * ── Was welches Profil ist ────────────────────────────────────
 *
 * `roller` bekommt `cycling-electric`: Ein E-Bike oder ein Roller
 * fährt schneller als ein Fahrrad und langsamer als ein Auto, und er
 * nimmt dieselben Wege wie ein Rad. Das ist eine Näherung — und eine
 * ehrlichere als ein Auto-Wert mit anderem Namen.
 */
const ORS_PROFIL: Record<Verkehrsmittel, string | null> = {
  auto: "driving-car",
  rad: "cycling-regular",
  roller: "cycling-electric",
  fuss: "foot-walking",
  /* Fahrpläne kann auch ORS nicht. Siehe unten. */
  oepnv: null,
};

function orsSchluessel(): string | null {
  const k = process.env.ORS_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

async function wegUeberOrs(
  von: Koordinate,
  nach: Koordinate,
  modus: Verkehrsmittel,
  schluessel: string,
): Promise<Wegstrecke | null> {
  const profil = ORS_PROFIL[modus];
  if (!profil) return null;

  try {
    const antwort = await fetch(
      `https://api.openrouteservice.org/v2/directions/${profil}` +
        `?start=${von.lon},${von.lat}&end=${nach.lon},${nach.lat}`,
      {
        headers: {
          Authorization: schluessel,
          /*
           * `application/geo+json`, nicht `application/json`.
           *
           * OpenRouteService antwortet auf `application/json` mit
           * `406 Not Acceptable`. Der Unterschied ist ein Wort im
           * Kopf, und der Fehler sieht aus wie ein ungültiger
           * Schlüssel: „keine Route" für jedes Verkehrsmittel, bei
           * einem Zugang, der einwandfrei ist.
           */
          Accept: "application/geo+json",
          "User-Agent": KENNUNG,
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!antwort.ok) {
      // Nur der Statuscode. Eine fremde Fehlerseite gehört nicht ins Protokoll.
      console.warn(`[routing] OpenRouteService antwortete ${antwort.status} für ${modus}`);
      return null;
    }
    const daten = (await antwort.json()) as {
      features?: { properties?: { summary?: { duration?: number; distance?: number } } }[];
    };
    const z = daten.features?.[0]?.properties?.summary;
    if (!z?.duration || !z?.distance) return null;

    return {
      modus,
      minuten: Math.round(z.duration / 60),
      kilometer: Math.round((z.distance / 1000) * 10) / 10,
    };
  } catch {
    return null;
  }
}

/** Eine Strecke zwischen zwei Punkten. `null`, wenn nicht ermittelbar. */
export async function wegBerechnen(
  von: Koordinate,
  nach: Koordinate,
  modus: Verkehrsmittel,
): Promise<Wegstrecke | null> {
  /*
   * Der Dienst mit echten Profilen zuerst.
   *
   * Liegt ein ORS-Schlüssel vor, beantwortet er alle Verkehrsmittel
   * ausser dem öffentlichen Verkehr. Ohne ihn bleibt OSRM — und damit
   * nur das Auto.
   */
  const schluessel = orsSchluessel();
  if (schluessel && ORS_PROFIL[modus]) {
    return wegUeberOrs(von, nach, modus, schluessel);
  }

  const profil = PROFIL[modus];
  if (!profil) return null;

  const url =
    `${basis("ROUTING_URL", "https://router.project-osrm.org")}/route/v1/${profil}/` +
    `${von.lon},${von.lat};${nach.lon},${nach.lat}?overview=false&alternatives=false`;

  try {
    const antwort = await fetch(url, {
      headers: { "User-Agent": KENNUNG },
      signal: AbortSignal.timeout(8000),
    });
    if (!antwort.ok) return null;
    const daten = (await antwort.json()) as {
      code?: string;
      routes?: { duration: number; distance: number }[];
    };
    const route = daten.routes?.[0];
    if (daten.code !== "Ok" || !route) return null;

    return {
      modus,
      minuten: Math.round(route.duration / 60),
      kilometer: Math.round((route.distance / 1000) * 10) / 10,
    };
  } catch {
    return null;
  }
}

/**
 * Welche Verkehrsmittel dieser Dienst wirklich kann.
 *
 * ── Der Fund, der diese Funktion nötig gemacht hat ────────────
 *
 * Der öffentliche OSRM-Demodienst nimmt jedes Profil in der Adresse
 * entgegen und antwortet immer mit derselben AUTOROUTE. Karlsruhe →
 * Stuttgart ergab dreimal „64 Minuten, 79,8 km" — für Auto, Rad und zu
 * Fuss.
 *
 * Das ist die gefährlichste Sorte Fehler: Die Antwort ist wohlgeformt,
 * die Zahl plausibel, und niemand prüft nach. „Fahrrad: 64 Minuten" für
 * achtzig Kilometer hätte in der Oberfläche gestanden wie eine
 * Auskunft.
 *
 * Also: Ohne eigenen Routing-Dienst gibt es nur das Auto. Wer
 * `ROUTING_URL` auf eine Instanz mit Rad- und Fussprofil setzt, bekommt
 * die anderen dazu.
 */
export function verfuegbareModi(): Verkehrsmittel[] {
  /*
   * Mit ORS-Schlüssel gibt es vier Verkehrsmittel.
   *
   * Der öffentliche Verkehr fehlt weiterhin — dafür braucht es
   * Fahrpläne, nicht Strassen. Eine „ÖPNV-Zeit" aus einer Autoroute
   * mal Faktor 1,4 wäre eine erfundene Zahl an genau der Stelle, an
   * der jemand entscheidet, ob er den Weg täglich fahren will.
   */
  if (process.env.ORS_API_KEY?.trim()) return ["auto", "rad", "roller", "fuss"];

  const eigener = process.env.ROUTING_URL?.trim();
  return eigener && eigener.length > 0 ? ["auto", "rad", "fuss"] : ["auto"];
}

/**
 * Warum ein Verkehrsmittel fehlt — für die Oberfläche.
 *
 * Ein fehlendes Rad sieht sonst aus wie ein Produkt, das an Radfahrer
 * nicht gedacht hat. Es ist aber eine fehlende Zugangsdatei, und das
 * ist ein Satz und kein Rätsel.
 */
export function fehlendeModiGrund(): string | null {
  if (process.env.ORS_API_KEY?.trim() || process.env.ROUTING_URL?.trim()) return null;
  return (
    "Rad, Roller und Fussweg brauchen einen Routendienst, der diese Profile " +
    "unterscheidet. Der frei zugängliche Dienst beantwortet jede Anfrage mit " +
    "der Autoroute — deshalb steht hier nur das Auto."
  );
}
