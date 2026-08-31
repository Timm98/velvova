"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
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
 * Nina in drei Dimensionen — mit three.js allein.
 *
 * Vorher liefen hier `@react-three/fiber` und `@react-three/drei`. Für
 * eine Szene aus genau einem Modell ohne Interaktion war das der
 * falsche Zuschnitt:
 *
 *   **937 KB in einem Chunk.** Der größte Teil davon Code, den diese
 *   Szene nie benutzt — Physik, Gesichtserkennung, Draco- und
 *   Basis-Dekoder.
 *
 *   **Ein WebAssembly-Verstoß gegen die eigene CSP.** Drei versucht
 *   Dekoder zu laden, die unsere Datei gar nicht braucht: sie ist nicht
 *   komprimiert. Die Wahl stand zwischen „WASM erlauben, obwohl wir es
 *   nicht brauchen" und „nicht laden, was wir nicht brauchen".
 *
 *   **Ein React-Reconciler für eine Endlosschleife.** Die Animation
 *   läuft in `requestAnimationFrame`; React muss davon nichts wissen.
 *
 * Was bleibt: der Loader, ein Mischer, eine Schleife.
 */

const MODELL = "/models/nina.glb";

/*
 * Ein Zwischenspeicher über alle Verbraucher.
 *
 * Die Datei ist 12,4 MB. Gesprächsseite und Drawer zeigen Nina
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
       * Sehr wenig Licht — mit Absicht.
       *
       * Alle elf Materialien sind emissiv und tragen ihre eigene
       * Textur; sie leuchten aus sich heraus. Mit Umgebungslicht 1.4
       * war Nina ein weißer Fleck: das Szenenlicht hat die
       * Eigenleuchtkraft überstrahlt. Ein Hauch genügt für die wenigen
       * nicht-emissiven Kanten.
       */
      szene.add(new AmbientLight(0xffffff, 0.3));
      const key = new DirectionalLight(0xffffff, 0.25);
      key.position.set(2, 3, 4);
      szene.add(key);

      // Jede Ansicht bekommt ihre eigene Kopie: zwei Nina-Bilder
      // gleichzeitig teilten sich sonst dieselben Objekte.
      const modell = gltf.scene.clone(true);

      /*
       * Automatisches Einpassen.
       *
       * Feste Werte hätten geraten, wie groß die Datei modelliert ist —
       * und das war beim ersten Versuch daneben: Nina saß als winziger
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
      wurzel.scale.setScalar(2.6 / längsteKante);
      szene.add(wurzel);

      const kamera = new PerspectiveCamera(32, 1, 0.1, 100);
      kamera.position.set(0, 0.15, 3.4);
      kamera.lookAt(0, 0, 0);

      renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      // Höchstens 1.5: auf einem Retina-Bildschirm wären es sonst vier
      // statt 2,25 mal so viele Pixel für ein Bild von 180 Pixeln.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = SRGBColorSpace;
      /*
       * Keine Tonwertkorrektur — bewusst.
       *
       * ACES Filmic ist die richtige Wahl für Szenen mit echtem Licht:
       * es rollt Spitzlichter weich ab, statt sie hart abzuschneiden.
       * Genau das ist hier falsch. Ninas elf Materialien tragen kein
       * Licht, sie SIND Licht — `emissiveStrength` zwischen 2 und 25,
       * alle im Blend-Modus. ACES hat diese Werte zusammengedrückt, und
       * übrig blieb ein grauer Schleier: gemessen 80,80,80 bei 32%
       * Deckkraft, wo Weiss stehen sollte.
       *
       * Linear durchgereicht kommt die Helligkeit an, die im Modell
       * steht. Dass sie über 1.0 hinausgeht, ist hier keine Panne,
       * sondern die Absicht des Modells.
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

      let letzterZustand = zustand.current;
      let letzteZeit = 0;

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
         * bei einem Zehntel macht daraus ein Bild Stillstand, das
         * niemand sieht.
         */
        const delta = letzteZeit === 0 ? 0 : Math.min((jetzt - letzteZeit) / 1000, 0.1);
        letzteZeit = jetzt;

        anim.tick(delta);
        // Die Eigendrehung gehört ins Modell, nicht auf den Container —
        // sonst dreht sich auch das Licht dahinter mit.
        if (!reducedMotion) wurzel.rotation.y += delta * 0.12;
        aktuellerRenderer.render(szene, kamera);
      }
      bildAnforderung = requestAnimationFrame(bild);
    })();

    return () => {
      abgebrochen = true;
      cancelAnimationFrame(bildAnforderung);
      beobachter?.disconnect();
      animation.current?.entsorge();
      animation.current = null;
      /*
       * Den Grafikkontext ausdrücklich freigeben.
       *
       * Ein Browser erlaubt nur eine begrenzte Zahl gleichzeitiger
       * WebGL-Kontexte (oft 16). Wer beim Aufräumen keinen freigibt,
       * verliert nach einigen Seitenwechseln den ältesten — und dann
       * verschwindet Nina auf einer Seite, auf der sie eben noch war.
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
   * Der Lichtverlauf hinter Nina ist `absolute` positioniert. Nach den
   * Malregeln von CSS kommt jedes positionierte Element über den
   * nicht positionierten Inhalt — unabhängig von der Reihenfolge im
   * HTML. Die Leinwand stand vorher ohne Positionierung da und lag
   * damit UNTER ihrem eigenen Hintergrund.
   *
   * Sichtbar war das Ergebnis als leerer violetter Kreis: die Szene
   * lief, zeichnete 24 Aufrufe und eine halbe Million Dreiecke pro
   * Bild, und niemand konnte es sehen.
   */
  return <div ref={behälter} className="relative h-full w-full" aria-hidden />;
}
