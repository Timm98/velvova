"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bell,
  ChevronDown,
  FolderKanban,
  MessageSquare,
  PanelLeft,
  Plus,
  ShoppingCart,
} from "lucide-react";
import type { Kontogruppe } from "./kontoeintraege.ts";
import { ARBEITSBEREICHE, SUCHE, istHier } from "./seitenleiste-eintraege.ts";
import { NeuesProjekt, Projektmenue } from "./Projektaktionen";
import { leistenstellen } from "@/lib/chancen/leistenstellen";
import type { Projektstelle } from "@/lib/chancen/projekttreffer";
import { cn } from "@/lib/cn";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Seitenleiste — der Unterschied zwischen Website und Werkzeug
 * ══════════════════════════════════════════════════════════════════
 *
 * Bis hierher trug der angemeldete Bereich dieselbe Kopfzeile wie die
 * öffentliche Seite: fünf Marketingpunkte, ein Zähler mit der Zahl
 * aller Stellen, ein Suchfeld für Besucher. Wer eingeloggt war, sah
 * weiter die Werbung für das Produkt, das er bereits benutzt.
 *
 * Eine Seitenleiste sagt etwas anderes, und zwar bevor jemand liest:
 * Hier wird gearbeitet. Sie bleibt beim Seitenwechsel stehen, sie
 * zeigt gleichzeitig, wo man ist und was es sonst gibt, und sie hat
 * unten Platz für das Konto — dort, wo niemand versehentlich
 * hinklickt.
 *
 * ── Warum nur ab `md` ───────────────────────────────────────────
 *
 * Weil auf dem Telefon bereits eine Navigation unten steht und zwei
 * Navigationen für dieselben fünf Ziele keine Wahl sind, sondern eine
 * Verdopplung. Auf schmalen Geräten bleibt alles, wie es war; die
 * Seitenleiste beginnt dort, wo die Vorlagen sie auch haben.
 *
 * ── Was hier NICHT steht ────────────────────────────────────────
 *
 * Kein Abschnitt für Projekte und keine Liste letzter Gespräche —
 * obwohl beide in der Vorlage stehen. Der Grund ist kein Vergessen:
 * `/app/monday` ist heute fest an genau ein Karrieregespräch
 * gebunden, und eine Tabelle für Projekte gibt es nicht. Ein
 * Abschnitt „Letzte Chats", der auf dasselbe Gespräch zeigt, sähe aus
 * wie eine Funktion und wäre keine.
 *
 * Die Bauform ist trotzdem darauf eingerichtet: `projekte` und
 * `gespraeche` sind Eigenschaften, die nichts zeichnen, solange sie
 * leer sind. Wenn die Daten da sind, kommen die Abschnitte dazu, ohne
 * dass an dieser Datei etwas umgestellt werden muss.
 */

export interface Leisteneintrag {
  id: string;
  titel: string;
  href: string;
}

const BREITE_OFFEN = "16.5rem";
const BREITE_ENG = "3.75rem";

/** Der Schlüssel überlebt Neuladen — die Breite ist eine Gewohnheit, keine Sitzung. */
const SPEICHER = "velvova.seitenleiste.eng";

/**
 * Ein Vorhaben mit seinen drei Bereichen.
 *
 * ── Warum die Reihenfolge feststeht ─────────────────────────────
 *
 * Wunsch, dann Jobs, dann Bewerbungen — das ist der Weg, den die
 * Arbeit nimmt. Ein Vorhaben ohne geklärten Wunsch hat keine
 * passenden Stellen, und ohne Stellen gibt es nichts zu bewerben.
 * Eine andere Reihenfolge würde eine andere Arbeitsweise nahelegen.
 *
 * ── Warum aufklappbar und zu ────────────────────────────────────
 *
 * Drei offene Vorhaben mit je drei Zeilen sind zwölf Einträge. Die
 * Leiste soll zeigen, WAS man vorhat, nicht alles, was man darin tun
 * könnte. Offen ist, woran man gerade arbeitet.
 */
function Projektzeile({
  projekt,
  offen,
}: {
  projekt: { id: string; titel: string; href: string };
  offen: boolean;
}) {
  const [auf, setAuf] = useState(offen);
  const pfad = usePathname();
  const hier = pfad === projekt.href;

  /*
   * ── Warum hier Stellen stehen und keine Sprungmarken ──────────
   *
   * Hier standen drei Zeilen: „Wunsch", „Jobs", „Bewerbungen" —
   * Anker auf dieselbe Seite. Aufgeklappt sah man damit, welche
   * Abschnitte es gibt, und nicht, was drin ist. Ein Vorhaben mit
   * dreissig Treffern und eines mit keinem sahen gleich aus.
   *
   * Jetzt stehen die Stellen selbst da, die höchsten zuerst. Die
   * Bewerbungen bleiben als eine Zeile darunter: Sie sind ein
   * anderer Stand derselben Sache, keine Liste, die man hier
   * durchsieht.
   */
  const [lage, setLage] = useState<
    { art: "zu" } | { art: "laedt" } | { art: "da"; stellen: Projektstelle[]; gesamt: number }
  >({ art: "zu" });

  useEffect(() => {
    if (!auf || lage.art !== "zu") return;
    let weg = false;
    setLage({ art: "laedt" });
    void leistenstellen(projekt.id).then((a) => {
      if (!weg) setLage({ art: "da", stellen: a.stellen, gesamt: a.gesamt });
    });
    return () => {
      weg = true;
    };
  }, [auf, lage.art, projekt.id]);

  return (
    <div className="grid gap-0.5">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setAuf((a) => !a)}
          aria-expanded={auf}
          aria-label={auf ? `${projekt.titel} zuklappen` : `${projekt.titel} aufklappen`}
          className="flex size-6 shrink-0 items-center justify-center rounded-(--radius-sm) text-(--app-text-3) transition-colors hover:bg-(--app-hover) hover:text-(--app-text)"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", !auf && "-rotate-90")}
            strokeWidth={2}
          />
        </button>
        <Link
          href={projekt.href}
          className={cn(
            "flex min-h-8 flex-1 items-center gap-2 truncate rounded-(--radius-sm) px-1.5 text-[13px] transition-colors",
            hier
              ? "bg-(--app-gewaehlt) text-(--app-text)"
              : "text-(--app-text-2) hover:bg-(--app-hover) hover:text-(--app-text)",
          )}
        >
          <span className="truncate">{projekt.titel}</span>
        </Link>
        <Projektmenue id={projekt.id} name={projekt.titel} />
      </div>

      {auf && (
        <div className="grid gap-0.5 pl-7">
          {lage.art === "laedt" && (
            <span className="flex min-h-7 items-center px-1.5 text-2xs text-(--app-text-3)">
              Stellen werden geladen …
            </span>
          )}

          {lage.art === "da" && lage.gesamt < 0 && (
            /* Der Fehlerfall trägt eigene Worte. „Keine Stellen" wäre
               eine Aussage über die Suche statt über den Fehler. */
            <span className="flex min-h-7 items-center px-1.5 text-2xs text-(--app-text-3)">
              Stellen nicht abrufbar
            </span>
          )}

          {lage.art === "da" && lage.gesamt === 0 && (
            /* Kein Treffer ist etwas anderes als kein Suchauftrag —
               was von beidem, sagt die Projektseite. Hier steht nur,
               dass nichts da ist. */
            <span className="flex min-h-7 items-center px-1.5 text-2xs text-(--app-text-3)">
              Noch keine Stellen
            </span>
          )}

          {lage.art === "da" &&
            lage.stellen.map((stelle) => (
              <Link
                key={stelle.jobId}
                href={`/app/jobs/${stelle.jobId}`}
                title={`${stelle.titel} — ${stelle.firma}`}
                className="flex min-h-7 items-center gap-1.5 rounded-(--radius-sm) px-1.5 text-2xs text-(--app-text-3) transition-colors hover:bg-(--app-hover) hover:text-(--app-text-2)"
              >
                <span className="truncate">{stelle.titel}</span>
                {/* Die Zahl nur, wenn es eine gibt. Ein fehlender Fit
                    ist keine Null — er heisst, dass für diese Stelle
                    keine Prüfung gelaufen ist. */}
                {stelle.fit !== null && (
                  <span className="ml-auto shrink-0 font-mono tabular-nums text-(--app-text-3)">
                    {stelle.fit}
                  </span>
                )}
              </Link>
            ))}

          {lage.art === "da" && lage.gesamt > lage.stellen.length && (
            <Link
              href={`${projekt.href}#jobs`}
              className="flex min-h-7 items-center rounded-(--radius-sm) px-1.5 text-2xs text-(--app-text-3) transition-colors hover:bg-(--app-hover) hover:text-(--app-text-2)"
            >
              Alle {lage.gesamt} Stellen
            </Link>
          )}

          <Link
            href={`${projekt.href}#bewerbungen`}
            className="flex min-h-7 items-center rounded-(--radius-sm) px-1.5 text-2xs text-(--app-text-3) transition-colors hover:bg-(--app-hover) hover:text-(--app-text-2)"
          >
            Bewerbungen
          </Link>
        </div>
      )}
    </div>
  );
}

export function Seitenleiste({
  brandName,
  assistentName,
  userName,
  userEmail,
  bildKennung,
  planName,
  planHref,
  unreadCount,
  gruppen,
  onLogout,
  onSuche,
  projekte = [],
  gespraeche = [],
}: {
  brandName: string;
  /** Mondays Name — steht oben in der Leiste. */
  assistentName: string;
  userName: string | null;
  userEmail: string;
  bildKennung: string | null;
  /**
   * Der Name des laufenden Abos — „Free", „Premium", „Max".
   *
   * Kommt aus `PLAENE[zugang.plan].name`, also aus den echten
   * Abodaten. Nicht erfunden, nicht vorbelegt: Ein Plan, der in der
   * Leiste steht und nicht stimmt, ist schlimmer als keiner — man
   * liest ihn im Vorbeigehen und glaubt ihm.
   */
  planName: string;
  /** Wohin der Warenkorb führt. Ansehen, nicht bestellen. */
  planHref: string;
  unreadCount: number;
  gruppen: Kontogruppe[];
  onLogout: React.ReactNode;
  onSuche: () => void;
  projekte?: Leisteneintrag[];
  gespraeche?: Leisteneintrag[];
}) {
  const pfad = usePathname();
  const offenesGespraech = useSearchParams().get("g");
  const [eng, setEng] = useState(false);
  const [kontoOffen, setKontoOffen] = useState(false);
  const kontoRef = useRef<HTMLDivElement>(null);

  /*
   * Erst nach dem ersten Zeichnen lesen.
   *
   * `localStorage` im Ausgangszustand zu lesen hiesse, dass der Server
   * etwas anderes zeichnet als der Browser — und React beschwert sich
   * über die Abweichung, statt sie zu beheben. Ein kurzes Aufklappen
   * ist der Preis; er fällt nicht auf, weil die Breite mit Übergang
   * wechselt.
   */
  useEffect(() => {
    try {
      setEng(window.localStorage.getItem(SPEICHER) === "true");
    } catch {
      /* Privater Modus, gesperrte Seitendaten. Dann eben offen. */
    }
  }, []);

  function umschalten() {
    setEng((vorher) => {
      const neu = !vorher;
      try {
        window.localStorage.setItem(SPEICHER, String(neu));
      } catch {
        /* Nicht speichern zu können ist kein Grund, nicht umzuschalten. */
      }
      return neu;
    });
  }

  /* Klick daneben und Escape schliessen das Kontomenü. */
  useEffect(() => {
    if (!kontoOffen) return;
    function daneben(e: MouseEvent) {
      if (!kontoRef.current?.contains(e.target as Node)) setKontoOffen(false);
    }
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") setKontoOffen(false);
    }
    document.addEventListener("mousedown", daneben);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", daneben);
      document.removeEventListener("keydown", taste);
    };
  }, [kontoOffen]);

  /* Beim Seitenwechsel schliessen — ein offenes Menü über der neuen
     Seite ist ein Rest der alten. */
  useEffect(() => setKontoOffen(false), [pfad]);

  const initiale = (userName ?? userEmail).trim().slice(0, 1).toUpperCase();

  /**
   * Eine Zeile in der Leiste.
   *
   * Im engen Zustand bleibt nur das Zeichen — mit `title`, damit man
   * beim Zögern erfährt, was es ist. Ein Vorleseprogramm bekommt den
   * Namen weiterhin, weil der Text nicht entfernt, sondern nur
   * optisch verborgen wird.
   */
  function Zeile({
    href, text, Icon, aktiv, kennzahl,
  }: {
    href: string; text: string; Icon: typeof Bell; aktiv: boolean; kennzahl?: number;
  }) {
    return (
      <Link
        href={href}
        title={eng ? text : undefined}
        aria-current={aktiv ? "page" : undefined}
        className={cn(
          "group flex min-h-9 items-center gap-2.5 rounded-(--radius-sm) px-2.5 text-[14px] transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          aktiv ? "bg-soft font-medium text-ink" : "text-ink-2 hover:bg-soft hover:text-ink",
          eng && "justify-center px-0",
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={aktiv ? 2 : 1.7} />
        <span className={cn("truncate", eng && "sr-only")}>{text}</span>
        {kennzahl && kennzahl > 0 && !eng ? (
          <span className="ml-auto rounded-(--radius-pill) bg-accent px-1.5 py-0.5 text-2xs font-medium text-ink-inv">
            {kennzahl > 99 ? "99+" : kennzahl}
          </span>
        ) : null}
      </Link>
    );
  }

  function Ueberschrift({ text }: { text: string }) {
    if (eng) return <div className="mx-2.5 my-2 border-t border-line" aria-hidden />;
    return (
      /*
        Klein und leise, wie bei Claude.
        
        Vorher: Versalien, Sperrung, mittleres Gewicht — dieselbe
        Behandlung, die ein Abschnittstitel in einem Bericht bekommt.
        In einer Leiste ist eine Überschrift aber keine Ansage,
        sondern eine Trennlinie mit einem Wort daran.
      */
      <h2 className="px-2.5 pt-4 pb-1 text-2xs font-normal text-(--app-text-3)">{text}</h2>
    );
  }

  return (
    <aside
      aria-label="Arbeitsbereiche"
      style={{ width: eng ? BREITE_ENG : BREITE_OFFEN }}
      className={cn(
        /*
         * Erst ab `md`. Darunter trägt die untere Leiste die
         * Navigation, und zwei Navigationen für dieselben Ziele sind
         * keine Wahl, sondern eine Verdopplung.
         */
        "hidden shrink-0 flex-col border-r border-(--app-rand) bg-(--app-leiste) md:flex",
        /* Eigene Höhe und eigenes Rollen: Die Leiste bleibt stehen,
           während der Inhalt daneben scrollt. */
        "md:h-dvh md:sticky md:top-0",
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
      )}
    >
      {/* ── Kopf: Marke und Breite ──────────────────────────────── */}
      <div className={cn("flex items-center gap-1 px-3 pt-3 pb-1", eng && "justify-center px-2")}>
        {!eng && (
          /*
            „Monday", nicht „Velvova".

            Die Marke steht oben rechts im Kopf. Hier oben steht, WER
            in dieser Leiste arbeitet — und das ist Monday. Zweimal
            derselbe Name auf einem Bildschirm sagt nichts zweimal, er
            nimmt nur einer der beiden Stellen ihre Aussage.

            Block- statt JSX-Kommentar: Direkt nach der öffnenden
            Klammer stünden sonst zwei Kinder nebeneinander, und die
            Datei bricht.
          */
          <Link
            href="/app/monday"
            className="truncate rounded-(--radius-sm) px-1.5 py-1 text-[15px] font-semibold tracking-tight text-(--app-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--app-fokus)"
          >
            {assistentName}
          </Link>
        )}
        <button
          type="button"
          onClick={umschalten}
          aria-expanded={!eng}
          aria-label={eng ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          title={eng ? "Ausklappen" : "Einklappen"}
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-(--radius-sm) text-ink-3 transition-colors hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <PanelLeft className="size-[18px]" strokeWidth={1.7} />
        </button>
      </div>

      {/* ── Gespräch beginnen ───────────────────────────────────── */}
      <div className={cn("px-3 pt-2 pb-1", eng && "px-2")}>
        {/*
          „Neuer Chat", nicht „Mit Monday sprechen".

          Der alte Text beschrieb den Gesprächspartner, nicht die
          Handlung. Wer eine Leiste überfliegt, sucht Verben: Was
          passiert, wenn ich hier klicke? „Neuer Chat" beantwortet
          das; „Mit Monday sprechen" stellt jemanden vor.

          Und er war der auffälligste Knopf der ganzen Leiste — für
          etwas, das man ohnehin ständig tut.
        */}
        <Link
          href="/app/monday"
          title={eng ? "Neuer Chat" : undefined}
          className={cn(
            "flex min-h-9 items-center gap-2.5 rounded-(--radius-control) border border-(--app-rand) px-2.5 text-[14px] font-medium text-(--app-text)",
            "transition-colors hover:border-(--app-rand-stark) hover:bg-(--app-hover)",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            eng && "justify-center px-0",
          )}
        >
          <Plus className="size-[18px] shrink-0" strokeWidth={2} />
          <span className={cn(eng && "sr-only")}>Neuer Chat</span>
        </Link>
      </div>

      {/* ── Suchen ─────────────────────────────────────────────── */}
      <div className={cn("px-3 pt-1", eng && "px-2")}>
        <button
          type="button"
          onClick={onSuche}
          title={eng ? SUCHE.text : undefined}
          className={cn(
            "flex min-h-9 w-full items-center gap-2.5 rounded-(--radius-sm) px-2.5 text-[14px] text-ink-2 transition-colors",
            "hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            eng && "justify-center px-0",
          )}
        >
          <SUCHE.icon className="size-[18px] shrink-0" strokeWidth={1.7} />
          <span className={cn("truncate", eng && "sr-only")}>{SUCHE.text}</span>
          {/*
            Das Tastenkürzel steht da, weil es sonst niemand findet.
            `⌘K` ist in `AppShell` schon verdrahtet — hier wird es nur
            sichtbar gemacht.
          */}
          {!eng && (
            <kbd className="ml-auto rounded-(--radius-xs) border border-line px-1.5 py-0.5 font-sans text-2xs text-ink-3">
              ⌘K
            </kbd>
          )}
        </button>
      </div>

      {/* ── Die Arbeitsbereiche ────────────────────────────────── */}
      <nav aria-label="Bereiche" className={cn("grid gap-0.5 px-3 pt-3", eng && "px-2")}>
        {ARBEITSBEREICHE.map((b) => (
          <Zeile
            key={b.href}
            href={b.href}
            text={b.text}
            Icon={b.icon}
            aktiv={istHier(pfad, b)}
          />
        ))}
        <Zeile
          href="/app/notifications"
          text="Benachrichtigungen"
          Icon={Bell}
          aktiv={istHier(pfad, { href: "/app/notifications" })}
          kennzahl={unreadCount}
        />
      </nav>

      {/*
        ── Projekte und Gespräche ──────────────────────────────────

        Beide zeichnen nichts, solange sie leer sind. Ein leerer
        Abschnitt mit Überschrift wäre die Ankündigung einer Funktion,
        die es noch nicht gibt.
      */}
      {/*
        Der Abschnitt steht auch leer da — anders als die Gespräche.
        
        Vorher galt für beide: nichts zeichnen, solange nichts drin
        ist. Für Gespräche stimmt das; sie entstehen von selbst. Ein
        Vorhaben entsteht nicht von selbst, und ohne Überschrift gäbe
        es keinen Ort für das Plus, mit dem man es anlegt.
      */}
      {!eng && (
        <div className={cn("min-h-0 px-3")}>
          <div className="flex items-center justify-between gap-1 pr-1">
            <Ueberschrift text="Projekte" />
            <NeuesProjekt />
          </div>
          <div className="grid gap-0.5">
            {projekte.map((p) => (
              <Projektzeile key={p.id} projekt={p} offen={pfad === p.href} />
            ))}
            {/*
              Hier stand ein Satz, der erklärte, wie Vorhaben
              entstehen. Eine Leiste erklärt sich nicht — das Plus
              daneben sagt dasselbe, ohne zwei Zeilen dafür zu
              brauchen.
            */}
          </div>
        </div>
      )}

      {/* „Weitere Chats", nicht „Letzte Gespräche": Was zu einem
          Vorhaben gehört, steht dort — hier steht der Rest. */}
      {gespraeche.length > 0 && (
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 pb-2", eng && "px-2")}>
          <Ueberschrift text="Weitere Chats" />
          <div className="grid gap-0.5">
            {gespraeche.map((g) => (
              <Zeile
                key={g.id}
                href={g.href}
                text={g.titel}
                Icon={MessageSquare}
                /*
                 * Nach der Kennung vergleichen, nicht nach der Adresse.
                 *
                 * `usePathname` liefert `/app/monday` ohne Abfrage —
                 * verglichen mit `/app/monday?g=…` hätte nie ein
                 * Eintrag als aktiv gegolten. Auffallen würde das
                 * nicht als Fehler, sondern als fehlende Hervorhebung:
                 * Man sieht nicht, in welchem Gespräch man ist.
                 */
                aktiv={pfad === "/app/monday" && offenesGespraech === g.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Schiebt das Konto nach unten, wenn darüber nichts scrollt. */}
      <div className="flex-1" aria-hidden />

      {/* ── Konto ──────────────────────────────────────────────── */}
      <div ref={kontoRef} className={cn("relative border-t border-line p-2", eng && "px-2")}>
        <button
          type="button"
          onClick={() => setKontoOffen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={kontoOffen}
          title={eng ? (userName ?? userEmail) : undefined}
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-(--radius-sm) px-1.5 text-left transition-colors",
            "hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            eng && "justify-center px-0",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft text-2xs font-semibold text-ink">
            {bildKennung ? (
              /*
                Kein `next/image`: Die Route liefert das Bild des
                angemeldeten Menschen und ist ohne Sitzung nicht
                abrufbar. Der Bildoptimierer holt sie serverseitig ohne
                Cookie und bekäme eine 404.
              */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/app/profilbild?v=${bildKennung}`}
                alt=""
                aria-hidden
                className="size-full object-cover"
              />
            ) : (
              initiale
            )}
          </span>
          {!eng && (
            <>
              {/*
                Nur der Name. Die Adresse stand hier als zweite Zeile
                und war das Einzige, was von unten dauerhaft ins Auge
                fiel — eine Angabe, die man kennt, an einem Ort, den
                man oft ansieht. Sie steht jetzt im Kontomenü.

                Darunter liegt statt ihrer der Plan: eine Angabe, die
                sich ändert und die man tatsächlich nachschlägt.
              */}
              {/*
                Name und Tarif als EIN Block, wie bei ChatGPT.
                
                Vorher stand der Tarif in einer eigenen Zeile
                darunter, eingerückt bis unter den Namen — zwei
                Elemente, die zusammengehören und trotzdem
                auseinanderfielen. Jetzt gehören beide demselben
                Knopf: Der Name oben, darunter klein der Tarif.
              */}
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium text-(--app-text)">
                  {userName ?? userEmail}
                </span>
                <span className="block truncate text-2xs text-(--app-text-3)">{planName}</span>
              </span>
              {/* Kein Chevron: Der ganze Block ist der Knopf, und ein
                  Pfeil daneben behauptet eine zweite Bedienstelle. */}
            </>
          )}
        </button>

        {/*
          ── Zweite Zeile: der laufende Plan ───────────────────────

          Links, was gilt. Rechts der Weg zum Ändern.

          Der Warenkorb ist ein Verweis und keine Bestellung — er
          öffnet die Übersicht. Ein Knopf an dieser Stelle, der
          unmittelbar etwas kostet, wäre die unangenehmste Überraschung,
          die eine Seitenleiste bereithalten kann.

          Eingeklappt entfällt die Zeile: Ein Warenkorb ohne den Plan
          daneben ist ein Angebot ohne Zusammenhang.
        */}
        {kontoOffen && (
          /*
            Nach oben, nicht nach unten.
            Der Knopf klebt am unteren Rand; ein Menü darunter läge
            ausserhalb des Fensters.
          */
          <div
            role="menu"
            className="absolute bottom-[calc(100%-0.25rem)] left-2 z-50 max-h-[70dvh] w-[15.5rem] overflow-y-auto rounded-(--radius-lg) border border-line bg-raised p-1.5 shadow-xl"
          >
            {/* Die Adresse steht jetzt hier — dort, wo man sie sucht,
                wenn man sie sucht. */}
            <p className="truncate px-3 pt-1 pb-2 text-2xs text-(--app-text-3)">{userEmail}</p>
            {gruppen.map((gruppe, i) => (
              <div key={gruppe.titel} className={cn(i > 0 && "mt-1.5 border-t border-line pt-1.5")}>
                {/* Der Titel trennt nur fuer Vorlesegeraete; sichtbar tut das die Linie. */}
                <p className="sr-only">{gruppe.titel}</p>
                {gruppe.eintraege.map((e) => (
                  <Link
                    key={e.href}
                    href={e.href}
                    role="menuitem"
                    className="flex items-center gap-2.5 rounded-(--radius-sm) px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
                  >
                    <e.icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                    <span className="truncate">{e.label}</span>
                  </Link>
                ))}
              </div>
            ))}
            <div className="mt-1.5 border-t border-line pt-1.5">{onLogout}</div>
          </div>
        )}
      </div>
    </aside>
  );
}
