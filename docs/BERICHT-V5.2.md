# Statusbericht V5.2 — Application Bridge und Vertrauen

Stand: 30. August 2026. Branch `feature/legal-global-metasearch`.
Checkpoint vor diesem Durchgang: `checkpoint-before-v5.2`.

---

## Gap-Abgleich

**Vorher stabilisiert** (aus dem letzten Durchgang): Routing, Auth, Runtime.
`/` liefert 200, alle App-Routen verlangen Anmeldung, `Aborted()` ist behoben und
mit einer Sperre gegen Wiederkehr gesichert.

**Vollständig vorhanden**: Source Registry und Policy Engine, kanonischer
Stellen-Graph, Job-List/Detail-Ansicht mit Split View, Modell-Router, Mondays
Gedächtnis, Belegabgleich, Betrugssignale, Chancenfunnel, Anforderungs-
klassifikation, Aufwandsschätzung, Bedingungsmatrix, Belegqualität.

**Vollständig gefehlt**: alle zwanzig Tabellen aus V5.2 ausser `memory_items`.

**Umgesetzt in diesem Durchgang**: Migration und Schema für alle zwanzig, plus
Engines und Oberflächen für Apply Capability Registry, Application Package,
Prepared Redirect, Job Briefs, Feedback und die Vertrauensseiten.

---

## Kurzfassung

| | |
| --- | --- |
| Unit-Tests | 532, grün |
| E2E-Tests | 390, grün (5 übersprungen: nur mobil) |
| Lint / Typecheck | 17/17 erfolgreich |
| Production Build | erfolgreich |
| Barrierefreiheit | 0 schwere Verstösse, beide Themen |
| Tabellen mit RLS | 57 von 96, **0 Lücken** |
| Migrationen | 7, davon 0006 neu (20 Tabellen) |
| Produktivbetrieb | **nein** |

---

## Der Kern: was beim externen Bewerben wirklich geht

Eine Webseite kann keine Formularfelder auf einer fremden Domain ausfüllen.
Browser trennen Origins — das ist keine Einschränkung, die man umgeht, sondern
der Grund, warum das Web sicher benutzbar ist.

Ein Produkt, das „wir bewerben uns für dich" verspricht, verspricht also
entweder etwas, das es nicht kann, oder es umgeht etwas, das es nicht umgehen
darf.

**Aktive Bewerbungswege:**

| Weg | Zustand |
| --- | --- |
| `prepared_redirect` | **aktiv, Standard** |
| `email_draft` | aktiv, nur bei Adresse aus freigegebener Quelle |
| `manual_only` | aktiv, wenn keine Adresse vorliegt |
| `native_apply` | vorbereitet, **kein autorisierter Partner** |
| `embedded_partner_apply` | vorbereitet, **keine Freigabe** |
| `apply_companion` | spezifiziert, nicht gebaut |

`auto_submit_allowed` ist als CHECK-Regel in der Datenbank auf `false`
festgenagelt. Nicht nur im Code — eine Konfiguration kann es nicht umgehen.

**So funktioniert der vorbereitete Verweis:** Checkliste zeigen → fehlende
Stücke benennen → Originalseite öffnen → **fragen, was passiert ist**. Der
Status bleibt „übergeben", bis ein Mensch bestätigt. „Noch nicht" ist eine
ebenso gültige Antwort wie „Ja" — ohne diese Möglichkeit wäre die Frage eine
Aufforderung.

---

## Was je Quelle gezeigt werden darf

Sechs Ebenen. Der Kern: **eine Zusammenfassung ist eine abgeleitete
Bearbeitung.** Wer den Ausgangstext nicht verwenden darf, darf auch die
Bearbeitung nicht veröffentlichen — Umschreiben ist keine Nutzungserlaubnis.

| Ebene | Wann |
| --- | --- |
| `generated_summary_allowed` | Quelle erlaubt Anzeige und Zusammenfassung |
| `licensed_excerpt` | Zusammenfassung erlaubt, Volltext nicht |
| `metadata_only` | Anzeige erlaubt, Zusammenfassung nicht |
| `link_only` | Quelle nicht freigegeben — kein Brief |
| `private_summary_only` | Text von der Person mitgebracht — bleibt bei ihr |

Ein Test prüft über das ganze Verzeichnis, dass **keine nicht freigegebene
Quelle einen Brief erzeugt** und überall entweder Verweis oder Nennung verlangt
wird. Briefe verfallen nach 72 Stunden: eine Zusammenfassung altert mit ihrer
Quelle.

**Drei Ebenen getrennt im Datenmodell** (`job_brief_facts.layer`):
`source_fact` — was die Quelle sagt. `normalized_fact` — was wir daraus gemacht
haben. `nina_interpretation` — was Monday daraus schliesst. Vermischt liest sich
eine Vermutung wie eine Zusage des Arbeitgebers.

---

## Vertrauensseiten

`/about`, `/contact`, `/ai-transparency` neu. `/imprint` an das
Freigabeverzeichnis angeschlossen.

**Der Freigabezustand wird berechnet, nicht gepflegt.** Eine handgeschriebene
Liste fehlender Angaben stünde eines Tages falsch da: die Adresse ist
eingetragen, der Hinweis behauptet weiter, sie fehle. Hier ändert sich der Text
von selbst.

| Seite | Zustand |
| --- | --- |
| Impressum | **Entwurf** — 7 Pflichtangaben fehlen |
| Datenschutz | **Juristische Prüfung ausstehend** |
| Nutzungsbedingungen | **Entwurf** |
| KI-Transparenz | freigegeben — Selbstauskunft, im Code belegbar |
| Quellenrichtlinie | freigegeben |

Adressen wie `name@....com` erscheinen nirgends: sie sehen fertig aus und sind
es nicht. Wer darauf schreibt, bekommt keine Antwort und weiss nicht, warum.

**Die Rollenbezeichnungen von Tim und Finn bleiben unveröffentlicht**, bis
`NEXT_PUBLIC_TEAM_ROLES_CONFIRMED=true` gesetzt ist. Eine falsche Rollenangabe
im Impressum ist ein Rechtsfehler, keine Ungenauigkeit.

---

## Feedback

Der Kontext kommt automatisch mit — wer ihn tippen muss, tippt ihn nicht.
Persönliches kommt nicht mit: aus `/app/jobs?q=Pflege+Teilzeit&ort=Hamburg`
wird `/app/jobs`. Ein Suchbegriff sagt mehr über eine Person, als sie in einen
Fehlerbericht schreiben wollte.

Anonym ist ein gültiger Weg: wer ein Datenschutzproblem meldet, soll das nicht
mit seinem Namen tun müssen. Und es wird **nicht direkt nach einer Absage**
gefragt — der Moment gehört der Person, nicht unserer Produktverbesserung.

---

## Was du lokal setzen musst

| Variable | Wofür |
| --- | --- |
| `OPENAI_API_KEY` | Monday antwortet über echte KI (**neuer Schlüssel, der alte ist verbrannt**) |
| `SUPABASE_SECRET_KEY` | serverseitige Läufe |
| `DATABASE_URL` | Migrationen gegen Supabase |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | zweite Stellenquelle |
| `JOOBLE_API_KEY_DE` | dritte Stellenquelle |
| `NEXT_PUBLIC_COMPANY_*` | Impressum |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_PRIVACY_EMAIL` | Kontaktwege |
| `NEXT_PUBLIC_TEAM_ROLES_CONFIRMED` | erst nach rechtlicher Bestätigung |

Supabase-URL und der `sb_publishable_`-Schlüssel stehen bereits in `.env.local`.

---

## Fehlende externe Freigaben

- **Kein autorisierter Native-Apply-Partner.** Ohne schriftliche Vereinbarung
  mit SmartRecruiters, Greenhouse oder einem Arbeitgeber bleibt es beim
  vorbereiteten Verweis.
- **Kein registriertes Arbeitgeberboard.** Die Adapter laufen, die Tabelle ist
  leer.
- **Kein Lightcast-Vertrag**, kein Jooble-/Adzuna-Zugang.
- **Keine Auftragsverarbeitungsverträge** mit Modell- und E-Mail-Anbieter.
- **Keine juristische Prüfung** von Impressum, Datenschutz und AGB.

---

## Was nicht umgesetzt ist

**Google-/Apple-Anmeldung und Identity Linking** — die Tabellen stehen
(`connected_identities`, `auth_identity_audit`), die OAuth-Anbindung braucht
konfigurierte Supabase-Provider und Redirect-URLs.

**E-Mail-Infrastruktur** — Tabellen für Präferenzen, Einwilligungen,
Zustellungen und Sperrliste stehen. Der Versand braucht `RESEND_API_KEY` und
eine verifizierte Domain mit SPF, DKIM und DMARC.

**Monday Interview V2** mit den neun Passungsdimensionen und der
Rollenexploration — konzeptionell aus V5.2 übernommen, nicht gebaut.

**Langfristige Jobbewertung**, **öffentliche FAQ-Monday**, **persönliche
Support-Monday mit Memory Controls**, **Apply Companion** — nicht begonnen.

**Sieben Addendum-V5.1-Punkte** haben weiterhin Tabellen, aber keine
Oberfläche: Candidate Passport, Watchtower, Follow-up, Kanalportfolio,
Suchplaner, Prozesstransparenz, Equivalency-Speicherung.

---

## Bekannte Risiken

- **Kein Ratenlimit** auf Anmeldung, Gesprächs- und Feedback-Endpunkten.
- **Keine Verschlüsselung** schutzbedürftiger Freitexte.
- **PGlite statt Supabase.** Einzelschreiber, für Produktion ungeeignet. Die
  Sperre verhindert den Absturz, ersetzt aber keinen echten Server.
- **Kein Penetrationstest**, kein unabhängiges Audit.
- Die Designsprache der **Anwendung** ist weiterhin Obsidian & Ice aus V3. Nur
  die Landingpage folgt Future Editorial.

---

## Befehle

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm --filter @paycheck/web dev     # nur Web — der Worker teilt sich PGlite nicht
                                    # http://localhost:3000
                                    # Anmeldung: /api/dev/login

pnpm lint && pnpm typecheck
pnpm test                            # 532 Unit-Tests
pnpm test:e2e                        # 390 E2E-Tests
pnpm build && pnpm --filter @paycheck/web start
```
