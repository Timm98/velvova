import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { brand } from "@paycheck/config";
import { AppHinweisleiste } from "@/components/shell/AppHinweisleiste";
import { VelvovaFooter } from "@/components/shell/VelvovaFooter";
import { TopNav } from "@/components/shell/TopNav";
import { kopfsitzung } from "@/components/shell/Kopfsitzung";
import { BestandProvider } from "@/components/marketing/BestandProvider";
import { HilfeKnopf } from "@/components/marketing/HilfeKnopf";
import { bestandszahl } from "@/lib/jobs/bestandszahl";
import { laenderbestand } from "@/lib/jobs/laenderbestand";
import { BEREICHE, oeffentlichesProfil, type Profilstand } from "@/lib/arbeitgeber/profil";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const daten = await oeffentlichesProfil(slug);
  if (!daten) return { title: "Unternehmen" };
  return {
    title: daten.organisation.name,
    description: feldText(daten.profil, "kurzbeschreibung") || undefined,
  };
}

/**
 * Die öffentliche Unternehmensseite.
 *
 * ── Warum fehlende Angaben dastehen statt zu verschwinden ─────
 *
 * Der übliche Weg wäre, leere Abschnitte auszublenden — die Seite
 * sieht dann immer vollständig aus. Genau das ist der Schaden: Wer
 * wissen will, wie Überstunden gehandhabt werden, findet den Abschnitt
 * nicht und schliesst daraus nichts. Steht dort „vom Unternehmen noch
 * nicht angegeben", weiss er zweierlei — dass die Frage vorgesehen ist
 * und dass sie unbeantwortet blieb.
 *
 * Das ist unbequem für Arbeitgeber und richtig für die Menschen, für
 * die diese Seite da ist.
 *
 * ── Warum keine Prozentzahl auf der öffentlichen Seite ────────
 *
 * Die Vollständigkeit steht im Editor, nicht hier. Eine Note über ein
 * Unternehmen, die aus der Anzahl ausgefüllter Felder entsteht, wäre
 * eine Bewertung ohne Grundlage — ein sorgfältig gepflegtes Profil
 * eines schlechten Arbeitgebers bekäme die bessere Zahl.
 */
export default async function UnternehmensSeite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [daten, bestand, laender, sitzung] = await Promise.all([
    oeffentlichesProfil(slug),
    bestandszahl(),
    laenderbestand(),
    kopfsitzung(),
  ]);

  if (!daten) notFound();
  const { organisation: org, profil } = daten;

  return (
    <BestandProvider genau={bestand.genau} proSekunde={bestand.proSekunde}>
      <div
        data-surface="editorial"
        className="min-h-dvh"
        style={{ background: "var(--ed-canvas)", color: "var(--ed-ink)" }}
      >
        <a href="#inhalt" className="skip-link">
          Zum Inhalt springen
        </a>

        <AppHinweisleiste />
        <TopNav
          brandName={brand.name}
          userName={sitzung.userName}
          userEmail={sitzung.userEmail}
          unreadCount={sitzung.unreadCount}
          stellenzahl={bestand.text}
          stellenGenau={bestand.genau}
          proSekunde={bestand.proSekunde}
          angemeldet={sitzung.angemeldet}
          accountMenu={sitzung.accountMenu}
        />

        <main id="inhalt">
          {/* ── Kopf ─────────────────────────────────────────── */}
          <section className="border-b border-line">
            <div className="mx-auto grid w-full max-w-(--breite-inhalt) gap-6 px-5 py-12 md:px-8 md:py-16">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-[clamp(2rem,4.4vw,3rem)] font-normal leading-[1.05] tracking-[-0.02em]">
                  {org.name}
                </h1>
                {/*
                  Das Prüfzeichen sagt genau eine Sache: dass jemand
                  belegt hat, für dieses Unternehmen zu sprechen. Es
                  sagt nichts über den Arbeitgeber — und darf deshalb
                  nicht wie eine Auszeichnung aussehen.
                */}
                {org.geprueft && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-(--radius-pill) px-3 py-1 text-2xs font-semibold uppercase tracking-[0.1em]"
                    style={{ background: "var(--ed-violet-soft)", color: "var(--ed-violet-text)" }}
                  >
                    <BadgeCheck aria-hidden className="size-3.5" strokeWidth={2} />
                    Zugehörigkeit geprüft
                  </span>
                )}
              </div>

              <p className="max-w-[62ch] text-[clamp(1rem,1.4vw,1.2rem)] leading-[1.6]" style={{ color: "var(--ed-ink-2)" }}>
                {feldText(profil, "kurzbeschreibung") || <Fehlt />}
              </p>

              <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5 text-sm">
                {/*
                  Über `feldText`, nicht direkt aus dem Objekt.

                  `Profilstand` ist bewusst als `Record<string, unknown>`
                  getippt — sonst hinge der Typ am Datenbankschema und
                  damit der Treiber im Browserbündel. Der Preis ist,
                  dass ein Feld hier nicht als Text gilt, bis jemand es
                  dazu macht. `feldText` ist diese Stelle.
                */}
                {([
                  ["Branche", feldText(profil, "branche")],
                  ["Grösse", feldText(profil, "groesse")],
                  ["Hauptsitz", feldText(profil, "hauptsitz")],
                  ["Arbeitsmodell", feldText(profil, "arbeitsmodell")],
                ] as const).map(([k, v]) => (
                  <div key={String(k)} className="grid gap-0.5">
                    <dt className="text-2xs uppercase tracking-[0.12em]" style={{ color: "var(--ed-ink-3)" }}>
                      {k}
                    </dt>
                    <dd style={{ color: "var(--ed-ink-2)" }}>{v || <Fehlt kurz />}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={`/jobs?q=${encodeURIComponent(org.name)}`}
                  className="group inline-flex min-h-13 items-center gap-2 rounded-(--radius-pill) px-6 text-[15px] font-medium"
                  style={{ background: "var(--ed-violet)", color: "#fff" }}
                >
                  Offene Stellen ansehen
                  <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                </Link>
                <Link
                  href="/register"
                  className="inline-flex min-h-13 items-center rounded-(--radius-pill) px-6 text-[15px] font-medium"
                  style={{ color: "var(--ed-ink)", boxShadow: "inset 0 0 0 1px var(--ed-hairline-strong)" }}
                >
                  Mit {brand.assistantName} meinen Fit prüfen
                </Link>
              </div>

              {/*
                Die Einschränkung steht am Knopf, nicht im Impressum.

                „Fit prüfen" klingt, als läge unser Wissen über beide
                Seiten zugrunde. Es liegt zugrunde, was hier
                veröffentlicht ist und was die Person selbst freigegeben
                hat — und dieser Unterschied entscheidet, wie viel die
                Zahl wert ist.
              */}
              <p className="max-w-[62ch] text-sm leading-relaxed" style={{ color: "var(--ed-ink-3)" }}>
                {brand.assistantName} vergleicht deine Wünsche nur mit veröffentlichten
                Unternehmensangaben und Informationen, die du selbst freigegeben hast.
              </p>

              <p className="text-2xs" style={{ color: "var(--ed-ink-3)" }}>
                Zuletzt aktualisiert:{" "}
                <span className="font-mono tabular-nums">
                  {new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(profil.aktualisiertAm)}
                </span>
                {org.website && (
                  <>
                    {" · "}
                    <a href={org.website} rel="noopener noreferrer nofollow" target="_blank" className="underline underline-offset-[3px]">
                      Website
                    </a>
                  </>
                )}
              </p>
            </div>
          </section>

          {/* ── Die Abschnitte ───────────────────────────────── */}
          {BEREICHE.filter((b) => b.id !== "grundlagen").map((bereich) => (
            <section key={bereich.id} className="border-b border-line">
              <div className="mx-auto grid w-full max-w-(--breite-inhalt) gap-8 px-5 py-12 md:grid-cols-[0.8fr_1.2fr] md:px-8 md:py-16">
                <div className="grid content-start gap-3">
                  <h2 className="font-display text-[clamp(1.4rem,2.4vw,1.9rem)] font-normal tracking-[-0.02em]">
                    {bereich.titel}
                  </h2>
                </div>

                <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {bereich.felder.map((f) => (
                    <div key={String(f.name)} className="grid gap-1">
                      <dt className="text-2xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ed-ink-3)" }}>
                        {f.label}
                      </dt>
                      <dd className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: "var(--ed-ink-2)" }}>
                        {feldText(profil, String(f.name)) || <Fehlt />}
                      </dd>
                    </div>
                  ))}

                  {bereich.id === "kultur" && (
                    <div className="grid gap-2 sm:col-span-2">
                      <dt className="text-2xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ed-ink-3)" }}>
                        Werte
                      </dt>
                      {(profil.werte ?? []).length === 0 ? (
                        <dd><Fehlt /></dd>
                      ) : (
                        <dd className="grid gap-3">
                          {(profil.werte ?? []).map((w) => (
                            <div key={w.wert} className="grid gap-1 rounded-(--radius-md) border border-line p-4">
                              <span className="text-[15px] font-medium">{w.wert}</span>
                              {/*
                                Ein Wert ohne Beispiel wird gezeigt, nicht
                                versteckt — und als das benannt, was er
                                ist. Ihn wegzulassen liesse das Profil
                                besser aussehen, als es ist.
                              */}
                              <span className="text-sm leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>
                                {w.beispiel?.trim() || <Fehlt text="Kein Beispiel angegeben." />}
                              </span>
                            </div>
                          ))}
                        </dd>
                      )}
                    </div>
                  )}
                </dl>
              </div>
            </section>
          ))}
        </main>

        <VelvovaFooter laender={laender} />
        <HilfeKnopf assistantName={brand.assistantName} />
      </div>
    </BestandProvider>
  );
}

function feldText(profil: Profilstand, name: string): string {
  const wert = profil[name];
  if (wert === null || wert === undefined) return "";
  if (typeof wert === "string") return wert.trim();
  if (typeof wert === "number") return String(wert);
  return "";
}

/**
 * Die fehlende Angabe als Angabe.
 *
 * Kursiv und blasser als der Fliesstext, damit man sie beim Überfliegen
 * als Leerstelle erkennt — aber nicht so blass, dass sie durchfällt:
 * Sie ist eine Auskunft, keine Randnotiz.
 */
function Fehlt({ kurz, text }: { kurz?: boolean; text?: string }) {
  return (
    <span className="italic" style={{ color: "var(--ed-ink-3)" }}>
      {text ?? (kurz ? "Nicht angegeben." : "Vom Unternehmen noch nicht angegeben.")}
    </span>
  );
}
