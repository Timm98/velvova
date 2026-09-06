#!/usr/bin/env python3
"""Zahlungslogos aus den Rohbildern freistellen.

── Warum ein eigenes Skript ──────────────────────────────────

Die Rohbilder sind RGB ohne Alphakanal: das Logo klebt auf einer
Fläche. Unverändert eingebaut hätte jedes Logo einen schwarzen oder
blauen Kasten um sich — im hellen wie im dunklen Modus.

── Warum kein Schwellwert ────────────────────────────────────

Der naheliegende Weg wäre „alles unter Helligkeit X wird
durchsichtig". Das macht aus jeder weichen Kante eine graue Treppe,
weil Kantenpunkte eine Mischung aus Logo- und Hintergrundfarbe sind.

Richtig ist die Umkehrung der Mischung. Für einen bekannten
Hintergrund H und eine Logofarbe F gilt in jedem Bildpunkt

    C = a·F + (1−a)·H

Daraus lässt sich die Deckung a berechnen und die Farbe
zurückrechnen. Kanten bleiben dadurch farbig statt grau.

Auf reinem Schwarz (H = 0) vereinfacht sich das zu C = a·F: die
Helligkeit *ist* die Deckung, sobald man weiss, wie hell die
dunkelste volle Logofarbe ist. Bei PayPals Dunkelblau ist das 143.

── Warum zwei Fassungen ──────────────────────────────────────

AMEX und die Überweisung sind weisse Logos. Freigestellt sind sie auf
dunklem Grund richtig und auf hellem unsichtbar. Deshalb entsteht von
beiden zusätzlich eine dunkle Fassung; die Oberfläche wählt nach
Farbschema.

Aufruf: python3 scripts/zahlungslogos-freistellen.py
"""
from PIL import Image
import os
import sys

QUELLE = os.path.expanduser("~/Downloads/zahlungsquellenbilder")
ZIEL = "apps/web/public/zahlungsarten"

# Jede Zeile: Datei-Erkennung, Name, Hintergrund, Logofarbe (None = bunt),
# ob eine dunkle Zweitfassung gebraucht wird.
BILDER = [
    ("046ea9d7", "paypal",       (0, 0, 0),     None,            False),
    ("38bbc602", "amex",         (2, 106, 206), (255, 255, 255), True),
    ("ChatGPT",  "visa",         (0, 0, 0),     None,            False),
    ("a3ccae88", "ueberweisung", (0, 0, 0),     (255, 255, 255), True),
    ("f8cfe6bd", "mastercard",   (0, 0, 0),     None,            False),
]

# Maximalkanal der dunkelsten vollen Logofarbe über alle Bilder
# (PayPals Dunkelblau, rgb(0, 46, 143)). Darunter beginnt Kante.
SCHWELLE = 143


def frei_von_schwarz(im: Image.Image) -> Image.Image:
    """C = a·F auf schwarzem Grund umkehren."""
    im = im.convert("RGB")
    aus = Image.new("RGBA", im.size)
    q, z = im.load(), aus.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = q[x, y]
            m = max(r, g, b)
            if m <= 3:
                z[x, y] = (0, 0, 0, 0)
                continue
            a = min(255, round(m * 255 / SCHWELLE))
            s = 255 / m  # auf volle Helligkeit zurückrechnen
            z[x, y] = (min(255, round(r * s)), min(255, round(g * s)),
                       min(255, round(b * s)), a)
    return aus


def frei_von_flaeche(im: Image.Image, grund, farbe) -> Image.Image:
    """C = a·F + (1−a)·H bei bekanntem Grund und bekannter Logofarbe.

    Gerechnet wird über den Kanal mit dem grössten Abstand zwischen
    beiden — dort ist das Verhältnis am wenigsten rauschanfällig.
    """
    im = im.convert("RGB")
    kanal = max(range(3), key=lambda i: abs(farbe[i] - grund[i]))
    spanne = farbe[kanal] - grund[kanal]
    aus = Image.new("RGBA", im.size)
    q, z = im.load(), aus.load()
    for y in range(im.height):
        for x in range(im.width):
            wert = q[x, y][kanal]
            a = (wert - grund[kanal]) / spanne
            a = max(0.0, min(1.0, a))
            z[x, y] = (*farbe, round(a * 255))
    return aus


def dunkle_fassung(im: Image.Image) -> Image.Image:
    """Dieselbe Form in Tinte statt Weiss — für helle Flächen."""
    aus = Image.new("RGBA", im.size)
    q, z = im.load(), aus.load()
    for y in range(im.height):
        for x in range(im.width):
            z[x, y] = (26, 30, 41, q[x, y][3])
    return aus


def eng_zuschneiden(im: Image.Image) -> Image.Image:
    """Alle vollständig durchsichtigen Ränder abschneiden.

    Ohne Rand: Die einheitliche Höhe im Badge entsteht über CSS, und
    jede mitgeschleppte Aussenfläche würde ein Logo kleiner erscheinen
    lassen als die anderen.
    """
    kasten = im.getchannel("A").getbbox()
    return im.crop(kasten) if kasten else im


def main() -> int:
    if not os.path.isdir(QUELLE):
        print(f"Quellordner fehlt: {QUELLE}", file=sys.stderr)
        return 1
    os.makedirs(ZIEL, exist_ok=True)

    dateien = sorted(os.listdir(QUELLE))
    for erkennung, name, grund, farbe, braucht_dunkel in BILDER:
        treffer = next((d for d in dateien if erkennung in d), None)
        if not treffer:
            print(f"{name}: kein Rohbild gefunden ({erkennung})", file=sys.stderr)
            continue

        im = Image.open(os.path.join(QUELLE, treffer))
        frei = frei_von_schwarz(im) if grund == (0, 0, 0) else frei_von_flaeche(im, grund, farbe)
        frei = eng_zuschneiden(frei)

        # Höhe deckeln: 42 px Anzeige auf dreifacher Auflösung reicht
        # für jedes Display und hält die Dateien klein.
        if frei.height > 240:
            frei = frei.resize((round(frei.width * 240 / frei.height), 240), Image.LANCZOS)
            # Nach dem Skalieren erneut zuschneiden: Das Neuberechnen
            # der Bildpunkte zieht die äusserste Reihe gegen null und
            # legt damit einen durchsichtigen Rand an, den das erste
            # Zuschneiden noch nicht kennen konnte. Ein Logo mit
            # unsichtbarem Rand wirkt im Badge kleiner als die anderen.
            frei = eng_zuschneiden(frei)

        pfad = os.path.join(ZIEL, f"{name}.png")
        frei.save(pfad, "PNG", optimize=True)
        print(f"{name:14s} {frei.size[0]:4d}x{frei.size[1]:3d}  {os.path.getsize(pfad)//1024:3d} kB")

        if braucht_dunkel:
            d = dunkle_fassung(frei)
            p2 = os.path.join(ZIEL, f"{name}-dunkel.png")
            d.save(p2, "PNG", optimize=True)
            print(f"{name + '-dunkel':14s} {d.size[0]:4d}x{d.size[1]:3d}  {os.path.getsize(p2)//1024:3d} kB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
