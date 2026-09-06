"use client";

import { useState, useTransition } from "react";
import { Button, Textarea } from "@/components/ui";
import { saveNotes } from "@/lib/studio";

/**
 * Notizen zu einer Bewerbung.
 *
 * ── Was hier gefehlt hat ──────────────────────────────────────
 *
 * Die Seite zeigte „Noch keine Notizen." — und es gab keinen Weg,
 * welche zu schreiben. `saveNotes` stand fertig im Code, ohne
 * Aufrufer. Ein leerer Zustand ohne Eingabe ist keine Leere, sondern
 * eine Sackgasse.
 *
 * ── Warum das gerade hier zählt ───────────────────────────────
 *
 * Was im Telefonat gesagt wurde, wer zurückrufen wollte, welche Zahl
 * genannt wurde — das ist genau der Stoff, aus dem später eine
 * Zusagenprüfung oder ein Widerspruch entsteht. Ohne Notizfeld bleibt
 * er im Kopf und ist nach zwei Wochen weg.
 */
export function Notizen({ applicationId, anfang }: { applicationId: string; anfang: string }) {
  const [text, setText] = useState(anfang);
  const [gespeichert, setGespeichert] = useState(anfang);
  const [laeuft, starten] = useTransition();

  const geaendert = text !== gespeichert;

  return (
    <div className="grid gap-2.5">
      <label htmlFor="notizen" className="sr-only">
        Notizen zu dieser Bewerbung
      </label>
      <Textarea
        id="notizen"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Was im Gespräch gesagt wurde. Wer sich melden wollte. Welche Zahl genannt wurde."
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={laeuft || !geaendert}
          onClick={() =>
            starten(async () => {
              await saveNotes(applicationId, text);
              setGespeichert(text);
            })
          }
        >
          {/*
            * „Notiz speichern", nicht „Speichern".
            *
            * Auf derselben Seite steht bereits der Speichern-Knopf des
            * Studios. Zwei Knöpfe mit demselben Namen sind für jemanden
            * am Bildschirm noch unterscheidbar — über die Nähe zum
            * Feld. Wer die Seite vorgelesen bekommt, hört zweimal
            * dasselbe Wort und muss raten.
            *
            * Aufgefallen ist es, weil die eigene Testreihe daran
            * scheiterte: „resolved to 2 elements".
            */}
          Notiz speichern
        </Button>
        {/*
          * Der Zustand steht als Text da, nicht als Farbe.
          *
          * „Nicht gespeichert" ist die Auskunft, die man braucht, bevor
          * man den Tab schliesst — ein blasser Knopf sagt das nicht.
          */}
        <span className="text-2xs text-ink-3">
          {geaendert ? "nicht gespeichert" : gespeichert ? "gespeichert" : ""}
        </span>
      </div>
    </div>
  );
}
