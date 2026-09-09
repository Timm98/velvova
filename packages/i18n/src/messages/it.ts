import type { Messages } from "./de.ts";

/**
 * Testi italiani.
 *
 * Tipizzati sul file tedesco: una chiave mancante è un errore di
 * compilazione, non uno spazio vuoto nell'interfaccia.
 *
 * ── Da far rileggere a un madrelingua ───────────────────────────
 *
 * Due punti soprattutto. La sezione `consent` contiene formule
 * giuridiche: un consenso tradotto male non è soltanto sgradevole,
 * non vale nulla. E in `studio` la distinzione fra «documentato» e
 * «non documentato» regge l'intera promessa del prodotto — deve
 * restare netta.
 */
export const it: Messages = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
    example: "Esempio",
    save: "Salva",
    cancel: "Annulla",
    confirm: "Conferma",
    edit: "Modifica",
    delete: "Elimina",
    reject: "Rifiuta",
    back: "Indietro",
    next: "Avanti",
    skip: "Salta",
    close: "Chiudi",
    loading: "Caricamento",
    retry: "Riprova",
    showMore: "Mostra di più",
    showLess: "Mostra di meno",
    notSpecified: "non indicato",
    unknown: "sconosciuto",
    notConnected: "non collegato",
    openOriginal: "Apri l'annuncio originale",
    dismiss: "Non mostrare più",
  },

  nav: {
    home: "Home",
    assistant: "{assistant}",
    jobs: "Offerte",
    applications: "Candidature",
    profile: "Profilo",
    coaching: "Preparazione",
    offers: "Proposte",
    checkIns: "Punti di verifica",
    settings: "Impostazioni",
    logout: "Esci",
    howItWorks: "Come funziona",
    methodology: "Metodo",
    security: "Sicurezza",
    privacy: "Privacy",
    imprint: "Note legali",
    matches: "Corrispondenze",
    careerProfile: "Profilo professionale",
    growth: "Carriera",
    notifications: "Notifiche",
    search: "Cerca",
    languageRegion: "Lingua e regione",
    appearance: "Aspetto",
    privacyData: "Privacy e dati",
    help: "Aiuto",
    discover: "Scopri",
    career: "Carriera",
    expand: "Espandi",
    collapse: "Comprimi",
    skipToContent: "Vai al contenuto",
    backToApp: "Torna a {assistant}",
  },

  landing: {
    eyebrow: "Il tuo accompagnamento professionale con l'IA",
    headline: "Trova un lavoro che ti si addice davvero.",
    headlineLine1: "Trova un lavoro",
    headlineLine2: "che ti si addice davvero.",
    subheadline:
      "{assistant} capisce la tua esperienza, trova posizioni recenti da fonti verificate e ti " +
      "accompagna dall'orientamento fino alla candidatura.",
    ctaPrimary: "Inizia gratis con {assistant}",
    ctaSecondary: "Come funziona",

    coreLine1: "Non ti mostriamo più annunci.",
    coreLine2: "Ti mostriamo quelli giusti.",
    coreSub: "Non 10.000 risultati. Le poche occasioni che contano davvero.",

    learnsEyebrow: "Che cosa {assistant} impara di te",
    learnsTitle: "Prima capire, poi cercare.",
    learnsBody:
      "Situazioni concrete invece di autodescrizioni. Che cosa hai fatto, che cosa ne è " +
      "venuto fuori, da che cosa lo si riconoscerebbe. Su questo può reggersi un profilo.",
    rolesEyebrow: "Direzioni",
    rolesTitle: "Ruoli che ti si addicono — e altri a cui non avresti pensato.",
    rolesBody:
      "Vicini, adiacenti, inattesi. Per ciascuno: su che cosa si fonda, che cosa cambierebbe, " +
      "che cosa manca — e come provarlo in piccolo.",
    jobsEyebrow: "Posizioni attuali",
    jobsTitle: "Ogni suggerimento con la sua ragione, la sua fonte e ciò che resta aperto.",
    jobsBody:
      "Annunci reali da fonti offerte apertamente, collegati all'originale e con l'ora " +
      "dell'ultima verifica. Lo stipendio solo se è indicato lì.",
    applyEyebrow: "Candidatura",
    applyTitle: "Quando una posizione va bene, {assistant} ti prepara.",
    applyBody:
      "Documenti adattati al ruolo — la lingua e l'ordine delle priorità, non la verità. Nulla " +
      "viene inviato senza il tuo esplicito consenso.",
    pathEyebrow: "Il percorso",
    pathTitle: "Da ciò che sai fare a ciò che ottieni.",
    pathBody:
      "Ogni passo si appoggia al precedente. Ciò che non è documentato non viene affermato — " +
      "né in un suggerimento né in una candidatura.",

    step1: "La tua esperienza",
    step1Detail: "Ciò che hai fatto davvero, non ciò che dice il curriculum.",
    step2: "{assistant} ti capisce",
    step2Detail: "Una conversazione su situazioni, non su parole di moda.",
    step3: "Competenze e modo di lavorare",
    step3Detail: "Documentate, con la loro provenienza. Nulla di inventato.",
    step4: "Ruoli realistici",
    step4Detail: "Da tre a cinque direzioni, ognuna con la sua ragione.",
    step5: "Posizioni recenti",
    step5Detail: "Da fonti verificate, con link originale e ora della verifica.",
    step6: "Adeguatezza e realtà",
    step6Detail: "Che cosa va bene, che cosa no, che cosa resta aperto.",
    step7: "Candidatura",
    step7Detail: "Solo affermazioni che puoi sostenere.",

    diffUnderstand: "Capire",
    diffUnderstandBody: "{assistant} non parte da un titolo di lavoro. Parte da te.",
    diffCheck: "Verificare",
    diffCheckBody:
      "Ogni posizione viene esaminata: adeguatezza, attualità, condizioni e domande aperte.",
    diffAct: "Agire",
    diffActBody:
      "{assistant} prepara il passo successivo sensato — dalla candidatura al colloquio.",

    closingTitle: "Comincia con una conversazione.",
    closingBody:
      "Nessuna registrazione per una prima occhiata, nessuna e-mail pubblicitaria, nessuna " +
      "condivisione del tuo profilo. Ogni dettaglio resta nelle tue mani.",

    navProduct: "Prodotto",
    navHow: "Come funziona",
    navSecurity: "Sicurezza",
    navSignIn: "Accedi",
    footerPrivacy: "Privacy",
    footerSecurity: "Sicurezza",
    footerMethodology: "Metodologia",
    footerImprint: "Note legali",
    footerTerms: "Condizioni",
  },

  auth: {
    loginTitle: "Accedi",
    registerTitle: "Crea un account",
    email: "Indirizzo e-mail",
    password: "Password",
    passwordHint: "Almeno dodici caratteri. La lunghezza conta più dei caratteri speciali.",
    login: "Accedi",
    register: "Crea un account",
    magicLink: "Inviami un link",
    magicLinkSent: "Se esiste un account per questo indirizzo, il link è in arrivo.",
    forgotPassword: "Password dimenticata?",
    noAccount: "Non hai ancora un account?",
    hasAccount: "Hai già un account?",
    errorInvalid: "Questo indirizzo e-mail o questa password non vanno bene.",
    errorEmailTaken: "Esiste già un account per questo indirizzo.",
    errorPasswordShort: "Questa password è troppo corta. Servono almeno otto caratteri.",
    errorEmailInvalid: "Questo indirizzo e-mail non sembra completo.",
  },

  consent: {
    title: "Prima di cominciare",
    intro:
      "Tre cose da decidere. Puoi cambiarle in qualsiasi momento nel centro privacy.",
    language: "Lingua",
    country: "Paese",
    location: "La tua posizione",
    workModel: "Modalità di lavoro",
    careerProfile: "Costruire un profilo professionale",
    careerProfileBody:
      "Le tue risposte vengono conservate per poterne ricavare un profilo. Senza questo non " +
      "funziona nient'altro.",
    documentAnalysis: "Analizzare i documenti",
    documentAnalysisBody:
      "Se carichi un curriculum, il testo viene analizzato per precompilare il profilo. " +
      "Facoltativo.",
    voiceInput: "Immissione vocale",
    voiceInputBody:
      "Puoi parlare con {assistant} invece di scrivere. Separatamente decidi se la " +
      "trascrizione viene conservata.",
    transcriptStorage: "Conservare la trascrizione",
    transcriptStorageBody:
      "Senza questo consenso il testo parlato viene elaborato ma mai conservato.",
    externalAi: "Trattamento da parte di un fornitore esterno",
    externalAiBodyActive:
      "Il tuo testo viene inviato a un fornitore di IA esterno per l'analisi. Gli " +
      "identificativi diretti come indirizzo e-mail e numero di telefono vengono rimossi prima.",
    externalAiBodyInactive:
      "Al momento non è configurato alcun fornitore di IA. {assistant} non risponderà — " +
      "deliberatamente non produciamo una risposta di esempio, perché sarebbe " +
      "indistinguibile da una vera.",
    privacyCenter: "Vai al centro privacy",
    start: "Inizia la conversazione",
  },

  interview: {
    title: "Conversazione con {assistant}",
    intro:
      "Prima di mostrarti delle offerte voglio capire che cosa sai fare davvero, che cosa ti " +
      "dà energia e di quali condizioni hai bisogno. Puoi correggere o saltare qualsiasi cosa " +
      "in qualsiasi momento.",
    progress: "{done} argomenti su {total} compresi",
    yourAnswer: "Descrivi il tuo obiettivo. Monday si occupa dei passi successivi.",
    send: "Invia",
    voiceMode: "Parla",
    textMode: "Scrivi",
    voiceUnavailable:
      "La modalità vocale non è disponibile perché non è collegato alcun fornitore vocale. La " +
      "scrittura funziona interamente.",
    listening: "Ti ascolto",
    paused: "In pausa",
    pause: "Metti in pausa",
    resume: "Riprendi",
    interrupt: "Interrompi",
    liveTranscript: "Trascrizione in diretta",
    whyThisQuestion: "Perché questa domanda?",
    recognisedSoFar: "Che cosa ho capito finora",
    openHypotheses: "Deduzioni ancora aperte",
    skipQuestion: "Salta questa domanda",
    pauseSession: "Interrompi la conversazione",
    resumeLater: "Potrai riprendere esattamente da qui più tardi.",
    thinking: "{assistant} sta scrivendo",
  },

  profile: {
    title: "Il tuo profilo professionale",
    compass: "La tua bussola professionale",
    confirmedStrengths: "Punti di forza documentati",
    energising: "Il lavoro che ti dà energia",
    draining: "Lo fai bene, ma ti costa energia",
    interests: "Interessi e obiettivi di apprendimento",
    values: "Valori e compromessi",
    workStyle: "Modo di lavorare preferito",
    hardNoGos: "Limiti invalicabili",
    roleClusters: "Direzioni che si addicono",
    surprising: "Meno ovvio",
    gaps: "Lacune e deduzioni aperte",
    coverage: "Copertura dei dati",
    coverageBody:
      "Quanta parte del tuo profilo è documentata. Ciò che manca abbassa la confidenza dei " +
      "suggerimenti, non la loro qualità.",
    showEvidence: "Mostra le prove",
    addEvidence: "Aggiungi una prova",
    changeWeight: "Cambia la ponderazione",
    confirmAll: "Conferma il profilo",
    confirmAllBody:
      "Dopo sblocco suggerimenti di lavoro personalizzati. Potrai continuare a cambiare tutto.",
    confirmed: "confermato",
    hypothesis: "deduzione",
    fromDocument: "dai tuoi documenti",
    rejected: "rifiutato",
    empty: "Qui non c'è ancora nulla. La conversazione con {assistant} lo riempie.",
  },

  jobs: {
    title: "La selezione di {assistant} per te",
    titleGeneric: "Selezione per te",
    locked: "Non ancora sbloccato",
    lockedBody:
      "I suggerimenti personalizzati compaiono solo quando il tuo profilo è pronto. " +
      "Altrimenti sarebbero congetture.",
    lockedCta: "Continua la conversazione",
    sortBy: "Ordina per",
    sortBestOverall: "Migliore nel complesso",
    sortHighestFit: "Massima adeguatezza",
    sortBestQuality: "Migliore qualità della posizione",
    sortHighestSalary: "Stipendio più alto",
    sortFutureRobust: "Solido nel tempo",
    sortShortestCommute: "Tragitto più breve",
    sortNewest: "Annunci più recenti",
    filters: "Filtri",
    showBlocked: "Mostra le offerte escluse",
    blockedBecause: "Esclusa a causa di",
    fit: "Adeguatezza",
    fitHigh: "adeguatezza alta",
    fitMedium: "adeguatezza media",
    fitExploratory: "esplorativa",
    fitInsufficient: "adeguatezza ancora aperta",
    confidence: "Confidenza",
    confidenceHigh: "alta",
    confidenceMedium: "media",
    confidenceLow: "bassa",
    jobQuality: "Qualità della posizione",
    aiTransition: "Come l'IA potrebbe cambiarla",
    listingConfidence: "Fiducia nell'annuncio",
    published: "Pubblicato",
    daysAgo: "{n} giorni fa",
    mainReason: "Perché ti si addice",
    mainReservation: "A che cosa fare attenzione",
    view: "Apri",
    save: "Salva",
    saved: "Salvata",
    discuss: "Parlane con {assistant}",
    empty: "Al momento nulla corrisponde a questi filtri. Allarga un po' la ricerca.",
    emptyAll: "Non è ancora stata caricata alcuna offerta.",
  },

  jobDetail: {
    whyShown: "Perché {assistant} ti mostra questo",
    tabOverview: "Panoramica",
    tabMatch: "La tua corrispondenza",
    tabQuality: "Qualità della posizione",
    tabFuture: "Futuro e IA",
    tabCompany: "Azienda ed esperienze",
    tabSource: "Annuncio originale e fonti",
    coreTasks: "Che cosa faresti davvero",
    mustHave: "Requisiti indispensabili",
    niceToHave: "Requisiti graditi",
    covered: "coperto dalla tua esperienza",
    notCovered: "non ancora documentato",
    transferable: "trasferibile da",
    learningCurve: "Curva di apprendimento probabile",
    commute: "Tragitto",
    questionsToAsk: "Domande da fare al colloquio",
    prepareApplication: "Prepara la candidatura",
    whyNotHigher: "Perché la corrispondenza non è più alta?",
    closeGap: "Quale lacuna potrei colmare in fretta?",
    tasksChanging: "Quali compiti potrebbe cambiare l'IA?",
    compare: "Confronta con un'altra offerta",
    retrievedAt: "Recuperato il",
    sourceKind: "Tipo di fonte",
    sampleSize: "Ampiezza del campione",
    period: "Periodo",
    aiSummary: "Sintesi dell'IA",
    aiSummaryNote:
      "Questa sintesi viene da un modello linguistico, non dalla fonte stessa. Le singole voci " +
      "sono nell'originale.",
    smallSample:
      "Campione molto ridotto. Qui le singole voci pesano molto — generalizzare non sarebbe " +
      "solido.",
    realityCheck: "Che cosa promette l'annuncio e che cosa raccontano altri",
    staleWarning: "Questo annuncio potrebbe non essere più attuale.",
    repostWarning:
      "In precedenza esisteva un annuncio identico. Può significare una sostituzione oppure " +
      "semplicemente una ripubblicazione.",
  },

  applications: {
    title: "Le tue candidature",
    viewKanban: "Bacheca",
    viewList: "Elenco",
    viewCalendar: "Scadenze",
    stageSaved: "Salvata",
    stagePreparing: "In preparazione",
    stageSent: "Inviata",
    stageAcknowledged: "Ricezione confermata",
    stageInterview: "Colloquio",
    stageOffer: "Offerta",
    stageRejected: "Rifiutata",
    stageWithdrawn: "Ritirata",
    stageAccepted: "Accettata",
    lastContact: "Ultimo contatto",
    nextStep: "Passo successivo",
    noNextStep: "Nessun passo definito",
    documents: "Documenti",
    notes: "Note",
    funnelTitle: "Che cosa dicono i tuoi numeri",
    funnelTooFew:
      "Le candidature sono ancora troppo poche per una diagnosi. Da una decina di candidature " +
      "inviate un andamento diventa leggibile; prima, qualsiasi affermazione sarebbe una " +
      "congettura.",
    empty: "Ancora nessuna candidatura. Partono dalle offerte salvate.",
  },

  studio: {
    title: "Prepara la candidatura",
    requirements: "Che cosa richiede il ruolo",
    yourEvidence: "La tua esperienza documentata",
    document: "Documento",
    checks: "Le verifiche di {assistant}",
    openPoints: "Punti aperti",
    generateCv: "Crea il curriculum",
    generateCvAts: "Versione adatta ai sistemi di selezione",
    generateCoverLetter: "Crea la lettera di presentazione",
    generateEmail: "Breve e-mail di candidatura",
    coverLetterNotNeeded:
      "Questo ruolo non richiede una lettera di presentazione. Probabilmente basta una breve " +
      "e-mail.",
    claimSupported: "documentato",
    claimUnsupported: "non documentato",
    claimNeedsConfirmation: "da confermare",
    unsupportedBlocked:
      "Finché un'affermazione non è documentata, il documento non può essere approvato. " +
      "Aggiungi una prova oppure attenua l'affermazione.",
    acceptChange: "Accetta",
    rejectChange: "Scarta",
    showDiff: "Vedi la modifica",
    reason: "Motivo",
    preview: "Anteprima prima dell'invio",
    recipient: "Destinatario",
    subject: "Oggetto",
    attachments: "Allegati",
    confirmSend: "Ho controllato tutto e voglio inviare questa candidatura",
    send: "Invia ora",
    exportDraft: "Scarica come bozza",
    draftOnlySendNotice:
      "Non è collegato alcun account e-mail. Non verrà inviato nulla — ricevi una bozza da " +
      "scaricare.",
    portalGuide: "Guidami nel portale",
  },

  coaching: {
    title: "Preparazione al colloquio",
    modePractice: "Esercizio",
    modeSimulation: "Simulazione realistica",
    modeCase: "Caso di studio",
    startSession: "Inizia",
    repeatAnswer: "Ripeti la risposta",
    feedbackRelevance: "Pertinenza rispetto alla domanda",
    feedbackStructure: "Struttura",
    feedbackEvidence: "Esempi concreti",
    feedbackClarity: "Chiarezza",
    feedbackMissing: "Che cosa manca ancora",
    starStories: "I tuoi esempi dal profilo",
    questionsForCompany: "Domande per l'azienda",
    noBehaviourScoring:
      "Vengono valutati solo il contenuto e la struttura della tua risposta. Non la voce, non " +
      "il viso, non l'accento, non la presenza.",
  },

  settings: {
    title: "Impostazioni",
    language: "Lingua",
    region: "Paese e regione",
    theme: "Aspetto",
    themeLight: "Chiaro",
    themeDark: "Scuro",
    themeSystem: "Sistema",
    notifications: "Notifiche",
    integrations: "Servizi collegati",
    microphone: "Microfono e trascrizioni",
    privacyCenter: "Centro privacy",
    memory: "Che cosa {assistant} sa di te",
    memoryBody: "Ogni voce può essere consultata, modificata ed eliminata singolarmente.",
    consents: "I tuoi consensi",
    exportData: "Esporta i dati",
    exportBody: "Ricevi tutto in un file JSON.",
    deleteAccount: "Elimina l'account",
    deleteAccountBody: "Cancella tutti i tuoi dati. Non si può annullare.",
    sessions: "Dispositivi collegati",
    revokeSession: "Disconnetti",
    currentSession: "Questo dispositivo",
    aiProvider: "Trattamento tramite IA",
    aiProviderNone:
      "Al momento non è configurato alcun fornitore di IA. Nessun testo viene trasmesso — e " +
      "nemmeno {assistant} risponde.",
    aiProviderExternal:
      "Trattamento da parte di un fornitore esterno. Finalità, regione e fornitore sono " +
      "indicati qui sotto.",
  },

  states: {
    loading: "Caricamento",
    errorTitle: "Non ha funzionato",
    errorBody: "Riprova. Se continua a succedere, non è colpa tua.",
    offlineTitle: "Nessuna connessione",
    offlineBody: "Le tue bozze sono al sicuro. Riprendiamo appena torni online.",
    permissionDenied: "Non hai l'autorizzazione per questo.",
    insufficientData: "Ci sono troppo pochi dati per questo.",
    notConnectedTitle: "Non collegato",
    notConnectedBody: "Questo servizio non è configurato, quindi la funzione è inattiva.",
    emptyTitle: "Qui non c'è ancora nulla",
  },

  nina: {
    askBar: "Chiedi a {assistant}",
    suggestionProfileGap:
      "Il tuo profilo ha ancora una lacuna importante. Aggiungiamo un progetto concreto?",
    suggestionNoSalary:
      "Questa posizione ti si addice sul piano professionale, ma non indica lo stipendio. Ti " +
      "preparo qualche domanda?",
    suggestionReviewsFirst:
      "Preferisci aprire prima le recensioni dei dipendenti o confrontare i requisiti con il " +
      "tuo profilo?",
    suggestionUnsupportedClaim:
      "Questa affermazione nella tua lettera non è ancora documentata. La attenuiamo o " +
      "aggiungiamo un esempio?",
    suggestionInterviewSoon:
      "Il tuo colloquio è fra tre giorni. Simuliamo le domande più probabili?",
    suggestionFunnelPattern:
      "Le tue ultime otto candidature avevano in comune un requisito indispensabile che nel " +
      "tuo profilo non è documentato. Correggiamo la ricerca?",
  },
};
