import { describe, expect, it } from "vitest";
import {
  MAX_WARTEZEIT_MS,
  MIN_WARTEZEIT_MS,
  STANDARD_WARTEZEIT_MS,
  Taktgeber,
  adressePruefen,
  darfAbrufen,
  robotsLesen,
  wartezeitMs,
} from "./abrufregeln.ts";

describe("Adressen, die nach innen zeigen", () => {
  it("verweigert die Cloud-Zugangsdaten von AWS", () => {
    /*
     * Der Fall, für den diese Prüfung existiert: `website` in
     * `companies` ist ein Textfeld. Steht dort diese Adresse, ruft der
     * Server die Zugangsdaten seiner eigenen Cloud ab und legt sie in
     * eine Datenbankzeile — ohne dass irgendwo ein Fehler entsteht.
     */
    const u = adressePruefen("http://169.254.169.254/latest/meta-data/iam/");
    expect(u.erlaubt).toBe(false);
    expect(u.grund).toBe("zeigt_nach_innen");
  });

  it("verweigert die Zugangsdaten von Google", () => {
    expect(adressePruefen("http://metadata.google.internal/computeMetadata/v1/").erlaubt).toBe(false);
  });

  it("verweigert die eigene Maschine in jeder Schreibweise", () => {
    for (const a of [
      "http://localhost:3000/",
      "http://127.0.0.1/",
      "http://127.9.9.9/",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
      /*
       * Dieselbe Adresse, wie `new URL()` sie hinterlässt. Die
       * Normalisierung zu Hex passiert still, und wer nur die
       * gepunktete Form prüft, lässt genau die durch, die ankommt.
       */
      "http://[::ffff:7f00:1]/",
      "http://etwas.localhost/",
    ]) {
      expect(adressePruefen(a).erlaubt, a).toBe(false);
    }
  });

  it("verweigert private Netze", () => {
    for (const a of [
      "http://10.0.0.5/", "http://192.168.1.1/", "http://172.16.0.1/",
      "http://172.31.255.254/", "http://[fc00::1]/", "http://[fe80::1]/",
      "http://intranet.internal/", "http://drucker.local/",
    ]) {
      expect(adressePruefen(a).erlaubt, a).toBe(false);
    }
  });

  it("lässt öffentliche Adressen durch, die in der Nähe der Sperren liegen", () => {
    /* 172.15 und 172.32 sind öffentlich — nur 172.16–31 ist privat. */
    for (const a of ["http://172.15.0.1/", "http://172.32.0.1/", "http://11.0.0.1/", "https://landkreis.de/"]) {
      expect(adressePruefen(a).erlaubt, a).toBe(true);
    }
  });

  it("verweigert alles, was keine Webseite holt", () => {
    expect(adressePruefen("file:///etc/passwd").erlaubt).toBe(false);
    expect(adressePruefen("gopher://alt.example/").erlaubt).toBe(false);
    expect(adressePruefen("javascript:alert(1)").erlaubt).toBe(false);
    expect(adressePruefen("nicht mal eine url").erlaubt).toBe(false);
  });

  it("entfernt Zugangsdaten aus der Adresse", () => {
    /*
     * `https://nutzer:passwort@firma.de` landet sonst in jedem
     * Protokoll, das die aufgerufene Adresse vermerkt.
     */
    const u = adressePruefen("https://nutzer:geheim@firma.example/karriere");
    expect(u.erlaubt).toBe(true);
    expect(u.adresse).not.toContain("geheim");
    expect(u.adresse).not.toContain("nutzer");
  });

  it("entfernt den Anker, der beim Server nie ankommt", () => {
    expect(adressePruefen("https://firma.example/karriere#stellen").adresse)
      .toBe("https://firma.example/karriere");
  });
});

describe("robots.txt lesen", () => {
  it("nimmt die Gruppe mit unserem Namen, nicht die allgemeine", () => {
    /*
     * Wer für uns eine eigene Gruppe geschrieben hat, hat damit
     * gesagt, dass die allgemeine für uns nicht gilt.
     */
    const r = robotsLesen(
      ["User-agent: *", "Disallow: /", "", "User-agent: VelvovaBot", "Disallow: /intern"].join("\n"),
      "VelvovaBot/1.0",
    );
    expect(r.verboten).toEqual(["/intern"]);
    expect(darfAbrufen("/karriere", r)).toBe(true);
  });

  it("nimmt die allgemeine Gruppe, wenn es keine eigene gibt", () => {
    const r = robotsLesen("User-agent: *\nDisallow: /suche", "VelvovaBot/1.0");
    expect(darfAbrufen("/suche/x", r)).toBe(false);
    expect(darfAbrufen("/karriere", r)).toBe(true);
  });

  it("liest ein leeres Disallow als Erlaubnis, nicht als Verbot", () => {
    /*
     * Die Umkehrung dieser Aussage ist der Grund, warum ein falsch
     * geschriebener Leser plötzlich gar nichts mehr abruft.
     */
    const r = robotsLesen("User-agent: *\nDisallow:", "VelvovaBot");
    expect(r.verboten).toEqual([]);
    expect(darfAbrufen("/", r)).toBe(true);
  });

  it("versteht Disallow: / als vollständiges Verbot", () => {
    const r = robotsLesen("User-agent: *\nDisallow: /", "VelvovaBot");
    expect(darfAbrufen("/karriere", r)).toBe(false);
  });

  it("lässt Allow ein Verbot schlagen, wenn es genauer ist", () => {
    const r = robotsLesen(
      "User-agent: *\nDisallow: /\nAllow: /karriere/", "VelvovaBot",
    );
    expect(darfAbrufen("/karriere/stellen", r)).toBe(true);
    expect(darfAbrufen("/intern", r)).toBe(false);
  });

  it("fasst mehrere User-agent-Zeilen zu einer Gruppe zusammen", () => {
    const r = robotsLesen(
      ["User-agent: Googlebot", "User-agent: VelvovaBot", "Disallow: /nur-fuer-uns"].join("\n"),
      "VelvovaBot",
    );
    expect(r.verboten).toEqual(["/nur-fuer-uns"]);
  });

  it("ignoriert Kommentare und leere Zeilen", () => {
    const r = robotsLesen(
      ["# Kommentar", "User-agent: *   # auch hier", "", "Disallow: /x  # und hier"].join("\n"),
      "VelvovaBot",
    );
    expect(r.verboten).toEqual(["/x"]);
  });

  it("erlaubt alles, wenn die Datei leer oder unlesbar ist", () => {
    expect(darfAbrufen("/karriere", robotsLesen("", "VelvovaBot"))).toBe(true);
    expect(darfAbrufen("/karriere", robotsLesen("<html>404</html>", "VelvovaBot"))).toBe(true);
  });
});

describe("Wie oft wir fragen", () => {
  it("wartet ohne Angabe die Standardzeit", () => {
    expect(wartezeitMs(robotsLesen("", "V"))).toBe(STANDARD_WARTEZEIT_MS);
  });

  it("übernimmt eine angegebene Wartezeit", () => {
    expect(wartezeitMs(robotsLesen("User-agent: *\nCrawl-delay: 5", "V"))).toBe(5000);
  });

  it("wird nie schneller als die eigene Untergrenze, auch wenn es erlaubt wäre", () => {
    /* Wir haben es nicht eilig. Ein fremder Server hat auch nichts davon. */
    expect(wartezeitMs(robotsLesen("User-agent: *\nCrawl-delay: 0", "V"))).toBe(MIN_WARTEZEIT_MS);
  });

  it("wird nicht beliebig langsam — sonst blockiert eine Seite den Lauf", () => {
    expect(wartezeitMs(robotsLesen("User-agent: *\nCrawl-delay: 600", "V"))).toBe(MAX_WARTEZEIT_MS);
  });
});

describe("Der Taktgeber", () => {
  it("lässt den ersten Abruf sofort zu", () => {
    expect(new Taktgeber(() => 1000).wartetNoch("firma.example", 2000)).toBe(0);
  });

  it("hält den zweiten Abruf an denselben Server zurück", () => {
    let uhr = 1000;
    const t = new Taktgeber(() => uhr);
    t.vermerkeAbruf("firma.example");
    uhr = 1500;
    expect(t.wartetNoch("firma.example", 2000)).toBe(1500);
  });

  it("lässt einen anderen Server sofort durch", () => {
    let uhr = 1000;
    const t = new Taktgeber(() => uhr);
    t.vermerkeAbruf("firma.example");
    uhr = 1100;
    expect(t.wartetNoch("landkreis.example", 2000)).toBe(0);
  });

  it("gibt nach Ablauf der Wartezeit wieder frei", () => {
    let uhr = 1000;
    const t = new Taktgeber(() => uhr);
    t.vermerkeAbruf("firma.example");
    uhr = 3500;
    expect(t.wartetNoch("firma.example", 2000)).toBe(0);
  });
});
