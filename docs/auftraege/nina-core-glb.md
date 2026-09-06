# Auftrag: Nina Core aus dem echten GLB — nach dem Velvova-Umbau

Erteilt am 4.9.2026. Ausdrücklich **nach** dem Umbau umzusetzen.

Heute steht dort eine kleine statische violette Kugel. Die GLB-Datei
ist vollständig und enthält drei Clips: `CALM`, `Talking`, `Thinking`.
GLB **nicht** ersetzen, keine CSS-Kugel bauen.

## Zustände und Clips
| Zustand | Clip | Auslöser aus dem echten Ablauf |
|---|---|---|
| idle | CALM (Dauerschleife) | Nutzer tippt, sonst nichts |
| listening | CALM + zarter Puls | Spracheingabe aktiv |
| thinking | Thinking | Antwort wird erzeugt |
| speaking | Talking | TTS-Audio läuft |

Übergänge als Crossfade, rund 0,5 s. Zustand **nicht** über Timer
bestimmen, sondern über die tatsächlichen Ereignisse.

## Darstellung reparieren
Kameraposition, Modellskalierung, Bounding Box, Clipping, Licht,
Materialien, Transparenz, Render-Reihenfolge, Tone Mapping, Alpha
Blending, GLB-Texturen prüfen. Automatisch über die Bounding Box
zentrieren und auf 75–85 % des Containers skalieren, ohne äussere
Effekte abzuschneiden. Geometrie und Animation unverändert lassen.

## Farbe — folgt dem Thema, nicht dem Nutzer

Geändert am 4.9.2026: **keine** manuelle Farbwahl. Die Farbe ergibt sich
aus dem Thema der Anwendung.

| Thema | Grundton |
|---|---|
| Hell | `#FF7A00`, warmes Orange |
| Dunkel | `#2563FF`, kräftiges Elektroblau |

Den vorhandenen Themenzustand der Anwendung benutzen — **keine** zweite
Hell/Dunkel-Erkennung daneben bauen. Der Core muss beim Umschalten
sofort reagieren, ohne Neuladen, und der Wechsel zwischen Orange und
Blau soll weich verlaufen, rund 300–500 ms.

**Kein** CSS-Filter über das Canvas. Die betroffenen Three.js-Materialien
tönen und dabei Geometrie, alle drei Clips, Transparenz, Verläufe, Glow,
innere Details und Texturen erhalten.

Vor dem Ändern **alle Materialnamen des GLB protokollieren** und
zuordnen, welches Material wofür steht: Hauptfarbe, innerer Glow,
äusserer Glow, Spirale, innere Kugel, Linien und Effekte. Nicht blind
alles einfärben. Die unterschiedlichen Helligkeiten der Schichten
müssen erhalten bleiben, sonst geht die räumliche Tiefe verloren.

**Das Thema bestimmt die Farbe, der Zustand nur Intensität und
Animation.** Hell bleibt immer orange, Dunkel immer blau — Thinking wird
nicht violett, Talking nicht grün.

| Zustand | Wirkung, in beiden Themen gleich aufgebaut |
|---|---|
| idle / CALM | Grundton, weicher Schein |
| listening | Grundton, zarter Puls |
| thinking | Grundton, etwas heller, mehr innere Bewegung |
| speaking | Grundton, stärkster Schein, zarte Tonreaktion |

## Tonreaktion
Beim Sprechen an das echte Audio koppeln (Web Audio `AnalyserNode`),
geglättete Amplitude auf Skalierung und Leuchtkraft. Bereich 1,00 bis
höchstens 1,04 — kein Hüpfen. Talking-Clip und Amplitude laufen
gleichzeitig. Beim Zuhören, falls verfügbar, Mikrofonpegel sehr
zurückhaltend nutzen; muss sich sichtbar von idle unterscheiden, darf
aber nicht wie Sprechen aussehen.

## Technik
Eine wiederverwendbare Komponente, `state` / `color` / `audioElement` /
`size` (small, medium, large). Three.js-Ressourcen beim Unmount
freigeben, keine doppelten Render-Schleifen, ausserhalb des Sichtfelds
drosseln, `prefers-reduced-motion` respektieren (Animation stark
reduzieren, Tonreaktion aus).

## Einbau
Auf der Nina-Seite deutlich grösser als heute. Desktop rund 80–110 px
an Ninas Namensbereich, im Sprachmodus deutlich grösser und mittig, im
Textchat kleiner. Keine KI-Dashboard-Optik.

## Entwicklerhilfe
Vorübergehende, nur intern sichtbare Umschaltung für CALM / Thinking /
Talking und alle Farben. Clipnamen einmal protokollieren, um zu prüfen,
dass die drei Clips erkannt werden.

## Abnahme
1. CALM läuft in Schleife. 2. Thinking beim Erzeugen. 3. Talking bei
TTS-Beginn. 4. Rückkehr zu CALM am Audioende. 5. Weiche Übergänge.
6. Farbe wählbar. 7. Farbe bleibt erhalten. 8. Talking reagiert auf
echtes Audio. 9. Modell zentriert und skaliert. 10. Keine kleine
statische Kugel mehr. 11. Keine Konsolenfehler. 12. Keine Lecks oder
doppelten Render-Schleifen.
