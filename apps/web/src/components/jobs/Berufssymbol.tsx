import {
  Briefcase, Building2, Car, ChefHat, Cpu, Factory, GraduationCap, HardHat,
  HeartPulse, Landmark, Leaf, Package, PenTool, Scale, ShoppingCart, Sparkles,
  Stethoscope, Truck, Users, Wrench, Zap,
} from "lucide-react";

/**
 * Ein Berufssymbol statt eines Fotos in der Liste.
 *
 * ── Was hier stand ────────────────────────────────────────────
 *
 * Ein Foto im Format 96 mal 48 Pixel — ein flacher Streifen neben
 * jeder Zeile. Bei 25 Zeilen ergab das 25 Bilder, die alle ungefähr
 * gleich aussahen, und gelegentlich eines, das die falsche Arbeit
 * zeigte.
 *
 * ── Warum ein Symbol besser ist als ein Bild ──────────────────
 *
 * Ein Foto neben einer Anzeige liest sich als „so sieht es dort aus".
 * Das wissen wir nicht — wir wissen nur die Berufsgruppe. Ein Symbol
 * behauptet genau so viel, wie wir belegen können, und es kann nicht
 * halb falsch sein: Ein Paketsymbol bei einer Lieferstelle ist
 * richtig, ein Foto eines fremden Lieferwagens wäre erfunden.
 *
 * Das grosse Motiv bleibt im Detailbereich, wo Platz für ein Bild ist
 * und wo es zur Stelle gehört, die man gerade ansieht.
 *
 * ── Warum nach amtlicher Kennung ──────────────────────────────
 *
 * Die ersten zwei Ziffern der KldB benennen die Berufshauptgruppe.
 * Sie stehen an 73,5 Prozent der Stellen und stammen von der
 * Bundesagentur, nicht aus einer Titelvermutung. Wo sie fehlt, steht
 * ein neutrales Koffersymbol — es sagt nichts Falsches.
 */

/** Die 37 Berufshauptgruppen der KldB 2010, auf Symbole gelegt. */
const SYMBOL: Record<string, typeof Briefcase> = {
  "11": Leaf, "12": Leaf, "21": Factory, "22": PenTool, "23": Factory,
  "24": Factory, "25": Wrench, "26": Zap, "27": Cpu, "28": PenTool,
  "29": ChefHat, "31": HardHat, "32": HardHat, "33": HardHat, "34": Wrench,
  "41": Leaf, "42": Leaf, "43": Cpu, "51": Package, "52": Truck,
  "53": HardHat, "54": Sparkles, "61": ShoppingCart, "62": ShoppingCart,
  "63": ChefHat, "71": Building2, "72": Landmark, "73": Scale,
  "81": HeartPulse, "82": Stethoscope, "83": Users, "84": GraduationCap,
  "91": GraduationCap, "92": PenTool, "93": PenTool, "94": PenTool, "95": Users,
};

/**
 * Ein ruhiger Farbton je Gruppe.
 *
 * Aus der Kennung gerechnet, damit dieselbe Gruppe immer dieselbe
 * Farbe hat — sonst wäre es Dekoration statt Wiedererkennung. Die
 * Sättigung bleibt niedrig: Das Symbol soll die Zeile begleiten,
 * nicht mit dem Jobtitel um Aufmerksamkeit ringen.
 */
function farbton(schluessel: string): number {
  let n = 0;
  for (const z of schluessel) n = (n * 31 + z.charCodeAt(0)) % 360;
  return n;
}

export function Berufssymbol({
  kldb,
  className,
}: {
  kldb?: string | null;
  className?: string;
}) {
  const gruppe = (kldb ?? "").replace(/\D/g, "").slice(0, 2);
  const Zeichen = SYMBOL[gruppe] ?? Briefcase;
  const ton = gruppe.length === 2 ? farbton(gruppe) : 240;

  return (
    <span
      aria-hidden
      className={`grid size-11 shrink-0 place-items-center rounded-(--radius-md) ${className ?? ""}`}
      style={{
        /* Sehr geringe Sättigung — auch im dunklen Modus tragbar, weil
           die Deckkraft niedrig ist und der Grund durchscheint. */
        backgroundColor: `hsl(${ton} 42% 50% / 0.12)`,
        color: `hsl(${ton} 38% 42%)`,
      }}
    >
      <Zeichen className="size-5" strokeWidth={1.7} />
    </span>
  );
}
