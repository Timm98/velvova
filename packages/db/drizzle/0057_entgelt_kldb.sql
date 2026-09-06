-- Amtliche Entgeltwerte, an die Berufskennung gebunden.
--
-- ── Warum es diese Tabelle gibt ───────────────────────────────
--
-- `beruf_entgelt` führt 1.926 Referenzwerte des Entgeltatlas, aber
-- verschlüsselt über den BERUFSNAMEN. Die Stellen tragen dagegen die
-- KldB-Kennung. Der Gehaltsvergleich suchte deshalb über den
-- Stellentitel — und Titelabgleich ist bei deutschen Berufsnamen
-- unzuverlässig (gemessen: die Hälfte ohne Treffer, darunter grobe
-- Fehlgriffe).
--
-- `beruf_schluessel` verbindet beides: 45.244 amtliche Bezeichnungen
-- mit ihrer KldB. Gemessen treffen 1.926 von 1.926 Entgeltnamen dort
-- EXAKT — beide Tabellen stammen von derselben Quelle und benutzen
-- dieselbe Bezeichnung. Kein Textabgleich, kein Raten.
--
-- Ergebnis: 752 KldB-Codes mit Referenzwert; 99,1 Prozent aller
-- Stellen mit Kennung finden ihren genauen Beruf.
create table if not exists entgelt_kldb (
  kldb text primary key,
  beruf text not null,
  q1 integer,
  median integer not null,
  q3 integer,
  /* Auf wie vielen sozialversicherungspflichtig Beschäftigten der
     Wert beruht. Gehört an jede Anzeige — 7.352 ist etwas anderes
     als 88.508. */
  besetzung integer,
  quelle text not null,
  stand timestamptz not null,
  berechnet_am timestamptz not null default now()
);
