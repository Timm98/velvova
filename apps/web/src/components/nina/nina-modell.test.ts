import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLIP_FÜR_ZUSTAND } from "./useNinaAnimation";

/**
 * Das Modell und der Code müssen zusammenpassen.
 *
 * `useNinaAnimation.ts` ordnet Produktzustände Clipnamen zu — „CALM",
 * „Talking", „Thinking". Diese Namen stehen nirgends im Code außer
 * dort; ihre Quelle ist die Binärdatei. Tauscht jemand nina.glb gegen
 * einen Export mit anderer Benennung, passiert nichts Sichtbares: der
 * Loader findet den Clip nicht, `setzeZustand` kehrt still zurück, und
 * Monday steht für immer in der Haltung, in der der Exporter sie
 * abgelegt hat. Kein Fehler, keine Warnung, nur eine Figur, die sich
 * nicht mehr bewegt.
 *
 * Der zweite Punkt ist der teurere. NinaScene lädt bewusst KEINEN
 * Draco-, Basis- oder Meshopt-Dekoder: die bringen WebAssembly mit,
 * und unsere CSP erlaubt kein `unsafe-eval`. Genau daran ist die
 * Vorgängerfassung gescheitert. Kommt eine komprimierte Datei ins
 * Verzeichnis, wäre der Effekt wieder ein CSP-Verstoß in der Konsole
 * und eine leere Fläche auf dem Bildschirm — hier fällt es vorher auf.
 *
 * Gelesen wird der GLB-Container von Hand. Er ist klein und
 * dokumentiert: 12-Byte-Kopf, dann Blöcke aus Länge, Typ, Daten. Der
 * Umweg über three.js bräuchte ein DOM, das es im Test nicht gibt.
 */

/*
 * Geprüft wird die Datei, die NinaScene WIRKLICH lädt.
 *
 * Das ist `nina.glb` — die gepackte Fassung ist zurückgenommen,
 * siehe `NinaScene`.
 * Der Name steht hier bewusst doppelt — einmal in `NinaScene`, einmal
 * hier — und nicht als geteilte Konstante: Diese Prüfung soll
 * anschlagen, wenn jemand dort eine andere Datei einträgt. Eine
 * gemeinsame Konstante würde brav mitwandern und nichts mehr
 * bewachen.
 */
const DATEI = path.join(__dirname, "..", "..", "..", "public", "models", "nina.glb");

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

interface GltfJson {
  animations?: { name?: string }[];
  extensionsUsed?: string[];
}

function liesGltfJson(): GltfJson {
  const puffer = readFileSync(DATEI);
  const sicht = new DataView(puffer.buffer, puffer.byteOffset, puffer.byteLength);
  expect(sicht.getUint32(0, true), "nina.glb trägt keine GLB-Kennung").toBe(MAGIC);

  let versatz = 12;
  while (versatz < sicht.byteLength) {
    const länge = sicht.getUint32(versatz, true);
    if (sicht.getUint32(versatz + 4, true) === JSON_CHUNK) {
      return JSON.parse(
        new TextDecoder().decode(
          new Uint8Array(puffer.buffer, puffer.byteOffset + versatz + 8, länge),
        ),
      ) as GltfJson;
    }
    versatz += 8 + länge;
  }
  throw new Error("Kein JSON-Block in nina.glb.");
}

describe("nina.glb", () => {
  it("enthält jeden Clip, den der Code ansteuert", () => {
    const vorhanden = new Set((liesGltfJson().animations ?? []).map((a) => a.name));

    for (const [zustand, clip] of Object.entries(CLIP_FÜR_ZUSTAND)) {
      expect(
        vorhanden.has(clip),
        `Zustand "${zustand}" verweist auf den Clip "${clip}", den nina.glb nicht enthält. ` +
          `Vorhanden: ${[...vorhanden].join(", ")}`,
      ).toBe(true);
    }
  });

  it("braucht keinen Dekoder, den NinaScene nicht lädt", () => {
    const nötig = (liesGltfJson().extensionsUsed ?? []).filter((e) =>
      /draco|basisu|meshopt/i.test(e),
    );

    expect(
      nötig,
      `nina.glb ist komprimiert (${nötig.join(", ")}). NinaScene lädt keinen Dekoder, ` +
        `und ein Dekoder bräuchte WebAssembly, das die CSP nicht erlaubt. ` +
        `Die Datei unkomprimiert exportieren.`,
    ).toEqual([]);
  });
});

describe("NinaScene", () => {
  it("hängt an keiner React-Three-Bibliothek", () => {
    /*
     * @react-three/drei zog Dekoder für Draco, Basis, mediapipe und
     * rapier mit — 937 KB in einem Chunk und ein WASM-Verstoß gegen
     * die eigene CSP, für ein Modell, das nichts davon braucht.
     * Die Szene läuft auf nacktem three.js; das soll so bleiben.
     */
    const pkg = JSON.parse(
      readFileSync(path.join(__dirname, "..", "..", "..", "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

    const alle = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(alle.filter((n) => n.startsWith("@react-three/"))).toEqual([]);
  });
});
