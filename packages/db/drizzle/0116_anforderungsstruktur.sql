-- ══════════════════════════════════════════════════════════════════
-- Anforderungen bekommen Kategorie, Verbindlichkeit und Herkunft
-- ══════════════════════════════════════════════════════════════════
--
-- Die alte Extraktion liess eine Zeile nur durch, wenn sie eines von
-- sieben Woertern enthielt. Gemessen am 11.09.2026 ueber 100 reale
-- Logistikanzeigen: 0,7 Eintraege je Anzeige, keine einzige Taetigkeit,
-- kein einziger als Wunsch erkannter Punkt. Von 120 geprueften Stellen
-- hatte keine zwei oder mehr pruefbare Muss-Anforderungen.
--
-- ── Warum die alten Zeilen stehen bleiben ───────────────────────
--
-- `extraktion_fassung` haelt fest, welche Regeln eine Zeile erzeugt
-- haben. Die neue Fassung wird danebengeschrieben, nicht darueber:
-- Solange nicht geprueft ist, dass sie besser ist, waere ein
-- Ueberschreiben ein Verlust ohne Rueckweg. Leser nehmen die hoechste
-- vorhandene Fassung je Stelle.
--
-- ── Warum Kategorie und Verbindlichkeit getrennt sind ───────────
--
-- `kind` sagt heute must oder nice -- eine Vermischung von zwei
-- Fragen. Eine Taetigkeit ist weder das eine noch das andere: Sie
-- beschreibt, was der Job IST, und fordert nichts. Wer sie unter
-- „must" fuehrt, erfindet eine Huerde, die die Anzeige nie aufgestellt
-- hat, und schliesst Menschen aus, die eingeladen waeren.
--
-- `verbindlichkeit` kennt deshalb drei Werte, und `unklar` ist der
-- haeufigste: gemessen 6,4 von 7,9 Eintraegen je Anzeige.

alter table job_requirements
  add column if not exists kategorie text not null default 'UNKNOWN';
--> statement-breakpoint

alter table job_requirements
  add column if not exists verbindlichkeit text not null default 'unklar';
--> statement-breakpoint

-- Der Satz ohne Beiwerk. Der Originaltext steht weiter in `text`.
alter table job_requirements
  add column if not exists bedeutung text;
--> statement-breakpoint

-- Bei EXPERIENCE: worin und wie lange. `null` heisst unbekannt,
-- nie „egal" -- gegen beliebige Berufsjahre wird nicht geprueft.
alter table job_requirements
  add column if not exists erfahrungsfeld text;
--> statement-breakpoint

alter table job_requirements
  add column if not exists erfahrungsmass text;
--> statement-breakpoint

alter table job_requirements
  add column if not exists extraktion_fassung text not null default 'anforderung-1';
--> statement-breakpoint

create index if not exists job_requirements_fassung_idx
  on job_requirements (job_id, extraktion_fassung);
