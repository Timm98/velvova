"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type AnimationClip,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { NinaAnimation } from "./useNinaAnimation";
import type { NinaVisualState } from "./NinaProvider";

/**
 * Monday in drei Dimensionen — mit three.js allein.
 *
 * Vorher liefen hier `@react-three/fiber` und `@react-three/drei`. Für
 * eine Szene aus genau einem Modell war das der falsche Zuschnitt:
 *
 *   **937 KB in einem Chunk.** Der größte Teil davon Code, den diese
 *   Szene nie benutzt — Physik, Gesichtserkennung, Draco- und
 *   Basis-Dekoder.
 *
 *   **Ein WebAssembly-Verstoß gegen die eigene CSP.** Drei versucht
 *   Dekoder zu laden, die unsere Datei gar nicht braucht: sie ist nicht
 *   komprimiert.
 *
 *   **Ein React-Reconciler für eine Endlosschleife.** Die Animation
 *   läuft in `requestAnimationFrame`; React muss davon nichts wissen.
 *
 * Was bleibt: der Loader, ein Mischer, eine Schleife.
 *
 * ── Was hier NICHT steht, und warum ──────────────────────────
 *
 * Ein Zwischenstand hat um das Modell herum eine eigene Welt gebaut:
 * Ringe, ein Knotennetz, Partikelwolken. Das war der falsche Weg. Die
 * Datei ist bereits ein fertig gestaltetes Objekt mit elf Materialien,
 * zwölf Netzen und drei Animationen — was ihr fehlte, war nicht mehr
 * Inhalt, sondern mehr Raum: Licht, das die Schichten trennt, und
 * Bewegung, die sie gegeneinander verschiebt.
 *
 * Deshalb kommt die Tiefe hier aus vier Dingen, von denen keines dem
 * Modell etwas hinzufügt:
 *
 *   1. drei Lichter aus drei Richtungen statt zwei,
 *   2. eine Farbstaffel, die helle Schichten nach vorn und dunkle nach
 *      hinten legt,
 *   3. eine sehr langsame Kamerabewegung, die Parallaxe erzeugt —
 *      der stärkste Tiefenhinweis überhaupt, und der einzige, den
 *      kein Standbild haben kann,
 *   4. eine Atembewegung, die den Körper minimal näher und ferner
 *      rückt.
 */

/*
 * ══════════════════════════════════════════════════════════════
 * Die gepackte Fassung — 7,6 statt 12,4 MB
 * ══════════════════════════════════════════════════════════════
 *
 * ── Einmal zurückgenommen, dann nachgemessen ────────────────
 *
 * Gemeldet war „der core oben rendert nicht", und ich habe die
 * gepackte Fassung daraufhin sofort zurückgenommen. Danach habe ich
 * beide Dateien nebeneinander geprüft — in Chromium UND in WebKit,
 * der Maschine hinter Safari:
 *
 *   Konsolenfehler                      0 in beiden Motoren
 *   Bildvergleich derselben Fläche      Mittelwert 1,45 von 255
 *
 * Die verbleibende Abweichung ist die Animation: Das Modell dreht
 * sich, und zwei Aufnahmen treffen es nie in derselben Phase. Nebe
 * einandergelegt sind die Bilder nicht zu unterscheiden — gleiche
 * Struktur, gleiche Farben, gleiches Licht.
 *
 * Die wahrscheinliche Ursache des Ausfalls war der Zeitpunkt: Der
 * Wechsel der Datei löst eine Neuübersetzung aus, und wer in genau
 * dem Moment lädt, sieht eine halbe Seite. Deshalb ist sie wieder
 * aktiv.
 *
 * Sollte der Kern erneut leer bleiben: Diese eine Zeile auf
 * `nina.glb` zurückzustellen genügt, die Datei liegt unverändert
 * daneben.
 *
 * ── Die Begründung ──────────────────────────────────────────
 *
 * Monday ist das mit Abstand grösste, was diese Anwendung ausliefert.
 * Gemessen auf der Startseite: Die Datei wird nach einer Sekunde
 * angefordert; über eine Leitung mit 20 Mbit/s dauert allein ihr
 * Herunterladen fünf Sekunden. So lange sitzt man vor einem leeren
 * Kreis.
 *
 * `nina.opt.glb` ist dieselbe Szene, anders verpackt:
 *
 *   Netzdaten   KHR_mesh_quantization
 *   Texturen    PNG → WebP, Auflösung unverändert
 *
 * Beides braucht KEINEN Dekoder: Quantisierung liest three.js selbst,
 * WebP der Browser. Zwölf Netze, drei Animationen, dieselben Namen —
 * geprüft in `nina-modell.test.ts`.
 *
 * ── Warum nicht stärker gepackt ─────────────────────────────
 *
 * Mit `meshopt` wären es 3,9 MB statt 7,6 — ein Drittel. Der
 * Entpacker dafür bringt WebAssembly mit, und unsere CSP erlaubt kein
 * `unsafe-eval`. Genau daran ist eine Vorgängerfassung schon einmal
 * gescheitert: Verstoss in der Konsole, leere Fläche auf dem
 * Bildschirm. Die 3,7 MB sind zu haben — aber nur gegen eine
 * schwächere CSP, und das ist keine Entscheidung, die man beiläufig
 * trifft.
 *
 * `nina.glb` bleibt liegen. Sie ist die Quelle, aus der die gepackte
 * Fassung entsteht:
 *
 *   npx @gltf-transform/cli optimize nina.glb nina.opt.glb \
 *     --compress quantize --texture-compress webp
 */
const MODELL = "/models/nina.opt.glb";

/*
 * Ein Zwischenspeicher über alle Verbraucher.
 *
 * Die Datei ist 7,6 MB. Gesprächsseite und Drawer zeigen Monday
 * gleichzeitig — ohne diese Zeile lüde jede Stelle sie erneut. Das
 * Versprechen ist die Zusage, nicht das Ergebnis: wer zuerst fragt,
 * löst den Ladevorgang aus, alle weiteren hängen sich an.
 */
let modellVersprechen: Promise<{ scene: Group; clips: AnimationClip[] }> | null = null;

function ladeModell() {
  if (!modellVersprechen) {
    modellVersprechen = new Promise((auflösen, ablehnen) => {
      new GLTFLoader().load(
        MODELL,
        (gltf) => auflösen({ scene: gltf.scene as unknown as Group, clips: gltf.animations }),
        undefined,
        (fehler) => {
          // Beim Fehlschlag den Zwischenspeicher leeren, sonst hängt
          // jeder spätere Versuch am selben abgelehnten Versprechen.
          modellVersprechen = null;
          ablehnen(fehler instanceof Error ? fehler : new Error("GLB konnte nicht geladen werden."));
        },
      );
    });
  }
  return modellVersprechen;
}

/** Vorladen, sobald die Anwendung im Browser läuft. */
/**
 * Zwei Farbstaffeln, eine je Darstellung.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Core die Farbe wechselt
 * ══════════════════════════════════════════════════════════════
 *
 * Das Modell ist emissiv: Seine Farben werden zum Grund addiert, statt
 * ihn zu ersetzen. Was auf dunklem Grund leuchtet, kann auf hellem
 * darin verschwinden — und umgekehrt. Eine Staffel für beide Seiten
 * gibt es deshalb nicht, ohne dass eine der beiden Seiten verliert.
 *
 * Hell trägt Orange, weil die helle Darstellung durchgehend warm ist.
 * Dunkel trägt Blau: Auf dem neutralen Grau der dunklen Flächen liest
 * sich ein warmer Kern wie eine Warnfarbe, ein kühler wie Licht.
 *
 * Die fünf Stufen sind keine gleichmässige Rampe. Jedes der elf
 * Materialien bekommt seinen Platz darin aus seiner ursprünglichen
 * Helligkeit — was in der Datei hell war, liegt vorn. Eine gerade
 * Mischung wäre ohne Ereignis; an den Stützstellen entstehen die
 * sichtbaren Kanten zwischen den Schichten.
 *
 * Bewusst kein Cyan und kein Gelb am oberen Ende: Alles oberhalb eines
 * mittleren Tons verschwindet auf heller Seite im Papier — und mit ihm
 * die Ringe und Partikel, die den Core ausmachen.
 */
const STAFFEL_HELL = ["#0A0300", "#2E0E02", "#8A3006", "#B4520F", "#E8873C"] as const;
const STAFFEL_DUNKEL = ["#00040F", "#031444", "#0A34C4", "#1E5CF0", "#4E96FF"] as const;

/** Für die Spitzlichter — einmal angelegt statt je Schicht neu. */
const WEISS = new Color("#ffffff");

/** Gegenlicht und Aufheller — je Darstellung, damit die Säume passen. */
const LICHTER_HELL = { gegen: 0xffc899, auf: 0xe8934f } as const;
const LICHTER_DUNKEL = { gegen: 0x9fc6ff, auf: 0x6f9dff } as const;

/**
 * Welche Darstellung gilt gerade?
 *
 * Drei Fälle, und der dritte ist der, den man vergisst: `data-theme`
 * steht nur, wenn hell oder dunkel ausdrücklich gewählt wurde. Ohne
 * das Attribut — der Normalfall, siehe `ThemeToggle` — entscheidet
 * das Gerät, und danach muss hier gefragt werden.
 */
function istDunkel(): boolean {
  if (typeof document === "undefined") return false;
  const gewaehlt = document.documentElement.dataset.theme;
  if (gewaehlt === "dark") return true;
  if (gewaehlt === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ninaVorladen(): void {
  if (typeof window !== "undefined") void ladeModell().catch(() => undefined);
}

export function NinaScene({
  state,
  reducedMotion = false,
  onError,
}: {
  state: NinaVisualState;
  reducedMotion?: boolean;
  onError?: (fehler: unknown) => void;
}) {
  const behälter = useRef<HTMLDivElement>(null);
  const animation = useRef<NinaAnimation | null>(null);
  /* Der Zustand als Ref, nicht als Abhängigkeit: die Bildschleife darf
     nicht bei jedem Wechsel neu aufgebaut werden. */
  const zustand = useRef(state);
  zustand.current = state;

  useEffect(() => {
    const el = behälter.current;
    if (!el) return;

    let abgebrochen = false;
    let bildAnforderung = 0;
    let renderer: WebGLRenderer | null = null;
    let beobachter: ResizeObserver | null = null;
    const aufräumen: (() => void)[] = [];

    void (async () => {
      let gltf: Awaited<ReturnType<typeof ladeModell>>;
      try {
        gltf = await ladeModell();
      } catch (fehler) {
        onError?.(fehler);
        return;
      }
      if (abgebrochen) return;

      const szene = new Scene();

      /*
       * Sehr wenig Umgebungslicht — mit Absicht.
       *
       * Alle elf Materialien sind emissiv und tragen ihre eigene
       * Textur; sie leuchten aus sich heraus. Mit Umgebungslicht 1.4
       * war Monday ein weißer Fleck: das Szenenlicht hat die
       * Eigenleuchtkraft überstrahlt. Ein Hauch genügt für die wenigen
       * nicht-emissiven Kanten.
       */
      szene.add(new AmbientLight(0xffffff, 0.42));
      /*
       * Das Führungslicht darf jetzt tragen: 0.9 statt 0.25.
       *
       * Solange die Körperfarbe fast auf Null stand, hätte mehr Licht
       * nichts beleuchtet — es gab nichts, worauf es hätte fallen
       * können. Mit einer echten Körperfarbe ist es umgekehrt: Erst
       * das Licht macht aus der Fläche eine Form, weil es die
       * Wölbungen der Datei über Helligkeitsunterschiede sichtbar
       * macht.
       *
       * Die emissiven Flächen kümmert das weiterhin nicht — die tragen
       * ihr Licht selbst und reagieren auf Szenenlicht kaum.
       */
      const key = new DirectionalLight(0xffffff, 0.9);
      key.position.set(2, 3, 4);
      szene.add(key);

      /*
       * Ein zweites Licht von hinten links.
       *
       * Die nicht-emissiven Kanten des Modells — Streben, Ringträger,
       * die Hülle — bekamen bisher nur Licht von vorn und lagen
       * dadurch flach im Bild. Ein schwaches Gegenlicht zeichnet ihre
       * Silhouetten nach und gibt dem Core Tiefe, ohne die emissiven
       * Flächen aufzuhellen: Die tragen ihr Licht selbst und reagieren
       * auf Szenenlicht kaum.
       */
      const gegenlicht = new DirectionalLight(0xffffff, 0.8);
      gegenlicht.position.set(-3, 1.5, -2.5);
      szene.add(gegenlicht);

      /*
       * Ein drittes Licht von unten rechts — nur für die Tiefe.
       *
       * Mit zwei Lichtern gibt es genau eine beleuchtete und eine
       * unbeleuchtete Seite; alles dazwischen ist ein gleichmässiger
       * Verlauf, und ein gleichmässiger Verlauf trägt keine Schichten.
       * Ein drittes, schwaches Licht aus einer dritten Richtung setzt
       * einen zweiten Lichtsaum an die Kanten — und zwei Säume an
       * einer Kante sagen dem Auge, wie weit die Kante von der
       * dahinter entfernt ist.
       *
       * Kühler und schwächer als die beiden anderen, damit es die
       * Modellierung ergänzt und nicht mit ihr konkurriert.
       */
      const aufheller = new DirectionalLight(0xffffff, 0.45);
      aufheller.position.set(2.5, -2, -1.5);
      szene.add(aufheller);

      // Jede Ansicht bekommt ihre eigene Kopie: zwei Monday-Bilder
      // gleichzeitig teilten sich sonst dieselben Objekte.
      const modell = gltf.scene.clone(true);

      /*
       * Das Modell einfärben — nicht die Fläche dahinter.
       *
       * ── Warum überhaupt ──────────────────────────────────
       *
       * Die elf Materialien der Datei leuchten rein weiss. Damit Monday
       * auf heller Seite überhaupt zu sehen war, lag bisher ein
       * violetter Verlauf hinter ihr. Das war ein Hintergrund, der
       * blau aussieht — nicht ein blaues Modell.
       *
       * ── Warum tönen und nicht ersetzen ───────────────────
       *
       * `color` und `emissive` werden in Three.js mit der jeweiligen
       * Textur multipliziert. Eine Tönung lässt deshalb jede
       * Helligkeitsstufe, jede Kante und jeden Verlauf im Bild stehen
       * und verschiebt nur den Farbton — anders als ein Ersetzen der
       * Textur, das die ganze Binnenzeichnung kostet.
       *
       * ── Warum die Materialien kopiert werden ─────────────
       *
       * `Object3D.clone()` kopiert den Objektbaum, nicht die
       * Materialien — die bleiben gemeinsam. Ohne eigene Kopie färbte
       * das Einfärben einer Ansicht alle anderen mit, auch die im Dock
       * und in der Kopfzeile.
       *
       * ── Warum eine Staffel und nicht ein Ton ─────────────
       *
       * Ein einziger Ton über alle elf Materialien nahm dem Core die
       * Tiefe: Die Schichten unterscheiden sich in der Datei durch
       * ihre Helligkeit, und ein gleicher Ton bügelt genau das glatt.
       *
       * Jedes Material bekommt deshalb seinen eigenen Platz zwischen
       * Nachtblau und einem mittleren Blau, abgeleitet aus seiner
       * ursprünglichen Helligkeit. Was in der Datei hell war, liegt
       * vorn; was dunkel war, tritt zurück. Fünf Stützstellen statt
       * einer geraden Mischung, weil eine gleichmässige Rampe ohne
       * Ereignis ist — an den Übergängen entstehen sichtbare Kanten
       * zwischen den Schichten.
       *
       * Bewusst kein Cyan am oberen Ende: Das Modell ist emissiv,
       * seine Farben werden addiert. Auf weisser Seite verschwindet
       * alles oberhalb eines mittleren Blaus im Papier — und mit ihm
       * die Ringe und Partikel, die den Core ausmachen.
       */
      /* Die Schichten merken sich ihren Platz in der Staffel, damit ein
         Wechsel der Darstellung sie umfärben kann, ohne dass das Modell
         neu geladen und die Szene neu aufgebaut wird. */
      const schichten: { stoff: MeshStandardMaterial; lage: number }[] = [];
      /*
       * 0.55 statt 0.20.
       *
       * `emissive` bringt Licht, `color` bringt Zeichnung. Bei 0.20
       * war die Körperfarbe fast nicht da: Was nicht von selbst
       * leuchtete, war schwarz — und schwarz auf hellem Grund ist eine
       * Silhouette ohne Binnenzeichnung. Genau die Flächen, in denen
       * die Textur der Datei ihre Feinheiten trägt, waren dadurch
       * leer.
       *
       * Bei 0.55 nehmen dieselben Flächen das Szenenlicht an und
       * zeigen, was auf ihnen steht. Der Farbton ändert sich nicht —
       * es ist derselbe Ton aus derselben Staffel, nur nicht mehr
       * fast auf Null multipliziert.
       */
      const koerperfaktor = 0.55;

      modell.traverse((teil) => {
        if (!(teil instanceof Mesh)) return;
        const liste = Array.isArray(teil.material) ? teil.material : [teil.material];
        const neu = liste.map((m) => {
          const kopie = (m as MeshStandardMaterial).clone() as MeshStandardMaterial;

          /* Wie hell war dieses Material ursprünglich? Das entscheidet
             über seinen Platz in der Farbstaffel. */
          const quelle = kopie.emissive ?? kopie.color;
          const lage = quelle
            ? Math.min(1, Math.max(0, (quelle.r + quelle.g + quelle.b) / 3))
            : 0.5;

          schichten.push({ stoff: kopie, lage });

          if (kopie.emissive) {
            /*
             * Gestaucht, nicht skaliert.
             *
             * Die elf Materialien tragen Leuchtstärken zwischen 2 und
             * 25. Multipliziert man sie alle mit demselben Faktor,
             * bleibt der Abstand — und die oberen brennen weiterhin
             * weiss aus, weil alles über 1.0 im Bild dasselbe Weiss
             * ist. Genau dort verschwanden die Ringe.
             *
             * Der Logarithmus staucht 2 bis 25 auf etwa 1,0 bis 2,0:
             * Die Reihenfolge der Schichten bleibt erhalten, aber
             * keine liegt mehr so weit oben, dass sie ihre eigene
             * Zeichnung überstrahlt.
             */
            const roh = kopie.emissiveIntensity ?? 1;
            kopie.emissiveIntensity = 0.45 + Math.log1p(roh) * 0.48;
          }
          return kopie;
        });
        teil.material = neu.length === 1 ? neu[0]! : neu;
      });

      /*
       * Einfärben — und zwar jederzeit wieder.
       *
       * Die Staffel steckte früher fest im Aufbau. Das reichte, solange
       * beide Darstellungen denselben Kern trugen; seit Hell orange und
       * Dunkel blau ist, muss ein Wechsel der Darstellung ankommen,
       * ohne die Szene neu aufzubauen — ein Neuaufbau hiesse Modell
       * neu laden, und das sieht man.
       *
       * Deshalb liegt hier nur noch die Farbe. Leuchtstärke, Einpassung
       * und Bewegung bleiben, wo sie sind: Sie hängen nicht am Modus.
       */
      const tonspeicher = new Color();
      function einfaerben(dunkel: boolean) {
        const namen = dunkel ? STAFFEL_DUNKEL : STAFFEL_HELL;
        const licht = dunkel ? LICHTER_DUNKEL : LICHTER_HELL;
        gegenlicht.color.setHex(licht.gegen);
        aufheller.color.setHex(licht.auf);

        const staffel = namen.map((n) => new Color(n));
        for (const { stoff, lage } of schichten) {
          const platz = lage * (staffel.length - 1);
          const unten = Math.min(staffel.length - 2, Math.floor(platz));
          const ton = tonspeicher
            .copy(staffel[unten]!)
            .lerp(staffel[unten + 1]!, platz - unten);

          /*
           * Spitzlichter nur in den obersten zwei Prozent, und
           * schwach. Bei 0,95 und Faktor 1,4 wurden aus „ein paar
           * Kanten leuchten" flächige weisse Zonen — auf hellem Grund
           * verschwindet dort jede Zeichnung.
           */
          if (lage > 0.98) ton.lerp(WEISS, (lage - 0.98) * 0.9);

          if (stoff.color) stoff.color.copy(ton).multiplyScalar(koerperfaktor);
          if (stoff.emissive) stoff.emissive.copy(ton);
        }
      }

      einfaerben(istDunkel());

      /*
       * Zwei Wege führen zu einem Wechsel, und beide müssen hier
       * ankommen:
       *
       *   **Der Schalter** setzt `data-theme` am Wurzelelement. Das
       *   sieht kein Medienereignis — dafür braucht es den Beobachter.
       *
       *   **Das Gerät** wechselt, während „System" gewählt ist. Davon
       *   weiss das Attribut nichts, denn es steht dann gar nicht da.
       *
       * Wer nur einen der beiden hört, hat einen Core, der beim
       * Umschalten in der alten Farbe stehen bleibt — bis zum nächsten
       * Seitenaufbau, und damit genau so lange, wie es auffällt.
       */
      const nachfuehren = () => einfaerben(istDunkel());

      const modusBeobachter = new MutationObserver(nachfuehren);
      modusBeobachter.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      aufräumen.push(() => modusBeobachter.disconnect());

      const geraet = window.matchMedia("(prefers-color-scheme: dark)");
      geraet.addEventListener("change", nachfuehren);
      aufräumen.push(() => geraet.removeEventListener("change", nachfuehren));

      /*
       * Automatisches Einpassen.
       *
       * Feste Werte hätten geraten, wie groß die Datei modelliert ist —
       * und das war beim ersten Versuch daneben: Monday saß als winziger
       * Punkt am Rand. Der Begrenzungsquader kommt aus der Datei, also
       * stimmt es für jedes Modell.
       */
      const box = new Box3().setFromObject(modell);
      const größe = box.getSize(new Vector3());
      const mitte = box.getCenter(new Vector3());
      const längsteKante = Math.max(größe.x, größe.y, größe.z) || 1;

      const wurzel = new Group();
      modell.position.copy(mitte).multiplyScalar(-1);
      wurzel.add(modell);
      /*
       * Eingepasst wird der Körper, nicht der Begrenzungsquader.
       *
       * Das war der Grund, warum der Core immer zu klein wirkte,
       * obwohl die Fläche gross war. Der Quader misst die Datei mit
       * allem, was in ihr steckt — und darin sind zwei fast flache
       * Spiralen mit 3,34 und 3,31 Einheiten Ausdehnung, während der
       * eigentliche Körper nur 2,32 misst (gemessen an den
       * POSITION-Accessoren der Datei).
       *
       * Auf die längste Kante eingepasst füllte der Körper also nur
       * 2,32 von 3,34 — knapp siebzig Prozent. Der Rest war Luft, die
       * zwei dünne Linien für sich beanspruchten.
       *
       * Der Faktor bezieht sich deshalb auf die KÜRZESTE der drei
       * Kantenlängen. Ausreisser sind fast immer flach — eine Spirale,
       * ein Bogen, eine Scheibe —, und flach heisst: Sie blähen eine
       * oder zwei Achsen auf, nie alle drei. Die kürzeste Achse ist
       * damit diejenige, die noch den Körper misst. Bei einer Datei
       * ohne Ausreisser sind alle drei ähnlich gross, und die Formel
       * bleibt richtig; sie ist nicht auf diese eine Datei gemünzt.
       *
       * Die Spitzen der Spiralen laufen dadurch je nach Drehstellung
       * über den Rand. Das ist der bewusste Tausch: zwei dünne, blasse
       * Enden, die kurz anschneiden, gegen einen Körper, der die
       * Fläche wirklich füllt.
       */
      const kanten = [größe.x, größe.y, größe.z].sort((a, b) => a - b);
      const körpermaß = kanten[0] || längsteKante;
      const einpassung = 1.9 / körpermaß;
      wurzel.scale.setScalar(einpassung);
      szene.add(wurzel);

      const kamera = new PerspectiveCamera(32, 1, 0.1, 100);
      kamera.position.set(0, 0.15, 3.4);
      kamera.lookAt(0, 0, 0);

      renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      /*
       * Die Auflösung richtet sich nach der Fläche, nicht nach einem
       * festen Deckel.
       *
       * Hier stand `min(devicePixelRatio, 1.5)` mit der Begründung, ein
       * Bild von 180 Pixeln brauche nicht mehr. Das stimmte, solange
       * Monday 180 Pixel gross war. Auf der Startseite ist sie jetzt
       * dreimal so gross — und bei 1.5 sah man von den Ringen,
       * Partikeln und Spiralen im Inneren nur noch Matsch.
       *
       * Ab 240 Pixeln Kantenlänge wird deshalb die volle Gerätedichte
       * genutzt.
       *
       * Die Schwelle lag bei 240, und darunter galt 1.5 — auch für
       * einen Kern von 120 Pixeln. Das war zu grob: Bei 1.5 zerfallen
       * die Ringe im Inneren zu Streifen, und zwar sichtbar, weil der
       * Kern im Gespräch neben Text steht, der gestochen scharf ist.
       *
       * Die Rechnung dahinter: 3.5 auf einer Fläche von 120 Pixeln
       * sind 420 mal 420 Bildpunkte. Das ist weniger als ein Sechstel
       * dessen, was die Startseite ohnehin zeichnet. Der sparsame
       * Wert bleibt deshalb nur für wirklich winzige Flächen, wo man
       * den Unterschied nicht sieht.
       */
      const kante = Math.max(el.clientWidth, el.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio * 2, kante >= 96 ? 3.5 : 1.5));
      renderer.outputColorSpace = SRGBColorSpace;
      /*
       * Keine Tonwertkorrektur — bewusst.
       *
       * ACES Filmic ist die richtige Wahl für Szenen mit echtem Licht:
       * es rollt Spitzlichter weich ab, statt sie hart abzuschneiden.
       * Genau das ist hier falsch. Mondays elf Materialien tragen kein
       * Licht, sie SIND Licht — `emissiveStrength` zwischen 2 und 25,
       * alle im Blend-Modus. ACES hat diese Werte zusammengedrückt, und
       * übrig blieb ein grauer Schleier: gemessen 80,80,80 bei 32%
       * Deckkraft, wo Weiss stehen sollte.
       */
      renderer.toneMappingExposure = 1;
      renderer.setClearAlpha(0);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.setAttribute("aria-hidden", "true");
      el.appendChild(renderer.domElement);

      const anim = new NinaAnimation(modell, gltf.clips);
      anim.setzeZustand(zustand.current, true);
      animation.current = anim;

      const aktuellerRenderer = renderer;
      function anpassen() {
        const w = el!.clientWidth;
        const h = el!.clientHeight;
        if (w === 0 || h === 0) return;
        aktuellerRenderer.setSize(w, h, false);
        kamera.aspect = w / h;
        kamera.updateProjectionMatrix();
      }
      anpassen();
      beobachter = new ResizeObserver(anpassen);
      beobachter.observe(el);

      /*
       * Die Maus neigt den Blick, nicht das Objekt.
       *
       * Wird das Modell geneigt, dreht sich auch sein Verhältnis zum
       * Licht mit, und die Plastizität geht verloren. Wandert
       * stattdessen die Kamera, bleibt die Beleuchtung stehen und die
       * Schichten verschieben sich gegeneinander — dieselbe Parallaxe,
       * die man beim Kopfneigen vor einem echten Gegenstand sieht.
       *
       * Am Behälter abgegriffen, nicht am Fenster: Am Fenster
       * reagierte jeder Core auf der Seite auf jede Mausbewegung
       * irgendwo — vier Mondays, die sich gemeinsam einer Bewegung
       * zuwenden, die keine von ihnen betrifft.
       */
      let zeigerX = 0;
      let zeigerY = 0;
      function zeiger(ev: PointerEvent) {
        const r = el!.getBoundingClientRect();
        zeigerX = ((ev.clientX - r.left) / r.width) * 2 - 1;
        zeigerY = ((ev.clientY - r.top) / r.height) * 2 - 1;
      }
      function zeigerWeg() {
        zeigerX = 0;
        zeigerY = 0;
      }
      /* Bei `prefers-reduced-motion` gar nicht erst anmelden: Eine
         Kamerafahrt, die dem Zeiger folgt, ist Bewegung — auch eine
         kleine. */
      if (!reducedMotion) {
        el.addEventListener("pointermove", zeiger);
        el.addEventListener("pointerleave", zeigerWeg);
        aufräumen.push(() => {
          el.removeEventListener("pointermove", zeiger);
          el.removeEventListener("pointerleave", zeigerWeg);
        });
      }

      let letzterZustand = zustand.current;
      let letzteZeit = 0;
      let laufzeit = 0;
      /* Weich nachgeführte Kameraposition — der Rohwert des Zeigers
         springt mit jedem Ereignis. */
      let blickX = 0;
      let blickY = 0;

      /*
       * Die Zeit kommt aus `requestAnimationFrame` selbst.
       *
       * three.js hat dafür `Clock`, aber das ist seit 0.185 als
       * überholt markiert und meldet sich bei jedem Laden in der
       * Konsole. Ein Ersatz lohnt keine weitere Abhängigkeit: rAF
       * übergibt den Zeitstempel ohnehin als Argument, und die
       * Differenz zweier Zeitstempel ist genau das, was der Mischer
       * braucht.
       */
      function bild(jetzt: number) {
        if (abgebrochen) return;
        bildAnforderung = requestAnimationFrame(bild);

        if (letzterZustand !== zustand.current) {
          anim.setzeZustand(zustand.current);
          letzterZustand = zustand.current;
        }

        /*
         * Der Sprung nach der Pause.
         *
         * Im Hintergrundtab hält der Browser rAF an. Beim Zurückkehren
         * wäre die Differenz je nach Abwesenheit Minuten — die
         * Animation ruckte dann einmal quer durch den Clip. Ein Deckel
         * bei einem Zwanzigstel macht daraus ein Bild Stillstand, das
         * niemand sieht.
         */
        const delta = letzteZeit === 0 ? 0 : Math.min((jetzt - letzteZeit) / 1000, 0.05);
        letzteZeit = jetzt;
        laufzeit += delta;

        anim.tick(delta);

        if (!reducedMotion) {
          /*
           * Eigendrehung um die geneigte Achse.
           *
           * Die Drehung gehört ins Modell, nicht auf den Container —
           * sonst dreht sich auch das Licht mit und die Plastizität
           * geht verloren.
           *
           * Die Neigung steht fest bei rund 14 Grad: Eine Kugel, die
           * exakt um die Senkrechte kreist, sieht aus wie ein Standbild
           * mit laufender Textur. Geneigt wandern die Ringe sichtbar
           * durch die Ansicht.
           *
           * 0.22 statt 0.45: Bei 0.45 lief der Körper in vierzehn
           * Sekunden einmal herum, und das Auge folgte der Drehung
           * statt dem Objekt. Bei 0.22 sind es knapp dreissig
           * Sekunden — man sieht, dass es sich bewegt, ohne dass es
           * einen Takt vorgibt.
           */
          wurzel.rotation.z = 0.24;
          wurzel.rotation.y += delta * 0.22;

          /*
           * Zwei Bewegungen, die Tiefe zeigen statt sie zu behaupten.
           *
           * **Atmen.** Der Körper rückt um anderthalb Prozent näher
           * und wieder weg. Das ist zu wenig, um als Grössenänderung
           * aufzufallen, aber genug, dass die vorderen Schichten sich
           * stärker verschieben als die hinteren — und dieser
           * Unterschied ist die Tiefeninformation.
           *
           * **Kreisen.** Die Kamera beschreibt eine sehr flache
           * Ellipse um die Blickachse, eine Umrundung in etwa fünfzig
           * Sekunden. Dadurch wandern nahe und ferne Teile
           * unterschiedlich schnell durchs Bild. Parallaxe ist der
           * stärkste Tiefenhinweis, den es gibt, und der einzige, den
           * ein Standbild grundsätzlich nicht haben kann.
           *
           * Beides ist bewusst so klein gewählt, dass man es nicht als
           * Bewegung wahrnimmt, sondern als Räumlichkeit.
           */
          const atem = 1 + Math.sin(laufzeit * 0.55) * 0.015;
          wurzel.scale.setScalar(einpassung * atem);

          blickX = blickX + (Math.sin(laufzeit * 0.13) * 0.12 + zeigerX * 0.1 - blickX) * 0.02;
          blickY = blickY + (Math.cos(laufzeit * 0.17) * 0.07 - zeigerY * 0.07 - blickY) * 0.02;
          kamera.position.set(blickX, 0.15 + blickY, 3.4);
          kamera.lookAt(0, 0, 0);
        }

        aktuellerRenderer.render(szene, kamera);
      }
      bildAnforderung = requestAnimationFrame(bild);
    })();

    return () => {
      abgebrochen = true;
      cancelAnimationFrame(bildAnforderung);
      beobachter?.disconnect();
      for (const f of aufräumen) f();
      animation.current?.entsorge();
      animation.current = null;
      /*
       * Den Grafikkontext ausdrücklich freigeben.
       *
       * Ein Browser erlaubt nur eine begrenzte Zahl gleichzeitiger
       * WebGL-Kontexte (oft 16). Wer beim Aufräumen keinen freigibt,
       * verliert nach einigen Seitenwechseln den ältesten — und dann
       * verschwindet Monday auf einer Seite, auf der sie eben noch war.
       */
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.parentNode?.removeChild(renderer.domElement);
        renderer = null;
      }
    };
    // `state` bewusst nicht in den Abhängigkeiten: der Wechsel läuft
    // über die Ref und die Bildschleife. Ein Neuaufbau der ganzen Szene
    // je Zustandswechsel wäre ein Neuladen des Modells.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, onError]);

  /*
   * `relative` ist hier der Unterschied zwischen sichtbar und nicht.
   *
   * Der Lichtverlauf hinter Monday ist `absolute` positioniert. Nach den
   * Malregeln von CSS kommt jedes positionierte Element über den nicht
   * positionierten Inhalt — unabhängig von der Reihenfolge im HTML.
   * Die Leinwand stand vorher ohne Positionierung da und lag damit
   * UNTER ihrem eigenen Hintergrund.
   *
   * Sichtbar war das Ergebnis als leerer violetter Kreis: die Szene
   * lief, zeichnete 24 Aufrufe und eine halbe Million Dreiecke pro
   * Bild, und niemand konnte es sehen.
   */
  return <div ref={behälter} className="relative h-full w-full" aria-hidden />;
}
