# ADR 0001: Monorepo mit pnpm und Turborepo

**Status:** angenommen · **Datum:** 2026-08-29

## Zusammenhang

Vier Anwendungen (Web, API, Worker, Mobile) teilen sich Domänentypen,
Bewertungslogik, Datenbankzugriff und Texte. Diese Logik zweimal zu
pflegen erzeugt genau die Sorte Fehler, die niemand bemerkt: zwei
Fassungen desselben Scores, die auseinanderlaufen.

## Entscheidung

Ein Monorepo mit pnpm-Workspaces und Turborepo. Die Pakete werden als
TypeScript-Quelle eingebunden, nicht als gebauter Code.

## Begründung

pnpm legt Abhängigkeiten inhaltsadressiert ab; bei dreizehn Paketen mit
großer Überschneidung spart das erheblich Platz und Installationszeit.
Turborepo führt Aufgaben nur dort aus, wo sich etwas geändert hat.

Quellpakete statt gebauter Artefakte: ein Entwickler ändert eine
Bewertungsregel und sieht sie sofort in der Web-App, ohne Build-Schritt
dazwischen. Der Preis ist, dass die Konsumenten TypeScript übersetzen
müssen — Next und Node tun das ohnehin.

## Folgen

- Alle relativen Importe nutzen `.ts`-Endungen. Das trägt sowohl Nodes
  Type-Stripping als auch Bundler; `.js`-Endungen tragen nur Bundler.
- `allowImportingTsExtensions` verlangt `noEmit` — Quellpakete werden
  nie emittiert, was hier zutrifft.
- Ein Paket ohne Konsument fällt nicht auf. Dagegen hilft nur Disziplin.
