import { describe, expect, it } from "vitest";
import { inspectUrl, isPrivateAddress, verifyUrl } from "./url-safety.ts";

/**
 * Der Server holt eine Adresse, die ein Nutzer eingegeben hat. Das ist
 * die klassische SSRF-Lücke, und die Beispiele hier sind keine
 * Gedankenspiele — 169.254.169.254 gibt bei mehreren Hostern ohne jede
 * Authentisierung die Zugangsdaten der Maschine heraus.
 */

describe("Private Adressen", () => {
  it("erkennt die üblichen Bereiche", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "0.0.0.0",
      "100.64.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("erkennt den Metadatendienst der Cloud-Anbieter", () => {
    // Der teuerste Einzelfall: von dort kommen bei AWS, GCP und Azure
    // Zugangsdaten, ohne dass irgendetwas nachfragt.
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
  });

  it("lässt sich nicht durch IPv6-Einbettung täuschen", () => {
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("[::ffff:169.254.169.254]")).toBe(true);
  });

  it("lässt öffentliche Adressen durch", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });

  it("hält 172.32.x für öffentlich", () => {
    // Der private Bereich endet bei 172.31. Ein zu weit gefasster
    // Filter sperrt echte Anzeigen aus.
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
    expect(isPrivateAddress("172.15.0.1")).toBe(false);
  });
});

describe("Erste Prüfung", () => {
  it("nimmt eine gewöhnliche Stellenadresse an", () => {
    expect(inspectUrl("https://boards.greenhouse.io/example/jobs/123").ok).toBe(true);
  });

  it("lehnt file: ab", () => {
    const v = inspectUrl("file:///etc/passwd");
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("scheme_not_allowed");
  });

  it("lehnt Zugangsdaten in der Adresse ab", () => {
    expect(inspectUrl("https://user:pass@example.invalid/job").reason).toBe("credentials_in_url");
  });

  it("lehnt ungewöhnliche Ports ab", () => {
    expect(inspectUrl("http://example.invalid:5432/").reason).toBe("port_not_allowed");
    expect(inspectUrl("http://example.invalid:6379/").reason).toBe("port_not_allowed");
  });

  it("lehnt localhost und den Server selbst ab", () => {
    expect(inspectUrl("http://localhost:8080/").reason).toBe("private_address");
    expect(inspectUrl("http://127.0.0.1/").reason).toBe("private_address");
    expect(inspectUrl("http://foo.internal/").reason).toBe("private_address");
  });

  it("lehnt Bruchstücke ab, statt sie zu raten", () => {
    expect(inspectUrl("beispiel.de/job").reason).toBe("invalid_url");
    expect(inspectUrl("").reason).toBe("invalid_url");
  });
});

describe("Vollständige Prüfung mit Namensauflösung", () => {
  it("lässt einen Namen mit öffentlicher Adresse durch", async () => {
    const v = await verifyUrl("https://example.invalid/job", async () => ["93.184.216.34"]);
    expect(v.ok).toBe(true);
    expect(v.addresses).toEqual(["93.184.216.34"]);
  });

  it("blockt einen Namen, der auf eine private Adresse zeigt", async () => {
    const v = await verifyUrl("https://boese.invalid/job", async () => ["127.0.0.1"]);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("private_address");
  });

  it("blockt schon bei einer einzigen privaten Adresse", async () => {
    // Genau der Rebinding-Angriff: ein Name, der auf beides zeigt.
    // Würde nur die erste Adresse geprüft, ginge er durch.
    const v = await verifyUrl("https://boese.invalid/job", async () => [
      "93.184.216.34",
      "127.0.0.1",
    ]);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("private_address");
  });

  it("gibt die geprüften Adressen zurück, damit erneutes Auflösen entfällt", async () => {
    // Löst der Aufrufer den Namen noch einmal auf, war die Prüfung
    // umsonst — zwischen Prüfung und Abruf kann sich die Antwort
    // geändert haben.
    const v = await verifyUrl("https://example.invalid/job", async () => [
      "93.184.216.34",
      "93.184.216.35",
    ]);
    expect(v.addresses).toHaveLength(2);
  });

  it("meldet einen nicht auflösbaren Namen als solchen", async () => {
    const v = await verifyUrl("https://gibtsnicht.invalid/", async () => {
      throw new Error("ENOTFOUND");
    });
    expect(v.reason).toBe("hostname_not_resolvable");
  });
});
