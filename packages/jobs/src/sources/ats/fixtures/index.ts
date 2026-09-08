/**
 * Antwortformen der fünf ATS-Anbieter.
 *
 * Anonymisiert und von Hand gekürzt. Keine echten Firmen, keine echten
 * Stellen, keine Zugangsdaten — die Struktur ist echt, der Inhalt nicht.
 *
 * Der Zweck dieser Dateien ist nicht, den Parser zu bestätigen. Er ist,
 * den Tag festzuhalten, an dem ein Anbieter sein Format ändert: dann
 * bricht der Test, und nicht die Anzeigenliste eines Menschen.
 */

export const greenhouseResponse = {
  jobs: [
    {
      id: 4001,
      internal_job_id: 9001,
      title: "Fachkraft Lagerlogistik (m/w/d)",
      updated_at: "2026-08-20T09:12:00Z",
      absolute_url: "https://boards.greenhouse.io/musterlogistik/jobs/4001",
      location: { name: "Hamburg, Germany" },
      content: "&lt;p&gt;Du nimmst &lt;b&gt;Waren&lt;/b&gt; an und kommissionierst.&lt;/p&gt;",
      metadata: [],
    },
    {
      // Ohne absolute_url. Kommt vor, und eine Anzeige ohne Weg zum
      // Original ist für die suchende Person wertlos.
      id: 4002,
      title: "Ohne Link",
      location: { name: "Bremen" },
      content: "&lt;p&gt;Text&lt;/p&gt;",
    },
  ],
  meta: { total: 2 },
};

export const leverResponse = [
  {
    id: "9f3c2b1a-0000-4000-8000-000000000001",
    text: "Softwareentwickler Backend (m/w/d)",
    hostedUrl: "https://jobs.lever.co/mustertech/9f3c2b1a",
    applyUrl: "https://jobs.lever.co/mustertech/9f3c2b1a/apply",
    createdAt: 1_787_000_000_000,
    categories: { location: "Berlin", team: "Platform", commitment: "Vollzeit" },
    descriptionPlain: "Du baust Dienste, die viele Menschen benutzen.",
    additionalPlain: "Wir arbeiten hybrid.",
  },
];

export const ashbyResponse = {
  jobs: [
    {
      id: "b12c3d4e-0000-4000-8000-000000000002",
      title: "Pflegefachkraft (m/w/d)",
      location: "München",
      isRemote: false,
      publishedAt: "2026-08-18T00:00:00.000Z",
      jobUrl: "https://jobs.ashbyhq.com/musterklinik/b12c3d4e",
      descriptionPlain: "Du betreust Patientinnen und Patienten auf Station.",
      compensation: { compensationTierSummary: "45.000 – 52.000 EUR" },
    },
  ],
};

export const smartRecruitersResponse = {
  totalFound: 1,
  content: [
    {
      id: "743999717000000-abc",
      name: "Sachbearbeitung Kundenservice (m/w/d)",
      releasedDate: "2026-08-22T07:00:00.000+0000",
      company: { identifier: "Musterhandel", name: "Musterhandel AG" },
      location: { city: "Köln", region: "Nordrhein-Westfalen", country: "de" },
      department: { label: "Customer Service" },
      applyUrl: "https://jobs.smartrecruiters.com/Musterhandel/743999717000000-abc",
      ref: "https://api.smartrecruiters.com/v1/companies/Musterhandel/postings/743999717000000-abc",
    },
  ],
};

/** Was ein Anbieter liefert, wenn etwas schiefgeht. */
export const kaputt = {
  leerObjekt: {},
  falscherTyp: { jobs: "nicht wirklich eine Liste" },
  nullEintraege: { jobs: [null, undefined] },
  leereListe: [],
};

/**
 * Recruitee.
 *
 * Die Struktur stammt aus einem echten Abruf vom 8. September 2026
 * (zwei Mandanten, 203 Anzeigen); der Inhalt ist erfunden. Abgebildet
 * sind die Eigenheiten, die dort GEMESSEN wurden und den Parser
 * beschäftigen:
 *
 *   - Beträge als Zeichenketten (`"46000"`), nicht als Zahlen
 *   - `salary` immer vorhanden, bei 39 % durchgehend `null`
 *   - drei Arbeitsmodell-Schalter, teils mehrfach gesetzt
 *   - `description` und `requirements` als zwei getrennte HTML-Felder
 *   - Datum als `"2026-09-07 12:00:16 UTC"`, nicht ISO
 *   - `company_name` weicht vom Mandantennamen ab
 *
 * `close_at` war in der Messung bei keiner Anzeige gesetzt. Hier steht
 * es trotzdem einmal — der Parser verarbeitet es, und der Test hält
 * fest, dass er es tut.
 */
export const recruiteeResponse = {
  offers: [
    {
      id: 2736976,
      guid: "us2gv",
      title: "Kältetechniker Technischer Innendienst (m/w/d)",
      status: "published",
      company_name: "Musterkälte GmbH",
      careers_url: "https://musterkaelte.recruitee.com/o/kaeltetechniker-innendienst",
      careers_apply_url: "https://musterkaelte.recruitee.com/o/kaeltetechniker-innendienst/c/new",
      location: "Kufstein, Tirol, Österreich",
      city: "Kufstein",
      state_name: "Tirol",
      postal_code: null,
      country: "Österreich",
      country_code: "AT",
      description: "<p>Du planst <b>Wärmepumpen</b> und berätst Kunden.</p>",
      requirements: "<ul><li>Abgeschlossene Ausbildung</li><li>Freude am Kundenkontakt</li></ul>",
      salary: { max: null, min: "46000", period: "year", currency: "EUR" },
      remote: false,
      hybrid: true,
      on_site: false,
      employment_type_code: "fulltime_permanent",
      experience_code: "mid_level",
      education_code: "vocational",
      category_code: "technical",
      department: "Technik",
      published_at: "2026-09-07 12:00:16 UTC",
      created_at: "2026-09-07 11:58:23 UTC",
      close_at: null,
      translations: { de: { description: "<p>Du planst <b>Wärmepumpen</b> und berätst Kunden.</p>" } },
    },
    {
      // Alle drei Schalter gesetzt — gemessen 13-mal. Was das heissen
      // soll, sagt die Antwort nicht, also bleibt `workModel` leer.
      id: 2736977,
      guid: "aa11b",
      title: "Marketing Manager (m/w/d)",
      status: "published",
      company_name: "Musterkälte GmbH",
      careers_url: "https://musterkaelte.recruitee.com/o/marketing-manager",
      careers_apply_url: "https://musterkaelte.recruitee.com/o/marketing-manager/c/new",
      location: "Wien, Österreich",
      country_code: "AT",
      description: "<p>Du verantwortest die Markteinführung.</p>",
      requirements: null,
      salary: { max: "72000", min: "60000", period: "year", currency: "EUR" },
      remote: true,
      hybrid: true,
      on_site: true,
      published_at: "2026-09-06 08:00:00 UTC",
      close_at: "2026-10-31 23:59:59 UTC",
    },
    {
      // `salary` da, aber leer — das heisst „nicht veröffentlicht",
      // nicht „null Euro".
      id: 2736039,
      guid: "13bc8",
      title: "Rezeptionsmitarbeiter (m/w/d)",
      status: "published",
      company_name: "Musterhotel KG",
      careers_url: "https://musterhotel.recruitee.com/o/rezeption",
      careers_apply_url: "https://musterhotel.recruitee.com/o/rezeption/c/new",
      location: "Zweibrücken, Rheinland-Pfalz, Deutschland",
      city: "Zweibrücken",
      postal_code: "66482",
      country_code: "DE",
      description: "<h1>Empfang</h1><p>Du begrüsst unsere Gäste.</p>",
      requirements: "<p>Gastgeber mit Herz.</p>",
      salary: { max: null, min: null, period: null, currency: null },
      remote: false,
      hybrid: false,
      on_site: true,
      published_at: "2026-09-07 03:59:31 UTC",
      close_at: null,
    },
    {
      // Ohne Weg zum Original. Fliegt raus wie bei den anderen vier.
      id: 2736040,
      title: "Ohne Link",
      status: "published",
      company_name: "Musterhotel KG",
      careers_url: null,
      careers_apply_url: null,
      location: "Berlin",
      description: "<p>Text</p>",
      salary: null,
    },
  ],
};
