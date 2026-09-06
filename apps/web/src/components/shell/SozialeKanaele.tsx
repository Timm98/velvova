import { AUSSENVERWEISE } from "@paycheck/config";

/**
 * Die sozialen Kanäle ganz unten im Fuss.
 *
 * ── Warum nur die echten ──────────────────────────────────────
 *
 * Gezeigt wird ein Abzeichen nur, wenn in `AUSSENVERWEISE.social`
 * eine Adresse steht. Fünf Symbole, von denen drei ins Leere führen,
 * sind die billigste Art, grösser auszusehen als man ist — und wer
 * einmal darauf geklickt hat, rechnet danach damit, dass auch der
 * Rest der Seite so gemeint ist.
 *
 * Steht nirgends eine Adresse, erscheint die Leiste gar nicht. Sie
 * füllt sich von selbst, sobald die Konten bestehen.
 */

/*
 * Alle fünf Zeichen selbst gezeichnet.
 *
 * Die Symbolsammlung des Projekts (lucide) hat ihre Markenzeichen
 * entfernt — `Instagram`, `Facebook`, `Linkedin` und `Youtube` gibt es
 * dort nicht mehr. Vier davon aus einer zweiten Bibliothek zu holen
 * hiesse, für fünf Symbole eine ganze Abhängigkeit mitzuschleppen und
 * dabei zwei verschiedene Strichstärken im selben Bild zu haben.
 *
 * Deshalb Flächen statt Striche: alle fünf als gefüllte Pfade in einem
 * 24er-Raster, damit sie als Gruppe gleich schwer wirken.
 */
function Instagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.98c-3.15 0-3.52.01-4.76.07-1.15.05-1.77.24-2.19.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.42-.35 1.04-.4 2.19-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.05 1.15.24 1.77.4 2.19.22.55.47.94.88 1.35.41.41.8.66 1.35.88.42.16 1.04.35 2.19.4 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c1.15-.05 1.77-.24 2.19-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.42.35-1.04.4-2.19.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.05-1.15-.24-1.77-.4-2.19a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.42-.16-1.04-.35-2.19-.4-1.24-.06-1.61-.07-4.76-.07Zm0 3.37a5.49 5.49 0 1 1 0 10.98 5.49 5.49 0 0 1 0-10.98Zm0 9.05a3.56 3.56 0 1 0 0-7.12 3.56 3.56 0 0 0 0 7.12Zm6.99-9.27a1.28 1.28 0 1 1-2.57 0 1.28 1.28 0 0 1 2.57 0Z" />
    </svg>
  );
}

function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function Linkedin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M6.94 4.5a2.19 2.19 0 1 1-4.38 0 2.19 2.19 0 0 1 4.38 0ZM3 8.4h3.86V21H3V8.4Zm6.36 0h3.7v1.72h.05c.52-.94 1.78-1.93 3.66-1.93 3.91 0 4.63 2.44 4.63 5.61V21h-3.86v-5.85c0-1.4-.03-3.2-2-3.2-2 0-2.31 1.52-2.31 3.1V21H9.36V8.4Z" />
    </svg>
  );
}

function Youtube({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M21.58 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.43A2.5 2.5 0 0 0 2.42 7.2C2 8.78 2 12 2 12s0 3.22.42 4.8a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.43a2.5 2.5 0 0 0 1.76-1.77C22 15.22 22 12 22 12s0-3.22-.42-4.8ZM10 15.02V8.98L15.2 12 10 15.02Z" />
    </svg>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64Z" />
    </svg>
  );
}

const ZEICHEN = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  x: X,
} as const;

export function SozialeKanaele() {
  const kanaele = AUSSENVERWEISE.social.filter(
    (k): k is { netz: keyof typeof ZEICHEN; name: string; url: string } => Boolean(k.url),
  );
  if (kanaele.length === 0) return null;

  return (
    <ul className="flex items-center gap-2">
      {kanaele.map((k) => {
        const Zeichen = ZEICHEN[k.netz];
        return (
          <li key={k.netz}>
            <a
              href={k.url}
              /*
                `noopener` gegen den Zugriff der Zielseite auf unser
                Fenster, `noreferrer` weil ein fremdes Netzwerk nicht
                erfahren muss, von welcher Unterseite jemand kam.
              */
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${k.name} — öffnet in neuem Tab`}
              className="grid size-10 place-items-center rounded-(--radius-md) border border-line text-ink-2 transition-colors hover:border-accent/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Zeichen className="size-[18px]" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
