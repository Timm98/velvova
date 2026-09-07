import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Die Bildflächen der Landingpage — und die Slots für echte Fotos.
 *
 * ── Was hier ehrlich gesagt werden muss ───────────────────────
 *
 * Der Auftrag verlangt Fotografie: echte Menschen, Tageslicht, echte
 * Arbeitsumgebungen. Fotos kann ich nicht herstellen. Fremde Bilder
 * ohne geklärte Lizenz auf eine Landingpage zu legen wäre kein
 * Kompromiss, sondern ein Rechtsverstoss.
 *
 * Drei Versuche, gezeichnete Menschen zu bauen, sahen aus wie das,
 * wovor der Auftrag ausdrücklich warnt: generische Illustration. Eine
 * mittelmässige Zeichnung eines Menschen ist schlechter als gar keine —
 * sie macht eine Seite billig, deren ganzer Zweck Charakter ist.
 *
 * Also das Gegenteil: KEINE gezeichneten Menschen. Was hier entsteht,
 * sind Räume und Licht — Architektur, Tiefe, Material, Korn. Das lässt
 * sich in Vektor gut machen, es sieht absichtlich aus, und es
 * konkurriert nicht mit einem Foto, sondern wartet auf eines.
 *
 * ── Wie ein Foto hierherkommt ─────────────────────────────────
 *
 * Jede Datei hier ist ein Platzhalter mit fester Kennung und festem
 * Seitenverhältnis (16:11). `Arbeitswelt.tsx` lädt sie über
 * `next/image`. Ein Foto ersetzt eine Datei — gleiche Kennung, Endung
 * `.avif` oder `.webp`, und der Eintrag in `MOTIVE` bekommt die neue
 * Endung. Sonst ändert sich nichts: kein Layoutbruch, kein neuer Code.
 *
 * Die Liste steht in `apps/web/public/arbeitswelt/BILDER.md`.
 */

const ZIEL = "apps/web/public/arbeitswelt";
const B = 1600;
const H = 1100;

/**
 * Acht Räume, acht Stimmungen.
 *
 * `licht` ist die Richtung des Fensters, `tiefe` die Zahl der Ebenen,
 * `ton` das Materialpaar. Zusammen ergeben sie einen Raum, den man
 * einordnen kann, ohne dass ein Gegenstand ihn benennt — genau das,
 * was ein Foto später besser kann.
 */
const RAEUME = {
  werkstatt:   { warm: "#c2703f", kalt: "#3d474f", papier: "#f0e7db", licht: 0.14, muster: "regal" },
  logistik:    { warm: "#cf9539", kalt: "#3f4f5b", papier: "#efe9de", licht: 0.10, muster: "flucht" },
  pflege:      { warm: "#cf8270", kalt: "#4a6a68", papier: "#f1ece7", licht: 0.20, muster: "flur" },
  labor:       { warm: "#5f8f86", kalt: "#3c4a59", papier: "#eaeeeb", licht: 0.24, muster: "bank" },
  buero:       { warm: "#635bff", kalt: "#3a3f57", papier: "#eceaf6", licht: 0.18, muster: "raster" },
  gastronomie: { warm: "#bd6047", kalt: "#524739", papier: "#f2e7d9", licht: 0.12, muster: "tresen" },
  technik:     { warm: "#cd8a2e", kalt: "#38424b", papier: "#ece7de", licht: 0.08, muster: "halle" },
  gestaltung:  { warm: "#7b5bd6", kalt: "#3e4252", papier: "#ece8f3", licht: 0.26, muster: "atelier" },
};

const r = (x, y, w, h, f, o = 1, rad = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" fill="${f}" opacity="${o}"/>`;
const p = (d, f, o = 1) => `<path d="${d}" fill="${f}" opacity="${o}"/>`;
const l = (d, f, w, o = 1) =>
  `<path d="${d}" fill="none" stroke="${f}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;

/**
 * Die Muster.
 *
 * Die Vordergrundbänder sind bewusst zurückhaltend. Erste Fassung
 * setzte sie dunkel und hoch — richtig für ein Vollbild mit Text
 * darüber, falsch für einen Halbseiten-Ausschnitt: Dort blieb vom Raum
 * fast nichts übrig ausser dem Band.
 *
 * Jedes baut denselben Raum in drei Tiefen: Wand, Mittelgrund,
 * Vordergrund. Der Vordergrund ist immer angeschnitten — daher kommt
 * das Gefühl, im Raum zu stehen statt ihn anzusehen.
 */
const MUSTER = {
  /* Werkzeugwand: viele senkrechte Fächer, eines hell. */
  regal: (c) => `
    ${r(0, 0, B, 720, "#ffffff", 0.34)}
    ${Array.from({ length: 9 }, (_, i) => r(96 + i * 168, 120, 118, 470, c.kalt, i === 4 ? 0.03 : 0.09, 4)).join("")}
    ${Array.from({ length: 9 }, (_, i) => r(96 + i * 168, 300, 118, 8, c.kalt, 0.16)).join("")}
    ${r(96 + 4 * 168, 120, 118, 470, c.warm, 0.3, 4)}
    ${p(`M0 720 H${B} V860 H0z`, c.kalt, 0.12)}
    ${p(`M0 ${H} V880 H980 L1060 ${H}z`, c.kalt, 0.42)}
    ${r(120, 838, 700, 10, "#ffffff", 0.3, 6)}`,

  /* Regalflucht in die Tiefe: Rechtecke, die kleiner und blasser werden. */
  flucht: (c) => `
    ${Array.from({ length: 6 }, (_, i) => {
      const s = 1 - i * 0.13;
      const w = 250 * s;
      const hh = 700 * s;
      const x = 60 + i * 268;
      const y = 760 - hh;
      return `${r(x, y, w, hh, "#ffffff", 0.5 - i * 0.06, 3)}
        ${Array.from({ length: 3 }, (_, j) =>
          r(x + 18 * s, y + 26 * s + j * (hh / 3), w - 36 * s, hh / 3 - 40 * s, j === 1 ? c.warm : c.kalt, 0.15, 3)).join("")}`;
    }).join("")}
    ${p(`M0 760 H${B} V${H} H0z`, c.kalt, 0.1)}
    ${p(`M0 ${H} V890 H620 V${H}z`, c.warm, 0.4)}`,

  /* Flur: hohe Fenster links, Bodenlinie, Lichtbahn. */
  flur: (c) => `
    ${r(0, 0, B, 780, "#ffffff", 0.42)}
    ${Array.from({ length: 3 }, (_, i) => `${r(90 + i * 320, 70, 230, 520, "#ffffff", 0.85, 10)}
      ${l(`M${205 + i * 320} 70 V590`, c.kalt, 8, 0.12)}
      ${r(90 + i * 320, 70, 230, 520, c.kalt, 0.05, 10)}`).join("")}
    ${p(`M90 590 L320 590 L620 ${H} L60 ${H}z`, "#ffffff", 0.5)}
    ${p(`M0 780 H${B} V${H} H0z`, c.kalt, 0.09)}
    ${p(`M0 ${H} V920 H${B} V${H}z`, c.warm, 0.32)}`,

  /* Laborbank: Reihen gleicher Objekte, viel Weiss. */
  bank: (c) => `
    ${r(0, 0, B, 700, "#ffffff", 0.5)}
    ${r(110, 130, 700, 420, "#ffffff", 0.9, 8)}
    ${Array.from({ length: 5 }, (_, i) => r(160 + i * 130, 180, 82, 150, c.warm, 0.2, 4)).join("")}
    ${Array.from({ length: 5 }, (_, i) => r(160 + i * 130, 370, 82, 120, c.kalt, 0.12, 4)).join("")}
    ${r(1000, 200, 460, 350, c.kalt, 0.07, 10)}
    ${p(`M0 700 H${B} V${H} H0z`, c.kalt, 0.08)}
    ${p(`M0 ${H} V830 H${B} V${H}z`, "#ffffff", 0.62)}
    ${Array.from({ length: 4 }, (_, i) => `${p(`M${300 + i * 260} 790 l30 -130 h68 l30 130z`, c.warm, 0.85)}
      ${p(`M${314 + i * 260} 726 h86 l16 64 h-118z`, c.warm, 1)}`).join("")}`,

  /* Büroraster: Bildschirmlicht und Flächen. */
  raster: (c) => `
    ${r(0, 0, B, 740, "#ffffff", 0.4)}
    ${r(110, 110, 620, 400, "#ffffff", 0.9, 12)}
    ${Array.from({ length: 4 }, (_, i) => r(170, 180 + i * 76, 500 - i * 110, 26, c.warm, 0.28, 6)).join("")}
    ${r(1180, 180, 320, 380, c.warm, 0.12, 12)}
    ${r(1240, 240, 200, 22, c.warm, 0.3, 6)}
    ${p(`M0 740 H${B} V${H} H0z`, c.kalt, 0.08)}
    ${p(`M0 ${H} V810 H${B} V${H}z`, "#ffffff", 0.6)}
    ${r(140, 690, 470, 220, c.kalt, 0.9, 14)}
    ${r(178, 728, 394, 144, "#ffffff", 0.96, 8)}
    ${r(216, 766, 230, 14, c.warm, 0.85, 7)}
    ${r(216, 800, 160, 14, c.kalt, 0.28, 7)}
    ${r(1120, 720, 340, 190, c.kalt, 0.85, 14)}
    ${r(1156, 756, 268, 118, "#ffffff", 0.94, 8)}`,

  /* Tresen: eine grosse Fläche vorn, Regal dahinter. */
  tresen: (c) => `
    ${r(0, 0, B, 700, "#ffffff", 0.34)}
    ${r(110, 100, 700, 500, "#ffffff", 0.6, 4)}
    ${Array.from({ length: 6 }, (_, i) => l(`M${170 + i * 122} 150 V560`, c.kalt, 7, 0.14)).join("")}
    ${Array.from({ length: 5 }, (_, i) => r(190 + i * 122, 210, 76, 66, c.warm, i === 2 ? 0.45 : 0.16, 6)).join("")}
    ${Array.from({ length: 5 }, (_, i) => r(190 + i * 122, 380, 76, 90, c.kalt, 0.12, 6)).join("")}
    ${p(`M0 700 H${B} V${H} H0z`, c.kalt, 0.1)}
    ${p(`M0 ${H} V830 H${B} V${H}z`, c.kalt, 0.46)}
    ${r(0, 750, B, 16, "#ffffff", 0.26)}
    ${Array.from({ length: 4 }, (_, i) => `${p(`M${300 + i * 300} 750 v-84 h112 v84z`, "#ffffff", 0.94)}
      ${l(`M${412 + i * 300} 690 q42 16 0 44`, "#ffffff", 12, 0.9)}`).join("")}`,

  /* Halle: hohes Volumen, Maschinenkreis, Bodenmarkierung. */
  halle: (c) => `
    ${r(0, 0, B, 760, "#ffffff", 0.3)}
    ${r(80, 90, 760, 600, "#ffffff", 0.5, 6)}
    <circle cx="430" cy="350" r="180" fill="${c.kalt}" opacity=".16"/>
    <circle cx="430" cy="350" r="180" fill="none" stroke="#ffffff" stroke-width="18" opacity=".8"/>
    <circle cx="430" cy="350" r="58" fill="${c.warm}" opacity=".5"/>
    ${l(`M430 350 V190 M430 350 L556 424`, c.warm, 18, 0.85)}
    ${Array.from({ length: 3 }, (_, i) => r(940 + i * 190, 260, 150, 330, c.kalt, i === 1 ? 0.14 : 0.07, 6)).join("")}
    ${p(`M0 760 H${B} V${H} H0z`, c.kalt, 0.12)}
    ${l(`M0 880 H${B}`, c.warm, 16, 0.5)}
    ${p(`M0 ${H} V950 H820 L900 ${H}z`, c.warm, 0.4)}`,

  /* Atelier: grosse Kurve, Farbpunkte, Blatt vorn. */
  atelier: (c) => `
    ${r(0, 0, B, 740, "#ffffff", 0.46)}
    ${r(170, 90, 720, 560, "#ffffff", 0.85, 6)}
    ${p(`M230 600 q170 -330 340 -170 q140 128 320 -50 v220z`, c.warm, 0.4)}
    ${l(`M230 600 q170 -330 340 -170 q140 128 320 -50`, c.warm, 14, 0.9)}
    ${Array.from({ length: 4 }, (_, i) =>
      `<circle cx="${1080 + i * 118}" cy="230" r="50" fill="${[c.warm, c.kalt, "#ffffff", c.warm][i]}" opacity="${i === 2 ? 0.92 : 0.5}"/>`).join("")}
    ${p(`M0 740 H${B} V${H} H0z`, c.kalt, 0.08)}
    ${p(`M0 ${H} V800 H${B} V${H}z`, "#ffffff", 0.6)}
    ${r(180, 776, 560, 324, c.papier, 1, 6)}
    ${r(234, 830, 330, 18, c.warm, 0.72, 9)}
    ${r(234, 876, 452, 14, c.kalt, 0.24, 7)}
    ${r(234, 912, 386, 14, c.kalt, 0.24, 7)}`,
};

function bild(name) {
  const c = RAEUME[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="grund" x1=".08" y1="0" x2=".92" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".42" stop-color="${c.papier}"/>
      <stop offset="1" stop-color="${c.kalt}" stop-opacity=".26"/>
    </linearGradient>
    <radialGradient id="fenster" cx="${c.licht}" cy=".1" r=".78">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".96"/>
      <stop offset=".55" stop-color="#ffffff" stop-opacity=".2"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ecke" x1="1" y1="1" x2=".35" y2=".2">
      <stop offset="0" stop-color="${c.kalt}" stop-opacity=".34"/>
      <stop offset="1" stop-color="${c.kalt}" stop-opacity="0"/>
    </linearGradient>
    <filter id="korn">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope=".18"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="${B}" height="${H}" fill="${c.papier}"/>
  <rect width="${B}" height="${H}" fill="url(#grund)"/>
  ${MUSTER[c.muster](c)}
  <rect width="${B}" height="${H}" fill="url(#fenster)"/>
  <rect width="${B}" height="${H}" fill="url(#ecke)"/>
  <rect width="${B}" height="${H}" filter="url(#korn)" opacity=".55" style="mix-blend-mode:multiply"/>
</svg>`;
}

mkdirSync(ZIEL, { recursive: true });
for (const name of Object.keys(RAEUME)) {
  writeFileSync(`${ZIEL}/${name}.svg`, bild(name).replace(/\n\s+/g, " ").trim());
}

writeFileSync(
  `${ZIEL}/BILDER.md`,
  `# Bildslots der Landingpage

Diese acht Dateien sind **Platzhalter**. Sie zeigen Räume und Licht, keine
Menschen — eine mittelmässige Zeichnung eines Menschen ist schlechter als
gar keine.

## Ein Foto einsetzen

1. Foto auf **1600 × 1100** (16:11) beschneiden, als AVIF und WebP
   speichern.
2. In diesen Ordner legen, gleicher Dateiname, andere Endung —
   \`werkstatt.avif\` statt \`werkstatt.svg\`.
3. In \`apps/web/src/components/marketing/Arbeitswelt.tsx\` die Endung im
   Eintrag \`MOTIVE\` ändern.

Sonst ändert sich nichts: gleiche Grösse, gleiches Layout, gleicher
Alternativtext.

## Die acht Slots

| Datei | Motiv, das hier hingehört | Wo es steht |
|---|---|---|
${Object.keys(RAEUME).map((n) => `| \`${n}.svg\` | ${{
  werkstatt: "Handwerk, Werkbank, konzentrierte Arbeit mit den Händen",
  logistik: "Lager oder Disposition, Regalfluchten, Tageslicht",
  pflege: "Gesundheitswesen, heller Flur, Gespräch",
  labor: "Labor oder Technik, Bank, präzise Arbeit",
  buero: "Büro, zwei Bildschirme, ruhige Konzentration",
  gastronomie: "Gastronomie, Tresen, Übergabe",
  technik: "Produktion, Maschine, Werkhalle",
  gestaltung: "Gestaltung, Entwurf, Material auf dem Tisch",
}[n]} | ${{
  werkstatt: "Abschnitt „Nicht jeder weiss …“",
  logistik: "Geschichte „Ich arbeite im Lager“",
  pflege: "Abschnitt „Monday denkt nicht in Schlagwörtern“",
  labor: "Abschnitt „Was Monday über einen Job wissen will“",
  buero: "Abschnitt „Wenn du dich entschieden hast“",
  gastronomie: "Zitatfläche „Vielleicht ist dein nächster Job …“",
  technik: "Abschnitt „Zwei Seiten“",
  gestaltung: "Abschnitt „Monday bleibt“",
}[n]} |`).join("\n")}

## Was ein Foto NICHT sein darf

Kein Handschlag, kein Team am Whiteboard mit Klebezetteln, kein Roboter,
kein Neon. Der Auftrag nennt das ausdrücklich — und es sind genau die
Bilder, die eine Karriereseite austauschbar machen.
`,
);

console.log(`${Object.keys(RAEUME).length} Bildflächen + BILDER.md in ${ZIEL} (${B}×${H}).`);
