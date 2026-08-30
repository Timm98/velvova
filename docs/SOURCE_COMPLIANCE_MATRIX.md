<!--
  ERZEUGT — nicht von Hand bearbeiten.

  Quelle: packages/sources/src/source-registry.ts
  Neu erzeugen: node scripts/generate-source-docs.mjs

  Von Hand gepflegte Compliance-Tabellen laufen auseinander. Dieses
  Dokument kann das nicht: es wird aus derselben Datei erzeugt, die die
  Policy Engine benutzt.
-->

# Quellen-Compliance-Matrix

Stand: 2026-08-30

> **Technische Risikosteuerung, keine Rechtsberatung.**
> Diese Tabelle bildet ab, was der Code durchsetzt. Vor einem öffentlichen
> Betrieb, großflächiger Metasuche, Bewertungsaggregation oder nativer
> Bewerbung muss eine auf Datenbank-, Wettbewerbs-, Urheber-, Datenschutz-
> und Plattformrecht spezialisierte Kanzlei die konkreten Verträge, Länder
> und Datenflüsse prüfen.

| Quelle | Grundlage | Entscheidung | Suchen | Abrufen | Cachen | Anzeigen | Zusammenfassen | Einbetten | Ranken | Native Apply |
|---|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Jooble Deutschland | `official_api_terms` | nur Verweis | — | — | — | — | — | — | — | — |
| Jooble Schweiz | `official_api_terms` | nur Verweis | — | — | — | — | — | — | — | — |
| Jooble Österreich | `official_api_terms` | nur Verweis | — | — | — | — | — | — | — | — |
| Adzuna Deutschland | `official_api_terms` | nur Verweis | — | — | — | — | — | — | — | — |
| Greenhouse (Arbeitgeberboards) | `employer_authorization` | freigegeben | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Lever (Arbeitgeberboards) | `employer_authorization` | freigegeben | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Ashby (Arbeitgeberboards) | `employer_authorization` | freigegeben | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| SmartRecruiters (Arbeitgeberboards) | `employer_authorization` | freigegeben | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Arbeitnow | `official_api_terms` | freigegeben | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Lightcast | `commercial_contract` | nur Verweis | — | — | — | — | — | — | — | — |
| LinkedIn | `link_only` | nur Verweis | — | — | — | — | — | — | — | — |
| Indeed | `link_only` | nur Verweis | — | — | — | — | — | — | — | — |
| StepStone | `link_only` | nur Verweis | — | — | — | — | — | — | — | — |
| Monster | `link_only` | nur Verweis | — | — | — | — | — | — | — | — |
| XING | `link_only` | nur Verweis | — | — | — | — | — | — | — | — |
| Glassdoor | `link_only` | nur Verweis | — | — | — | — | — | — | — | — |
| kununu | `link_only` | nur Verweis | — | — | — | — | — | — | — | — |
| Google for Jobs | `link_only` | nur Verweis | — | — | — | — | — | — | — | — |
| Bundesagentur für Arbeit | `government_partnership` | nur Verweis | — | — | — | — | — | — | — | — |
| EURES | `government_partnership` | nur Verweis | — | — | — | — | — | — | — | — |
| Von dir hinzugefügt | `user_private_import` | privat | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | — |

## Was die Engine erzwingt

- Eine Quelle **ohne Eintrag** ist `ungeprüft` — nicht „vermutlich in Ordnung".
- Eine Quelle **ohne Freigabe** wird nicht abgerufen. Auch nicht, um sie
  anschließend umzuformulieren: *Umformulieren ist keine Rechtsgrundlage.*
- **Kein `Summarize` ohne `FetchDetails`.** Wer nicht lesen darf, darf auch
  nicht zusammenfassen.
- Eine Stelle **ohne Verweis auf das Original** wird nicht veröffentlicht.
- Eine **abgelaufene Prüfung** setzt die Quelle selbsttätig auf `ungeprüft`.
- Der **Kill Switch** wirkt vor dem ersten Netzzugriff, nicht danach.

Durchgesetzt in `packages/sources/src/policy-engine.ts`, geprüft in
`packages/sources/src/policy-engine.test.ts`.
