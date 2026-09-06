/**
 * Ein leerer Ersatz für `server-only`.
 *
 * Das echte Paket ist kein Modul mit Inhalt, sondern eine Schranke:
 * Next.js bricht den Build ab, wenn eine Client-Komponente etwas
 * importiert, das es enthält. Im Testlauf gibt es diesen Build nicht —
 * und ohne Ersatz scheitert jeder Test an einem Modul, das gar keinen
 * Code beisteuert.
 *
 * Der Ersatz hebt die Schranke NICHT auf. Sie wirkt dort, wo sie
 * gedacht ist: beim Bauen der Anwendung. Hier steht nur, dass ein
 * Testlauf sie nicht braucht.
 */
export {};
