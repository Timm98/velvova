/**
 * Antwortformen der vier ATS-Anbieter.
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
