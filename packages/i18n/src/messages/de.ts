/**
 * Deutsche Texte. Kein Text steht hart im Code.
 *
 * {brand} und {assistant} werden zur Laufzeit ersetzt - beide Namen sind
 * vorläufig und müssen sich an einer Stelle ändern lassen.
 */

export const de = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
    example: "Beispiel",
    save: "Speichern",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    edit: "Bearbeiten",
    delete: "Löschen",
    reject: "Ablehnen",
    back: "Zurück",
    next: "Weiter",
    skip: "Ueberspringen",
    close: "Schließen",
    loading: "Wird geladen",
    retry: "Erneut versuchen",
    showMore: "Mehr anzeigen",
    showLess: "Weniger anzeigen",
    notSpecified: "nicht angegeben",
    unknown: "unbekannt",
    demoMode: "Demo-Modus",
    demoNotice: "Diese Daten sind erfunden. Es sind keine echten Stellen und keine echten Unternehmen.",
    notConnected: "nicht verbunden",
    openOriginal: "Im Original öffnen",
    dismiss: "Nicht mehr anzeigen",
  },

  nav: {
    home: "Start",
    assistant: "{assistant}",
    jobs: "Jobs",
    applications: "Bewerbungen",
    profile: "Profil",
    coaching: "Coaching",
    offers: "Angebote",
    checkIns: "Check-ins",
    settings: "Einstellungen",
    logout: "Abmelden",
    howItWorks: "So funktioniert es",
    methodology: "Methodik",
    security: "Sicherheit",
    privacy: "Datenschutz",
    imprint: "Impressum",
    matches: "Matches",
    careerProfile: "Karriereprofil",
    growth: "Karriere",
    notifications: "Benachrichtigungen",
    search: "Suchen",
    languageRegion: "Sprache & Region",
    appearance: "Erscheinungsbild",
    privacyData: "Datenschutz & Daten",
    help: "Hilfe",
    skipToContent: "Zum Inhalt springen",
  },

  landing: {
    eyebrow: "Deine Karriere, verstanden statt geraten",
    headline: "Finde Arbeit, die zu deinem Leben passt.",
    subheadline:
      "{assistant} fragt zuerst nach dem, was du tatsächlich getan hast — und sortiert dann " +
      "echte Stellen. Jede Empfehlung kommt mit Grund, Vorbehalt und Quelle.",
    ctaPrimary: "Mit {assistant} starten",
    ctaSecondary: "So funktioniert es",
    trustProfile: "Privates Profil",
    trustReasons: "Nachvollziehbare Matches",
    trustNoInvention: "Keine erfundenen Bewerbungsangaben",

    flowEyebrow: "Der Ablauf",
    flowTitle: "Erst verstehen. Dann vergleichen. Dann bewerben.",
    step1Title: "{assistant} fragt, bevor sie sucht",
    step1Body:
      "Konkrete Situationen statt Selbsteinschätzung. Aus „Kundenservice, 2 Jahre“ wird eine " +
      "benannte Handlung mit Ergebnis.",
    step2Title: "Du siehst wenige, wirklich passende Stellen",
    step2Body:
      "Echte Anzeigen mit Quelle und Abrufdatum, sortiert nach begründeter Passung — nicht nach " +
      "Werbebudget.",
    step3Title: "{assistant} begleitet Bewerbung und Interview",
    step3Body:
      "Jeder Satz in den Unterlagen hängt an etwas, das du bestätigt hast. Versendet wird nie " +
      "ohne deine ausdrückliche Freigabe.",

    methodEyebrow: "Methodik",
    methodTitle: "Vier Arten von Wissen. Nie vermischt.",
    methodBody:
      "Der häufigste Fehler in KI-Produkten ist, eine Vermutung wie eine Tatsache aussehen zu " +
      "lassen. Deshalb trägt jede Aussage im Profil sichtbar, woher sie stammt — und du kannst " +
      "jede Ableitung bestätigen, ändern oder löschen.",
    methodLink: "Ausführliche Methodik",
    knowledgeSaidTitle: "Was du gesagt hast",
    knowledgeSaidBody: "Deine eigenen Angaben, wörtlich gespeichert.",
    knowledgeEvidenceTitle: "Was belegt ist",
    knowledgeEvidenceBody:
      "Eine Aussage mit konkreter Situation, Handlung und Ergebnis — von dir bestätigt.",
    knowledgeGuessTitle: "Was vermutet wird",
    knowledgeGuessBody:
      "Eine Hypothese von {assistant}. Immer als solche gekennzeichnet, nie stillschweigend " +
      "übernommen.",
    knowledgeExternalTitle: "Was von außen kommt",
    knowledgeExternalBody:
      "Stellenanzeigen, Register, Bewertungen — mit Quelle und Abrufdatum.",

    futureTitle: "Wie sich die Rolle entwickelt",
    futureBody:
      "Bewertet werden die Aufgaben der konkreten Stelle, nicht die Berufstafel. Ausgegeben " +
      "werden Szenarien mit Datenstand — nie eine Jahreszahl, wann etwas „verschwindet“.",
    futureLink: "Wie das berechnet wird",
    privacyTitle: "Deine Daten bleiben deine",
    privacyBody:
      "Du siehst, was gespeichert ist, kannst alles einzeln ändern oder löschen und jede " +
      "Einwilligung getrennt widerrufen. An das Sprachmodell geht nur der Kontext, den die " +
      "jeweilige Aufgabe braucht.",
    privacyLink: "Sicherheit und Datenschutz",

    closingTitle: "Fang mit dem an, was du schon kannst.",
    closingBody:
      "Das erste Gespräch dauert etwa fünfzehn Minuten. Du kannst jederzeit pausieren und " +
      "später weitermachen.",
    closingCta: "Kostenlos beginnen",

    navProduct: "Produkt",
    navPricing: "Preise",
    footerProduct: "Produkt",
    footerTrust: "Vertrauen",
    footerCompany: "Unternehmen",
    footerOverview: "Überblick",
    footerNote:
      "{brand} und {assistant} sind vorläufige Namen. Kandidatenseitig — dieses Produkt " +
      "arbeitet für die suchende Person, nicht für Arbeitgeber.",
    footerLanguage:
      "Sprache und Region wählst du beim Anlegen des Kontos und änderst sie jederzeit unter " +
      "Profil → Sprache & Region.",

    exampleSaid: "Was du erzählst",
    exampleSaidText: "„Ich habe oft schwierige Kunden beruhigt.“",
    exampleAsked: "Was {assistant} nachfragt",
    exampleAskedText:
      "„Erzähl mir von einer Eskalation, die du übernommen hast. Was hast du konkret getan — " +
      "und was kam dabei heraus?“",
    exampleEvidence: "Belegte Stärke",
    exampleEvidenceText: "Konfliktklärung · technische Vermittlung · Verantwortung unter Druck",
    exampleRoles: "Passende Rollen",
  },

  auth: {
    loginTitle: "Anmelden",
    registerTitle: "Konto anlegen",
    email: "E-Mail-Adresse",
    password: "Passwort",
    passwordHint: "Mindestens zwölf Zeichen. Länge zählt mehr als Sonderzeichen.",
    login: "Anmelden",
    register: "Konto anlegen",
    magicLink: "Link per E-Mail senden",
    magicLinkSent: "Wenn ein Konto zu dieser Adresse besteht, ist ein Link unterwegs.",
    forgotPassword: "Passwort vergessen?",
    noAccount: "Noch kein Konto?",
    hasAccount: "Schon ein Konto?",
    errorInvalid: "E-Mail-Adresse oder Passwort stimmen nicht.",
    errorEmailTaken: "Zu dieser Adresse besteht bereits ein Konto.",
    errorPasswordShort: "Das Passwort ist zu kurz. Es braucht mindestens zwölf Zeichen.",
    errorEmailInvalid: "Diese E-Mail-Adresse sieht nicht vollständig aus.",
  },

  consent: {
    title: "Bevor wir anfangen",
    intro:
      "Drei Dinge, die du festlegst. Du kannst jede Entscheidung später im Privacy Center ändern.",
    language: "Sprache",
    country: "Land",
    location: "Dein Standort",
    workModel: "Arbeitsmodell",
    careerProfile: "Karriereprofil erstellen",
    careerProfileBody:
      "Deine Antworten werden gespeichert, damit daraus ein Profil entsteht. Ohne das " +
      "funktioniert nichts Weiteres.",
    documentAnalysis: "Unterlagen auswerten",
    documentAnalysisBody:
      "Falls du einen Lebenslauf hochlädst, wird sein Text ausgewertet, um das Profil " +
      "vorzubefüllen. Freiwillig.",
    voiceInput: "Spracheingabe",
    voiceInputBody:
      "Du kannst mit {assistant} sprechen statt zu schreiben. Getrennt davon entscheidest du, " +
      "ob das Transkript gespeichert wird.",
    transcriptStorage: "Transkript speichern",
    transcriptStorageBody:
      "Ohne diese Zustimmung wird gesprochener Text nur verarbeitet und nicht abgelegt.",
    externalAi: "Verarbeitung durch einen externen Anbieter",
    externalAiBodyActive:
      "Deine Texte werden zur Analyse an einen externen KI-Anbieter übermittelt. Direkte " +
      "Identifikatoren wie E-Mail-Adresse und Telefonnummer werden vorher entfernt.",
    externalAiBodyInactive:
      "Zurzeit ist kein externer Anbieter verbunden. Es läuft ein lokaler Demo-Anbieter, " +
      "seine Antworten sind Beispiele ohne inhaltliche Aussage.",
    privacyCenter: "Zum Privacy Center",
    start: "Gespräch beginnen",
  },

  interview: {
    title: "Gespräch mit {assistant}",
    intro:
      "Bevor ich dir Jobs zeige, möchte ich verstehen, was du wirklich kannst, was dir Energie " +
      "gibt und welche Bedingungen du brauchst. Du kannst jederzeit etwas korrigieren oder " +
      "überspringen.",
    progress: "{done} von {total} Themen verstanden",
    yourAnswer: "Deine Antwort",
    send: "Senden",
    voiceMode: "Sprechen",
    textMode: "Schreiben",
    voiceUnavailable:
      "Der Sprachmodus ist nicht verfügbar, weil kein Sprachanbieter verbunden ist. Der " +
      "Textweg funktioniert vollständig.",
    listening: "Ich höre zu",
    paused: "Pausiert",
    pause: "Pausieren",
    resume: "Fortsetzen",
    interrupt: "Unterbrechen",
    liveTranscript: "Live-Mitschrift",
    whyThisQuestion: "Warum diese Frage?",
    recognisedSoFar: "Was ich bisher verstanden habe",
    openHypotheses: "Noch offene Vermutungen",
    skipQuestion: "Diese Frage überspringen",
    pauseSession: "Gespräch pausieren",
    resumeLater: "Du kannst später genau hier weitermachen.",
    thinking: "{assistant} formuliert",
  },

  profile: {
    title: "Dein Karriereprofil",
    compass: "Dein Karrierekompass",
    confirmedStrengths: "Belegte Stärken",
    energising: "Tätigkeiten, die dir Energie geben",
    draining: "Kannst du gut, kostet aber Energie",
    interests: "Interessen und Lernziele",
    values: "Werte und Abwägungen",
    workStyle: "Bevorzugte Arbeitsweise",
    hardNoGos: "Harte Grenzen",
    roleClusters: "Passende Richtungen",
    surprising: "Weniger naheliegend",
    gaps: "Lücken und offene Vermutungen",
    coverage: "Datenabdeckung",
    coverageBody:
      "So viel deines Profils ist belegt. Was fehlt, senkt die Sicherheit der Empfehlungen - " +
      "nicht ihre Qualität.",
    showEvidence: "Beleg ansehen",
    addEvidence: "Beleg ergänzen",
    changeWeight: "Gewichtung ändern",
    confirmAll: "Profil bestätigen",
    confirmAllBody:
      "Danach schalte ich personalisierte Jobvorschläge frei. Du kannst alles weiter ändern.",
    confirmed: "bestätigt",
    hypothesis: "Vermutung",
    fromDocument: "aus deinen Unterlagen",
    rejected: "abgelehnt",
    empty: "Hier steht noch nichts. Das Gespräch mit {assistant} füllt diesen Bereich.",
  },

  jobs: {
    title: "Ninas Auswahl für dich",
    titleGeneric: "Auswahl für dich",
    locked: "Noch gesperrt",
    lockedBody:
      "Personalisierte Vorschläge gibt es erst, wenn dein Profil steht. Sonst wären es " +
      "Zufallstreffer.",
    lockedCta: "Gespräch fortsetzen",
    sortBy: "Sortieren nach",
    sortBestOverall: "Beste Gesamtchance",
    sortHighestFit: "Höchste Passung",
    sortBestQuality: "Beste Jobqualität",
    sortHighestSalary: "Höchstes Gehalt",
    sortFutureRobust: "Zukunftsrobuste Entwicklung",
    sortShortestCommute: "Kürzester Arbeitsweg",
    sortNewest: "Neueste Anzeigen",
    filters: "Filter",
    showBlocked: "Ausgeschlossene Stellen anzeigen",
    blockedBecause: "Ausgeschlossen wegen",
    fit: "Passung",
    fitHigh: "hohe Passung",
    fitMedium: "mittlere Passung",
    fitExploratory: "explorativ",
    fitInsufficient: "Datenbasis zu dünn",
    confidence: "Sicherheit",
    confidenceHigh: "hoch",
    confidenceMedium: "mittel",
    confidenceLow: "niedrig",
    jobQuality: "Jobqualität",
    aiTransition: "Entwicklung durch KI",
    listingConfidence: "Vertrauen in die Anzeige",
    published: "Veröffentlicht",
    daysAgo: "vor {n} Tagen",
    mainReason: "Warum sie passt",
    mainReservation: "Was du bedenken solltest",
    view: "Ansehen",
    save: "Speichern",
    saved: "Gespeichert",
    discuss: "Mit {assistant} besprechen",
    empty: "Zu diesen Filtern gibt es gerade nichts. Weite die Suche etwas aus.",
    emptyAll: "Es sind noch keine Stellen geladen.",
  },

  jobDetail: {
    whyShown: "Warum {assistant} dir das zeigt",
    tabOverview: "Überblick",
    tabMatch: "Dein Match",
    tabQuality: "Jobqualität",
    tabFuture: "Zukunft & KI",
    tabCompany: "Unternehmen & Erfahrungen",
    tabSource: "Originalanzeige & Quellen",
    coreTasks: "Was du tatsächlich tun würdest",
    mustHave: "Muss-Anforderungen",
    niceToHave: "Kann-Anforderungen",
    covered: "durch deine Erfahrung gedeckt",
    notCovered: "noch nicht belegt",
    transferable: "übertragbar aus",
    learningCurve: "Wahrscheinliche Lernkurve",
    commute: "Arbeitsweg",
    questionsToAsk: "Fragen, die du im Gespräch stellen solltest",
    prepareApplication: "Bewerbung vorbereiten",
    whyNotHigher: "Warum ist der Match nicht höher?",
    closeGap: "Welche Lücke kann ich kurzfristig schließen?",
    tasksChanging: "Welche Aufgaben könnten sich durch KI verändern?",
    compare: "Mit einem anderen Job vergleichen",
    retrievedAt: "Abgerufen am",
    sourceKind: "Art der Quelle",
    sampleSize: "Stichprobe",
    period: "Zeitraum",
    aiSummary: "KI-Zusammenfassung",
    aiSummaryNote:
      "Diese Zusammenfassung stammt von einem Sprachmodell, nicht von der Quelle selbst. " +
      "Die Einzelstimmen stehen im Original.",
    smallSample:
      "Sehr kleine Stichprobe. Einzelne Stimmen wiegen hier stark - eine Verallgemeinerung " +
      "wäre nicht zulässig.",
    realityCheck: "Was die Anzeige verspricht - und was andere berichten",
    staleWarning: "Diese Anzeige ist möglicherweise nicht mehr aktuell.",
    repostWarning:
      "Eine inhaltlich gleiche Anzeige gab es schon früher. Das kann Nachbesetzung bedeuten " +
      "oder bloße Wiedervorlage.",
  },

  applications: {
    title: "Deine Bewerbungen",
    viewKanban: "Tafel",
    viewList: "Liste",
    viewCalendar: "Termine",
    stageSaved: "Gespeichert",
    stagePreparing: "In Vorbereitung",
    stageSent: "Versendet",
    stageAcknowledged: "Eingang bestätigt",
    stageInterview: "Interview",
    stageOffer: "Angebot",
    stageRejected: "Abgelehnt",
    stageWithdrawn: "Zurückgezogen",
    stageAccepted: "Angenommen",
    lastContact: "Letzter Kontakt",
    nextStep: "Nächster Schritt",
    noNextStep: "Kein nächster Schritt gesetzt",
    documents: "Unterlagen",
    notes: "Notizen",
    funnelTitle: "Was deine Zahlen zeigen",
    funnelTooFew:
      "Für eine Diagnose sind es noch zu wenige Bewerbungen. Ab etwa zehn versendeten " +
      "Bewerbungen lässt sich ein Muster erkennen - vorher wäre jede Aussage geraten.",
    empty: "Noch keine Bewerbung. Sie entstehen aus gespeicherten Stellen.",
  },

  studio: {
    title: "Bewerbung vorbereiten",
    requirements: "Anforderungen der Stelle",
    yourEvidence: "Deine belegten Erfahrungen",
    document: "Dokument",
    checks: "Ninas Prüfung",
    openPoints: "Offene Punkte",
    generateCv: "Lebenslauf erstellen",
    generateCvAts: "ATS-freundliche Fassung",
    generateCoverLetter: "Anschreiben erstellen",
    generateEmail: "Kurze Bewerbungs-E-Mail",
    coverLetterNotNeeded:
      "Diese Stelle verlangt kein Anschreiben. Eine kurze E-Mail reicht vermutlich.",
    claimSupported: "belegt",
    claimUnsupported: "nicht belegt",
    claimWeakened: "abgeschwächt",
    unsupportedBlocked:
      "Solange eine Aussage keinen Beleg hat, kann das Dokument nicht freigegeben werden. " +
      "Ergänze einen Beleg oder schwäche die Aussage ab.",
    acceptChange: "Übernehmen",
    rejectChange: "Verwerfen",
    showDiff: "Änderung ansehen",
    reason: "Begründung",
    preview: "Vorschau vor dem Versand",
    recipient: "Empfänger",
    subject: "Betreff",
    attachments: "Anlagen",
    confirmSend: "Ich habe alles geprüft und möchte diese Bewerbung senden",
    send: "Jetzt senden",
    exportDraft: "Als Entwurf herunterladen",
    demoSendNotice:
      "Es ist kein E-Mail-Konto verbunden. Es wird nichts versendet - du bekommst einen " +
      "Entwurf zum Herunterladen.",
    portalGuide: "Zum Bewerbungsportal begleiten",
  },

  coaching: {
    title: "Gesprächsvorbereitung",
    modePractice: "Übung",
    modeSimulation: "Realistische Simulation",
    modeCase: "Fallaufgabe",
    startSession: "Beginnen",
    repeatAnswer: "Antwort wiederholen",
    feedbackRelevance: "Bezug zur Frage",
    feedbackStructure: "Aufbau",
    feedbackEvidence: "Konkrete Belege",
    feedbackClarity: "Verständlichkeit",
    feedbackMissing: "Was noch fehlt",
    starStories: "Deine Geschichten aus dem Profil",
    questionsForCompany: "Fragen an das Unternehmen",
    noBehaviourScoring:
      "Bewertet werden ausschließlich Inhalt und Aufbau deiner Antwort. Nicht deine Stimme, " +
      "dein Gesicht, dein Akzent oder deine Wirkung.",
  },

  settings: {
    title: "Einstellungen",
    language: "Sprache",
    region: "Land und Region",
    theme: "Darstellung",
    themeLight: "Hell",
    themeDark: "Dunkel",
    themeSystem: "System",
    notifications: "Benachrichtigungen",
    integrations: "Verbundene Dienste",
    microphone: "Mikrofon und Transkripte",
    privacyCenter: "Privacy Center",
    memory: "Was {assistant} über dich weiß",
    memoryBody: "Jeder Eintrag einzeln einsehbar, änderbar und löschbar.",
    consents: "Deine Einwilligungen",
    exportData: "Daten exportieren",
    exportBody: "Du bekommst alles als JSON-Datei.",
    deleteAccount: "Konto löschen",
    deleteAccountBody:
      "Löscht alle deine Daten. Das lässt sich nicht rückgängig machen.",
    sessions: "Angemeldete Geräte",
    revokeSession: "Abmelden",
    currentSession: "Dieses Gerät",
    aiProvider: "KI-Verarbeitung",
    aiProviderMock:
      "Zurzeit läuft ein lokaler Demo-Anbieter. Es verlassen keine Daten dieses Gerät.",
    aiProviderExternal:
      "Verarbeitung durch einen externen Anbieter. Zweck, Region und Anbieter stehen unten.",
  },

  states: {
    loading: "Wird geladen",
    errorTitle: "Das hat nicht geklappt",
    errorBody: "Versuch es noch einmal. Bleibt es dabei, liegt es nicht an dir.",
    offlineTitle: "Keine Verbindung",
    offlineBody: "Deine Entwürfe sind gesichert. Sobald du wieder online bist, geht es weiter.",
    permissionDenied: "Dafür fehlt die Berechtigung.",
    insufficientData: "Dazu liegen zu wenige Daten vor.",
    notConnectedTitle: "Nicht verbunden",
    notConnectedBody: "Dieser Dienst ist nicht eingerichtet. Die Funktion ist deshalb nicht aktiv.",
    emptyTitle: "Hier ist noch nichts",
  },

  nina: {
    askBar: "{assistant} fragen",
    suggestionProfileGap:
      "Dein Profil hat noch eine wichtige Lücke. Wollen wir ein konkretes Projekt ergänzen?",
    suggestionNoSalary:
      "Dieser Job passt fachlich gut, aber das Gehalt ist nicht angegeben. Soll ich dir passende " +
      "Rückfragen vorbereiten?",
    suggestionReviewsFirst:
      "Möchtest du zuerst die Mitarbeiterbewertungen öffnen oder die Anforderungen mit deinem " +
      "Profil vergleichen?",
    suggestionUnsupportedClaim:
      "Für diese Aussage im Anschreiben fehlt noch ein Beleg. Sollen wir sie abschwächen oder " +
      "ein Beispiel ergänzen?",
    suggestionInterviewSoon:
      "Dein Gespräch ist in drei Tagen. Sollen wir die wahrscheinlichsten Fragen simulieren?",
    suggestionFunnelPattern:
      "Deine letzten acht Bewerbungen hatten ein gemeinsames Muss-Kriterium, das in deinem Profil " +
      "nicht belegt ist. Sollen wir die Suche korrigieren?",
  },
};

/**
 * Die Struktur des Katalogs, nicht seine konkreten Sätze. Ohne diese
 * Aufweitung würde TypeScript den deutschen Wortlaut als Typ verlangen -
 * und keine Uebersetzung könnte ihn je erfüllen.
 */
export type Messages = typeof de;
