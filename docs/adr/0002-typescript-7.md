# ADR 0002: TypeScript 7.0.2 statt 5.x

**Status:** angenommen · **Datum:** 2026-08-29

## Zusammenhang

Der Auftrag verlangt die neuesten stabilen, nicht-beta Pakete. Zum
Zeitpunkt des Baus ist TypeScript 7.0.2 der `latest`-Tag; 5.9.3 ist die
letzte 5er-Fassung. TypeScript 7 ist die native Portierung des
Compilers.

## Entscheidung

TypeScript 7.0.2, fixiert in allen Paketen.

## Begründung

7.0.2 trägt den `latest`-Tag, ist also die stabile Fassung — nicht `rc`
oder `next`. Die Kompatibilität wurde geprüft, nicht angenommen: Next
16.3.3, Drizzle 0.45.2, Zod 4.5.2, Vitest 4.1.11 und Fastify 5.12.1
typechecken alle fehlerfrei.

Die Fehler beim ersten Lauf waren eigene Fehler, keine
Compiler-Inkompatibilitäten:
- ein `Object.fromEntries`-Cast, der besser explizit aufgebaut wird
- ein fehlendes `@types/node` in mehreren Paketen

## Folgen

- Parameter-Properties (`constructor(private readonly x: T)`) werden
  vermieden. Nicht wegen TypeScript 7, sondern weil Nodes
  `--experimental-strip-types` sie nicht unterstützt und die
  Wartungsskripte darüber laufen.
- Sollte ein Werkzeug später mit TS 7 brechen, ist der Rückweg auf 5.9.3
  eine Zeile je Paket.

## Nachtrag, 2026-08-30: kein ESLint

Der Auftrag für die zweite Ausbaustufe nennt ESLint. Der Versuch, es
einzurichten, scheitert an genau dieser Entscheidung:

```
typescript-eslint does not support TS 7.0.
```

`eslint-config-next` zieht `typescript-eslint` mit, und das weigert sich,
mit TypeScript 7 zu laufen. Damit ist keine `.tsx`-Datei parsbar.

Drei Möglichkeiten, eine gewählt:

1. **Auf TypeScript 6 zurückgehen**, nur damit der Linter läuft.
   Verworfen: der Typprüfer ist das schärfere Werkzeug, und er ist hier
   die Grundlage von allem.
2. **TypeScript 6 zusätzlich installieren** und den Linter dagegen
   laufen lassen. Verworfen: zwei Compilerfassungen im selben Projekt
   erzeugen genau die Art von Abweichung, die man nicht bemerkt, bis sie
   wehtut.
3. **Vorerst ohne ESLint arbeiten.** Gewählt.

Was den Ausfall abfedert:

- `tsc --noEmit` läuft über jedes Paket, auch über die Web-App. Der
  Großteil dessen, was ein Linter fängt, fängt er auch.
- Die Barrierefreiheitsregeln, die `jsx-a11y` statisch prüfen würde,
  prüft die axe-Suite an der **laufenden Seite** — gründlicher, weil sie
  berechnete Farben und tatsächliche Größen sieht statt Quelltext.

Sobald `typescript-eslint` TypeScript 7 unterstützt, wird ESLint
nachgezogen. Bis dahin steht hier, warum es fehlt — statt eines
Lint-Skripts, das grün aussieht und nichts prüft.
