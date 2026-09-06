import { describe, expect, it } from "vitest";
import { profilbildAdresse, profilbildKennung } from "./profilbild-kennung";

describe("profilbildKennung", () => {
  it("gibt ohne Bild nichts zurück", () => {
    expect(profilbildKennung(null)).toBeNull();
    expect(profilbildKennung(undefined)).toBeNull();
    expect(profilbildKennung("")).toBeNull();
  });

  it("liefert für dasselbe Bild dieselbe Kennung", () => {
    expect(profilbildKennung("a/b/c.jpg")).toBe(profilbildKennung("a/b/c.jpg"));
  });

  it("liefert für ein anderes Bild eine andere — sonst bliebe das alte stehen", () => {
    expect(profilbildKennung("a/b/c.jpg")).not.toBe(profilbildKennung("a/b/d.jpg"));
  });

  it("verrät den Speicherpfad nicht", () => {
    const k = profilbildKennung("profilbilder/geheim/abc123.jpg")!;
    expect(k).not.toContain("geheim");
    expect(k).not.toContain("abc123");
    expect(k).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("profilbildAdresse", () => {
  it("hängt die Kennung an — daran hing der ganze Fehler", () => {
    expect(profilbildAdresse("abcdef1234567890")).toBe("/app/profilbild?v=abcdef1234567890");
  });

  it("gibt ohne Kennung keine Adresse", () => {
    expect(profilbildAdresse(null)).toBeNull();
  });
});
