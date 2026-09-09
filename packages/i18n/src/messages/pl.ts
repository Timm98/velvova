import type { Messages } from "./de.ts";

/**
 * Teksty polskie.
 *
 * Typowane według pliku niemieckiego: brakujący klucz to błąd
 * kompilacji, a nie puste miejsce w interfejsie.
 *
 * ── Do sprawdzenia przez osobę z językiem ojczystym ─────────────
 *
 * Przede wszystkim dwa miejsca. Sekcja `consent` zawiera sformułowania
 * prawne: źle przetłumaczona zgoda nie tylko drażni — jest nieważna.
 * A w `studio` rozróżnienie między „udokumentowane" i
 * „nieudokumentowane" niesie całą obietnicę produktu i musi pozostać
 * ostre.
 *
 * ── Forma zwracania się ─────────────────────────────────────────
 *
 * Konsekwentnie na „ty", tak jak w oryginale niemieckim. Polski
 * zwyczaj w tekstach urzędowych bywa inny; tutaj chodzi o rozmowę,
 * nie o pismo urzędowe.
 */
export const pl: Messages = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
    example: "Przykład",
    save: "Zapisz",
    cancel: "Anuluj",
    confirm: "Potwierdź",
    edit: "Edytuj",
    delete: "Usuń",
    reject: "Odrzuć",
    back: "Wstecz",
    next: "Dalej",
    skip: "Pomiń",
    close: "Zamknij",
    loading: "Wczytywanie",
    retry: "Spróbuj ponownie",
    showMore: "Pokaż więcej",
    showLess: "Pokaż mniej",
    notSpecified: "nie podano",
    unknown: "nieznane",
    notConnected: "brak połączenia",
    openOriginal: "Otwórz oryginalne ogłoszenie",
    dismiss: "Nie pokazuj ponownie",
  },

  nav: {
    home: "Start",
    assistant: "{assistant}",
    jobs: "Oferty",
    applications: "Aplikacje",
    profile: "Profil",
    coaching: "Przygotowanie",
    offers: "Propozycje",
    checkIns: "Punkty kontrolne",
    settings: "Ustawienia",
    logout: "Wyloguj się",
    howItWorks: "Jak to działa",
    methodology: "Metoda",
    security: "Bezpieczeństwo",
    privacy: "Prywatność",
    imprint: "Nota prawna",
    matches: "Dopasowania",
    careerProfile: "Profil zawodowy",
    growth: "Kariera",
    notifications: "Powiadomienia",
    search: "Szukaj",
    languageRegion: "Język i region",
    appearance: "Wygląd",
    privacyData: "Prywatność i dane",
    help: "Pomoc",
    discover: "Odkrywaj",
    career: "Kariera",
    expand: "Rozwiń",
    collapse: "Zwiń",
    skipToContent: "Przejdź do treści",
    backToApp: "Powrót do {assistant}",
  },

  landing: {
    eyebrow: "Twoje wsparcie zawodowe z AI",
    headline: "Znajdź pracę, która naprawdę do ciebie pasuje.",
    headlineLine1: "Znajdź pracę,",
    headlineLine2: "która naprawdę do ciebie pasuje.",
    subheadline:
      "{assistant} rozumie twoje doświadczenie, znajduje aktualne stanowiska ze sprawdzonych " +
      "źródeł i towarzyszy ci od orientacji aż po aplikację.",
    ctaPrimary: "Zacznij bezpłatnie z {assistant}",
    ctaSecondary: "Jak to działa",

    coreLine1: "Nie pokazujemy ci więcej ofert.",
    coreLine2: "Pokazujemy ci właściwe.",
    coreSub: "Nie 10 000 wyników. Tych kilka szans, które naprawdę się liczą.",

    learnsEyebrow: "Czego {assistant} się o tobie dowiaduje",
    learnsTitle: "Najpierw zrozumieć, potem szukać.",
    learnsBody:
      "Konkretne sytuacje zamiast autoprezentacji. Co zrobiłeś, co z tego wyszło, po czym " +
      "można by to poznać. Na tym może opierać się profil.",
    rolesEyebrow: "Kierunki",
    rolesTitle: "Role, które pasują — i takie, o których byś nie pomyślał.",
    rolesBody:
      "Pokrewne, sąsiednie, nieoczywiste. Przy każdej: na czym się opiera, co byłoby inaczej, " +
      "czego brakuje — i jak sprawdzić to na małą skalę.",
    jobsEyebrow: "Aktualne stanowiska",
    jobsTitle: "Każda rekomendacja z uzasadnieniem, źródłem i tym, co pozostaje otwarte.",
    jobsBody:
      "Prawdziwe ogłoszenia z otwarcie udostępnianych źródeł, z odnośnikiem do oryginału i " +
      "godziną ostatniego sprawdzenia. Wynagrodzenie tylko wtedy, gdy tam figuruje.",
    applyEyebrow: "Aplikacja",
    applyTitle: "Gdy stanowisko pasuje, {assistant} cię przygotuje.",
    applyBody:
      "Dokumenty dopasowane do roli — język i kolejność, nie prawda. Nic nie zostaje wysłane " +
      "bez twojej wyraźnej zgody.",
    pathEyebrow: "Droga",
    pathTitle: "Od tego, co umiesz, do tego, co dostajesz.",
    pathBody:
      "Każdy krok opiera się na poprzednim. Czego nie da się udokumentować, tego nie " +
      "twierdzimy — ani w rekomendacji, ani w aplikacji.",

    step1: "Twoje doświadczenie",
    step1Detail: "To, co naprawdę robiłeś — nie to, co mówi CV.",
    step2: "{assistant} cię rozumie",
    step2Detail: "Rozmowa o sytuacjach, nie o modnych hasłach.",
    step3: "Umiejętności i sposób pracy",
    step3Detail: "Udokumentowane, ze wskazaniem źródła. Nic zmyślonego.",
    step4: "Realistyczne role",
    step4Detail: "Trzy do pięciu kierunków, każdy z uzasadnieniem.",
    step5: "Aktualne stanowiska",
    step5Detail: "Ze sprawdzonych źródeł, z oryginalnym odnośnikiem i godziną sprawdzenia.",
    step6: "Dopasowanie i rzeczywistość",
    step6Detail: "Co pasuje, co nie pasuje, co pozostaje otwarte.",
    step7: "Aplikacja",
    step7Detail: "Tylko stwierdzenia, które możesz poprzeć.",

    diffUnderstand: "Zrozumieć",
    diffUnderstandBody: "{assistant} nie zaczyna od nazwy stanowiska. Zaczyna od ciebie.",
    diffCheck: "Sprawdzić",
    diffCheckBody:
      "Każde stanowisko jest sprawdzane pod kątem dopasowania, aktualności, warunków i " +
      "otwartych pytań.",
    diffAct: "Działać",
    diffActBody:
      "{assistant} przygotowuje sensowny następny krok — od aplikacji po rozmowę.",

    closingTitle: "Zacznij od rozmowy.",
    closingBody:
      "Bez rejestracji na pierwszy rzut oka, bez maili reklamowych, bez udostępniania twojego " +
      "profilu. Każdy szczegół pozostaje w twoich rękach.",

    navProduct: "Produkt",
    navHow: "Jak to działa",
    navSecurity: "Bezpieczeństwo",
    navSignIn: "Zaloguj się",
    footerPrivacy: "Prywatność",
    footerSecurity: "Bezpieczeństwo",
    footerMethodology: "Metodologia",
    footerImprint: "Nota prawna",
    footerTerms: "Regulamin",
  },

  auth: {
    loginTitle: "Zaloguj się",
    registerTitle: "Załóż konto",
    email: "Adres e-mail",
    password: "Hasło",
    passwordHint: "Co najmniej dwanaście znaków. Długość liczy się bardziej niż znaki specjalne.",
    login: "Zaloguj się",
    register: "Załóż konto",
    magicLink: "Wyślij mi link",
    magicLinkSent: "Jeśli dla tego adresu istnieje konto, link jest już w drodze.",
    forgotPassword: "Nie pamiętasz hasła?",
    noAccount: "Nie masz jeszcze konta?",
    hasAccount: "Masz już konto?",
    errorInvalid: "Ten adres e-mail lub to hasło się nie zgadza.",
    errorEmailTaken: "Dla tego adresu istnieje już konto.",
    errorPasswordShort: "To hasło jest za krótkie. Potrzebuje co najmniej ośmiu znaków.",
    errorEmailInvalid: "Ten adres e-mail wygląda na niekompletny.",
  },

  consent: {
    title: "Zanim zaczniemy",
    intro:
      "Trzy rzeczy do decyzji. Każdą z nich możesz później zmienić w centrum prywatności.",
    language: "Język",
    country: "Kraj",
    location: "Twoja lokalizacja",
    workModel: "Model pracy",
    careerProfile: "Zbudować profil zawodowy",
    careerProfileBody:
      "Twoje odpowiedzi są przechowywane, aby mógł z nich powstać profil. Bez tego nic innego " +
      "nie zadziała.",
    documentAnalysis: "Analizować dokumenty",
    documentAnalysisBody:
      "Jeśli prześlesz CV, jego tekst zostanie przeanalizowany, aby wstępnie wypełnić profil. " +
      "Opcjonalne.",
    voiceInput: "Wprowadzanie głosowe",
    voiceInputBody:
      "Możesz mówić do {assistant} zamiast pisać. Osobno decydujesz, czy transkrypcja jest " +
      "przechowywana.",
    transcriptStorage: "Przechowywać transkrypcję",
    transcriptStorageBody:
      "Bez tej zgody tekst mówiony jest przetwarzany, ale nigdy nie zostaje zachowany.",
    externalAi: "Przetwarzanie przez dostawcę zewnętrznego",
    externalAiBodyActive:
      "Twój tekst jest przekazywany do zewnętrznego dostawcy AI w celu analizy. Bezpośrednie " +
      "identyfikatory, takie jak adres e-mail i numer telefonu, są wcześniej usuwane.",
    externalAiBodyInactive:
      "W tej chwili nie skonfigurowano żadnego dostawcy AI. {assistant} nie odpowie — celowo nie " +
      "tworzymy odpowiedzi przykładowej, ponieważ nie dałoby się jej odróżnić od prawdziwej.",
    privacyCenter: "Przejdź do centrum prywatności",
    start: "Rozpocznij rozmowę",
  },

  interview: {
    title: "Rozmowa z {assistant}",
    intro:
      "Zanim pokażę ci oferty, chcę zrozumieć, co naprawdę potrafisz, co daje ci energię i " +
      "jakich warunków potrzebujesz. W każdej chwili możesz wszystko poprawić lub pominąć.",
    progress: "Zrozumiano {done} z {total} tematów",
    yourAnswer: "Opisz, czego chcesz. Monday zajmie się kolejnymi krokami.",
    send: "Wyślij",
    voiceMode: "Mów",
    textMode: "Pisz",
    voiceUnavailable:
      "Tryb głosowy jest niedostępny, ponieważ nie podłączono dostawcy mowy. Pisanie działa w " +
      "pełni.",
    listening: "Słucham",
    paused: "Wstrzymane",
    pause: "Wstrzymaj",
    resume: "Wznów",
    interrupt: "Przerwij",
    liveTranscript: "Transkrypcja na żywo",
    whyThisQuestion: "Dlaczego to pytanie?",
    recognisedSoFar: "Co dotąd zrozumiałam",
    openHypotheses: "Wciąż otwarte wnioski",
    skipQuestion: "Pomiń to pytanie",
    pauseSession: "Przerwij rozmowę",
    resumeLater: "Później będziesz mógł podjąć ją dokładnie w tym miejscu.",
    thinking: "{assistant} pisze",
  },

  profile: {
    title: "Twój profil zawodowy",
    compass: "Twój kompas zawodowy",
    confirmedStrengths: "Udokumentowane mocne strony",
    energising: "Praca, która daje ci energię",
    draining: "Robisz to dobrze, ale kosztuje cię to energię",
    interests: "Zainteresowania i cele nauki",
    values: "Wartości i kompromisy",
    workStyle: "Preferowany sposób pracy",
    hardNoGos: "Twarde granice",
    roleClusters: "Kierunki, które pasują",
    surprising: "Mniej oczywiste",
    gaps: "Luki i otwarte wnioski",
    coverage: "Pokrycie danymi",
    coverageBody:
      "Jaka część twojego profilu jest udokumentowana. To, czego brakuje, obniża pewność " +
      "rekomendacji, a nie ich jakość.",
    showEvidence: "Pokaż podstawę",
    addEvidence: "Dodaj podstawę",
    changeWeight: "Zmień wagę",
    confirmAll: "Potwierdź profil",
    confirmAllBody:
      "Potem odblokuję spersonalizowane propozycje ofert. Nadal będziesz mógł wszystko zmieniać.",
    confirmed: "potwierdzone",
    hypothesis: "wniosek",
    fromDocument: "z twoich dokumentów",
    rejected: "odrzucone",
    empty: "Tu jeszcze nic nie ma. Rozmowa z {assistant} to wypełnia.",
  },

  jobs: {
    title: "Wybór {assistant} dla ciebie",
    titleGeneric: "Wybór dla ciebie",
    locked: "Jeszcze nieodblokowane",
    lockedBody:
      "Spersonalizowane propozycje pojawiają się dopiero, gdy twój profil jest gotowy. W " +
      "przeciwnym razie byłyby zgadywaniem.",
    lockedCta: "Kontynuuj rozmowę",
    sortBy: "Sortuj według",
    sortBestOverall: "Najlepsze ogółem",
    sortHighestFit: "Najwyższe dopasowanie",
    sortBestQuality: "Najlepsza jakość stanowiska",
    sortHighestSalary: "Najwyższe wynagrodzenie",
    sortFutureRobust: "Odporne na przyszłość",
    sortShortestCommute: "Najkrótszy dojazd",
    sortNewest: "Najnowsze ogłoszenia",
    filters: "Filtry",
    showBlocked: "Pokaż wykluczone oferty",
    blockedBecause: "Wykluczone z powodu",
    fit: "Dopasowanie",
    fitHigh: "wysokie dopasowanie",
    fitMedium: "średnie dopasowanie",
    fitExploratory: "rozpoznawcze",
    fitInsufficient: "dopasowanie wciąż otwarte",
    confidence: "Pewność",
    confidenceHigh: "wysoka",
    confidenceMedium: "średnia",
    confidenceLow: "niska",
    jobQuality: "Jakość stanowiska",
    aiTransition: "Jak AI może to zmienić",
    listingConfidence: "Zaufanie do ogłoszenia",
    published: "Opublikowano",
    daysAgo: "{n} dni temu",
    mainReason: "Dlaczego pasuje",
    mainReservation: "Na co zwrócić uwagę",
    view: "Zobacz",
    save: "Zapisz",
    saved: "Zapisano",
    discuss: "Omów z {assistant}",
    empty: "Do tych filtrów nic teraz nie pasuje. Poszerz nieco wyszukiwanie.",
    emptyAll: "Nie wczytano jeszcze żadnych ofert.",
  },

  jobDetail: {
    whyShown: "Dlaczego {assistant} ci to pokazuje",
    tabOverview: "Przegląd",
    tabMatch: "Twoje dopasowanie",
    tabQuality: "Jakość stanowiska",
    tabFuture: "Przyszłość i AI",
    tabCompany: "Firma i doświadczenia",
    tabSource: "Oryginalne ogłoszenie i źródła",
    coreTasks: "Co naprawdę byś robił",
    mustHave: "Wymagania konieczne",
    niceToHave: "Wymagania mile widziane",
    covered: "pokryte twoim doświadczeniem",
    notCovered: "jeszcze nieudokumentowane",
    transferable: "przenoszalne z",
    learningCurve: "Prawdopodobna krzywa uczenia się",
    commute: "Dojazd",
    questionsToAsk: "Pytania warte zadania na rozmowie",
    prepareApplication: "Przygotuj aplikację",
    whyNotHigher: "Dlaczego dopasowanie nie jest wyższe?",
    closeGap: "Którą lukę mógłbym szybko zamknąć?",
    tasksChanging: "Które zadania mogłaby zmienić AI?",
    compare: "Porównaj z inną ofertą",
    retrievedAt: "Pobrano",
    sourceKind: "Rodzaj źródła",
    sampleSize: "Wielkość próby",
    period: "Okres",
    aiSummary: "Podsumowanie AI",
    aiSummaryNote:
      "To podsumowanie pochodzi z modelu językowego, a nie z samego źródła. Poszczególne " +
      "głosy znajdują się w oryginale.",
    smallSample:
      "Bardzo mała próba. Pojedyncze głosy mają tu dużą wagę — uogólnianie nie byłoby " +
      "uzasadnione.",
    realityCheck: "Co obiecuje ogłoszenie — i co relacjonują inni",
    staleWarning: "To ogłoszenie może już nie być aktualne.",
    repostWarning:
      "Wcześniej istniało identyczne ogłoszenie. Może to oznaczać zatrudnienie na zastępstwo " +
      "albo po prostu ponowną publikację.",
  },

  applications: {
    title: "Twoje aplikacje",
    viewKanban: "Tablica",
    viewList: "Lista",
    viewCalendar: "Terminy",
    stageSaved: "Zapisana",
    stagePreparing: "W przygotowaniu",
    stageSent: "Wysłana",
    stageAcknowledged: "Potwierdzono odbiór",
    stageInterview: "Rozmowa",
    stageOffer: "Oferta",
    stageRejected: "Odrzucona",
    stageWithdrawn: "Wycofana",
    stageAccepted: "Przyjęta",
    lastContact: "Ostatni kontakt",
    nextStep: "Następny krok",
    noNextStep: "Nie ustalono następnego kroku",
    documents: "Dokumenty",
    notes: "Notatki",
    funnelTitle: "Co pokazują twoje liczby",
    funnelTooFew:
      "Aplikacji jest jeszcze za mało, by postawić diagnozę. Od mniej więcej dziesięciu " +
      "wysłanych aplikacji widać wzorzec — wcześniej każde stwierdzenie byłoby zgadywaniem.",
    empty: "Jeszcze żadnych aplikacji. Zaczynają się od zapisanych ofert.",
  },

  studio: {
    title: "Przygotuj aplikację",
    requirements: "Czego wymaga stanowisko",
    yourEvidence: "Twoje udokumentowane doświadczenie",
    document: "Dokument",
    checks: "Sprawdzenia {assistant}",
    openPoints: "Punkty otwarte",
    generateCv: "Utwórz CV",
    generateCvAts: "Wersja przyjazna systemom rekrutacyjnym",
    generateCoverLetter: "Utwórz list motywacyjny",
    generateEmail: "Krótki e-mail aplikacyjny",
    coverLetterNotNeeded:
      "To stanowisko nie wymaga listu motywacyjnego. Prawdopodobnie wystarczy krótki e-mail.",
    claimSupported: "udokumentowane",
    claimUnsupported: "nieudokumentowane",
    claimNeedsConfirmation: "wymaga potwierdzenia",
    unsupportedBlocked:
      "Dopóki stwierdzenie nie ma podstawy, dokumentu nie można zatwierdzić. Dodaj podstawę " +
      "albo złagodź stwierdzenie.",
    acceptChange: "Przyjmij",
    rejectChange: "Odrzuć",
    showDiff: "Zobacz zmianę",
    reason: "Powód",
    preview: "Podgląd przed wysłaniem",
    recipient: "Odbiorca",
    subject: "Temat",
    attachments: "Załączniki",
    confirmSend: "Wszystko sprawdziłem i chcę wysłać tę aplikację",
    send: "Wyślij teraz",
    exportDraft: "Pobierz jako wersję roboczą",
    draftOnlySendNotice:
      "Nie podłączono konta e-mail. Nic nie zostanie wysłane — otrzymujesz wersję roboczą do " +
      "pobrania.",
    portalGuide: "Przeprowadź mnie przez portal",
  },

  coaching: {
    title: "Przygotowanie do rozmowy",
    modePractice: "Ćwiczenie",
    modeSimulation: "Realistyczna symulacja",
    modeCase: "Studium przypadku",
    startSession: "Zacznij",
    repeatAnswer: "Powtórz odpowiedź",
    feedbackRelevance: "Trafność wobec pytania",
    feedbackStructure: "Struktura",
    feedbackEvidence: "Konkretne przykłady",
    feedbackClarity: "Jasność",
    feedbackMissing: "Czego jeszcze brakuje",
    starStories: "Twoje przykłady z profilu",
    questionsForCompany: "Pytania do firmy",
    noBehaviourScoring:
      "Oceniana jest wyłącznie treść i struktura twojej odpowiedzi. Nie głos, nie twarz, nie " +
      "akcent, nie sposób bycia.",
  },

  settings: {
    title: "Ustawienia",
    language: "Język",
    region: "Kraj i region",
    theme: "Wygląd",
    themeLight: "Jasny",
    themeDark: "Ciemny",
    themeSystem: "Systemowy",
    notifications: "Powiadomienia",
    integrations: "Połączone usługi",
    microphone: "Mikrofon i transkrypcje",
    privacyCenter: "Centrum prywatności",
    memory: "Co {assistant} o tobie wie",
    memoryBody: "Każdy wpis można obejrzeć, zmienić i usunąć osobno.",
    consents: "Twoje zgody",
    exportData: "Eksportuj dane",
    exportBody: "Otrzymujesz całość jako plik JSON.",
    deleteAccount: "Usuń konto",
    deleteAccountBody: "Usuwa wszystkie twoje dane. Tego nie da się cofnąć.",
    sessions: "Zalogowane urządzenia",
    revokeSession: "Wyloguj",
    currentSession: "To urządzenie",
    aiProvider: "Przetwarzanie przez AI",
    aiProviderNone:
      "W tej chwili nie skonfigurowano żadnego dostawcy AI. Żaden tekst nie jest przesyłany — " +
      "i {assistant} też nie odpowiada.",
    aiProviderExternal:
      "Przetwarzanie przez dostawcę zewnętrznego. Cel, region i dostawca są podane poniżej.",
  },

  states: {
    loading: "Wczytywanie",
    errorTitle: "To się nie udało",
    errorBody: "Spróbuj ponownie. Jeśli powtarza się to dalej, to nie twoja wina.",
    offlineTitle: "Brak połączenia",
    offlineBody: "Twoje wersje robocze są bezpieczne. Wracamy, gdy tylko znów będziesz online.",
    permissionDenied: "Nie masz do tego uprawnień.",
    insufficientData: "Jest na to za mało danych.",
    notConnectedTitle: "Brak połączenia",
    notConnectedBody: "Ta usługa nie jest skonfigurowana, więc funkcja jest nieaktywna.",
    emptyTitle: "Tu jeszcze nic nie ma",
  },

  nina: {
    askBar: "Zapytaj {assistant}",
    suggestionProfileGap:
      "W twoim profilu jest jeszcze ważna luka. Dodamy konkretny projekt?",
    suggestionNoSalary:
      "To stanowisko pasuje merytorycznie, ale nie podano wynagrodzenia. Przygotować ci kilka " +
      "pytań?",
    suggestionReviewsFirst:
      "Wolisz najpierw otworzyć opinie pracowników, czy porównać wymagania ze swoim profilem?",
    suggestionUnsupportedClaim:
      "To stwierdzenie w twoim liście nie ma jeszcze podstawy. Złagodzimy je czy dodamy " +
      "przykład?",
    suggestionInterviewSoon:
      "Twoja rozmowa jest za trzy dni. Zasymulujemy najbardziej prawdopodobne pytania?",
    suggestionFunnelPattern:
      "Twoje ostatnie osiem aplikacji łączyło jedno wymaganie konieczne, które nie jest " +
      "udokumentowane w twoim profilu. Skorygujemy wyszukiwanie?",
  },
};
