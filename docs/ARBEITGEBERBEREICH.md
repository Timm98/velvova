# Arbeitgeberbereich

Stand: 2. September 2026

## Was es gibt

Ein eigener Bereich unter `/business`, in dem Unternehmen Stellen
ausschreiben und Bewerbungen bearbeiten. Getrennt von der Jobsuche —
eigene Adresse, eigene Navigation, eigene Kopfzeile mit dem Namen der
Organisation.

| Seite | Zweck |
|---|---|
| `/business` | Übersicht: offene Stellen, neue Bewerbungen |
| `/business/einrichten` | Organisation gründen (ein Feld) |
| `/business/stellen` | Entwürfe und veröffentlichte Stellen |
| `/business/stellen/[id]` | Anzeige schreiben, prüfen, veröffentlichen |
| `/business/bewerbungen` | Bewerbungen mit Stand, Notiz und Absagegrund |
| `/business/team` | Mitglieder, Rollen, Einladungen |
| `/business/einstellungen` | Name und Website |
| `/business/einladung/[token]` | Einladung annehmen |
| `/admin/organisationen` | Konten bestätigen (nur Betrieb) |

Auf der Bewerberseite:

| Seite | Zweck |
|---|---|
| `/app/jobs/bewerben/[id]` | Bewerbung, mit Liste dessen, was übermittelt wird |
| `/app/applications` | Eigene Bewerbungen, Stand vom Unternehmen |

## Die Trennlinie

**Ein Unternehmen sieht nie:** den Nina-Chat, die Lebenshaltung, das
aktuelle Gehalt, die Steuerangaben, andere Bewerbungen, gespeicherte
Stellen, das Karriereprofil.

Das ist eine Eigenschaft des Schemas, keine Sorgfaltspflicht beim
Abfragen. Was ein Unternehmen sieht, steht in `posting_candidates` —
einer **Kopie** der Angaben, die jemand für genau diese Stelle
freigegeben hat, entstanden im Moment der Bewerbung.

Der naheliegende Entwurf wäre gewesen, `applications` um eine
Organisationskennung zu erweitern. Daran hängen aber Notizen der Person,
ihre Termine, ihre Coaching-Sitzungen — und über `user_id` ihr ganzes
Profil. Ein vergessener Join, und das Unternehmen liest mit.

Die Kopie hat einen zweiten Grund: Eine Freigabe hat einen Zeitpunkt. Wer
sich im Januar bewirbt und sein Profil im März ändert, hat nicht
rückwirkend etwas anderes freigegeben.

**Die Gegenrichtung gilt auch:** Die interne Notiz des Unternehmens ist
für die bewerbende Person nicht sichtbar. Eine interne Notiz, die der
Bewerber lesen kann, ist keine — und dann schreibt niemand mehr eine
ehrliche.

## Rollen

| Rolle | Darf |
|---|---|
| `viewer` | alles sehen |
| `recruiter` | + Stellen schreiben, Bewerbungen bearbeiten |
| `admin` | + veröffentlichen, einladen, Rollen ändern |
| `owner` | + Besitz übertragen |

Geprüft in `verlangeRolle()` vor jeder schreibenden Handlung — und
zusätzlich in der Zeilensicherheit über `app_is_org_member()` und
`app_is_org_admin()`.

Eine unbekannte Rolle wird als `viewer` gelesen, nicht als `owner`. Der
Vorgabewert des alten Schemas war `member`; wer durch eine alte Zeile
eine unbekannte Rolle trägt, darf lesen und sonst nichts.

## Eine Lücke, die dabei gefunden wurde

`memberships` stand in der allgemeinen Eigentümerschleife von `rls.sql`:
`user_id = app_current_user_id()`, für **alle** Befehle. Postgres
verknüpft zulassende Richtlinien mit ODER — also durfte **jeder
Angemeldete sich selbst in jede Organisation eintragen**, denn die Zeile
trug ja seine eigene Kennung.

Wer die Organisationskennung kannte — sie steht in jedem
Arbeitgeber-Link —, hätte damit Zugang zu allen Bewerbungen dieses
Unternehmens gehabt.

Behoben durch getrennte Richtlinien je Befehl und
`app_create_organization()`: Organisation und Besitzer entstehen in einem
Schritt unter definierten Rechten, damit es keine Selbsteintragung
braucht. Festgehalten in `packages/db/src/arbeitgeber-rls.test.ts`.

Zusätzlich: Zeilenschutz kennt keine Spalten. Die Bewerberin darf ihre
eigene Zeile ändern — damit stünde ihr auch `stage = 'hired'` offen. Ein
Trigger (`app_posting_candidate_guard`) zieht die Spaltengrenze nach:
Zurückziehen ja, alles andere nein.

## Bestätigung

Ohne Bestätigung kann eine Organisation keine Stelle veröffentlichen.
Sonst könnte jemand ein Konto „Siemens AG" nennen und in dessen Namen
ausschreiben — Menschen bewerben sich darauf und schicken ihre Unterlagen
an jemanden, den sie für diesen Arbeitgeber halten.

Ein Mensch im Betrieb entscheidet das. Automatisch ginge es nur über die
E-Mail-Domäne, und die ist kein Beweis: Eine Freemail-Adresse sagt
nichts, eine Unternehmensadresse hat auch das Praktikum, und
Personaldienstleister schreiben rechtmässig im Namen Dritter aus.

## Anzeigenprüfung

`anzeigenpruefung.ts` prüft eine Anzeige, bevor sie hinausgeht — im
Editor beim Tippen und auf dem Server beim Veröffentlichen. Dieselbe
Funktion, weil eine Serveraktion ein Endpunkt ist: Sie lässt sich
aufrufen, ohne das Formular je gesehen zu haben.

**Blockiert:** Titel, Ort, Beschreibung, Gehaltsangabe, verdrehte Spanne.
**Wichtig:** Wochenstunden, Arbeitsmodell, `(m/w/d)` im Titel,
Formulierungen mit Alters-, Herkunfts- oder Familienstandsbezug.
**Hinweis:** Vertragsart, sehr weite Spanne, keine Leistungen genannt.

Muster statt Modell: Ein Modell würde gelegentlich etwas beanstanden, das
nicht dasteht — und wer einmal eine Formulierung geändert bekommt, die
gar nicht in seinem Text stand, liest den nächsten Hinweis nicht mehr.

## Veröffentlichte Stellen im Index

Beim Veröffentlichen entsteht eine Zeile in `jobs` mit der Quelle
**„Direkt vom Arbeitgeber"**, `salary_provenance = 'employer'` und
`apply_method = 'internal'`.

`employer` ist die verlässlichste Gehaltsherkunft im ganzen Index: Die
Zahl kommt von dem, der sie zahlt. Ohne eigenen Wert wäre sie von der
Angabe eines Portals nicht zu unterscheiden.

Beim Schliessen wird die Stelle nicht gelöscht, sondern über `expires_at`
abgelaufen — eine gelöschte Zeile nähme die Bewerbungen mit, die daran
hängen.

## Geprüft

- **1.162 Unit-Tests**, darunter 17 Zeilensicherheitsprüfungen gegen eine
  echte Datenbank (`arbeitgeber-rls.test.ts`)
- **455 E2E-Tests** über fünf Viewports, `/business` ohne axe-Verstösse
- **33 Browser-Prüfungen** des vollständigen Ablaufs
  (`scripts/arbeitgeber-pruefung.mjs`)
- **17 Adressen** mit einem frischen Konto abgeklopft, davon fünf mit
  eigener Organisation gegen eine fremde (`scripts/business-rundgang.mjs`)

## Was fehlt

- **E-Mail-Versand von Einladungen.** Der Link steht im Team-Bereich zum
  Weitergeben. Ehrlicher als ein Versand, der scheitern kann, während die
  Oberfläche „verschickt" meldet — aber unbequem.
- **Dokumente an der Bewerbung.** `document_ids` steht im Schema und wird
  nicht gefüllt. Lebenslauf und Zeugnisse gehören zu den
  schutzbedürftigsten Daten im Produkt; die Freigabe je Bewerbung braucht
  einen eigenen Durchgang.
- **Benachrichtigungen.** Weder das Unternehmen bei einer neuen Bewerbung
  noch die Person bei einem Standwechsel.
- **Nina im Arbeitgeberbereich.** Die Anzeigenprüfung ist die
  deterministische Hälfte. Eine Formulierungshilfe wäre denkbar — sie
  darf aber nie Kandidatendaten sehen.
