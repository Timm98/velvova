# Was eine Juristin prüfen muss

Diese Liste ist für den Termin gedacht, nicht für das Archiv. Sie sagt, was
technisch bereits durchgesetzt ist — und was eine rechtliche Entscheidung
braucht, die im Code nicht getroffen werden kann.

## Zuerst: die eine Regel

**Umformulieren ist keine Rechtsgrundlage.** Fremde Inhalte durch ein
Sprachmodell zu paraphrasieren macht sie nicht zu eigenen. Dieser Satz steht im
Kopf von `apps/web/src/lib/sources/decision-types.ts`, weil er die häufigste
Fehlannahme in diesem Produktbereich ist.

## Quellen

- [ ] Ist der Zugriffsmodus je Quelle richtig eingestuft?
      `docs/LEGAL_SOURCE_REGISTER.md`, erzeugt aus derselben Registry, die die
      Engine durchsetzt.
- [ ] Trägt jede aktive Quelle eine tragfähige Rechtsgrundlage, mit erreichbarer
      Fundstelle?
- [ ] Sind die erlaubten Operationen je Quelle richtig? Insbesondere: darf
      zusammengefasst werden, wo gelesen werden darf?
- [ ] Sind die erlaubten Felder eng genug? Bei `link_only` nur Titel,
      Unternehmen, Ort und Verweis.
- [ ] Sind die Prüffristen (`reviewDueAt`) angemessen?
- [ ] Ist die Kennzeichnung ausreichend, wo sie verlangt ist?

**Technisch durchgesetzt:** unbekannte Quelle → `pending_review`; abgelaufene
Prüffrist → `pending_review`; nicht freigegeben → kein Netzzugriff; Anzeige nur
mit `PublicDisplay` **und** vorhandenem Quellverweis.

**Rechtlich zu entscheiden:** ob die Einstufungen stimmen. Der Code setzt
durch, was eingetragen ist — er weiss nicht, ob es richtig ist.

## Aussagen über Reichweite

- [ ] Ist die Reichweitenaussage zutreffend?

Das Produkt sagt nie, es durchsuche „alle Jobs im Internet“. Der Satz wird von
`coverageStatement()` aus den gezählten Entscheidungen gebaut — die falsche
Aussage ist strukturell nicht formulierbar. Zu prüfen ist, ob die richtige
Aussage genügt.

## Automatisierte Entscheidungen

- [ ] Liegt eine automatisierte Entscheidung im Einzelfall vor?

Argumente dagegen, die im Code belegt sind: keine Ablehnung, keine
Vorauswahl für einen Arbeitgeber, jede Aussage vom Menschen bestätigt, jeder
Wert mit Begründung, keine Darstellung als Einstellungswahrscheinlichkeit.

Das Argument dafür: es wird systematisch bewertet und sortiert.

**Diese Frage ist nicht technisch zu beantworten.**

## KI-Verordnung

- [ ] Einstufung: Hochrisiko oder nicht?

Beschäftigung ist ein Hochrisikobereich. Der Unterschied hier: das System
bewertet Bewerbende nicht **für** einen Arbeitgeber, sondern unterstützt die
suchende Person **selbst**. Ob diese Unterscheidung trägt, gehört geprüft.

- [ ] Genügt die Systemkarte (`docs/AI_SYSTEM_CARD.md`) den Transparenzpflichten?
- [ ] Reicht die menschliche Aufsicht?

## Datenschutz

- [ ] Ist die Einwilligung zur Modellnutzung freiwillig?

Argument: die Bewertungslogik läuft ohne Modell. Ein Widerruf kostet das
Gespräch, nicht das Produkt. Das ist die Grundlage der Freiwilligkeit — und der
Grund, warum die Bewertung bewusst regelbasiert ist.

- [ ] Sind besondere Kategorien im Freitext ausreichend behandelt?
      **Bekannte Lücke:** die Verschlüsselung schutzbedürftiger Freitexte ist
      vorgesehen, aber nicht implementiert.
- [ ] Sind die Aufbewahrungsfristen angemessen? Sie sind dokumentiert, aber
      nicht technisch erzwungen.
- [ ] Auftragsverarbeitungsverträge — **offen**.
- [ ] Drittlandübermittlung beim Modellanbieter — **offen**.

## Bewerbungen

- [ ] Genügt die Freigabe als Zustimmung zum Versand?
- [ ] Ist der Belegabgleich haftungsrechtlich hilfreich oder eine Zusage, die
      wir nicht halten können?

Der Code sperrt die Freigabe bei unbelegter Aussage. Das ist strenger als eine
Warnung, aber der Abgleich arbeitet mit Wortüberlappung und ist kein
inhaltliches Verständnis.

## Nicht verhandelbar

Diese Punkte sind im Code durchgesetzt und stehen nicht zur Abwägung:

- kein Scraping nicht freigegebener Quellen
- kein Massenversand, keine automatische Bewerbung
- keine Aussage über geschützte Merkmale
- keine Emotions-, Gesichts-, Akzent- oder Ehrlichkeitsanalyse
- kein Wert als Einstellungswahrscheinlichkeit
- keine verdeckte Weitergabe individueller Profile
