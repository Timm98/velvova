import type { Messages } from "./de.ts";

/**
 * Nederlandse teksten.
 *
 * Getypeerd op het Duitse bestand: een ontbrekende sleutel is een
 * compilatiefout, geen leeg vlak in de interface.
 *
 * ── Na te lezen door een moedertaalspreker ──────────────────────
 *
 * Vooral twee stukken. Het onderdeel `consent` bevat juridische
 * formuleringen: een slecht vertaalde toestemming is niet alleen
 * hinderlijk, ze is niets waard. En in `studio` draagt het onderscheid
 * tussen «onderbouwd» en «niet onderbouwd» de hele belofte van het
 * product — dat moet scherp blijven.
 */
export const nl: Messages = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
    example: "Voorbeeld",
    save: "Opslaan",
    cancel: "Annuleren",
    confirm: "Bevestigen",
    edit: "Bewerken",
    delete: "Verwijderen",
    reject: "Afwijzen",
    back: "Terug",
    next: "Volgende",
    skip: "Overslaan",
    close: "Sluiten",
    loading: "Laden",
    retry: "Opnieuw proberen",
    showMore: "Meer tonen",
    showLess: "Minder tonen",
    notSpecified: "niet vermeld",
    unknown: "onbekend",
    notConnected: "niet verbonden",
    openOriginal: "Originele vacature openen",
    dismiss: "Niet meer tonen",
  },

  nav: {
    home: "Start",
    assistant: "{assistant}",
    jobs: "Vacatures",
    applications: "Sollicitaties",
    profile: "Profiel",
    coaching: "Voorbereiding",
    offers: "Voorstellen",
    checkIns: "Ijkmomenten",
    settings: "Instellingen",
    logout: "Uitloggen",
    howItWorks: "Hoe het werkt",
    methodology: "Methode",
    security: "Beveiliging",
    privacy: "Privacy",
    imprint: "Colofon",
    matches: "Matches",
    careerProfile: "Loopbaanprofiel",
    growth: "Loopbaan",
    notifications: "Meldingen",
    search: "Zoeken",
    languageRegion: "Taal en regio",
    appearance: "Weergave",
    privacyData: "Privacy en gegevens",
    help: "Help",
    discover: "Ontdekken",
    career: "Loopbaan",
    expand: "Uitklappen",
    collapse: "Inklappen",
    skipToContent: "Naar de inhoud",
    backToApp: "Terug naar {assistant}",
  },

  landing: {
    eyebrow: "Jouw persoonlijke loopbaanbegeleiding met AI",
    headline: "Vind werk dat echt bij je past.",
    headlineLine1: "Vind werk",
    headlineLine2: "dat echt bij je past.",
    subheadline:
      "{assistant} begrijpt je ervaring, vindt recente functies uit gecontroleerde bronnen en " +
      "blijft bij je van oriëntatie tot sollicitatie.",
    ctaPrimary: "Gratis beginnen met {assistant}",
    ctaSecondary: "Hoe het werkt",

    coreLine1: "We laten je niet méér vacatures zien.",
    coreLine2: "We laten je de juiste zien.",
    coreSub: "Geen 10.000 resultaten. De paar kansen die er echt toe doen.",

    learnsEyebrow: "Wat {assistant} over je leert",
    learnsTitle: "Eerst begrijpen, dan zoeken.",
    learnsBody:
      "Concrete situaties in plaats van een zelfbeschrijving. Wat je hebt gedaan, wat eruit " +
      "kwam, waaraan iemand het zou herkennen. Daarop kan een profiel rusten.",
    rolesEyebrow: "Richtingen",
    rolesTitle: "Functies die passen — en andere waar je niet aan had gedacht.",
    rolesBody:
      "Aangrenzend, verwant, onverwacht. Van elke: waarop ze berust, wat er anders zou zijn, " +
      "wat ontbreekt — en hoe je het klein kunt uitproberen.",
    jobsEyebrow: "Actuele functies",
    jobsTitle: "Elke aanbeveling met reden, bron en wat er open blijft.",
    jobsBody:
      "Echte vacatures uit openlijk aangeboden bronnen, gelinkt aan het origineel en met het " +
      "tijdstip van de laatste controle. Salaris alleen als het er staat.",
    applyEyebrow: "Sollicitatie",
    applyTitle: "Als een functie past, maakt {assistant} je klaar.",
    applyBody:
      "Documenten afgestemd op de functie — de taal en de volgorde, niet de waarheid. Er wordt " +
      "niets verstuurd zonder jouw uitdrukkelijke toestemming.",
    pathEyebrow: "Het pad",
    pathTitle: "Van wat je kunt naar wat je krijgt.",
    pathBody:
      "Elke stap rust op de vorige. Wat niet onderbouwd is, wordt niet beweerd — niet in een " +
      "aanbeveling en niet in een sollicitatie.",

    step1: "Jouw ervaring",
    step1Detail: "Wat je werkelijk deed — niet wat het cv zegt.",
    step2: "{assistant} begrijpt je",
    step2Detail: "Een gesprek over situaties, niet over modewoorden.",
    step3: "Vaardigheden en werkwijze",
    step3Detail: "Onderbouwd, met herkomst. Niets verzonnen.",
    step4: "Realistische functies",
    step4Detail: "Drie tot vijf richtingen, elk met een reden.",
    step5: "Recente functies",
    step5Detail: "Uit gecontroleerde bronnen, met originele link en controletijd.",
    step6: "Passendheid en werkelijkheid",
    step6Detail: "Wat past, wat niet en wat nog open staat.",
    step7: "Sollicitatie",
    step7Detail: "Alleen uitspraken die je kunt onderbouwen.",

    diffUnderstand: "Begrijpen",
    diffUnderstandBody: "{assistant} begint niet bij een functietitel. Ze begint bij jou.",
    diffCheck: "Controleren",
    diffCheckBody:
      "Elke functie wordt nagelopen op passendheid, actualiteit, voorwaarden en open vragen.",
    diffAct: "Handelen",
    diffActBody:
      "{assistant} bereidt de volgende zinvolle stap voor — van sollicitatie tot gesprek.",

    closingTitle: "Begin met een gesprek.",
    closingBody:
      "Geen registratie voor een eerste blik, geen reclamemail, geen delen van je profiel. " +
      "Elk detail blijft in jouw handen.",

    navProduct: "Product",
    navHow: "Hoe het werkt",
    navSecurity: "Beveiliging",
    navSignIn: "Inloggen",
    footerPrivacy: "Privacy",
    footerSecurity: "Beveiliging",
    footerMethodology: "Methodologie",
    footerImprint: "Colofon",
    footerTerms: "Voorwaarden",
  },

  auth: {
    loginTitle: "Inloggen",
    registerTitle: "Account aanmaken",
    email: "E-mailadres",
    password: "Wachtwoord",
    passwordHint: "Minstens twaalf tekens. Lengte telt zwaarder dan speciale tekens.",
    login: "Inloggen",
    register: "Account aanmaken",
    magicLink: "Stuur me een link",
    magicLinkSent: "Als er een account bestaat voor dit adres, is er een link onderweg.",
    forgotPassword: "Wachtwoord vergeten?",
    noAccount: "Nog geen account?",
    hasAccount: "Heb je al een account?",
    errorInvalid: "Dat e-mailadres of dat wachtwoord klopt niet.",
    errorEmailTaken: "Voor dit adres bestaat al een account.",
    errorPasswordShort: "Dat wachtwoord is te kort. Het heeft minstens acht tekens nodig.",
    errorEmailInvalid: "Dat e-mailadres lijkt niet volledig.",
  },

  consent: {
    title: "Voordat we beginnen",
    intro:
      "Drie dingen om te beslissen. Je kunt ze later altijd wijzigen in het privacycentrum.",
    language: "Taal",
    country: "Land",
    location: "Jouw locatie",
    workModel: "Werkvorm",
    careerProfile: "Een loopbaanprofiel opbouwen",
    careerProfileBody:
      "Je antwoorden worden bewaard zodat daaruit een profiel kan ontstaan. Zonder dit werkt " +
      "verder niets.",
    documentAnalysis: "Documenten analyseren",
    documentAnalysisBody:
      "Als je een cv uploadt, wordt de tekst geanalyseerd om je profiel alvast te vullen. " +
      "Optioneel.",
    voiceInput: "Spraakinvoer",
    voiceInputBody:
      "Je kunt met {assistant} praten in plaats van typen. Los daarvan beslis je of de " +
      "transcriptie wordt bewaard.",
    transcriptStorage: "Transcriptie bewaren",
    transcriptStorageBody:
      "Zonder deze toestemming wordt gesproken tekst wel verwerkt, maar nooit bewaard.",
    externalAi: "Verwerking door een externe aanbieder",
    externalAiBodyActive:
      "Je tekst wordt voor analyse naar een externe AI-aanbieder gestuurd. Directe " +
      "identificatoren zoals e-mailadres en telefoonnummer worden er vooraf uit gehaald.",
    externalAiBodyInactive:
      "Er is op dit moment geen AI-aanbieder ingesteld. {assistant} zal niet antwoorden — we maken " +
      "bewust geen voorbeeldantwoord, want dat zou niet van een echt antwoord te " +
      "onderscheiden zijn.",
    privacyCenter: "Naar het privacycentrum",
    start: "Het gesprek beginnen",
  },

  interview: {
    title: "Gesprek met {assistant}",
    intro:
      "Voordat ik je vacatures laat zien, wil ik begrijpen wat je echt kunt, waar je energie " +
      "van krijgt en welke voorwaarden je nodig hebt. Je kunt alles op elk moment corrigeren " +
      "of overslaan.",
    progress: "{done} van {total} onderwerpen begrepen",
    yourAnswer: "Hoe kan ik je helpen met je volgende stap?",
    send: "Versturen",
    voiceMode: "Spreken",
    textMode: "Typen",
    voiceUnavailable:
      "De spraakmodus is niet beschikbaar omdat er geen spraakaanbieder is verbonden. Typen " +
      "werkt volledig.",
    listening: "Ik luister",
    paused: "Gepauzeerd",
    pause: "Pauzeren",
    resume: "Hervatten",
    interrupt: "Onderbreken",
    liveTranscript: "Live transcriptie",
    whyThisQuestion: "Waarom deze vraag?",
    recognisedSoFar: "Wat ik tot nu toe heb begrepen",
    openHypotheses: "Nog open gevolgtrekkingen",
    skipQuestion: "Deze vraag overslaan",
    pauseSession: "Het gesprek onderbreken",
    resumeLater: "Je kunt later precies hier verdergaan.",
    thinking: "{assistant} schrijft",
  },

  profile: {
    title: "Jouw loopbaanprofiel",
    compass: "Jouw loopbaankompas",
    confirmedStrengths: "Onderbouwde sterke punten",
    energising: "Werk waar je energie van krijgt",
    draining: "Je doet het goed, maar het kost je energie",
    interests: "Interesses en leerdoelen",
    values: "Waarden en afwegingen",
    workStyle: "Voorkeursmanier van werken",
    hardNoGos: "Harde grenzen",
    roleClusters: "Richtingen die passen",
    surprising: "Minder voor de hand liggend",
    gaps: "Hiaten en open gevolgtrekkingen",
    coverage: "Dekking van de gegevens",
    coverageBody:
      "Hoeveel van je profiel onderbouwd is. Wat ontbreekt verlaagt het vertrouwen in de " +
      "aanbevelingen, niet hun kwaliteit.",
    showEvidence: "Onderbouwing tonen",
    addEvidence: "Onderbouwing toevoegen",
    changeWeight: "Weging aanpassen",
    confirmAll: "Profiel bevestigen",
    confirmAllBody:
      "Daarna ontgrendel ik persoonlijke vacaturesuggesties. Je kunt alles blijven wijzigen.",
    confirmed: "bevestigd",
    hypothesis: "gevolgtrekking",
    fromDocument: "uit je documenten",
    rejected: "afgewezen",
    empty: "Hier staat nog niets. Het gesprek met {assistant} vult dit.",
  },

  jobs: {
    title: "De selectie van {assistant} voor jou",
    titleGeneric: "Selectie voor jou",
    locked: "Nog niet ontgrendeld",
    lockedBody:
      "Persoonlijke suggesties verschijnen pas als je profiel staat. Anders zouden het " +
      "gissingen zijn.",
    lockedCta: "Het gesprek voortzetten",
    sortBy: "Sorteren op",
    sortBestOverall: "Beste geheel",
    sortHighestFit: "Hoogste passendheid",
    sortBestQuality: "Beste functiekwaliteit",
    sortHighestSalary: "Hoogste salaris",
    sortFutureRobust: "Toekomstbestendig",
    sortShortestCommute: "Kortste reistijd",
    sortNewest: "Nieuwste vacatures",
    filters: "Filters",
    showBlocked: "Uitgesloten vacatures tonen",
    blockedBecause: "Uitgesloten vanwege",
    fit: "Passendheid",
    fitHigh: "sterke passendheid",
    fitMedium: "gemiddelde passendheid",
    fitExploratory: "verkennend",
    fitInsufficient: "passendheid nog open",
    confidence: "Vertrouwen",
    confidenceHigh: "hoog",
    confidenceMedium: "gemiddeld",
    confidenceLow: "laag",
    jobQuality: "Functiekwaliteit",
    aiTransition: "Hoe AI het kan veranderen",
    listingConfidence: "Vertrouwen in de vacature",
    published: "Geplaatst",
    daysAgo: "{n} dagen geleden",
    mainReason: "Waarom het past",
    mainReservation: "Waar je op moet letten",
    view: "Bekijken",
    save: "Bewaren",
    saved: "Bewaard",
    discuss: "Bespreken met {assistant}",
    empty: "Op dit moment past er niets bij deze filters. Verbreed de zoekopdracht wat.",
    emptyAll: "Er zijn nog geen vacatures geladen.",
  },

  jobDetail: {
    whyShown: "Waarom {assistant} je dit laat zien",
    tabOverview: "Overzicht",
    tabMatch: "Jouw match",
    tabQuality: "Functiekwaliteit",
    tabFuture: "Toekomst en AI",
    tabCompany: "Bedrijf en ervaringen",
    tabSource: "Originele vacature en bronnen",
    coreTasks: "Wat je werkelijk zou doen",
    mustHave: "Harde eisen",
    niceToHave: "Wensen",
    covered: "gedekt door jouw ervaring",
    notCovered: "nog niet onderbouwd",
    transferable: "overdraagbaar vanuit",
    learningCurve: "Waarschijnlijke leercurve",
    commute: "Reistijd",
    questionsToAsk: "Vragen die het waard zijn in het gesprek",
    prepareApplication: "Sollicitatie voorbereiden",
    whyNotHigher: "Waarom is de match niet hoger?",
    closeGap: "Welk hiaat zou ik snel kunnen dichten?",
    tasksChanging: "Welke taken zou AI kunnen veranderen?",
    compare: "Vergelijken met een andere vacature",
    retrievedAt: "Opgehaald op",
    sourceKind: "Soort bron",
    sampleSize: "Steekproefomvang",
    period: "Periode",
    aiSummary: "AI-samenvatting",
    aiSummaryNote:
      "Deze samenvatting komt van een taalmodel, niet van de bron zelf. De afzonderlijke " +
      "meningen staan in het origineel.",
    smallSample:
      "Zeer kleine steekproef. Losse meningen wegen hier zwaar — generaliseren zou niet " +
      "houdbaar zijn.",
    realityCheck: "Wat de vacature belooft — en wat anderen vertellen",
    staleWarning: "Deze vacature is mogelijk niet meer actueel.",
    repostWarning:
      "Eerder bestond er een identieke vacature. Dat kan een vervanging betekenen, of gewoon " +
      "een herplaatsing.",
  },

  applications: {
    title: "Jouw sollicitaties",
    viewKanban: "Bord",
    viewList: "Lijst",
    viewCalendar: "Data",
    stageSaved: "Bewaard",
    stagePreparing: "In voorbereiding",
    stageSent: "Verstuurd",
    stageAcknowledged: "Ontvangst bevestigd",
    stageInterview: "Gesprek",
    stageOffer: "Aanbod",
    stageRejected: "Afgewezen",
    stageWithdrawn: "Ingetrokken",
    stageAccepted: "Aangenomen",
    lastContact: "Laatste contact",
    nextStep: "Volgende stap",
    noNextStep: "Geen volgende stap ingesteld",
    documents: "Documenten",
    notes: "Notities",
    funnelTitle: "Wat je cijfers laten zien",
    funnelTooFew:
      "Er zijn nog te weinig sollicitaties voor een diagnose. Vanaf een stuk of tien " +
      "verstuurde sollicitaties wordt een patroon leesbaar — daarvoor zou elke uitspraak een " +
      "gissing zijn.",
    empty: "Nog geen sollicitaties. Ze beginnen bij bewaarde vacatures.",
  },

  studio: {
    title: "Sollicitatie voorbereiden",
    requirements: "Wat de functie vraagt",
    yourEvidence: "Jouw onderbouwde ervaring",
    document: "Document",
    checks: "De controles van {assistant}",
    openPoints: "Open punten",
    generateCv: "Cv maken",
    generateCvAts: "Versie voor selectiesystemen",
    generateCoverLetter: "Motivatiebrief maken",
    generateEmail: "Korte sollicitatiemail",
    coverLetterNotNeeded:
      "Deze functie vraagt geen motivatiebrief. Een korte mail is waarschijnlijk genoeg.",
    claimSupported: "onderbouwd",
    claimUnsupported: "niet onderbouwd",
    claimNeedsConfirmation: "moet bevestigd worden",
    unsupportedBlocked:
      "Zolang een uitspraak niet onderbouwd is, kan het document niet worden vrijgegeven. Voeg " +
      "onderbouwing toe of zwak de uitspraak af.",
    acceptChange: "Overnemen",
    rejectChange: "Verwerpen",
    showDiff: "Wijziging bekijken",
    reason: "Reden",
    preview: "Voorbeeld voor het versturen",
    recipient: "Ontvanger",
    subject: "Onderwerp",
    attachments: "Bijlagen",
    confirmSend: "Ik heb alles gecontroleerd en wil deze sollicitatie versturen",
    send: "Nu versturen",
    exportDraft: "Als concept downloaden",
    draftOnlySendNotice:
      "Er is geen e-mailaccount verbonden. Er wordt niets verstuurd — je krijgt een concept om " +
      "te downloaden.",
    portalGuide: "Leid me door het portaal",
  },

  coaching: {
    title: "Voorbereiding op het gesprek",
    modePractice: "Oefenen",
    modeSimulation: "Realistische simulatie",
    modeCase: "Casus",
    startSession: "Beginnen",
    repeatAnswer: "Antwoord herhalen",
    feedbackRelevance: "Relevantie voor de vraag",
    feedbackStructure: "Structuur",
    feedbackEvidence: "Concrete voorbeelden",
    feedbackClarity: "Helderheid",
    feedbackMissing: "Wat er nog ontbreekt",
    starStories: "Jouw voorbeelden uit het profiel",
    questionsForCompany: "Vragen voor het bedrijf",
    noBehaviourScoring:
      "Alleen de inhoud en de structuur van je antwoord worden beoordeeld. Niet je stem, je " +
      "gezicht, je accent of je uitstraling.",
  },

  settings: {
    title: "Instellingen",
    language: "Taal",
    region: "Land en regio",
    theme: "Weergave",
    themeLight: "Licht",
    themeDark: "Donker",
    themeSystem: "Systeem",
    notifications: "Meldingen",
    integrations: "Verbonden diensten",
    microphone: "Microfoon en transcripties",
    privacyCenter: "Privacycentrum",
    memory: "Wat {assistant} over je weet",
    memoryBody: "Elk item kan afzonderlijk worden bekeken, gewijzigd en verwijderd.",
    consents: "Jouw toestemmingen",
    exportData: "Gegevens exporteren",
    exportBody: "Je krijgt alles als JSON-bestand.",
    deleteAccount: "Account verwijderen",
    deleteAccountBody: "Verwijdert al je gegevens. Dit kan niet ongedaan worden gemaakt.",
    sessions: "Ingelogde apparaten",
    revokeSession: "Uitloggen",
    currentSession: "Dit apparaat",
    aiProvider: "Verwerking door AI",
    aiProviderNone:
      "Er is op dit moment geen AI-aanbieder ingesteld. Er wordt geen tekst verstuurd — en " +
      "{assistant} antwoordt ook niet.",
    aiProviderExternal:
      "Verwerking door een externe aanbieder. Doel, regio en aanbieder staan hieronder.",
  },

  states: {
    loading: "Laden",
    errorTitle: "Dat is niet gelukt",
    errorBody: "Probeer het opnieuw. Als het blijft gebeuren, ligt het niet aan jou.",
    offlineTitle: "Geen verbinding",
    offlineBody: "Je concepten zijn veilig. We gaan verder zodra je weer online bent.",
    permissionDenied: "Daar heb je geen toestemming voor.",
    insufficientData: "Er zijn te weinig gegevens voor.",
    notConnectedTitle: "Niet verbonden",
    notConnectedBody: "Deze dienst is niet ingesteld, dus de functie is inactief.",
    emptyTitle: "Hier staat nog niets",
  },

  nina: {
    askBar: "{assistant} vragen",
    suggestionProfileGap:
      "Je profiel heeft nog een belangrijk hiaat. Zullen we een concreet project toevoegen?",
    suggestionNoSalary:
      "Deze functie past inhoudelijk goed, maar er staat geen salaris bij. Zal ik een paar " +
      "vragen voor je voorbereiden?",
    suggestionReviewsFirst:
      "Wil je eerst de ervaringen van medewerkers openen, of de eisen met je profiel " +
      "vergelijken?",
    suggestionUnsupportedClaim:
      "Deze uitspraak in je brief is nog niet onderbouwd. Zullen we hem afzwakken of een " +
      "voorbeeld toevoegen?",
    suggestionInterviewSoon:
      "Je gesprek is over drie dagen. Zullen we de meest waarschijnlijke vragen simuleren?",
    suggestionFunnelPattern:
      "Je laatste acht sollicitaties hadden één harde eis gemeen die in je profiel niet " +
      "onderbouwd is. Zullen we de zoekopdracht bijstellen?",
  },
};
