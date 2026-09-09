"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  projektAnlegen,
  projektArchivieren,
  projektLoeschen,
  projektUmbenennen,
} from "@/lib/chancen/projektaktionen";
import { cn } from "@/lib/cn";

/**
 * Ein Vorhaben von Hand anlegen.
 *
 * ── Warum ein Feld und kein Formular ────────────────────────────
 *
 * Weil zu diesem Zeitpunkt nur eines feststeht: wie es heissen soll.
 * Ziel, Gehalt, Ort und Ausschlüsse entstehen im Gespräch — sie hier
 * abzufragen hiesse, jemanden ein Formular ausfüllen zu lassen, dessen
 * Felder er noch gar nicht beantworten kann.
 */
export function NeuesProjekt() {
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState("");
  const [laeuft, starten] = useTransition();
  const feld = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (offen) feld.current?.focus();
  }, [offen]);

  function anlegen() {
    const n = name.trim();
    if (n.length < 3) return;
    starten(async () => {
      const p = await projektAnlegen(n);
      setName("");
      setOffen(false);
      if (p) router.push(`/app/projekte/${p.id}`);
    });
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label="Neues Vorhaben anlegen"
        title="Neues Vorhaben"
        className="grid size-6 shrink-0 place-items-center rounded-(--radius-sm) text-(--app-text-3) transition-colors hover:bg-(--app-hover) hover:text-(--app-text)"
      >
        <Plus className="size-3.5" strokeWidth={2} />
      </button>
    );
  }

  return (
    <input
      ref={feld}
      value={name}
      disabled={laeuft}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") anlegen();
        /* Escape verwirft. Ein Feld, das nur über einen Klick daneben
           zugeht, fängt Klicks ab, die woandershin wollten. */
        if (e.key === "Escape") {
          setName("");
          setOffen(false);
        }
      }}
      onBlur={() => {
        if (!name.trim()) setOffen(false);
      }}
      placeholder="Wie soll es heissen?"
      maxLength={60}
      className="min-h-7 w-full rounded-(--radius-sm) border border-(--app-rand) bg-(--app-eingabe) px-2 text-[13px] text-(--app-text) outline-none placeholder:text-(--app-text-3) focus:border-(--app-rand-stark) disabled:opacity-60"
    />
  );
}

/**
 * Umbenennen, archivieren, löschen.
 *
 * Löschen fragt nach. Archivieren nicht: Es ist rückholbar, und eine
 * Rückfrage für etwas Rückholbares erzieht dazu, Rückfragen
 * wegzuklicken — auch die, die es ernst meinen.
 */
export function Projektmenue({ id, name }: { id: string; name: string }) {
  const [offen, setOffen] = useState(false);
  const [umbenennen, setUmbenennen] = useState(false);
  const [neuerName, setNeuerName] = useState(name);
  const [laeuft, starten] = useTransition();
  const hier = useRef<HTMLSpanElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!offen) return;
    const aus = (e: MouseEvent) => {
      if (!hier.current?.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    document.addEventListener("mousedown", aus);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", aus);
      document.removeEventListener("keydown", taste);
    };
  }, [offen]);

  const eintrag =
    "flex w-full items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-1.5 text-left text-[13px] text-(--app-text-2) transition-colors hover:bg-(--app-hover) hover:text-(--app-text) disabled:opacity-50";

  if (umbenennen) {
    return (
      <input
        autoFocus
        value={neuerName}
        disabled={laeuft}
        onChange={(e) => setNeuerName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            starten(async () => {
              await projektUmbenennen(id, neuerName);
              setUmbenennen(false);
            });
          }
          if (e.key === "Escape") {
            setNeuerName(name);
            setUmbenennen(false);
          }
        }}
        onBlur={() => {
          setNeuerName(name);
          setUmbenennen(false);
        }}
        maxLength={60}
        className="min-h-7 w-full rounded-(--radius-sm) border border-(--app-rand) bg-(--app-eingabe) px-2 text-[13px] text-(--app-text) outline-none focus:border-(--app-rand-stark)"
      />
    );
  }

  return (
    <span ref={hier} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-label={`Aktionen für ${name}`}
        className={cn(
          "grid size-6 place-items-center rounded-(--radius-sm) text-(--app-text-3) transition-colors",
          "hover:bg-(--app-hover) hover:text-(--app-text)",
          offen && "bg-(--app-hover) text-(--app-text)",
        )}
      >
        <MoreHorizontal className="size-3.5" strokeWidth={2} />
      </button>

      {offen && (
        <span
          role="menu"
          className="absolute top-[calc(100%+0.25rem)] right-0 z-50 block w-48 rounded-(--radius-lg) border border-(--app-rand) bg-(--app-erhoben) p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            className={eintrag}
            onClick={() => {
              setOffen(false);
              setUmbenennen(true);
            }}
          >
            <Pencil className="size-3.5 shrink-0" strokeWidth={1.8} />
            Umbenennen
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={laeuft}
            className={eintrag}
            onClick={() => {
              setOffen(false);
              starten(() => void projektArchivieren(id));
            }}
          >
            <Archive className="size-3.5 shrink-0" strokeWidth={1.8} />
            Archivieren
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={laeuft}
            className={cn(eintrag, "hover:text-(--app-fehler)")}
            onClick={() => {
              setOffen(false);
              /*
               * `confirm` und kein eigener Dialog.
               *
               * Ein Vorhaben zu löschen ist selten und unumkehrbar.
               * Ein eigener Dialog wäre schöner und würde hier zum
               * dritten schwebenden Element in einer Leiste, die schon
               * zwei hat. Der Browser fragt gut genug.
               */
              if (!window.confirm(`„${name}" wirklich löschen? Zugeordnete Stellen und Bewerbungen bleiben erhalten.`)) return;
              starten(async () => {
                await projektLoeschen(id);
                router.push("/app/monday");
              });
            }}
          >
            <Trash2 className="size-3.5 shrink-0" strokeWidth={1.8} />
            Löschen
          </button>
        </span>
      )}
    </span>
  );
}
