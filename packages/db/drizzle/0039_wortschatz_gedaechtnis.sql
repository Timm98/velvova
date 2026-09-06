-- Wann ein Suchbegriff zuletzt für einen Import verwendet wurde.
--
-- ── Warum das fehlte ──────────────────────────────────────────
--
-- Die Importläufe holen ihre Begriffe nach Ergiebigkeit sortiert — die
-- mit den meisten Anzeigen zuerst. Das ist richtig für den ersten
-- Lauf und falsch für jeden weiteren: Sie beginnen wieder am Anfang
-- und holen, was längst da ist.
--
-- Gemessen nach mehreren Läufen: 12 neue Stellen aus 3.000 geholten.
-- Der Rest war „unverändert" — dieselben Begriffe, dieselben Anzeigen.
--
-- Von 12.304 Begriffen im Wortschatz waren zu dem Zeitpunkt erst 3.600
-- überhaupt je abgefragt worden. Die Läufe drehten sich im Kreis,
-- während zwei Drittel des Wortschatzes unberührt lagen.

ALTER TABLE beruf_wortschatz ADD COLUMN IF NOT EXISTS zuletzt_geholt timestamptz
--> statement-breakpoint
-- Nie verwendete zuerst, danach die am längsten nicht verwendeten.
CREATE INDEX IF NOT EXISTS beruf_wortschatz_geholt_idx
  ON beruf_wortschatz (zuletzt_geholt NULLS FIRST)
