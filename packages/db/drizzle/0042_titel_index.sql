-- Index auf den bereinigten Stellentitel.
--
-- `beruf_zuordnung` schlüsselt nach dem Titel ohne „(m/w/d)". Jede
-- Abfrage, die darüber verknüpft, rechnet den Ausdruck sonst für jede
-- der 1,09 Millionen Zeilen neu — der Nachtrag der KldB-Kennung schaffte
-- damit 10.000 Zeilen je Minute und hätte fast zwei Stunden gebraucht.
--
-- Als Ausdrucksindex steht das Ergebnis in der Tabelle und die
-- Verknüpfung wird zum Nachschlagen.
create index if not exists jobs_titel_bereinigt_idx
  on jobs (lower(btrim(regexp_replace(title, '\s*\(m/w/d\)|\s*\(w/m/d\)|\s*m/w/d', '', 'gi'))));
