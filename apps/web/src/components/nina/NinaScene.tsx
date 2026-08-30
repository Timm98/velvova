"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import type { AnimationAction, Group } from "three";
import type { NinaVisualState } from "./NinaProvider";

/**
 * Nina in drei Dimensionen.
 *
 * Die Datei enthält genau drei Animationen — nachgesehen, nicht geraten:
 *
 *   CALM      35 Kanäle
 *   Talking   35 Kanäle
 *   Thinking  27 Kanäle
 *
 * Kein Skelett, keine Kamera, keine Lichter. Die Bewegungen sind
 * Objekttransformationen; alle elf Materialien sind emissiv und tragen
 * ihre eigene Textur. Deshalb genügt sehr wenig Umgebungslicht — mehr
 * würde die Eigenleuchtkraft nur überstrahlen.
 *
 * Sechs Produktzustände treffen auf drei Clips. Das Mapping ist
 * absichtlich sparsam: wo es keinen eigenen Clip gibt, läuft CALM. Eine
 * erfundene Ersatzanimation wäre eine Aussage über einen Zustand, den
 * das Modell nicht darstellt.
 */

const MODELL = "/models/nina.glb";

/** Zustand → Clipname. Die Namen stammen aus der Datei. */
const CLIP: Record<NinaVisualState, "CALM" | "Talking" | "Thinking"> = {
  idle: "CALM",
  thinking: "Thinking",
  talking: "Talking",
  // Kein eigener Listening-Clip vorhanden. CALM plus der pulsierende
  // Ring außen herum trägt den Zustand — siehe NinaVisual.
  listening: "CALM",
  success: "CALM",
  error: "CALM",
};

const ÜBERBLENDUNG = 0.28;

function Modell({ state, reducedMotion }: { state: NinaVisualState; reducedMotion: boolean }) {
  const gruppe = useRef<Group>(null);
  const { scene, animations } = useGLTF(MODELL);
  const { actions } = useAnimations(animations, gruppe);
  const laufend = useRef<AnimationAction | null>(null);

  /*
   * Die Szene wird geklont — aber nur einmal.
   *
   * `useGLTF` gibt allen Verbrauchern dieselbe Szene. Zwei Nina-Bilder
   * gleichzeitig (Gesprächsseite und Drawer) würden sich sonst
   * dieselben Objekte teilen und gegenseitig verschieben.
   */
  const kopie = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const ziel = actions[CLIP[state]];
    if (!ziel) return;
    if (laufend.current === ziel) return;

    /*
     * Überblenden, nicht umschalten.
     *
     * Ein harter Wechsel springt sichtbar — die Figur steht in einer
     * anderen Haltung, sobald Nina zu denken anfängt. Beide Aktionen
     * laufen für einen Moment gleichzeitig, die alte verstummt.
     */
    const vorher = laufend.current;
    ziel.reset().setEffectiveWeight(1).fadeIn(reducedMotion ? 0 : ÜBERBLENDUNG).play();
    vorher?.fadeOut(reducedMotion ? 0 : ÜBERBLENDUNG);
    laufend.current = ziel;
  }, [actions, state, reducedMotion]);

  /*
   * Das Modell auf den Bildausschnitt einpassen.
   *
   * Fest verdrahtete Werte für Größe und Position hätten geraten, wie
   * groß die Datei modelliert ist — und das war beim ersten Versuch
   * daneben: Nina saß winzig am linken Rand. Der Begrenzungsquader
   * kommt aus der Datei selbst, also stimmt es für jedes Modell.
   */
  const einpassung = useMemo(() => {
    const box = new Box3().setFromObject(kopie);
    const größe = box.getSize(new Vector3());
    const mitte = box.getCenter(new Vector3());
    const längsteKante = Math.max(größe.x, größe.y, größe.z) || 1;
    return {
      // 2.6 Welteinheiten füllen den Lichtkreis bei fov 32 und Abstand
      // 3.4 gut aus. Bei 2.0 saß Nina als kleiner Punkt in einer großen
      // leeren Fläche — der Schein war größer als sie.
      skalierung: 2.6 / längsteKante,
      versatz: mitte.multiplyScalar(-1),
    };
  }, [kopie]);

  /*
   * Eine sehr langsame Eigendrehung.
   *
   * `useFrame` statt einer CSS-Animation: die Drehung gehört ins Modell,
   * nicht auf den Container — sonst dreht sich auch das Licht dahinter.
   * Bei reduzierter Bewegung steht sie still.
   */
  useFrame((_, delta) => {
    if (reducedMotion || !gruppe.current) return;
    gruppe.current.rotation.y += delta * 0.12;
  });

  return (
    <group ref={gruppe} dispose={null} scale={einpassung.skalierung}>
      <primitive object={kopie} position={einpassung.versatz} />
    </group>
  );
}

/**
 * Die Leinwand.
 *
 * `dpr={[1, 1.5]}` statt der Gerätedichte: auf einem Retina-Bildschirm
 * wären das vier- statt 2,25-mal so viele Pixel für ein Bild, das 180
 * Pixel hoch ist. Der Unterschied ist nicht zu sehen, die Rechenlast
 * schon.
 */
export function NinaScene({
  state,
  reducedMotion = false,
}: {
  state: NinaVisualState;
  reducedMotion?: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      /*
       * Tone Mapping aus.
       *
       * Die Voreinstellung (ACESFilmic) komprimiert Helligkeiten für
       * fotorealistische Szenen. Hier führt sie dazu, dass eine
       * 25-fache Emission zu mattem Grau wird — das Modell soll aber
       * leuchten. `NoToneMapping` gibt die Werte durch, wie sie
       * modelliert sind.
       */
      flat
      camera={{ position: [0, 0.2, 3.4], fov: 32 }}
      /* Kein Bildlauf-Fänger: das Modell ist Dekoration und darf die
         Seite nicht am Scrollen hindern. */
      style={{ pointerEvents: "none", background: "transparent" }}
      /* Nur zeichnen, wenn sich etwas ändert, wäre hier falsch — die
         Animationen laufen dauerhaft. Stattdessen begrenzen wir die
         Auflösung und verzichten auf Schatten und Nachbearbeitung. */
      shadows={false}
      frameloop={reducedMotion ? "demand" : "always"}
    >
      {/*
       * Sehr wenig Licht — mit Absicht.
       *
       * Alle elf Materialien sind emissiv und tragen ihre eigene
       * Textur; sie leuchten aus sich heraus. Der erste Versuch stand
       * bei Intensität 1.4 plus Richtungslicht, und Nina war ein
       * weißer Fleck: das Szenenlicht hat die Eigenleuchtkraft
       * überstrahlt. Ein Hauch genügt, damit die wenigen
       * nicht-emissiven Kanten nicht schwarz sind.
       */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[2, 3, 4]} intensity={0.15} />
      <Suspense fallback={null}>
        <Modell state={state} reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}

/*
 * Einmal vorladen.
 *
 * 12,4 MB. Ohne das lädt jede Stelle, an der Nina auftaucht, erneut —
 * und die erste Anzeige wäre jedes Mal leer. `useGLTF` hält den Cache
 * über alle Verbraucher hinweg.
 */
useGLTF.preload(MODELL);
