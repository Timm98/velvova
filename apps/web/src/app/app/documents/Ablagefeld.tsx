"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Unterlagen hochladen — anklicken oder hineinziehen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Fläche und kein Knopf
 * ══════════════════════════════════════════════════════════════
 *
 * Vorher gab es hier gar nichts: Unterlagen kamen nur über das
 * Gespräch herein. Wer auf „Dokumente" ging, um einen Lebenslauf
 * abzulegen, fand einen Verweis zurück in den Chat.
 *
 * Eine Fläche kann beides, was Menschen erwarten: Man klickt sie an
 * und bekommt den Dateiwähler, oder man zieht die Datei aus dem
 * Downloadordner darauf. Ein Knopf kann nur das erste — und
 * Hineinziehen ist die Bewegung, die man ohnehin macht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum derselbe Endpunkt wie im Gespräch
 * ══════════════════════════════════════════════════════════════
 *
 * `/api/nina/documents` prüft den Dateityp am INHALT statt an der
 * Endung, begrenzt die Grösse, erkennt dieselbe Datei am Hash wieder
 * und legt den Prüfstand für den Virenscan an.
 *
 * Ein eigener Weg für diese Seite müsste all das noch einmal können
 * — und beim ersten Unterschied wäre eine der beiden Türen die
 * schlechter gesicherte. Es gibt deshalb nur eine.
 *
 * Der Pfad heisst weiter `nina`, obwohl die Begleitung Monday heisst:
 * Es ist eine Schnittstelle, die nur Javascript aufruft. Sie
 * umzubenennen ändert nichts, was jemand sieht, und bricht jeden
 * laufenden Aufruf.
 */
export function Ablagefeld() {
  const router = useRouter();
  const feld = useRef<HTMLInputElement>(null);
  const [ueber, setUeber] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);

  async function schicken(dateien: FileList | null) {
    const datei = dateien?.[0];
    if (!datei || laeuft) return;

    setLaeuft(true);
    setMeldung(null);
    try {
      const form = new FormData();
      form.set("datei", datei);
      /*
       * `other` und `career_profile`: Die Art bestimmt hier niemand —
       * sie aus der Endung zu raten wäre eine Behauptung. Monday
       * ordnet sie beim Lesen ein.
       */
      form.set("art", "other");
      form.set("reichweite", "career_profile");

      const antwort = await fetch("/api/nina/documents", { method: "POST", body: form });
      const daten = (await antwort.json().catch(() => ({}))) as {
        fehler?: string;
        hinweis?: string;
        schonDa?: boolean;
      };

      if (!antwort.ok) {
        setMeldung({ art: "fehler", text: daten.fehler ?? "Das hat nicht geklappt." });
        return;
      }

      setMeldung({
        art: "ok",
        text: daten.schonDa ? (daten.hinweis ?? "Die Datei war schon da.") : `${datei.name} liegt jetzt hier.`,
      });
      /* Die Liste darunter kommt vom Server — sie muss neu geladen
         werden, sonst sieht man die eigene Datei nicht. */
      router.refresh();
    } catch {
      setMeldung({ art: "fehler", text: "Keine Verbindung. Versuch es gleich noch einmal." });
    } finally {
      setLaeuft(false);
      if (feld.current) feld.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      {/*
        `<label>` als Fläche: Der Klick landet ohne eine Zeile
        JavaScript im versteckten Feld, und die Tastatur erreicht das
        Feld weiterhin. Ein `<div onClick>` müsste beides nachbauen.
      */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setUeber(true);
        }}
        onDragLeave={() => setUeber(false)}
        onDrop={(e) => {
          e.preventDefault();
          setUeber(false);
          void schicken(e.dataTransfer.files);
        }}
        className={cn(
          "grid cursor-pointer place-items-center gap-2 rounded-(--radius-surface) border border-dashed px-6 py-10 text-center transition-colors",
          ueber ? "border-accent bg-accent-soft" : "border-line-3 hover:bg-soft",
          laeuft && "pointer-events-none opacity-60",
        )}
      >
        <Upload aria-hidden className="size-6 text-ink-3" strokeWidth={1.6} />
        <span className="text-sm text-ink">
          {laeuft ? "Wird hochgeladen …" : "Datei hierher ziehen oder klicken"}
        </span>
        <span className="text-2xs text-ink-3">
          Lebenslauf, Zeugnisse, Referenzen — PDF, Word oder Bild.
        </span>
        <input
          ref={feld}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
          className="sr-only"
          onChange={(e) => void schicken(e.target.files)}
        />
      </label>

      {meldung && (
        <p
          role={meldung.art === "fehler" ? "alert" : "status"}
          className={cn(
            "text-sm leading-relaxed",
            meldung.art === "fehler" ? "text-critical" : "text-ink-2",
          )}
        >
          {meldung.text}
        </p>
      )}
    </div>
  );
}
