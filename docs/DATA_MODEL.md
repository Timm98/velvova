# Datenmodell

57 Tabellen, migrationsbasiert. Schema in `packages/db/src/schema/`,
Migration in `packages/db/drizzle/`.

## Aufteilung

| Datei | Inhalt |
|---|---|
| `enums.ts` | Alle Aufzählungen, gespiegelt aus `@paycheck/domain` |
| `identity.ts` | Konten, Sitzungen, Einwilligungen, Integrationen, Audit |
| `profile.ts` | Career Evidence Graph, Gespräch, Rollencluster, Taxonomie |
| `jobs.ts` | Stellen, Quellen, Unternehmen, Bewertungen, Matches |
| `applications.ts` | Bewerbungen, Dokumente, Coaching, Angebote, Check-ins |
| `ops.ts` | KI-Läufe, Prompt-Fassungen, Analytics, Import-Läufe |

## Der Kern: evidence_items

Die wichtigste Tabelle. Jede Zeile ist **eine prüfbare Aussage**.

| Spalte | Zweck |
|---|---|
| `type` | 14 Knotentypen von `experience_episode` bis `occupation` |
| `statement` | Der Satz, in der Sprache des Menschen |
| `source_type` | Woher: gesagt, bestätigt, aus Dokument, Hypothese, extern, Kurzaufgabe |
| `source_ref` | Verweis auf Gesprächsschritt, Dokumentseite oder Quelle |
| `confidence` | 0..1 — wie sicher die Aussage ist, nicht wie gut |
| `user_confirmed` | **Der Riegel.** Ohne dies zählt nichts |
| `user_rejected` | Abgelehnt: bleibt sichtbar, zählt nie wieder |
| `sensitivity_level` | Steuert Verschlüsselung und externe Weitergabe |
| `retention_class` | `session_only`, `profile` oder `legal_minimum` |
| `statement_encrypted` | Für besonders schutzbedürftige Freitexte |
| `deleted_at` | Soft Delete; der Worker räumt nach 30 Tagen auf |

`isConfirmedFact()` in `@paycheck/domain` entscheidet an **einer** Stelle,
was als Fakt gilt. Alles andere ruft diese Funktion auf.

`evidence_edges` bildet Beziehungen ab: `demonstrates`, `supports`,
`contradicts`, `prefers`, `avoids`, `requires`, `transfers_to`,
`maps_to`, `derived_from`.

## Nachvollziehbarkeit von Bewertungen

`job_matches` speichert jeden Wert **mit der Fassung der Logik**
(`scoring_version`), die ihn erzeugt hat. `match_factors` speichert die
einzelnen Faktoren mitsamt Rohwert, Gewicht, Beitrag, Erklärung und den
Evidenz-IDs, die ihn stützen.

Ohne das ließe sich ein drei Monate alter Wert nicht mehr erklären.

## Claim-Provenienz

`claim_evidence_links` verbindet jede prüfbare Aussage eines erzeugten
Dokuments mit der Evidenz, die sie trägt. Status: `supported`,
`weakened`, `unsupported`, `user_override`.

Ein Dokument mit einer `unsupported`-Aussage kann nicht freigegeben
werden — durchgesetzt in `checkApproval()`, nicht nur angezeigt.

## Quellen und Herkunft

| Tabelle | Zweck |
|---|---|
| `job_sources` | Quelle mit **Lizenzstatus**. Ohne geklärte Lizenz: nicht aktiv |
| `job_snapshots` | Rohfassung je Abruf — erlaubt zu zeigen, was sich geändert hat |
| `review_aggregates` | Bewertungen mit **Quellenart**, Stichprobe, Zeitraum, Auswahllogik |
| `review_themes` | Wiederkehrende Themen mit Stimmung und Nennungszahl |
| `source_citations` | Jede externe Aussage im Produkt hat hier eine Zeile |

Die Trennung nach `review_source_kind` ist keine Formalität:
Kundenbewertungen sagen nichts über die Arbeitskultur, und das Produkt
darf sie nicht so behandeln.

## Einwilligungen

`consents` — je Kombination aus Mensch und Art eine Zeile, mit Zweck,
Fassung des Textes, Zeitpunkt der Erteilung **und** des Widerrufs.

Ein Widerruf löscht die Zeile nicht. Sonst wäre später nicht
nachvollziehbar, was wann galt.

## Zugriffskontrolle

28 Tabellen mit direktem Nutzerbezug tragen `user_id` und haben Row Level
Security mit `FORCE`. Die Richtlinie:

```sql
USING (user_id = app_current_user_id())
WITH CHECK (user_id = app_current_user_id())
```

Tabellen ohne Personenbezug — Stellen, Unternehmen, Taxonomien — bleiben
bewusst offen lesbar.

Details in [PRIVACY_SECURITY.md](PRIVACY_SECURITY.md).

## Vollständige Tabellenliste

**Identität und Governance**
`users`, `auth_accounts`, `sessions`, `magic_links`, `user_settings`,
`consents`, `organizations`, `memberships`, `integrations`,
`privacy_requests`, `audit_logs`

**Karriereprofil**
`career_profiles`, `evidence_items`, `evidence_edges`, `experiences`,
`skills`, `profile_skills`, `preferences`, `user_constraints`,
`interview_sessions`, `interview_turns`, `micro_assessments`,
`micro_assessment_results`, `occupations`, `role_clusters`,
`role_hypotheses`

**Stellen und Unternehmen**
`job_sources`, `companies`, `jobs`, `job_snapshots`, `job_requirements`,
`company_sources`, `review_aggregates`, `review_themes`,
`source_citations`, `saved_jobs`, `job_matches`, `match_factors`

**Bewerbungen und Begleitung**
`applications`, `application_events`, `documents`,
`generated_artifacts`, `claim_evidence_links`, `deliveries`,
`coaching_sessions`, `coaching_turns`, `coaching_feedback`, `offers`,
`check_ins`, `reminders`, `notifications`

**Betrieb**
`prompt_versions`, `ai_runs`, `analytics_events`,
`feature_flag_overrides`, `job_ingestion_runs`, `_migrations`

## Was fehlt

- `pgvector` ist verfügbar, aber es gibt noch keine Embedding-Spalten.
- Die Feldverschlüsselung hat eine Spalte (`statement_encrypted`), aber
  noch keinen aktiven Schlüsselpfad.
- `organizations` und `memberships` sind für spätere B2B2C-Nutzung
  angelegt und heute unbenutzt. `can_see_individual_profiles` steht
  standardmäßig auf `false`.
