import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Die Illustrationsbibliothek der Berufsgruppen (V7 §21.3).
 *
 * ── Warum ein Generator und nicht 15 Dateien ──────────────────
 *
 * Fünfzehn von Hand gezeichnete Bilder sehen aus wie fünfzehn von Hand
 * gezeichnete Bilder. Sie driften: hier ein anderer Blauton, dort eine
 * dickere Linie, da ein tieferer Horizont. In einer Jobliste liegen sie
 * untereinander, und dann sieht man jede Abweichung.
 *
 * Deshalb steht die Bildsprache EINMAL hier und wird fünfzehnmal
 * angewandt. Gleiche Fläche, gleicher Horizont, gleiche Strichstärke,
 * gleiche Lichtrichtung, gleiche Palette. Was sich unterscheidet, sind
 * nur die Gegenstände — und genau die sollen es auch sein.
 *
 * ── Warum keine Menschen ──────────────────────────────────────
 *
 * Ein gezeichneter Mensch neben einer echten Stellenanzeige behauptet
 * etwas: so sehen die Leute dort aus, so ist die Stimmung. Das weiss
 * niemand. Diese Bilder zeigen deshalb Arbeitsumgebungen und
 * Werkzeuge — Gegenstände behaupten weniger als Gesichter.
 *
 * Ausserdem umgeht es die Stockfoto-Ästhetik, die ausdrücklich nicht
 * gewünscht ist: keine lächelnden Models, keine Handschläge.
 *
 * ── Warum die Farben so eng sind ──────────────────────────────
 *
 * Grün heisst im Produkt „belegt", Rot heisst „Konflikt", Bernstein
 * heisst „zu prüfen". Diese Farben dürfen nicht dekorativ auftreten,
 * sonst verlieren sie ihre Bedeutung genau dort, wo sie gebraucht wird.
 * Die Illustrationen bleiben deshalb im Indigo-Lavendel-Band der Marke,
 * mit einem einzigen gedämpften Akzent je Gruppe.
 *
 *   node scripts/illustrationen-bauen.mjs
 */

const B = 800, H = 400;          // 2:1 — dasselbe Verhältnis wie die Jobkarte
const GRUND = 300;               // Horizont, überall gleich
const R = 10;                    // Eckenradius der Gegenstände

/* Die Palette. Ein Grundton, zwei Flächentöne, ein Akzent je Gruppe. */
const TINTE = "#2b2545";
const HELL = "#ffffff";

const stil = (akzent, ton) => `
  .bg { fill: url(#v); }
  .fl { fill: ${HELL}; }
  .li { fill: none; stroke: ${TINTE}; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; opacity: .82; }
  .du { fill: ${TINTE}; opacity: .82; }
  .ak { fill: ${akzent}; }
  .ak-l { fill: none; stroke: ${akzent}; stroke-width: 3.5; stroke-linecap: round; }
  .we { fill: ${ton}; opacity: .5; }
  .sc { fill: ${TINTE}; opacity: .07; }
`;

/* Rechteck mit runden Ecken und Schatten darunter — der Grundbaustein. */
const kasten = (x, y, w, h, klasse = "fl", r = R) =>
  `<rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="${r}" class="sc"/>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${klasse}"/>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="li"/>`;

const linie = (d) => `<path d="${d}" class="li"/>`;
const akzentLinie = (d) => `<path d="${d}" class="ak-l"/>`;
const kreis = (cx, cy, r, k = "ak") => `<circle cx="${cx}" cy="${cy}" r="${r}" class="${k}"/>`;
/* Balken wie in einer Liste — steht für Text, ohne Text zu behaupten. */
const balken = (x, y, w, h = 7) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" class="we"/>`;

/**
 * Die fünfzehn Szenen.
 *
 * Jede besteht aus wenigen grossen Formen. Die Versuchung ist, viel
 * hineinzupacken; in 88 Pixel Höhe auf einer Jobkarte sieht man davon
 * nichts, und in der Detailansicht wirkt es unruhig. Drei bis fünf
 * Elemente je Bild, mehr nicht.
 */
/* Zusätzliche Bausteine für unverwechselbare Silhouetten. */
const sprechblase = (x, y, w, h, k = "fl") =>
  `<path d="M${x + R} ${y}h${w - 2 * R}a${R} ${R} 0 0 1 ${R} ${R}v${h - 2 * R}a${R} ${R} 0 0 1 -${R} ${R}h-${w - 46}l-22 26v-26h-${16}a${R} ${R} 0 0 1 -${R}-${R}v-${h - 2 * R}a${R} ${R} 0 0 1 ${R}-${R}z" class="${k}"/>` +
  `<path d="M${x + R} ${y}h${w - 2 * R}a${R} ${R} 0 0 1 ${R} ${R}v${h - 2 * R}a${R} ${R} 0 0 1 -${R} ${R}h-${w - 46}l-22 26v-26h-${16}a${R} ${R} 0 0 1 -${R}-${R}v-${h - 2 * R}a${R} ${R} 0 0 1 ${R}-${R}z" class="li"/>`;

/* Ein Zahnrad, das auch als Zahnrad zu erkennen ist. */
const zahnrad = (cx, cy, r, zaehne = 8, k = "we") => {
  let d = "";
  for (let i = 0; i < zaehne; i++) {
    const a = (i / zaehne) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
    const x2 = cx + Math.cos(a) * (r + 11), y2 = cy + Math.sin(a) * (r + 11);
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" class="${k}"/>` +
         `<circle cx="${cx}" cy="${cy}" r="${r}" class="li"/>` +
         `<path d="${d}" class="li"/>` +
         `<circle cx="${cx}" cy="${cy}" r="${(r * 0.34).toFixed(1)}" class="du"/>`;
};

/* Gestapelte Münzen — Geld, ohne ein Eurozeichen zu malen. */
const muenzen = (cx, y, n = 3) => {
  let o = "";
  for (let i = 0; i < n; i++) {
    const yy = y - i * 22;
    o += `<ellipse cx="${cx}" cy="${yy}" rx="46" ry="15" class="${i === n - 1 ? "ak" : "we"}"/>` +
         `<ellipse cx="${cx}" cy="${yy}" rx="46" ry="15" class="li"/>`;
  }
  return o;
};

/* Ein aufgeschlagenes Buch. */
const buch = (cx, cy) =>
  `<path d="M${cx} ${cy - 52}c-26-18-58-18-84-8v92c26-10 58-10 84 8z" class="fl"/>` +
  `<path d="M${cx} ${cy - 52}c26-18 58-18 84-8v92c-26-10-58-10-84 8z" class="we"/>` +
  `<path d="M${cx} ${cy - 52}c-26-18-58-18-84-8v92c26-10 58-10 84 8zM${cx} ${cy - 52}c26-18 58-18 84-8v92c-26-10-58-10-84 8zM${cx} ${cy - 52}v92" class="li"/>`;

const SZENEN = {
  /* Gespräch. Zwei Sprechblasen — das unterscheidet sich auf 88 Pixel
     Höhe von jeder anderen Gruppe, und darum geht es. */
  customer_success: { akzent: "#6d5ce7", ton: "#c9c2f5", teile: () =>
    sprechblase(175, 110, 250, 120) + balken(205, 145, 160) + balken(205, 168, 110) +
    sprechblase(440, 165, 210, 100, "ak") + kreis(690, 205, 16, "we") },

  software_data: { akzent: "#4f7ce8", ton: "#bcd0f7", teile: () =>
    kasten(160, 110, 480, 180) + linie("M160 152h480") +
    kreis(196, 131, 6, "ak") + kreis(216, 131, 6, "du") + kreis(236, 131, 6, "du") +
    akzentLinie("M255 200l-34 32 34 32") + akzentLinie("M355 200l34 32-34 32") +
    linie("M285 272l45-80") },

  data_bi: { akzent: "#3f8fbf", ton: "#b6dcec", teile: () =>
    `<rect x="200" y="200" width="52" height="90" rx="7" class="we"/><rect x="200" y="200" width="52" height="90" rx="7" class="li"/>` +
    `<rect x="278" y="150" width="52" height="140" rx="7" class="ak"/><rect x="278" y="150" width="52" height="140" rx="7" class="li"/>` +
    `<rect x="356" y="110" width="52" height="180" rx="7" class="we"/><rect x="356" y="110" width="52" height="180" rx="7" class="li"/>` +
    `<rect x="434" y="175" width="52" height="115" rx="7" class="ak"/><rect x="434" y="175" width="52" height="115" rx="7" class="li"/>` +
    `<rect x="512" y="230" width="52" height="60" rx="7" class="we"/><rect x="512" y="230" width="52" height="60" rx="7" class="li"/>` +
    akzentLinie("M226 178l52-42 52-38 52 58 52 48") },

  finance: { akzent: "#3f8f7a", ton: "#b4ded2", teile: () =>
    muenzen(300, 278, 4) + kasten(440, 150, 210, 140) +
    balken(472, 190, 130) + balken(472, 214, 90) + akzentLinie("M472 252h110") },

  healthcare: { akzent: "#c25c7a", ton: "#f2c8d4", teile: () =>
    `<path d="M340 120h64v52h52v64h-52v52h-64v-52h-52v-64h52z" class="fl"/>` +
    `<path d="M340 120h64v52h52v64h-52v52h-64v-52h-52v-64h52z" class="li"/>` +
    akzentLinie("M480 230h34l18-34 24 62 20-42h74") },

  education: { akzent: "#b8873f", ton: "#f0dcbb", teile: () =>
    buch(330, 200) +
    `<path d="M500 175l90-38 90 38-90 38z" class="ak"/><path d="M500 175l90-38 90 38-90 38zM665 190v46" class="li"/>` },

  skilled_trades: { akzent: "#a8703f", ton: "#eed6bd", teile: () =>
    /* Schutzhelm mit Kamm und schmaler Krempe.
     *
     * Die erste Fassung war eine glatte Halbkugel auf einem breiten
     * Balken — das las sich als Servierglocke. Der Kamm oben und die
     * kurze, nach vorn gezogene Krempe machen daraus einen Helm. */
    `<path d="M258 236a70 70 0 0 1 140 0z" class="ak"/>` +
    `<path d="M258 236a70 70 0 0 1 140 0z" class="li"/>` +
    `<path d="M328 166v70M300 172a70 70 0 0 0-8 64M356 172a70 70 0 0 1 8 64" class="li"/>` +
    `<path d="M238 236h180a12 12 0 0 1 12 12v6H226v-6a12 12 0 0 1 12-12z" class="fl"/>` +
    `<path d="M238 236h180a12 12 0 0 1 12 12v6H226v-6a12 12 0 0 1 12-12z" class="li"/>` +
    /* Hammer, aufrecht.
     *
     * Zweimal schraeg gezeichnet, zweimal falsch gelesen: erst als
     * Spaten, dann als Golfschlaeger. Ein Werkzeug erkennt man an
     * seiner Silhouette, und die eines Hammers ist ein Querbalken auf
     * einem senkrechten Stiel. Schraeg gestellt verliert sie genau das.
     *
     * Die Lehre gilt fuer die ganze Bibliothek: lieber die kanonische
     * Ansicht als die dynamischere. */
    `<rect x="524" y="132" width="120" height="44" rx="9" class="ak"/>` +
    `<rect x="524" y="132" width="120" height="44" rx="9" class="li"/>` +
    `<path d="M524 154h-26a26 26 0 0 0 0 22h26z" class="ak"/>` +
    `<path d="M524 154h-26a26 26 0 0 0 0 22h26z" class="li"/>` +
    `<rect x="574" y="176" width="20" height="114" rx="10" class="fl"/>` +
    `<rect x="574" y="176" width="20" height="114" rx="10" class="li"/>` },

  operations: { akzent: "#5f74a8", ton: "#c5cfe8", teile: () =>
    zahnrad(300, 180, 56, 9) + zahnrad(430, 245, 36, 8, "ak") +
    kasten(520, 230, 150, 60) + balken(548, 252, 94) },

  logistics: { akzent: "#7a6bd4", ton: "#cdc6f2", teile: () =>
    kasten(160, 168, 180, 122) + linie("M160 212h180M250 168v122") +
    kasten(365, 128, 150, 162) + linie("M365 180h150M440 128v162") +
    kasten(540, 200, 120, 90) + akzentLinie("M600 200v90") + akzentLinie("M540 244h120") },

  sales: { akzent: "#c07a3f", ton: "#f3d9bb", teile: () =>
    kasten(180, 118, 300, 172) + linie("M180 158h300") +
    akzentLinie("M215 258l58-52 46 34 78-82") + kreis(397, 158, 11) +
    /* Preisschild statt Fünfeck.
     *
     * Vorher stand hier eine Haus-artige Form, die nichts bedeutete.
     * Das Schild mit Loch und Schnur ist eindeutig kaufmaennisch —
     * und kommt ohne den verbotenen Handschlag aus. */
    `<path d="M542 196h74l68 68-74 74-68-68z" class="we"/>` +
    `<path d="M542 196h74l68 68-74 74-68-68z" class="li"/>` +
    `<circle cx="592" cy="246" r="15" class="fl"/><circle cx="592" cy="246" r="15" class="li"/>` +
    akzentLinie("M616 196l24-24") },

  design: { akzent: "#a05cc0", ton: "#e4c9f0", teile: () =>
    /* Palette: eine Form, die nichts anderes sein kann. */
    `<path d="M330 116c74 0 130 46 130 96 0 30-24 40-46 40h-26c-18 0-28 12-28 26 0 12-10 22-30 22-66 0-120-40-120-92s54-92 120-92z" class="fl"/>` +
    `<path d="M330 116c74 0 130 46 130 96 0 30-24 40-46 40h-26c-18 0-28 12-28 26 0 12-10 22-30 22-66 0-120-40-120-92s54-92 120-92z" class="li"/>` +
    kreis(272, 178, 15) + kreis(330, 160, 15, "we") + kreis(388, 182, 15, "du") + kreis(268, 236, 15, "we") +
    `<path d="M540 290l-14-96 40-64 40 64-14 96z" class="we"/><path d="M540 290l-14-96 40-64 40 64-14 96zM526 194h80" class="li"/>` },

  administration: { akzent: "#5f7fa8", ton: "#c5d6e8", teile: () =>
    /* Hängeregister — Verwaltung ist Ablage, nicht noch ein Kärtchen. */
    `<path d="M200 150h96l24 30h180v110H200z" class="fl"/>` +
    `<path d="M200 150h96l24 30h180v110H200z" class="li"/>` +
    `<path d="M230 210h240v80H230z" class="we"/><path d="M230 210h240v80H230z" class="li"/>` +
    kasten(540, 178, 120, 112) + akzentLinie("M568 214h64M568 240h44") },

  hr: { akzent: "#4f9a8a", ton: "#bee0d8", teile: () =>
    /* Ausweise statt Gesichter. Ein gezeichnetes Gesicht bekommt eine
       Stimmung, die niemand gemeint hat — die erste Fassung las sich
       als zwei traurige Menschen. */
    kasten(200, 130, 150, 160) + kreis(275, 182, 26, "ak") + balken(228, 228, 94) + balken(240, 250, 70) +
    kasten(400, 130, 150, 160) + kreis(475, 182, 26, "we") + balken(428, 228, 94) + balken(440, 250, 70) +
    akzentLinie("M600 180v80M580 200l20-20 20 20") },

  marketing: { akzent: "#c05c8a", ton: "#f2c9dc", teile: () =>
    `<path d="M240 200l176-70v140z" class="fl"/><path d="M240 200l176-70v140z" class="li"/>` +
    `<rect x="196" y="176" width="46" height="48" rx="8" class="ak"/><rect x="196" y="176" width="46" height="48" rx="8" class="li"/>` +
    akzentLinie("M456 168v64M492 148v104M528 178v44") +
    kasten(566, 196, 110, 94) + balken(592, 226, 58) },

  research: { akzent: "#4f8fa8", ton: "#bcdce8", teile: () =>
    linie("M296 118v76l-62 96h150l-62-96v-76M280 118h64") +
    `<path d="M252 244h122l24 46H228z" class="ak" opacity=".5"/>` +
    kreis(300, 262, 8, "du") + kreis(330, 274, 6, "du") +
    kasten(470, 152, 190, 138) + balken(500, 192, 122) + balken(500, 216, 82) + kreis(628, 262, 12) },
};

mkdirSync("apps/web/public/berufsbilder", { recursive: true });

let n = 0;
for (const [key, s] of Object.entries(SZENEN)) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img">` +
    `<defs><linearGradient id="v" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#f4f2fd"/><stop offset="1" stop-color="${s.ton}" stop-opacity=".85"/>` +
    `</linearGradient></defs>` +
    `<style>${stil(s.akzent, s.ton)}</style>` +
    `<rect width="${B}" height="${H}" class="bg"/>` +
    /* Der Horizont. Überall auf derselben Höhe — das ist es, was die
       fünfzehn Bilder nebeneinander als eine Familie lesbar macht. */
    `<path d="M0 ${GRUND}h${B}" stroke="${TINTE}" stroke-width="3.5" opacity=".2"/>` +
    s.teile() +
    `</svg>`;
  writeFileSync(`apps/web/public/berufsbilder/${key}.svg`, svg);
  n++;
}
console.log(`${n} Berufsbilder geschrieben nach apps/web/public/berufsbilder/`);
