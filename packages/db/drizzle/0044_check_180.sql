-- Die 180-Tage-Marke.
--
-- Bisher: 30, 60, 90. Die drei liegen alle in der Probezeit, und
-- innerhalb der Probezeit sagt „ich bin zufrieden" wenig — wer eine
-- Stelle gerade angetreten hat, will sie meistens behalten.
--
-- Erst nach einem halben Jahr trennt sich, ob eine Empfehlung getaugt
-- hat. Deshalb kommt 180 hinzu; 60 bleibt für bereits erfasste
-- Antworten gültig.
alter type application_event_type add value if not exists 'fit_check_180';
