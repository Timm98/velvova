# Monday-Core — Detailtiefe und Markenobjekt

Erteilt am 5.9.2026. Baut auf `docs/auftraege/nina-core-glb.md` auf; die
GLB-Datei bleibt Grundlage, Form und Position bleiben erhalten.

**Befund:** Der Core wirkt besonders im hellen Modus blass, flach und
stellenweise wie zufällige blaue Linien.

## 1 Innerer Kern
Klar umrissenes, kompaktes Zentrum aus mehreren halbtransparenten
Schichten mit sichtbarer Tiefe. In der Mitte ein ruhig pulsierendes,
konzentriertes Licht. **Kein Auge, kein Roboter** — eine abstrakte,
lebendige Intelligenz.

## 2 Mittlere Struktur
Drei bis fünf unterschiedlich grosse, unabhängig rotierende Ringe —
nicht geschlossen, nicht symmetrisch. Verschiedene Linienstärken,
Transparenzen und Tiefenebenen. Einzelne Segmente durch feine
Licht- und Datenbahnen verbunden. Bewegung langsam und kontrolliert.

## 3 Äussere Ebene
Zufällige, pinselartige Aussenlinien reduzieren. Stattdessen gezielte
Umlaufbahnen und feine Partikelströme: einige Partikel fliessen von
aussen zum Zentrum, andere umkreisen den Core ruhig. Die Silhouette
bleibt trotz Detailtiefe sauber und wiedererkennbar.

## 4 Räumliche Tiefe
Vorder-, Mittel- und Hintergrundebene. Teile verlaufen vor und hinter
dem Zentrum. Dezente Unschärfe nur weit hinten. Keine flache
2D-Liniengrafik.

## 5 Zustände
| Zustand | Verhalten |
|---|---|
| Idle | langsames Atmen, ruhige Ringrotation |
| Listening | äussere Bahnen reagieren sanft auf die Stimme |
| Thinking | Partikel schneller zum Zentrum, Ringe richten sich kurz aus |
| Speaking | Lichtimpulse vom Kern nach aussen |
| Match gefunden | kurzer kontrollierter Impuls mit leichtem Ausbau |

Nie hektisch, nie spielerisch.

## 6 Dunkler Modus
Tiefes, klares Blau mit einzelnen hellen Cyan-Akzenten. Kern und innere
Details deutlich sichtbar. Bloom kontrolliert, keine überstrahlenden
Neonflächen.

## 7 Heller Modus
**Nicht dieselben Materialien transparenter.** Kräftigeres Royalblau,
dunklere Konturlinien, mehr Kontrast, Deckkraft und Schatten. Glow
reduzieren; stattdessen Materialkontrast, Schatten und verschiedene
Blautöne. Auf Weiss klar, detailliert und räumlich.

## 8 Interaktion
Sehr leichte Reaktion auf die Maus — höchstens wenige Grad Neigung. Bei
Hover einzelne Bahnen hervorheben. Flüssig, ohne die Ladezeit
nennenswert zu erhöhen.

## 9 Technik
Vorhandene GLB als Grundlage. Geometrie und Materialien für WebGL
optimieren. Instancing für Partikel. Performante Animation. Mobile
berücksichtigen, für schwächere Geräte eine reduzierte Qualitätsstufe.
`prefers-reduced-motion` respektieren.

**Zielbild:** deutlich detailreicher und hochwertiger, aber weiterhin
ruhig, minimalistisch und markentauglich. Keine Science-Fiction-Kugel,
kein Roboterauge, keine Galaxie, keine chaotischen Neonlinien.
