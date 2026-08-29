# ADR 0005: Fastify-API neben Next-Route-Handlern

**Status:** angenommen · **Datum:** 2026-08-29

## Zusammenhang

Der Auftrag verlangt eine typisierte Backend-API. Die Weboberfläche
braucht sie nicht — Server Components und Server Actions erreichen die
Datenbank direkt und sparen eine Netzwerkrunde.

## Entscheidung

Beides, aber ohne zweite Wahrheit: Die Web-App arbeitet über Server
Actions gegen die geteilten Pakete. `apps/api` bedient die native App
und spätere Partner über dieselben Pakete.

## Begründung

Alles über die API zu leiten würde die Web-App verlangsamen, ohne dass
jemand davon profitiert. Gar keine API zu bauen würde die native App
blockieren, die keine Server Components ausführen kann.

Der Punkt, an dem es nicht auseinanderlaufen darf, ist die Fachlogik —
und die liegt vollständig in `packages/domain`, `packages/matching` und
`packages/db`. Beide Wege rufen dieselben Funktionen auf. Eine
Änderung an der Bewertung wirkt in beiden.

## Folgen

- Autorisierung ist an zwei Stellen umzusetzen. Der gemeinsame Nenner
  ist `withUser()` aus `packages/db`, das die eingeschränkte Rolle setzt
  — wer es vergisst, sieht keine Daten statt fremder.
- Die API ist heute schmal (Zustand, Methodik, Gesundheit). Die
  nutzerbezogenen Endpunkte folgen mit der nativen App.
