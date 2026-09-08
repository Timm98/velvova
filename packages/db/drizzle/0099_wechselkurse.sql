-- Wechselkurse, damit ein Gehalt aus Zürich in Euro lesbar ist.
--
-- ══════════════════════════════════════════════════════════════
-- Was hier umgerechnet wird — und was ausdrücklich nicht
-- ══════════════════════════════════════════════════════════════
--
-- Umgerechnet werden AUSGESCHRIEBENE Beträge: Eine Stelle in Zürich
-- nennt 95.000 CHF, und wer in Deutschland sucht, soll sie neben
-- deutschen Stellen einordnen können. Das ist eine Umrechnung, keine
-- Behauptung.
--
-- Nicht umgerechnet wird ein Lohnniveau. `lib/landeslage.ts` begründet
-- das ausführlich: Aus einem deutschen Beispielgehalt „53.000 €" ein
-- schweizerisches zu machen, indem man den Kurs anwendet, wäre eine
-- Aussage über den Schweizer Arbeitsmarkt, die niemand geprüft hat.
-- Löhne folgen keinem Wechselkurs.
--
-- ══════════════════════════════════════════════════════════════
-- Warum eine Tabelle und kein Zwischenspeicher im Arbeitsspeicher
-- ══════════════════════════════════════════════════════════════
--
-- Weil jede Serverinstanz sonst ihren eigenen Kurs hätte. Zwei
-- Besucher sähen dieselbe Stelle mit verschiedenen Beträgen, je
-- nachdem, welche Instanz gerade antwortet — und beim Neuladen änderte
-- sich die Zahl ohne Anlass.
--
-- Mit einer Tabelle gibt es einen Kurs, ein Datum und eine Antwort auf
-- die Frage „wovon ist das umgerechnet".
--
-- ── Der Stand gehört dazu ───────────────────────────────────
--
-- `stand` ist der Tag, für den die EZB den Kurs veröffentlicht hat;
-- `geholt_am` ist der Zeitpunkt unseres Abrufs. Sie sind verschieden,
-- und der Unterschied zählt: Die EZB veröffentlicht an Werktagen gegen
-- 16 Uhr. Am Sonntag ist der frischeste Kurs zwei Tage alt, und das
-- ist kein Fehler — aber es soll dastehen.
--
-- ── Basis ist immer EUR ─────────────────────────────────────
--
-- So veröffentlicht die EZB, und so bleibt es hier. Jede andere
-- Umrechnung läuft über EUR als Zwischenschritt. Kreuzkurse selbst zu
-- bilden hiesse, zwei Rundungen zu einer zusammenzufassen und das
-- Ergebnis für genauer zu halten, als es ist.
create table if not exists wechselkurse (
  waehrung    text primary key,
  -- Wie viele Einheiten dieser Währung ein Euro kostet.
  -- USD 1.1622 heisst: 1 EUR = 1,1622 USD.
  kurs        numeric(18, 6) not null check (kurs > 0),
  -- Der Tag, für den die Quelle den Kurs nennt.
  stand       date not null,
  quelle      text not null default 'ecb',
  geholt_am   timestamptz not null default now()
);
