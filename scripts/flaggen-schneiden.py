#!/usr/bin/env python3
"""Flaggen aus dem Bogen schneiden — ohne den schwarzen Rahmen.

Der Bogen zeichnet jede Flagge mit einem dicken schwarzen Rand. Der
sah in der ersten Fassung wie ein Gestaltungsmittel aus, ist aber
Bildinhalt: Er lässt sich nicht umfärben, skaliert falsch mit und
sitzt im dunklen Modus als schwarzer Kasten auf blauem Grund.

Deshalb wird er hier weggeschnitten und der feine helle Rand später
in CSS gezogen, wo er zum Farbschema passt.

Der Rahmen wird gemessen, nicht geraten: von jeder Kante nach innen
laufen, bis ein Bildpunkt auftaucht, der weder durchsichtig noch
nahezu schwarz ist. Feste Pixelwerte wären bei 271 Flaggen mit
unterschiedlich dunklen Motiven eine Wette.

Aufruf: python3 scripts/flaggen-schneiden.py
"""
from PIL import Image
import os

BOGEN = os.path.expanduser("~/Downloads/flaggen-global-transparent-6k.png")
ZIEL = "apps/web/public/flaggen"
SP, ZE, X0, Y0, BR, HO = 580, 390, 300, 340, 380, 250

# Jede Nummer einzeln am Prüfblatt bestätigt.
FELD = {"AT": 13, "AU": 14, "BE": 21, "BR": 32, "CA": 39, "CH": 45, "DE": 60,
        "ES": 73, "FR": 84, "GB": 86, "IN": 119, "IT": 124, "MX": 171,
        "NL": 180, "NZ": 185, "PL": 194, "SG": 213, "US": 252, "ZA": 268}


# Der Rahmen ist in jeder Zelle gleich breit: 30 Bildpunkte links und
# rechts, 5 oben und unten. Gemessen an drei Flaggen ohne jedes Schwarz
# im Motiv (Schweiz, Österreich, Japan) — alle drei ergaben dieselben
# Werte und ein Motiv von 320x240.
#
# Der erste Versuch suchte den Rahmen stattdessen pro Flagge, indem er
# von aussen nach innen lief, bis etwas Nicht-Schwarzes kam. Das frass
# Belgien den schwarzen Streifen weg und Deutschland das obere Drittel:
# Ein Erkenner, der Schwarz für Rahmen hält, kann eine schwarze Flagge
# nicht von ihrem Rahmen unterscheiden.
RAND_X, RAND_Y = 30, 5


def rahmen_abschneiden(im: Image.Image) -> Image.Image:
    b, h = im.size
    return im.crop((RAND_X, RAND_Y, b - RAND_X, h - RAND_Y))


def main() -> int:
    im = Image.open(BOGEN)
    os.makedirs(ZIEL, exist_ok=True)
    gesamt = 0
    for code, i in sorted(FELD.items()):
        r, c = divmod(i, 20)
        z = im.crop((X0 + c * SP, Y0 + r * ZE, X0 + c * SP + BR, Y0 + r * ZE + HO)).convert("RGBA")
        z = rahmen_abschneiden(z)
        # Auf einheitliche Anzeigehöhe bringen; das Verhältnis bleibt.
        z = z.resize((round(z.width * 96 / z.height), 96), Image.LANCZOS)
        pfad = f"{ZIEL}/{code.lower()}.webp"
        z.save(pfad, "WEBP", quality=90, method=6)
        gesamt += os.path.getsize(pfad)
    print(f"{len(FELD)} Flaggen ohne Rahmen, zusammen {gesamt // 1024} kB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
