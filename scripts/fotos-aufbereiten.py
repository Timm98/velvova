"""
Wandelt die KI-Bilder in auslieferbare Grössen.

Die Vorlagen sind 1536×1024-PNG, zusammen 266 MB. Ausgeliefert werden
zwei WebP-Grössen je Motiv: 1200 px für die Detailansicht, 480 px für
Listen und Karten. Ohne diesen Schritt lüde eine Seite mit zwölf
Kacheln 24 MB nach.

Die Zuordnung steht in zuordnung.json und stammt aus dem Ansehen der
Bilder, nicht aus den Dateinamen — die sind Zeitstempel.
"""
import json, os, sys
from PIL import Image

O = os.path.expanduser("~/Downloads/drive-download-20260903T135018Z-1-001")
S = sys.argv[1]
ZIEL = os.path.expanduser("~/paycheck-rebuild/apps/web/public/fotos")

namen = json.load(open(f"{S}/bogen/namen.json"))
zuordnung = json.load(open(f"{S}/zuordnung.json"))

for art in ("beruf", "krise", "marke"):
    os.makedirs(f"{ZIEL}/{art}", exist_ok=True)

eintraege, bytes_gesamt = [], 0
for nr_s, (art, slug, alt, gruppe) in sorted(zuordnung.items(), key=lambda x: int(x[0])):
    quelle = os.path.join(O, namen[int(nr_s) - 1])
    im = Image.open(quelle).convert("RGB")
    for breite, endung in ((1200, ""), (480, "-klein")):
        k = im.copy()
        k.thumbnail((breite, breite), Image.LANCZOS)
        p = f"{ZIEL}/{art}/{slug}{endung}.webp"
        k.save(p, "WEBP", quality=82, method=6)
        bytes_gesamt += os.path.getsize(p)
    eintraege.append({"art": art, "slug": slug, "alt": alt, "gruppe": gruppe,
                      "breite": im.width, "hoehe": im.height})

json.dump(eintraege, open(f"{S}/eintraege.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(eintraege)} Motive · {bytes_gesamt/1048576:.1f} MB (vorher 266 MB)")
from collections import Counter
for a, n in Counter(e["art"] for e in eintraege).most_common():
    print(f"  {a}: {n}")
