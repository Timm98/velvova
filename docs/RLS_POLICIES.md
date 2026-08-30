# RLS-Richtlinien

<!-- Erzeugt aus dem Datenbankkatalog einer frisch migrierten Datenbank.
     Nicht von Hand ändern: `node scripts/generate-rls-doc.mjs`. -->

Row Level Security ist der Ort, an dem „niemand sieht fremde Daten“ durchgesetzt wird.
Der Anwendungscode kann sich irren; die Datenbank nicht.

Drei Dinge machen das wirksam, und alle drei sind leicht zu übersehen:

1. **Die Verbindung darf kein Superuser sein.** RLS gilt für Superuser nicht, und
   `FORCE ROW LEVEL SECURITY` ändert daran nichts. Der erste Anlauf des RLS-Tests ist
   genau daran gescheitert: die Richtlinien waren richtig und wirkten trotzdem nicht.
   Jede Anfrage läuft deshalb über die eingeschränkte Rolle `paycheck_app`.
2. **RLS muss eingeschaltet sein.** Eine Richtlinie auf einer Tabelle ohne
   `ENABLE ROW LEVEL SECURITY` steht in der Datenbank, sieht beruhigend aus und
   filtert nichts.
3. **Ohne gesetzte Kennung sieht eine Sitzung nichts.** `app_current_user_id()` liefert
   dann NULL, und `user_id = NULL` ist niemals wahr. Ein vergessenes `withUser()` führt
   zu einer leeren Liste, nicht zu fremden Daten.

Stand dieser Datei: **46 von 78 Tabellen** mit aktivem RLS, **46 Richtlinien**.

## Tabellen mit Row Level Security

| Tabelle | erzwungen | Richtlinien | Bedingung |
| --- | --- | --- | --- |
| `ai_runs` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `application_events` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `application_process_observations` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `applications` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `auth_accounts` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `candidate_passport_fields` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `candidate_passport_uses` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `career_profiles` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `check_ins` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `coaching_sessions` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `consents` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `deliveries` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `documents` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `evidence_edges` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `evidence_items` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `experience_equivalencies` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `experiences` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `generated_artifacts` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `integrations` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `interview_sessions` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `interview_turns` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `job_matches` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `market_reality_signals` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `memberships` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `micro_assessment_results` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `networking_contacts` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `networking_messages` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `notifications` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `offers` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `preferences` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `privacy_requests` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `profile_skills` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `reminders` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `role_clusters` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `role_hypotheses` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `saved_jobs` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `search_channel_activities` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `search_plans` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `search_space_snapshots` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `seniority_alignment_assessments` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `sessions` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `target_companies` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `user_constraints` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `user_settings` | ✓ | 1 | `(user_id = app_current_user_id())` |
| `users` | ✓ | 1 | `(id = app_current_user_id())` |
| `watchlist_job_events` | ✓ | 1 | `(user_id = app_current_user_id())` |

## Tabellen ohne Row Level Security

Diese Tabellen enthalten keine personenbezogenen Zeilen: Stellenanzeigen, Unternehmen,
Quellen, Nachschlagewerte. Sie sind für alle gleich, und eine Zeilenfilterung hätte
nichts zu filtern.

`_migrations`, `analytics_events`, `application_effort_profiles`, `audit_logs`, `claim_evidence_links`, `coaching_feedback`, `coaching_turns`, `companies`, `company_sources`, `employer_boards`, `employer_process_aggregates`, `feature_flag_overrides`, `hiring_process_templates`, `job_condition_facts`, `job_ingestion_runs`, `job_requirements`, `job_snapshots`, `job_source_links`, `job_source_timing`, `job_sources`, `jobs`, `magic_links`, `match_factors`, `micro_assessments`, `occupations`, `organizations`, `prompt_versions`, `research_evidence_registry`, `review_aggregates`, `review_themes`, `skills`, `source_citations`

## Prüfung auf Lücken

Keine Tabelle trägt eine Spalte `user_id`, ohne dass RLS aktiv ist. Das ist die
Prüfung, die zählt: eine nutzerbezogene Tabelle ohne Zeilenfilter sieht geschützt
aus und ist es nicht.

## Supabase (Produktion)

7 Migrationsdateien unter `supabase/migrations`. Darin 7 mal
`ENABLE ROW LEVEL SECURITY` und 19 `CREATE POLICY`-Anweisungen — teils
innerhalb von Schleifen, die pro Tabelle mehrere Richtlinien erzeugen.

**Diese Zahlen sind gezählt, nicht abgefragt.** Ohne laufende Supabase-Instanz gibt es
keinen Katalog, den man fragen könnte. Sobald eine Instanz erreichbar ist, gehört an
diese Stelle dieselbe Katalogabfrage wie oben — bis dahin ist der Abschnitt eine
Zählung von Absichten, kein Nachweis von Wirkung.

Geprüft wird stattdessen die Aussage der Migrationen selbst: jede neue nutzerbezogene
Tabelle braucht Richtlinien (`apps/web/src/lib/supabase/migrations.test.ts`).

---

Geprüft in `packages/db/src/db.test.ts` (echtes Postgres, zwei Nutzer, gegenseitige
Unsichtbarkeit) und `apps/web/src/lib/nina/context/build-context-envelope.test.ts`
(kein fremder Kontext im Modellaufruf).
