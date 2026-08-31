"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bookmark, BookmarkCheck, FileText, MessageSquare } from "lucide-react";
import { startApplication, toggleSaveJob } from "@/lib/jobActions";
import { Button } from "@/components/ui";

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

      <div className="grid grid-cols-2 gap-2.5">
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

      {blocked && (
        <p className="text-sm leading-relaxed text-ink-2">
          Diese Stelle widerspricht einer deiner harten Bedingungen. Du kannst dich trotzdem
          bewerben — die Entscheidung liegt bei dir, nicht bei uns.
        </p>
      )}
    </div>
  );
}
