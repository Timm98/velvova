# Das Karrieregespräch

Wie Monday fragt, warum in dieser Reihenfolge, und was mit den Antworten
geschieht.

## Die Haltung

Wer Arbeit sucht, steht unter Druck. Das Gespräch darf ihn nicht vergrössern.
Daraus folgen drei Dinge, die man an der Oberfläche sieht:

- **Fortschritt zählt Themen, keine Prozente.** „7 von 12 Themen verstanden“
  statt „58 % vollständig“. Eine Prozentzahl behauptet eine Messung, die es
  nicht gibt, und erzeugt Druck an einer Stelle, an der keiner hingehört.
- **Jede Frage kann übersprungen werden.** Ein übersprungenes Thema ist kein
  Versäumnis; es senkt die Zuversicht, nicht die Passung.
- **Keine Streaks, keine Tagesziele, kein Countdown.**

## Die zwölf Themen

| Thema | Wonach gefragt wird | Pflicht |
| --- | --- | --- |
| `consent_and_goal` | Einwilligung, Ziel der Suche | ✓ |
| `current_situation` | wo die Person gerade steht | ✓ |
| `background` | Ausbildung, Werkzeuge, Zertifikate | |
| `experience_episodes` | konkrete Situationen, keine Selbstbeschreibungen | ✓ |
| `tasks_and_energy` | was Kraft gibt, was sie zieht | ✓ |
| `feedback_and_recognition` | was andere an ihr sehen | |
| `work_style_and_environment` | wie sie arbeitet, worin sie aufgeht | |
| `values_and_motives` | was ihr wichtig ist | |
| `hard_constraints` | Gehalt, Zeit, Ort, Gesundheit | ✓ |
| `location_and_logistics` | Wege, Verkehrsmittel, Grenzen | ✓ |
| `learning_goals` | Richtung, Lernbereitschaft | |
| `micro_work_samples` | kurze Aufgaben, freiwillig | |

Sechs sind Pflicht. Sie bilden den Riegel vor personalisierten Vorschlägen:
ohne sie gibt es keine Empfehlungen, weil eine Empfehlung ohne Datenlage eine
Behauptung wäre.

**Die Abdeckung gehört der Person, nicht einer Sitzung.** Wer ein zweites
Gespräch beginnt, verliert sein Profil nicht — der Riegel rechnet über alle
Sitzungen. Die erste Fassung hing an der zuletzt aktualisierten Sitzung, und
ein neues Gespräch setzte den Fortschritt scheinbar zurück.

## Wie gefragt wird

**Nach Situationen, nicht nach Eigenschaften.** „Erzähl mir von einer Situation,
in der etwas schiefging und du es gelöst hast“ — nicht „Bist du
lösungsorientiert?“. Die zweite Frage misst, wie gut jemand Bewerbungssprache
kann. Genau das soll dieses Produkt ersetzen, nicht belohnen.

**Eine Frage auf einmal.** Eine Formularwand mit zwölf Feldern ist schneller
auszufüllen und liefert schlechtere Antworten.

**Nachfragen statt annehmen.** Bleibt eine Antwort vage, fragt Monday nach dem
Konkreten: was genau getan wurde, was daraus wurde. Aus „ich bin teamfähig“
wird nichts; aus „ich habe eine Eskalation übernommen und bis zur Lösung
begleitet“ wird ein Beleg.

**Der Zweck steht daneben.** Zu jeder Frage ist abrufbar, wofür die Antwort
gebraucht wird. Eine Frage nach Gesundheit ohne diese Erklärung ist übergriffig.

## Was mit den Antworten geschieht

Aus einer Antwort werden Aussagen (`evidence_items`) mit:

- **Herkunft** — `user_stated`, `user_confirmed`, `document_extract`,
  `ai_hypothesis`, `external_source`, `work_sample`
- **Zuversicht** — 0 bis 1
- **Zustand** — bestätigt, offen, verworfen

**Nichts zählt, bevor die Person es bestätigt hat.** Eine abgeleitete Aussage
steht sichtbar als Vermutung da und fliesst in keine Empfehlung ein. Das ist
kein Vorsichtszusatz: `isConfirmedFact()` entscheidet darüber, ob eine Aussage
in der Bewertung überhaupt vorkommt.

Verworfene Aussagen bleiben verworfen. Sie tauchen nicht als offene Vermutung
wieder auf — sonst schlüge das Produkt der Person immer wieder dasselbe vor,
das sie bereits abgelehnt hat.

## Wiederaufnahme

Der Vorgangszustand liegt in der Datenbank, nicht im Kontextfenster des
Modells. Nach einem Neustart, einem Gerätewechsel oder drei Tagen Pause steht
dieselbe Antwort bereit:

> Zuletzt: Bewerbung begonnen. Offen ist: Bewerbung fortsetzen. Möchtest du
> dort weitermachen? — Monday

Liegt kein Ereignis vor, behauptet die Antwort nichts. Das ist der Unterschied
zwischen Erinnern und So-tun-als-ob.

## Sprachmodus

Optional, gleichwertig, nie Pflicht. Sprache ist für manche Menschen der
einzige Weg, frei zu erzählen, und für andere eine Hürde. Ist kein Anbieter
verbunden, ist der Knopf deaktiviert — mit Begründung, nicht nur ausgegraut.

**Keine Analyse der Stimme.** Kein Akzent, keine Emotion, keine Ehrlichkeit.
Nur der Wortlaut.

## Grenzen

- Der Demo-Anbieter liefert Beispielantworten ohne inhaltliche Aussage. Das
  steht als Badge am Gespräch, nicht in einer Fussnote.
- Die Ableitung von Aussagen ist nicht validiert. Deshalb steht die Bestätigung
  durch die Person davor und nicht dahinter.
- Zwölf Themen sind eine Setzung, keine Erkenntnis. `docs/RESEARCH_BASIS.md`
  sagt, worauf sie beruht und worauf nicht.
