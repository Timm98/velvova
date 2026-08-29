import { darkTokens, lightTokens, radius, space, type Tokens } from "@paycheck/design-tokens";
import { useColorScheme } from "react-native";

/**
 * Dieselben Farben wie im Web.
 *
 * React Native kennt keine CSS-Variablen, deshalb kommen die Werte aus
 * derselben Tabelle in @paycheck/design-tokens. Eine Aenderung dort
 * wirkt auf beiden Plattformen - sonst laufen die Oberflaechen
 * auseinander, und das faellt erst spaet auf.
 */
export function useTokens(): Tokens {
  return useColorScheme() === "dark" ? darkTokens : lightTokens;
}

export { radius, space };
