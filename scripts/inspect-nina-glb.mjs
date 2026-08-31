#!/usr/bin/env node
/**
 * Was steckt wirklich in nina.glb?
 *
 * Die Clipnamen in `useNinaAnimation.ts` sind keine Vermutung. Sie
 * kommen aus dieser Prüfung — und wenn jemand die Datei austauscht,
 * sagt sie sofort, ob die Zuordnung noch stimmt.
 *
 * Bewusst OHNE three.js: der GLB-Container ist ein kleines,
 * dokumentiertes Binärformat (12-Byte-Kopf, dann Blöcke aus Länge, Typ,
 * Daten). Der erste Block ist das JSON. Es zu lesen kostet zwei Dutzend
 * Zeilen und braucht weder WebGL noch ein DOM — die Prüfung läuft damit
 * auch dort, wo kein Browser ist.
 *
 *   node scripts/inspect-nina-glb.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HIER = dirname(fileURLToPath(import.meta.url));
const DATEI = join(HIER, "..", "apps", "web", "public", "models", "nina.glb");

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

function lies(pfad) {
  const puffer = readFileSync(pfad);
  const sicht = new DataView(puffer.buffer, puffer.byteOffset, puffer.byteLength);

  if (sicht.getUint32(0, true) !== MAGIC) {
    throw new Error("Das ist keine GLB-Datei: die Kennung am Anfang fehlt.");
  }
  const version = sicht.getUint32(4, true);

  // Blöcke ab Byte 12: [Länge][Typ][Daten]. Der JSON-Block muss laut
  // Spezifikation der erste sein, aber wir suchen ihn trotzdem — eine
  // Datei aus einem exotischen Exporter soll nicht stumm scheitern.
  let versatz = 12;
  while (versatz < sicht.byteLength) {
    const länge = sicht.getUint32(versatz, true);
    const typ = sicht.getUint32(versatz + 4, true);
    if (typ === JSON_CHUNK) {
      const roh = new TextDecoder().decode(
        new Uint8Array(puffer.buffer, puffer.byteOffset + versatz + 8, länge),
      );
      return { version, größe: puffer.byteLength, gltf: JSON.parse(roh) };
    }
    versatz += 8 + länge;
  }
  throw new Error("Kein JSON-Block in der Datei gefunden.");
}

const { version, größe, gltf } = lies(DATEI);

console.log(`nina.glb — glTF ${version}, ${(größe / 1_048_576).toFixed(1)} MB\n`);

const clips = gltf.animations ?? [];
console.log(`Animationen (${clips.length}):`);
for (const clip of clips) {
  console.log(`  ${(clip.name ?? "(namenlos)").padEnd(16)} ${clip.channels?.length ?? 0} Kanäle`);
}
if (clips.length === 0) {
  console.log("  keine — die Zustandszuordnung läuft dann ins Leere.");
}

console.log(`\nMeshes: ${(gltf.meshes ?? []).length}`);
console.log(`Materialien: ${(gltf.materials ?? []).length}`);
console.log(`Texturen: ${(gltf.textures ?? []).length}`);
console.log(`Knoten: ${(gltf.nodes ?? []).length}`);

/*
 * Erweiterungen sind der eigentliche Grund für dieses Skript.
 *
 * Steht hier KHR_draco_mesh_compression oder KHR_texture_basisu, dann
 * braucht der Loader einen zusätzlichen Dekoder — und der bringt
 * WebAssembly mit, das unsere CSP nicht erlaubt. Ist die Liste leer,
 * genügt der nackte GLTFLoader, und genau darauf ist NinaScene gebaut.
 */
const erweiterungen = gltf.extensionsUsed ?? [];
console.log(
  `\nErweiterungen: ${erweiterungen.length > 0 ? erweiterungen.join(", ") : "keine (nackter GLTFLoader genügt)"}`,
);

const dekoderNötig = erweiterungen.filter(
  (e) => e.includes("draco") || e.includes("basisu") || e.includes("meshopt"),
);
if (dekoderNötig.length > 0) {
  console.log(
    `\n!  Diese Erweiterungen brauchen einen Dekoder: ${dekoderNötig.join(", ")}\n` +
      `   NinaScene lädt keinen. Entweder die Datei unkomprimiert exportieren\n` +
      `   oder den passenden Dekoder in NinaScene einhängen.`,
  );
  process.exitCode = 1;
}
