/**
 * Deutsche Texte. Kein Text steht hart im Code.
 *
 * {brand} und {assistant} werden zur Laufzeit ersetzt - beide Namen sind
 * vorlaeufig und muessen sich an einer Stelle aendern lassen.
 */

export const de = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
    save: "Speichern",
    cancel: "Abbrechen",
    confirm: "Bestaetigen",
    edit: "Bearbeiten",
    delete: "Loeschen",
    reject: "Ablehnen",
    back: "Zurueck",
    next: "Weiter",
    skip: "Ueberspringen",
    close: "Schliessen",
    loading: "Wird geladen",
    retry: "Erneut versuchen",
    showMore: "Mehr anzeigen",
    showLess: "Weniger anzeigen",
    notSpecified: "nicht angegeben",
    unknown: "unbekannt",
    demoMode: "Demo-Modus",
    demoNotice: "Diese Daten sind erfunden. Es sind keine echten Stellen und keine echten Unternehmen.",
    notConnected: "nicht verbunden",
    openOriginal: "Im Original oeffnen",
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
    skipToContent: "Zum Inhalt springen",
  },

  landing: {
    headline: "Finde nicht irgendeinen Job. Finde den, der wirklich zu dir passt.",
    subheadline:
      "{assistant} versteht deine Erfahrungen, Staerken und Bedingungen, entdeckt passende Rollen " +
      "und begleitet dich von der Jobsuche bis zum Interview.",
    ctaVoice: "Mit {assistant} sprechen",
    ctaText: "Lieber schreiben",
    ctaSecondary: "So funktioniert es",
    stepsTitle: "Drei Schritte",
    step1Title: "Verstehen",
    step1Body:
      "Bevor du Stellen siehst, klaeren wir, was du tatsaechlich kannst - anhand konkreter " +
      "Situationen, nicht anhand von Selbsteinschaetzungen.",
    step2Title: "Vergleichen",
    step2Body:
      "Du bekommst wenige, begruendete Vorschlaege statt hunderter Anzeigen. Jeder mit einem " +
      "Grund und einem Vorbehalt.",
    step3Title: "Bewerben",
    step3Body:
      "Unterlagen entstehen aus deinen belegten Erfahrungen. Jede Aussage haengt an etwas, " +
      "das du bestaetigt hast.",
    matchTitle: "Ein Match, das sich erklaeren laesst",
    matchBody:
      "Statt einer Prozentzahl siehst du, woraus sie entsteht - und wo die Datenlage duenn ist.",
    evidenceTitle: "Aus einer Alltagserfahrung wird eine belegte Staerke",
    evidenceBody:
      "Was im Lebenslauf als \"Kundenservice\" steht, ist oft etwas viel Genaueres. Genau danach " +
      "fragt {assistant}.",
    realityTitle: "Was in der Anzeige steht - und was nicht",
    realityBody:
      "Mitarbeiterstimmen, Kundenbewertungen und Arbeitgeberangaben bleiben getrennt. Eine " +
      "Standortbewertung von Kundinnen sagt nichts ueber die Arbeitskultur.",
    privacyTitle: "Deine Daten bleiben deine",
    privacyBody:
      "Du siehst, was gespeichert ist, kannst alles einzeln aendern oder loeschen und jede " +
      "Einwilligung getrennt widerrufen.",
    closingTitle: "Fang mit dem an, was du schon kannst",
    closingBody: "Das Gespraech dauert etwa fuenfzehn Minuten. Du kannst jederzeit pausieren.",
  },

  auth: {
    loginTitle: "Anmelden",
    registerTitle: "Konto anlegen",
    email: "E-Mail-Adresse",
    password: "Passwort",
    passwordHint: "Mindestens zwoelf Zeichen. Laenge zaehlt mehr als Sonderzeichen.",
    login: "Anmelden",
    register: "Konto anlegen",
    magicLink: "Link per E-Mail senden",
    magicLinkSent: "Wenn ein Konto zu dieser Adresse besteht, ist ein Link unterwegs.",
    forgotPassword: "Passwort vergessen?",
    noAccount: "Noch kein Konto?",
    hasAccount: "Schon ein Konto?",
    errorInvalid: "E-Mail-Adresse oder Passwort stimmen nicht.",
    errorEmailTaken: "Zu dieser Adresse besteht bereits ein Konto.",
    errorPasswordShort: "Das Passwort ist zu kurz. Es braucht mindestens zwoelf Zeichen.",
    errorEmailInvalid: "Diese E-Mail-Adresse sieht nicht vollstaendig aus.",
  },

  consent: {
    title: "Bevor wir anfangen",
    intro:
      "Drei Dinge, die du festlegst. Du kannst jede Entscheidung spaeter im Privacy Center aendern.",
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
      "Falls du einen Lebenslauf hochlaedst, wird sein Text ausgewertet, um das Profil " +
      "vorzubefuellen. Freiwillig.",
    voiceInput: "Spracheingabe",
    voiceInputBody:
      "Du kannst mit {assistant} sprechen statt zu schreiben. Getrennt davon entscheidest du, " +
      "ob das Transkript gespeichert wird.",
    transcriptStorage: "Transkript speichern",
    transcriptStorageBody:
      "Ohne diese Zustimmung wird gesprochener Text nur verarbeitet und nicht abgelegt.",
    externalAi: "Verarbeitung durch einen externen Anbieter",
    externalAiBodyActive:
      "Deine Texte werden zur Analyse an einen externen KI-Anbieter uebermittelt. Direkte " +
      "Identifikatoren wie E-Mail-Adresse und Telefonnummer werden vorher entfernt.",
    externalAiBodyInactive:
      "Zurzeit ist kein externer Anbieter verbunden. Es laeuft ein lokaler Demo-Anbieter, " +
      "seine Antworten sind Beispiele ohne inhaltliche Aussage.",
    privacyCenter: "Zum Privacy Center",
    start: "Gespraech beginnen",
  },

  interview: {
    title: "Gespraech mit {assistant}",
    intro:
      "Bevor ich dir Jobs zeige, moechte ich verstehen, was du wirklich kannst, was dir Energie " +
      "gibt und welche Bedingungen du brauchst. Du kannst jederzeit etwas korrigieren oder " +
      "ueberspringen.",
    progress: "{done} von {total} Themen verstanden",
    yourAnswer: "Deine Antwort",
    send: "Senden",
    voiceMode: "Sprechen",
    textMode: "Schreiben",
    voiceUnavailable:
      "Der Sprachmodus ist nicht verfuegbar, weil kein Sprachanbieter verbunden ist. Der " +
      "Textweg funktioniert vollstaendig.",
    listening: "Ich hoere zu",
    paused: "Pausiert",
    pause: "Pausieren",
    resume: "Fortsetzen",
    interrupt: "Unterbrechen",
    liveTranscript: "Live-Mitschrift",
    whyThisQuestion: "Warum diese Frage?",
    recognisedSoFar: "Was ich bisher verstanden habe",
    openHypotheses: "Noch offene Vermutungen",
    skipQuestion: "Diese Frage ueberspringen",
    pauseSession: "Gespraech pausieren",
    resumeLater: "Du kannst spaeter genau hier weitermachen.",
    thinking: "{assistant} formuliert",
  },

  profile: {
    title: "Dein Karriereprofil",
    compass: "Dein Karrierekompass",
    confirmedStrengths: "Belegte Staerken",
    energising: "Taetigkeiten, die dir Energie geben",
    draining: "Kannst du gut, kostet aber Energie",
    interests: "Interessen und Lernziele",
    values: "Werte und Abwaegungen",
    workStyle: "Bevorzugte Arbeitsweise",
    hardNoGos: "Harte Grenzen",
    roleClusters: "Passende Richtungen",
    surprising: "Weniger naheliegend",
    gaps: "Luecken und offene Vermutungen",
    coverage: "Datenabdeckung",
    coverageBody:
      "So viel deines Profils ist belegt. Was fehlt, senkt die Sicherheit der Empfehlungen - " +
      "nicht ihre Qualitaet.",
    showEvidence: "Beleg ansehen",
    addEvidence: "Beleg ergaenzen",
    changeWeight: "Gewichtung aendern",
    confirmAll: "Profil bestaetigen",
    confirmAllBody:
      "Danach schalte ich personalisierte Jobvorschlaege frei. Du kannst alles weiter aendern.",
    confirmed: "bestaetigt",
    hypothesis: "Vermutung",
    fromDocument: "aus deinen Unterlagen",
    rejected: "abgelehnt",
    empty: "Hier steht noch nichts. Das Gespraech mit {assistant} fuellt diesen Bereich.",
  },

  jobs: {
    title: "Ninas Auswahl fuer dich",
    titleGeneric: "Auswahl fuer dich",
    locked: "Noch gesperrt",
    lockedBody:
      "Personalisierte Vorschlaege gibt es erst, wenn dein Profil steht. Sonst waeren es " +
      "Zufallstreffer.",
    lockedCta: "Gespraech fortsetzen",
    sortBy: "Sortieren nach",
    sortBestOverall: "Beste Gesamtchance",
    sortHighestFit: "Hoechste Passung",
    sortBestQuality: "Beste Jobqualitaet",
    sortHighestSalary: "Hoechstes Gehalt",
    sortFutureRobust: "Zukunftsrobuste Entwicklung",
    sortShortestCommute: "Kuerzester Arbeitsweg",
    sortNewest: "Neueste Anzeigen",
    filters: "Filter",
    showBlocked: "Ausgeschlossene Stellen anzeigen",
    blockedBecause: "Ausgeschlossen wegen",
    fit: "Passung",
    fitHigh: "hohe Passung",
    fitMedium: "mittlere Passung",
    fitExploratory: "explorativ",
    fitInsufficient: "Datenbasis zu duenn",
    confidence: "Sicherheit",
    confidenceHigh: "hoch",
    confidenceMedium: "mittel",
    confidenceLow: "niedrig",
    jobQuality: "Jobqualitaet",
    aiTransition: "Entwicklung durch KI",
    listingConfidence: "Vertrauen in die Anzeige",
    published: "Veroeffentlicht",
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
    tabOverview: "Ueberblick",
    tabMatch: "Dein Match",
    tabQuality: "Jobqualitaet",
    tabFuture: "Zukunft & KI",
    tabCompany: "Unternehmen & Erfahrungen",
    tabSource: "Originalanzeige & Quellen",
    coreTasks: "Was du tatsaechlich tun wuerdest",
    mustHave: "Muss-Anforderungen",
    niceToHave: "Kann-Anforderungen",
    covered: "durch deine Erfahrung gedeckt",
    notCovered: "noch nicht belegt",
    transferable: "uebertragbar aus",
    learningCurve: "Wahrscheinliche Lernkurve",
    commute: "Arbeitsweg",
    questionsToAsk: "Fragen, die du im Gespraech stellen solltest",
    prepareApplication: "Bewerbung vorbereiten",
    whyNotHigher: "Warum ist der Match nicht hoeher?",
    closeGap: "Welche Luecke kann ich kurzfristig schliessen?",
    tasksChanging: "Welche Aufgaben koennten sich durch KI veraendern?",
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
      "waere nicht zulaessig.",
    realityCheck: "Was die Anzeige verspricht - und was andere berichten",
    staleWarning: "Diese Anzeige ist moeglicherweise nicht mehr aktuell.",
    repostWarning:
      "Eine inhaltlich gleiche Anzeige gab es schon frueher. Das kann Nachbesetzung bedeuten " +
      "oder blosse Wiedervorlage.",
  },

  applications: {
    title: "Deine Bewerbungen",
    viewKanban: "Tafel",
    viewList: "Liste",
    viewCalendar: "Termine",
    stageSaved: "Gespeichert",
    stagePreparing: "In Vorbereitung",
    stageSent: "Versendet",
    stageAcknowledged: "Eingang bestaetigt",
    stageInterview: "Interview",
    stageOffer: "Angebot",
    stageRejected: "Abgelehnt",
    stageWithdrawn: "Zurueckgezogen",
    stageAccepted: "Angenommen",
    lastContact: "Letzter Kontakt",
    nextStep: "Naechster Schritt",
    noNextStep: "Kein naechster Schritt gesetzt",
    documents: "Unterlagen",
    notes: "Notizen",
    funnelTitle: "Was deine Zahlen zeigen",
    funnelTooFew:
      "Fuer eine Diagnose sind es noch zu wenige Bewerbungen. Ab etwa zehn versendeten " +
      "Bewerbungen laesst sich ein Muster erkennen - vorher waere jede Aussage geraten.",
    empty: "Noch keine Bewerbung. Sie entstehen aus gespeicherten Stellen.",
  },

  studio: {
    title: "Bewerbung vorbereiten",
    requirements: "Anforderungen der Stelle",
    yourEvidence: "Deine belegten Erfahrungen",
    document: "Dokument",
    checks: "Ninas Pruefung",
    openPoints: "Offene Punkte",
    generateCv: "Lebenslauf erstellen",
    generateCvAts: "ATS-freundliche Fassung",
    generateCoverLetter: "Anschreiben erstellen",
    generateEmail: "Kurze Bewerbungs-E-Mail",
    coverLetterNotNeeded:
      "Diese Stelle verlangt kein Anschreiben. Eine kurze E-Mail reicht vermutlich.",
    claimSupported: "belegt",
    claimUnsupported: "nicht belegt",
    claimWeakened: "abgeschwaecht",
    unsupportedBlocked:
      "Solange eine Aussage keinen Beleg hat, kann das Dokument nicht freigegeben werden. " +
      "Ergaenze einen Beleg oder schwaeche die Aussage ab.",
    acceptChange: "Uebernehmen",
    rejectChange: "Verwerfen",
    showDiff: "Aenderung ansehen",
    reason: "Begruendung",
    preview: "Vorschau vor dem Versand",
    recipient: "Empfaenger",
    subject: "Betreff",
    attachments: "Anlagen",
    confirmSend: "Ich habe alles geprueft und moechte diese Bewerbung senden",
    send: "Jetzt senden",
    exportDraft: "Als Entwurf herunterladen",
    demoSendNotice:
      "Es ist kein E-Mail-Konto verbunden. Es wird nichts versendet - du bekommst einen " +
      "Entwurf zum Herunterladen.",
    portalGuide: "Zum Bewerbungsportal begleiten",
  },

  coaching: {
    title: "Gespraechsvorbereitung",
    modePractice: "Uebung",
    modeSimulation: "Realistische Simulation",
    modeCase: "Fallaufgabe",
    startSession: "Beginnen",
    repeatAnswer: "Antwort wiederholen",
    feedbackRelevance: "Bezug zur Frage",
    feedbackStructure: "Aufbau",
    feedbackEvidence: "Konkrete Belege",
    feedbackClarity: "Verstaendlichkeit",
    feedbackMissing: "Was noch fehlt",
    starStories: "Deine Geschichten aus dem Profil",
    questionsForCompany: "Fragen an das Unternehmen",
    noBehaviourScoring:
      "Bewertet werden ausschliesslich Inhalt und Aufbau deiner Antwort. Nicht deine Stimme, " +
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
    memory: "Was {assistant} ueber dich weiss",
    memoryBody: "Jeder Eintrag einzeln einsehbar, aenderbar und loeschbar.",
    consents: "Deine Einwilligungen",
    exportData: "Daten exportieren",
    exportBody: "Du bekommst alles als JSON-Datei.",
    deleteAccount: "Konto loeschen",
    deleteAccountBody:
      "Loescht alle deine Daten. Das laesst sich nicht rueckgaengig machen.",
    sessions: "Angemeldete Geraete",
    revokeSession: "Abmelden",
    currentSession: "Dieses Geraet",
    aiProvider: "KI-Verarbeitung",
    aiProviderMock:
      "Zurzeit laeuft ein lokaler Demo-Anbieter. Es verlassen keine Daten dieses Geraet.",
    aiProviderExternal:
      "Verarbeitung durch einen externen Anbieter. Zweck, Region und Anbieter stehen unten.",
  },

  states: {
    loading: "Wird geladen",
    errorTitle: "Das hat nicht geklappt",
    errorBody: "Versuch es noch einmal. Bleibt es dabei, liegt es nicht an dir.",
    offlineTitle: "Keine Verbindung",
    offlineBody: "Deine Entwuerfe sind gesichert. Sobald du wieder online bist, geht es weiter.",
    permissionDenied: "Dafuer fehlt die Berechtigung.",
    insufficientData: "Dazu liegen zu wenige Daten vor.",
    notConnectedTitle: "Nicht verbunden",
    notConnectedBody: "Dieser Dienst ist nicht eingerichtet. Die Funktion ist deshalb nicht aktiv.",
    emptyTitle: "Hier ist noch nichts",
  },

  nina: {
    askBar: "{assistant} fragen",
    suggestionProfileGap:
      "Dein Profil hat noch eine wichtige Luecke. Wollen wir ein konkretes Projekt ergaenzen?",
    suggestionNoSalary:
      "Dieser Job passt fachlich gut, aber das Gehalt ist nicht angegeben. Soll ich dir passende " +
      "Rueckfragen vorbereiten?",
    suggestionReviewsFirst:
      "Moechtest du zuerst die Mitarbeiterbewertungen oeffnen oder die Anforderungen mit deinem " +
      "Profil vergleichen?",
    suggestionUnsupportedClaim:
      "Fuer diese Aussage im Anschreiben fehlt noch ein Beleg. Sollen wir sie abschwaechen oder " +
      "ein Beispiel ergaenzen?",
    suggestionInterviewSoon:
      "Dein Gespraech ist in drei Tagen. Sollen wir die wahrscheinlichsten Fragen simulieren?",
    suggestionFunnelPattern:
      "Deine letzten acht Bewerbungen hatten ein gemeinsames Muss-Kriterium, das in deinem Profil " +
      "nicht belegt ist. Sollen wir die Suche korrigieren?",
  },
};

/**
 * Die Struktur des Katalogs, nicht seine konkreten Saetze. Ohne diese
 * Aufweitung wuerde TypeScript den deutschen Wortlaut als Typ verlangen -
 * und keine Uebersetzung koennte ihn je erfuellen.
 */
export type Messages = typeof de;
