-- ══════════════════════════════════════════════════════════════════
-- Der Verlauf nach einem Wechsel: spaeter fragen, Kontext mitschreiben
-- ══════════════════════════════════════════════════════════════════
--
-- Velvova fragt nach einem Stellenantritt bei 30, 90 und 180 Tagen
-- nach. Die Begruendung stand im Code: 180 Tage liegen hinter der
-- Probezeit, und erst dort trenne sich, ob eine Empfehlung getaugt
-- habe.
--
-- Die Begruendung ist falsch. Wer den Arbeitgeber wechselt, ist danach
-- zufriedener — auch dann, wenn die neue Stelle nicht besser ist. Die
-- Zufriedenheit steigt im Jahr des Wechsels und faellt danach wieder
-- (Boswell, Boudreau & Tichy 2005; mit deutschen SOEP-Daten bestaetigt
-- bei Chadi & Hetschko 2018). Alle drei bisherigen Marken liegen in
-- diesem Hoch. Velvova misst die Flitterwochen und hoert auf, bevor
-- die Kurve kippt.
--
-- Deshalb kommen zwei Marken dazu: ein Jahr und drei Jahre.
--
-- ── Warum drei zusaetzliche Spalten auf check_ins ───────────────
--
-- Dieselbe Forschung misst nicht einfach Zufriedenheit ueber Zeit. Sie
-- trennt nach Wechselgrund, Berufsnaehe und Ausbildungspassung — ohne
-- diese Trennung ist der Verlauf nicht deutbar. Ein freiwilliger
-- Wechsel und eine Betriebsschliessung erzeugen verschiedene Kurven;
-- Ueberqualifikation senkt die Zufriedenheit dauerhaft und unabhaengig
-- vom Wechsel. Ohne die drei Angaben haette Velvova in drei Jahren
-- einen Mittelwert, aus dem sich nichts folgern laesst.
--
-- Sie stehen auf `check_ins` und nicht auf `applications`, weil sie zur
-- Auswertung gehoeren und dort jede Zeile fuer sich allein deutbar
-- bleiben soll. Der Kontext wird einmal erfragt und auf jede spaetere
-- Antwort desselben Wechsels mitgeschrieben.
--
-- ── Warum nullbar, ohne Vorgabewert und ohne Pruefung ───────────
--
-- Der Wechselgrund kann eine Kuendigung sein. Danach zu fragen ist
-- zumutbar, eine Antwort zu erzwingen nicht. `null` heisst "nicht
-- gesagt" — nie ein Ersatzwert. Text statt enum, weil eine Antwort aus
-- einem Formular kommt und ein unbekannter Wert keinen Check-in
-- verhindern darf; geprueft wird in `wechselverlauf.ts`, bevor
-- geschrieben wird.
--
-- ── Was diese Migration NICHT tut ───────────────────────────────
--
-- Nichts wird geloescht und nichts umgeschrieben. `zufriedenheit_180`
-- bleibt samt Inhalt stehen, `fit_check_60` und `fit_check_180` bleiben
-- gueltige Ereignisse. Die 180-Tage-Marke wird nur nicht mehr neu
-- geplant; bereits gelegte Erinnerungen bleiben beantwortbar.

-- Zwei Ereignisse fuer die neuen Marken. Getrennte Anweisungen, weil
-- ein hinzugefuegter enum-Wert in derselben Transaktion nicht benutzt
-- werden darf.
ALTER TYPE "application_event_type" ADD VALUE IF NOT EXISTS 'fit_check_365';
--> statement-breakpoint

ALTER TYPE "application_event_type" ADD VALUE IF NOT EXISTS 'fit_check_1095';
--> statement-breakpoint

-- Der Verlauf je Empfehlung, jetzt ueber das erste Jahr hinaus.
alter table empfehlungs_ergebnisse
  add column if not exists zufriedenheit_365 integer;
--> statement-breakpoint

alter table empfehlungs_ergebnisse
  add column if not exists zufriedenheit_1095 integer;
--> statement-breakpoint

-- Die drei Angaben, ohne die der Verlauf nicht deutbar ist.
alter table check_ins
  add column if not exists wechselgrund text;
--> statement-breakpoint

alter table check_ins
  add column if not exists berufsnaehe text;
--> statement-breakpoint

alter table check_ins
  add column if not exists ausbildungspassung text;
