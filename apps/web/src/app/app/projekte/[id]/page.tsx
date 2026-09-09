import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, FileText, MessagesSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { projektLaden } from "@/lib/chancen/projekte";
import { freieStellen } from "@/lib/chancen/zuordnen";
import { StelleLoesen, Stellenzuordnung } from "@/components/chancen/Stellenzuordnung";
import { PageHeader } from "@/components/ui/states";

export const metadata: Metadata = { title: "Vorhaben" };
export const dynamic = "force-dynamic";

/**
 * Ein Vorhaben mit dem, was sich darin aufgebaut hat.
 *
 * ── Warum diese Seite existiert, bevor sie etwas zeigen kann ────
 *
 * Weil die Seitenleiste hierher verlinkt. Sie tat das bereits, ohne
 * dass es die Route gab — der erste Klick auf das erste Vorhaben wäre
 * ins Leere gegangen.
 *
 * Ein Link auf eine Seite, die es nicht gibt, ist schlimmer als eine
 * Seite, die noch wenig zeigt: Das eine sieht aus wie ein Fehler des
 * Menschen, das andere wie ein Anfang.
 *
 * ── Die Reihenfolge auf der Seite ist die Reihenfolge der Arbeit ─
 *
 * Erst das Gespräch, in dem das Vorhaben entstand. Dann die Stellen,
 * die daraus gemerkt wurden. Dann die Bewerbungen, die daraus
 * geworden sind. Genau so baut sich ein Vorhaben auf, und genau so
 * steht es hier — auch wenn die hinteren Abschnitte lange leer
 * bleiben.
 */
export default async function ProjektSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const projekt = await projektLaden(user.id, id);

  /*
   * `notFound()` und nicht eine eigene Meldung: Ob es das Vorhaben
   * nicht gibt oder ob es jemand anderem gehört, geht den Aufrufer
   * nichts an. Beides sieht von aussen gleich aus.
   */
  if (!projekt) notFound();

  const standtext: Record<string, string> = {
    aktiv: "läuft",
    ruht: "pausiert",
    abgeschlossen: "abgeschlossen",
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={standtext[projekt.status] ?? projekt.status}
        title={projekt.name}
      />

      <Abschnitt
        id="wunsch"
        icon={MessagesSquare}
        titel="Wunsch"
        zahl={projekt.gespraeche}
        leer="Zu diesem Vorhaben läuft noch kein Gespräch."
      >
        {/*
          Das Ziel steht IM Wunsch, nicht darüber.

          Vorher lag es als Absatz unter der Überschrift und gehörte
          zu nichts. Der Wunsch ist der Ort, an dem steht, worum es
          geht — und was Monday davon bisher verstanden hat.
        */}
        {projekt.ziel && (
          <p className="max-w-[var(--measure)] pb-3 text-[15px] leading-relaxed text-(--app-text)">
            {projekt.ziel}
          </p>
        )}
        {projekt.gespraeche > 0 && (
          <Link
            href="/app/monday"
            className="inline-flex min-h-11 items-center rounded-(--radius-control) border border-line px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Weiter mit Monday
          </Link>
        )}
      </Abschnitt>

      <Abschnitt
        icon={Briefcase}
        id="jobs"
        titel="Gemerkte Stellen"
        /* Bleibt auch im leeren Abschnitt stehen — dort ist sie das
           Einzige, was man tun kann. */
        immer={<Stellenzuordnung projektId={projekt.id} frei={await freieStellen()} />}
        zahl={projekt.stellen.length}
        leer="Noch keine Stelle in diesem Vorhaben gemerkt."
      >
        <div className="grid gap-3">
          {projekt.stellen.length > 0 && (
            <ul className="grid gap-1">
              {projekt.stellen.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Link
                    href={`/app/jobs/${s.jobId}`}
                    className="min-w-0 flex-1 rounded-(--radius-sm) px-2 py-1.5 transition-colors hover:bg-(--app-hover)"
                  >
                    <span className="block truncate text-[14px] text-(--app-text)">{s.titel}</span>
                    <span className="block truncate text-2xs text-(--app-text-3)">{s.firma}</span>
                  </Link>
                  <StelleLoesen savedJobId={s.id} projektId={projekt.id} />
                </li>
              ))}
            </ul>
          )}

          {/*
            Die Zuordnung steht UNTER der Liste, nicht darüber.

            Oben wäre sie das Erste, was man sieht — und ein Vorhaben
            handelt von den Stellen, die schon darin sind, nicht davon,
            welche man noch hinzufügen könnte.
          */}
        </div>
      </Abschnitt>

      <Abschnitt
        icon={FileText}
        id="bewerbungen"
        titel="Bewerbungen"
        zahl={projekt.bewerbungen.length}
        leer="Noch keine Bewerbung aus diesem Vorhaben."
      >
        <Liste
          eintraege={projekt.bewerbungen.map((b) => ({
            id: b.id,
            href: `/app/applications/${b.id}`,
            oben: b.titel,
            unten: `${b.firma} · ${b.stand}`,
          }))}
        />
      </Abschnitt>
    </div>
  );
}

/**
 * Ein Abschnitt mit Zahl.
 *
 * Die Zahl steht auch bei null da. Ein Abschnitt, der bei null
 * verschwindet, lässt den Menschen im Unklaren, ob es ihn gibt — und
 * genau das soll er hier sehen: Es gibt ihn, er ist noch leer, und so
 * baut sich das Vorhaben auf.
 */
function Abschnitt({
  id,
  icon: Icon,
  titel,
  zahl,
  leer,
  immer,
  children,
}: {
  /* Sprungziel für die Verweise aus der Seitenleiste. */
  id?: string;
  icon: typeof Briefcase;
  titel: string;
  zahl: number;
  leer: string;
  /**
   * Was auch im leeren Abschnitt stehen bleibt.
   *
   * ── Warum das nötig wurde ───────────────────────────────────────
   *
   * Der Abschnitt zeigte bei null Einträgen NUR seinen Leertext und
   * verschluckte die Kinder. Damit verschwand der Knopf „Gemerkte
   * Stelle zuordnen" genau dann, wenn man ihn braucht — in einem
   * leeren Vorhaben. Am Bildschirm sofort zu sehen, im Code nicht.
   */
  immer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="grid scroll-mt-8 gap-3">
      <div className="flex items-baseline gap-2.5 border-b border-(--app-rand) pb-2">
        <Icon className="size-[18px] shrink-0 translate-y-[3px] text-ink-3" strokeWidth={1.8} />
        <h2 className="text-[15px] font-semibold text-ink">{titel}</h2>
        <span className="font-mono text-2xs tabular-nums text-ink-3">{zahl}</span>
      </div>
      {zahl === 0 ? (
        <p className="text-[14px] leading-relaxed text-ink-3">{leer}</p>
      ) : (
        children
      )}
      {immer}
    </section>
  );
}

function Liste({
  eintraege,
}: {
  eintraege: { id: string; href: string; oben: string; unten: string }[];
}) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-(--radius-md) border border-line bg-line">
      {eintraege.map((e) => (
        <li key={e.id}>
          <Link
            href={e.href}
            className="grid gap-0.5 bg-raised px-4 py-3 transition-colors hover:bg-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <span className="text-[14px] font-medium text-ink">{e.oben}</span>
            <span className="text-2xs text-ink-3">{e.unten}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
