/**
 * Darf der Server diese Adresse abrufen?
 *
 * Eine vom Nutzer eingegebene URL, die der Server holt, ist die
 * klassische SSRF-Lücke: `http://169.254.169.254/latest/meta-data/`
 * liest bei manchen Hostern die Zugangsdaten der Maschine aus, und
 * `http://localhost:5432` erreicht die eigene Datenbank. Der Nutzer
 * bekommt in beiden Fällen etwas zu sehen, das ihn nichts angeht.
 *
 * Die Prüfung läuft zweistufig, und die zweite ist die, die zählt:
 *
 *   1. Vor der Auflösung — Schema, Port, offensichtliche Adressformen.
 *   2. Nach der Auflösung — jede IP, auf die der Name zeigt.
 *
 * Ohne den zweiten Schritt bleibt DNS Rebinding offen: ein Angreifer
 * lässt `boese.example` zuerst auf eine öffentliche Adresse zeigen und
 * beim zweiten Aufruf auf 127.0.0.1. Deshalb wird die aufgelöste
 * Adresse geprüft und danach genau diese Adresse verbunden — nicht der
 * Name noch einmal.
 */

export type UrlRejectionReason =
  | "invalid_url"
  | "scheme_not_allowed"
  | "port_not_allowed"
  | "private_address"
  | "credentials_in_url"
  | "hostname_not_resolvable";

export interface UrlVerdict {
  ok: boolean;
  reason?: UrlRejectionReason;
  /** In ganzen Sätzen, für die Person. */
  message?: string;
  url?: URL;
  /** Die aufgelösten Adressen, auf die verbunden werden darf. */
  addresses?: string[];
}

const ERLAUBTE_SCHEMATA = new Set(["http:", "https:"]);

/**
 * Nur die Ports, hinter denen im Web etwas steht. Alles andere ist
 * entweder ein Dienst, der nichts mit Stellenanzeigen zu tun hat, oder
 * ein Versuch, einen internen Dienst zu erreichen.
 */
const ERLAUBTE_PORTS = new Set(["", "80", "443", "8080", "8443"]);

/** IPv4 in Punktnotation zu einer Zahl. */
function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out;
}

/**
 * Adressbereiche, die nie das offene Internet sind.
 *
 * Der wichtigste Eintrag ist 169.254.0.0/16: dort liegt bei AWS, GCP
 * und Azure der Metadatendienst, und der gibt ohne jede
 * Authentisierung Zugangsdaten heraus.
 */
const PRIVATE_V4: [number, number][] = [
  [ipv4ToLong("0.0.0.0")!, ipv4ToLong("0.255.255.255")!],
  [ipv4ToLong("10.0.0.0")!, ipv4ToLong("10.255.255.255")!],
  [ipv4ToLong("100.64.0.0")!, ipv4ToLong("100.127.255.255")!],
  [ipv4ToLong("127.0.0.0")!, ipv4ToLong("127.255.255.255")!],
  [ipv4ToLong("169.254.0.0")!, ipv4ToLong("169.254.255.255")!],
  [ipv4ToLong("172.16.0.0")!, ipv4ToLong("172.31.255.255")!],
  [ipv4ToLong("192.0.0.0")!, ipv4ToLong("192.0.0.255")!],
  [ipv4ToLong("192.0.2.0")!, ipv4ToLong("192.0.2.255")!],
  [ipv4ToLong("192.168.0.0")!, ipv4ToLong("192.168.255.255")!],
  [ipv4ToLong("198.18.0.0")!, ipv4ToLong("198.19.255.255")!],
  [ipv4ToLong("224.0.0.0")!, ipv4ToLong("255.255.255.255")!],
];

export function isPrivateAddress(address: string): boolean {
  const adresse = address.trim().toLowerCase().replace(/^\[|\]$/g, "");

  // IPv6-eingebettetes IPv4: ::ffff:127.0.0.1 ist 127.0.0.1.
  const eingebettet = adresse.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (eingebettet) return isPrivateAddress(eingebettet[1]!);

  const v4 = ipv4ToLong(adresse);
  if (v4 !== null) return PRIVATE_V4.some(([von, bis]) => v4 >= von && v4 <= bis);

  if (adresse.includes(":")) {
    if (adresse === "::" || adresse === "::1") return true;
    // fc00::/7 eindeutig lokal, fe80::/10 link-local.
    if (/^f[cd][0-9a-f]{2}:/.test(adresse)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(adresse)) return true;
    return false;
  }

  return false;
}

/** Was sich ohne Namensauflösung sagen lässt. */
export function inspectUrl(raw: string): UrlVerdict {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return {
      ok: false,
      reason: "invalid_url",
      message: "Das sieht nicht nach einer vollständigen Adresse aus. Sie muss mit http:// oder https:// beginnen.",
    };
  }

  if (!ERLAUBTE_SCHEMATA.has(url.protocol)) {
    return {
      ok: false,
      reason: "scheme_not_allowed",
      // file: und gopher: sind die üblichen Wege, aus einem Abruf ein
      // Lesen im Dateisystem zu machen.
      message: `Adressen mit „${url.protocol}“ werden nicht abgerufen. Möglich sind http und https.`,
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      reason: "credentials_in_url",
      message: "Die Adresse enthält Zugangsdaten. Solche Adressen werden nicht abgerufen.",
    };
  }

  if (!ERLAUBTE_PORTS.has(url.port)) {
    return {
      ok: false,
      reason: "port_not_allowed",
      message: `Port ${url.port} wird nicht abgerufen. Möglich sind 80, 443, 8080 und 8443.`,
    };
  }

  // Steht dort schon eine IP, muss sie hier durch — sonst käme sie
  // ohne Auflösung nie zur zweiten Prüfung.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isPrivateAddress(host)) {
      return {
        ok: false,
        reason: "private_address",
        message: "Diese Adresse zeigt in ein privates Netz. Sie wird nicht abgerufen.",
      };
    }
  }

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return {
      ok: false,
      reason: "private_address",
      message: "Diese Adresse zeigt auf den Server selbst. Sie wird nicht abgerufen.",
    };
  }

  return { ok: true, url };
}

/**
 * Die vollständige Prüfung, inklusive Namensauflösung.
 *
 * Gibt die aufgelösten Adressen zurück. Der Aufrufer muss genau eine
 * davon verbinden — löst er den Namen erneut auf, war die Prüfung
 * umsonst.
 */
export async function verifyUrl(
  raw: string,
  lookup: (host: string) => Promise<string[]>,
): Promise<UrlVerdict> {
  const erste = inspectUrl(raw);
  if (!erste.ok) return erste;

  const host = erste.url!.hostname.replace(/^\[|\]$/g, "");

  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    return { ...erste, addresses: [host] };
  }

  let adressen: string[];
  try {
    adressen = await lookup(host);
  } catch {
    return {
      ok: false,
      reason: "hostname_not_resolvable",
      message: `„${host}“ ist nicht auflösbar.`,
    };
  }

  if (adressen.length === 0) {
    return {
      ok: false,
      reason: "hostname_not_resolvable",
      message: `„${host}“ ist nicht auflösbar.`,
    };
  }

  // EINE private Adresse reicht. Ein Name, der auf 93.184.216.34 und
  // 127.0.0.1 zeigt, ist genau der Rebinding-Angriff.
  if (adressen.some(isPrivateAddress)) {
    return {
      ok: false,
      reason: "private_address",
      message: "Dieser Name zeigt in ein privates Netz. Die Adresse wird nicht abgerufen.",
    };
  }

  return { ...erste, addresses: adressen };
}
