"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bookmark, BookmarkCheck, FileText, MessageSquare, FlaskConical } from "lucide-react";
import { startApplication, toggleSaveJob } from "@/lib/jobActions";
import { Button } from "@/components/ui";
import { StelleAblegen } from "../StelleAblegen";

/**
 * Die Handlungen an einer Stelle.
 *
 * Eine primäre — Bewerbung vorbereiten — und daneben die leiseren.
 * "Vorbereiten" legt eine Bewerbung im Zustand "In Vorbereitung" an.
 * Versendet wird dabei nichts; das geschieht ausschließlich nach einer
 * ausdrücklichen Bestätigung im Studio.
 */
export function JobActions({
  jobId,
  blocked,
  initiallySaved = false,
  labels,
}: {
  jobId: string;
  blocked: boolean;
  initiallySaved?: boolean;
  labels: Record<"prepare" | "save" | "saved" | "discuss", string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(initiallySaved);

  return (
    <div className="grid gap-2.5">
      <Button
        type="button"
        variant="primary"
        full
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const id = await startApplication(jobId);
            router.push(`/app/applications/${id}`);
          })
        }
      >
        <FileText className="size-4" strokeWidth={1.9} />
        {pending ? "Wird vorbereitet …" : labels.prepare}
      </Button>

      {/*
        Untereinander, sobald es eng wird.
        
        Zwei feste Spalten in einer 320 Pixel breiten Seitenspalte
        ergaben zwei Knöpfe zu je 150 Pixeln — „Mit Nina besprechen"
        braucht mehr und lief über den Nachbarn. Ein Raster mit
        Mindestbreite bricht stattdessen um.
      */}
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
        <Button
          type="button"
          variant="secondary"
          aria-pressed={saved}
          disabled={pending}
          onClick={() => {
            setSaved((v) => !v);
            startTransition(async () => {
              const r = await toggleSaveJob(jobId);
              setSaved(r.saved);
            });
          }}
        >
          {saved ? (
            <BookmarkCheck className="size-4 text-accent" strokeWidth={2} />
          ) : (
            <Bookmark className="size-4" strokeWidth={1.9} />
          )}
          {saved ? labels.saved : labels.save}
        </Button>

        {/*
          Zum Job-Chat auf DIESER Seite, nicht zur Hauptseite.
          
          Der Knopf führte nach /app/nina und liess die Stelle hinter
          sich — mit einem leeren Gespräch als Ergebnis. Jetzt springt
          er zum Fragenblock weiter unten, der an diese Stelle gebunden
          ist.
        */}
        <Button asChild variant="secondary">
          <a href="#nina-fragen">
            <MessageSquare className="size-4" strokeWidth={1.9} />
            {labels.discuss}
          </a>
        </Button>

        {/*
          Diese Stelle ausprobieren — nicht irgendeine Arbeit.

          Die Adresse trägt die Stellenkennung, und die Aufgabe kommt
          aus dem Berufsfeld DIESER Anzeige. Vorher gab es nur
          `/app/proben`, wo sich die Aufgabe nach dem letzten
          Bewerbungsereignis richtete — und wer noch keines hatte,
          bekam irgendeine. So kam die Warmwasser-Aufgabe zur
          Lieferfahrer-Stelle.
        */}
        <Button asChild variant="secondary">
          <a href={`/app/jobs/${jobId}/probe`}>
            <FlaskConical className="size-4" strokeWidth={1.9} />
            Job ausprobieren
          </a>
        </Button>
      </div>

      {/*
        Der direkte Weg zur Übergabe.
        
        Das Studio schreibt die Unterlagen; diese Seite zeigt die
        Checkliste und öffnet die Originalanzeige. Wer schon weiss, dass
        er sich bewerben will, braucht den Umweg nicht — und wer aus dem
        Studio kommt, landet ohnehin hier.
      */}
      <a
        href={`/app/jobs/${jobId}/apply`}
        className="inline-flex min-h-6 items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
      >
        <ArrowUpRight className="size-3.5" strokeWidth={1.9} />
        Was für die Bewerbung gebraucht wird
      </a>

      {/*
        Ablegen steht unter den Handlungen, nicht neben ihnen.
        
        „Passt nicht" ist keine gleichrangige Alternative zu „Bewerbung
        vorbereiten" — es ist der Ausweg. Als vierter Knopf im Raster
        stünde es optisch auf einer Stufe mit dem Ziel der Seite.
      */}
      <StelleAblegen jobId={jobId} />

      {blocked && (
        <p className="text-sm leading-relaxed text-ink-2">
          Diese Stelle widerspricht einer deiner harten Bedingungen. Du kannst dich trotzdem
          bewerben — die Entscheidung liegt bei dir, nicht bei uns.
        </p>
      )}
    </div>
  );
}
