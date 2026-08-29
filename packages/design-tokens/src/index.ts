/**
 * Tokens auch als Werte, damit die native App dieselben Farben nutzt.
 * Die CSS-Datei bleibt die Quelle für das Web; diese Tabelle wird von
 * apps/mobile gelesen, wo keine CSS-Variablen zur Verfügung stehen.
 */

/**
 * Die Form der Tokentabelle, nicht die konkreten Farben.
 *
 * Ohne diese Aufweitung wuerde "as const" die Werte des Hellmodus zu
 * Literaltypen machen - und keine dunkle Farbe koennte sie je erfuellen.
 * Derselbe Fall wie beim Textkatalog in @paycheck/i18n.
 */
export interface Tokens {
  surfacePage: string; surfaceRaised: string; surfaceSunken: string; surfaceInset: string;
  textPrimary: string; textSecondary: string; textMuted: string; textInverse: string;
  borderSubtle: string; borderDefault: string; borderStrong: string;
  accent: string; accentHover: string; accentSubtle: string; accentBorder: string;
  accentText: string; accentOn: string;
  assistant: string; assistantSubtle: string; assistantBorder: string; assistantText: string;
  positive: string; positiveSubtle: string;
  caution: string; cautionSubtle: string;
  critical: string; criticalSubtle: string;
  neutral: string; neutralSubtle: string;
}

export const lightTokens: Tokens = {
  surfacePage: "#faf8f5", surfaceRaised: "#ffffff", surfaceSunken: "#f2eee8", surfaceInset: "#ebe5dc",
  textPrimary: "#22201d", textSecondary: "#56504a", textMuted: "#6b645c", textInverse: "#faf8f5",
  borderSubtle: "#e3ddd3", borderDefault: "#d2cabd", borderStrong: "#b3a898",
  accent: "#a8442a", accentHover: "#8f381f", accentSubtle: "#fbeee9", accentBorder: "#e8c4b6", accentText: "#8f381f", accentOn: "#ffffff",
  assistant: "#4a5578", assistantSubtle: "#eef0f6", assistantBorder: "#ccd2e3", assistantText: "#3b4463",
  positive: "#2f6a45", positiveSubtle: "#e9f2ec",
  caution: "#8a6115", cautionSubtle: "#f9f1e0",
  critical: "#9c2f2f", criticalSubtle: "#f8eaea",
  neutral: "#5b5751", neutralSubtle: "#f0ece6",
};

export const darkTokens: Tokens = {
  surfacePage: "#16151a", surfaceRaised: "#201f26", surfaceSunken: "#111014", surfaceInset: "#2a2831",
  textPrimary: "#ece8e3", textSecondary: "#b5aea6", textMuted: "#9a938b", textInverse: "#16151a",
  borderSubtle: "#2e2c35", borderDefault: "#3d3a45", borderStrong: "#565161",
  accent: "#e08163", accentHover: "#eb9376", accentSubtle: "#2c1f1a", accentBorder: "#4d3327", accentText: "#f0a184", accentOn: "#16151a",
  assistant: "#9aa5cc", assistantSubtle: "#1e202c", assistantBorder: "#333853", assistantText: "#aeb8dc",
  positive: "#74c497", positiveSubtle: "#172319",
  caution: "#d9ab5c", cautionSubtle: "#262015",
  critical: "#e08585", criticalSubtle: "#2a1a1a",
  neutral: "#a09a92", neutralSubtle: "#232128",
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96 } as const;
export const radius = { sm: 6, md: 10, lg: 16, full: 999 } as const;
