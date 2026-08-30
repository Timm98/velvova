# Vor dem ersten Produktivbetrieb

Diese Liste ist keine Formalie. Jeder Punkt steht hier, weil sein Fehlen
entweder Daten preisgibt, eine falsche Aussage erzeugt oder einen Ausfall
unsichtbar macht.

Stand: **das Produkt läuft nicht in Produktion.** Was hier offen ist, ist offen.

## Zugangsdaten

- [ ] Alle Schlüssel rotiert, die je in einem Chat, Screenshot oder Prompt
      standen. Ein veröffentlichter Schlüssel ist kompromittiert, auch wenn
      niemand ihn benutzt hat.
- [ ] `.env.local` nicht im Repository. `git log --all -- .env.local` muss leer sein.
- [ ] `.env.example` enthält nur leere Platzhalter.
- [ ] Der Test auf Geheimnisse im Browserpaket läuft nach dem Build:
      `apps/web/src/lib/no-client-secrets.test.ts`.
- [ ] Schlüssel je Umgebung getrennt. Ein Schlüssel für Entwicklung und
      Produktion heisst, dass ein Entwicklungsfehler Produktionsdaten trifft.

## Datenbank

- [ ] `DATABASE_DRIVER=pg`, `DATABASE_URL` gesetzt. PGlite ist eine
      Einzelprozess-Datenbank und für Produktion ungeeignet.
- [ ] Die Anwendung verbindet sich **nicht** als Superuser. RLS gilt für
      Superuser nicht — die Richtlinien wären vollständig wirkungslos, ohne
      dass irgendetwas fehlschlägt.
- [ ] `pnpm vitest run packages/db` grün: 33 Tabellen mit RLS, keine Tabelle
      mit `user_id` ohne Zeilenfilter.
- [ ] Sicherungen eingerichtet und **eine Wiederherstellung geprobt**. Eine
      ungeprüfte Sicherung ist eine Vermutung.

## Rechtliches

- [ ] `docs/LEGAL_SOURCE_REGISTER.md` frisch erzeugt und von einem Menschen
      gelesen.
- [ ] Kein Registry-Eintrag mit überschrittenem `reviewDueAt`.
- [ ] Jede aktive Quelle mit `legalBasisUrl`, die tatsächlich erreichbar ist.
- [ ] Kennzeichnung dort ausgegeben, wo `attributionRequired` gesetzt ist.
- [ ] DPIA von einer verantwortlichen Person gezeichnet (`docs/DPIA_DRAFT.md`
      ist ein Entwurf, keine Bewertung).
- [ ] Verzeichnis der Verarbeitungstätigkeiten geführt
      (`docs/DATA_PROCESSING_REGISTER.md`).
- [ ] Auftragsverarbeitungsverträge mit jedem Modellanbieter.

## Anwendung

- [ ] `pnpm build` fehlerfrei, `pnpm typecheck` fehlerfrei.
- [ ] `pnpm test` und `pnpm test:e2e` grün.
- [ ] Barrierefreiheit ohne schwere Verstösse in **beiden** Themen.
- [ ] CSP mit Nonce aktiv, keine Ausnahme für `unsafe-inline`.
- [ ] `/api/dev/login` und `/api/dev/reset-interview` antworten mit 404. Beide
      prüfen `NODE_ENV` **und** den Treiber; beide Riegel müssen greifen.
- [ ] Fehlerberichte ohne personenbezogene Inhalte. Anzeigentexte,
      Gesprächsinhalte und Bewerbungsentwürfe gehören in kein Protokoll.

## Betrieb

- [ ] Überwachung auf `job_sources.last_run_ok = false`.
- [ ] Kostengrenze je Modellstufe, mit Abschaltung statt stiller Verlangsamung.
- [ ] Runbook für den Quellenausfall gelesen, nicht nur vorhanden.
- [ ] Eine Person benannt, die den Not-Aus auslösen darf, und ein Weg, sie
      ausserhalb der Arbeitszeit zu erreichen.

## Was ehrlich bleiben muss

Diese Punkte sind keine technischen Aufgaben, sondern Zusagen, die im Produkt
sichtbar sind. Sie brechen leise, wenn niemand hinsieht.

- [ ] Kein Wert wird als Einstellungswahrscheinlichkeit dargestellt.
- [ ] Kein Score ohne die Zahl, auf die sich sein Text bezieht. Ein Band
      („hohe Passung“) und eine zurückgehaltene Zahl hingen einmal an zwei
      verschiedenen Schwellen — die Anzeige widersprach sich selbst.
- [ ] Keine Bewerbung ohne ausdrückliche Freigabe eines Menschen.
- [ ] Keine unbelegte Aussage in einem Dokument, das das Haus verlässt.
- [ ] Keine Aussage über geschützte Merkmale, keine Emotions-, Gesichts-,
      Akzent- oder Ehrlichkeitsanalyse.
- [ ] Die Reichweitenaussage nennt die tatsächlich abgefragten Quellen. Nicht
      „alle Jobs im Internet“ — der Satz wird aus gezählten Entscheidungen
      gebaut, damit er nicht gelogen werden kann.
