# Antwort an Jooble — 4.9.2026

## Deutsch

Betreff: Re: 403 beim API-Zugriff — Ursache gefunden, Fehler lag bei uns

Hallo zusammen,

vielen Dank für die gezielten Rückfragen — die haben uns direkt auf die
Ursache gebracht. Der Fehler lag vollständig auf unserer Seite, eine
Freischaltung ist nicht nötig. Der Reihe nach:

**Der HOST-Parameter war die Ursache.** Wir haben gegen den Host
`https://jooble.org/api/<Schlüssel>` abgerufen, also ohne Länderpräfix,
und keinen HOST-Parameter mitgeschickt. Ihre Frage danach war der
entscheidende Hinweis. Ein Gegentest, gleiche Minute, gleiche Leitung,
gleicher Schlüssel:

    POST https://jooble.org/api/<Schlüssel>     -> 403 (Cloudflare, HTML)
    POST https://de.jooble.org/api/<Schlüssel>  -> 200, totalCount 68.358

Ein länderspezifischer Schlüssel gilt offenbar nur auf dem Host seines
Landes. Wir haben den Host inzwischen fest an das Land gebunden; der
Abruf läuft seitdem fehlerfrei.

**Zu Ihren übrigen Fragen, der Vollständigkeit halber:**

1. *Ausgehende IP:* 87.173.125.252 (IPv4; `jooble.org` hat keinen
   AAAA-Record, es ging also nie über IPv6). Es handelt sich um einen
   Anschluss ohne feste Adresse — für eine Freischaltung wäre er
   ungeeignet. Da sich die 403 als Host-Problem erwiesen hat, erübrigt
   sich das aber.

2. *User-Agent:* Wir hatten keinen gesetzt, es ging der Node-Standard
   `node` hinaus. Wir senden inzwischen einen sprechenden Wert mit
   Kontaktadresse, damit Sie uns bei Auffälligkeiten zuordnen können.

3. *Vollständige Anfrage:*

       POST https://jooble.org/api/<Schlüssel>
       Content-Type: application/json

       {"keywords":"Kundenbetreuung Sachbearbeitung Vertrieb Logistik",
        "location":"Deutschland",
        "page":"1"}

4. *Vollständige 403-Antwort:* Absender war Cloudflare, nicht Ihre
   Anwendung — der Aufruf hat die Schnittstelle nie erreicht.

       HTTP/2 403 Forbidden
       server: cloudflare
       cf-ray: a35e874a6f751909-FRA
       cf-cache-status: DYNAMIC
       content-type: text/html
       date: Fri, 04 Sep 2026 16:56:36 GMT
       last-modified: Thu, 20 Aug 2026 07:59:17 GMT
       x-upstream: 192.168.1.116:11081 : 104.18.20.223:443
       x-frame-options: SAMEORIGIN

   Körper: die generische HTML-Seite „Error 403", 4.631 Zeichen,
   `<meta name="robots" content="noindex, nofollow">`. Kein JSON, keine
   Fehlermeldung Ihrer API.

5. *Test von einem anderen Rechner:* haben wir uns gespart, nachdem der
   Host-Test die Frage beantwortet hatte — die 403 hing nicht an der
   Adresse.

**Und daraus ergibt sich unsere eigentliche Bitte.**

Wenn ein Schlüssel jeweils nur für seinen Länderhost gilt, dann brauchen
wir je Markt einen eigenen — und wir würden gern deutlich mehr Märkte
abdecken als bisher. Unser Abruf war auf DE, AT und CH ausgelegt; der
DE-Schlüssel liefert auf `at.jooble.org` und `ch.jooble.org`
erwartungsgemäß 403.

Wir betreiben eine Stellensuche mit derzeit rund 2,3 Millionen
Anzeigen aus 28 lizenzierten Quellen. Ein Abgleich unseres Bestands
gegen die 70 Länderhosts, die wir bei Ihnen bestätigen konnten, sieht
so aus:

* In **18 Ihrer Märkte** haben wir bereits Bestand, den Jooble
  verdichten würde — DE, FR, US, IT, AU, BR, CA, NL, CH, ES, ZA, PL,
  SG, IN, BE, AT, MX, NZ.
* In **52 Ihrer Märkte haben wir bislang überhaupt keine Anzeigen** —
  AE, AR, AZ, BA, BG, BH, BY, CI, CL, CO, CR, CU, CZ, DK, DO, EC, EG,
  FI, GR, HK, HR, HU, ID, IE, IL, JP, KR, KW, KZ, MA, MY, NG, NO, PE,
  PH, PK, PT, QA, RO, RS, RU, SA, SE, SK, SV, TH, TR, TW, UA, UY, UZ,
  VE. Dort wären Sie nicht eine weitere Quelle, sondern die erste.

Deshalb die Frage: Für welche dieser Märkte können Sie uns Schlüssel
ausstellen? Am liebsten für alle, in denen Sie aktiv sind.

Falls Ihnen ein gestaffelter Einstieg lieber ist, sind AT und CH der
unmittelbare Bedarf — dafür ist unser Abruf bereits gebaut und wartet
nur auf die Zugangsdaten. Eine darüber hinausgehende Rangfolge maßen
wir uns nicht an: unsere Nutzerschaft sitzt heute fast vollständig in
Deutschland, und welche Ihrer Märkte am ergiebigsten sind, wissen Sie
belastbar, wir nicht. Wenn Sie uns eine Reihenfolge vorschlagen,
nehmen wir sie.

Unser Abrufmuster können Sie dabei zugrunde legen: ein Aufruf je Markt
und Lauf, `page: "1"`, wenige Läufe am Tag. Wenn Sie ein anderes
Volumen oder eine andere Taktung vorgeben, richten wir uns danach —
sagen Sie uns einfach die Grenzen, dann tragen wir sie fest ein, statt
sie zu erproben.

Danke nochmals — die Frage nach dem HOST-Parameter hat uns viel Zeit
gespart.

Viele Grüße

---

## English

Subject: Re: 403 on API access — cause found, the error was on our side

Hello,

thank you for the very specific questions — they led us straight to the
cause. The fault was entirely on our side and no whitelisting is needed.

**The HOST was the cause.** We were calling
`https://jooble.org/api/<key>`, i.e. without the country prefix, and we
sent no HOST parameter at all. Your question about it was the decisive
hint. A direct comparison, same minute, same connection, same key:

    POST https://jooble.org/api/<key>     -> 403 (Cloudflare, HTML)
    POST https://de.jooble.org/api/<key>  -> 200, totalCount 68,358

A country-specific key evidently only works on its country's host. We
have since bound the host to the country; the ingest has run cleanly
ever since.

**Your remaining questions, for completeness:**

1. *Outbound IP:* 87.173.125.252 (IPv4; `jooble.org` has no AAAA
   record, so IPv6 was never involved). It is a connection without a
   fixed address and would be unsuitable for whitelisting — but since
   the 403 turned out to be a host issue, that is moot.

2. *User-Agent:* we had not set one; Node's default `node` went out. We
   now send a descriptive value including a contact address.

3. *Full request:*

       POST https://jooble.org/api/<key>
       Content-Type: application/json

       {"keywords":"Kundenbetreuung Sachbearbeitung Vertrieb Logistik",
        "location":"Deutschland",
        "page":"1"}

4. *Full 403 response:* the sender was Cloudflare, not your
   application — the call never reached the API.

       HTTP/2 403 Forbidden
       server: cloudflare
       cf-ray: a35e874a6f751909-FRA
       cf-cache-status: DYNAMIC
       content-type: text/html
       date: Fri, 04 Sep 2026 16:56:36 GMT
       last-modified: Thu, 20 Aug 2026 07:59:17 GMT
       x-upstream: 192.168.1.116:11081 : 104.18.20.223:443
       x-frame-options: SAMEORIGIN

   Body: the generic "Error 403" HTML page, 4,631 characters, with
   `<meta name="robots" content="noindex, nofollow">`. No JSON, no error
   message from your API.

5. *Test from a different machine:* we skipped it once the host test had
   answered the question — the 403 was not tied to the address.

**Which brings us to our actual request.**

If a key only works on its own country host, we need one per market —
and we would like to cover considerably more markets than we do today.
Our ingest was built for DE, AT and CH; the DE key returns 403 on
`at.jooble.org` and `ch.jooble.org`, as expected.

We run a job search currently holding around 2.3 million listings from
28 licensed sources. Comparing our coverage against the 70 country
hosts we were able to confirm on your side:

* In **18 of your markets** we already hold listings that Jooble would
  densify — DE, FR, US, IT, AU, BR, CA, NL, CH, ES, ZA, PL, SG, IN, BE,
  AT, MX, NZ.
* In **52 of your markets we currently hold nothing at all** — AE, AR,
  AZ, BA, BG, BH, BY, CI, CL, CO, CR, CU, CZ, DK, DO, EC, EG, FI, GR,
  HK, HR, HU, ID, IE, IL, JP, KR, KW, KZ, MA, MY, NG, NO, PE, PH, PK,
  PT, QA, RO, RS, RU, SA, SE, SK, SV, TH, TR, TW, UA, UY, UZ, VE. There
  you would not be one more source, you would be the first.

So: which of these markets can you issue keys for? Ideally all the ones
you are active in.

If you would rather start smaller, AT and CH are the immediate need —
our ingest is already built for them and is only waiting on
credentials. Beyond that we will not presume to rank your markets: our
user base today sits almost entirely in Germany, and which of your
markets are richest is something you know reliably and we do not. If
you propose an order, we will take it.

You can assume this request pattern: one call per market per run,
`page: "1"`, a handful of runs per day. If you want a different volume
or cadence, we will follow it — just tell us the limits and we will
encode them, rather than discovering them.

Thanks again — the HOST question saved us a lot of time.

Best regards
