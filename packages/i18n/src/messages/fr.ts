import type { Messages } from "./de.ts";

/**
 * Textes français.
 *
 * Typés d'après le fichier allemand : une clé manquante devient une
 * erreur de compilation, pas un blanc dans l'interface.
 *
 * ── À relire par une personne de langue maternelle ──────────────
 *
 * Deux passages en particulier. La section `consent` porte des
 * formulations juridiques : un consentement mal traduit ne fait pas
 * qu'irriter, il ne vaut rien. Et la section `studio` distingue
 * « evidenced » de « not evidenced » — cette distinction porte toute
 * la promesse du produit et doit rester nette en français.
 */
export const fr: Messages = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
    example: "Exemple",
    save: "Enregistrer",
    cancel: "Annuler",
    confirm: "Confirmer",
    edit: "Modifier",
    delete: "Supprimer",
    reject: "Refuser",
    back: "Retour",
    next: "Suivant",
    skip: "Passer",
    close: "Fermer",
    loading: "Chargement",
    retry: "Réessayer",
    showMore: "Afficher plus",
    showLess: "Afficher moins",
    notSpecified: "non précisé",
    unknown: "inconnu",
    notConnected: "non connecté",
    openOriginal: "Ouvrir l'annonce d'origine",
    dismiss: "Ne plus afficher",
  },

  nav: {
    home: "Accueil",
    assistant: "{assistant}",
    jobs: "Offres",
    applications: "Candidatures",
    profile: "Profil",
    coaching: "Préparation",
    offers: "Propositions",
    checkIns: "Points d'étape",
    settings: "Paramètres",
    logout: "Se déconnecter",
    howItWorks: "Comment ça marche",
    methodology: "Méthode",
    security: "Sécurité",
    privacy: "Confidentialité",
    imprint: "Mentions légales",
    matches: "Correspondances",
    careerProfile: "Profil professionnel",
    growth: "Carrière",
    notifications: "Notifications",
    search: "Rechercher",
    languageRegion: "Langue et région",
    appearance: "Apparence",
    privacyData: "Confidentialité et données",
    help: "Aide",
    discover: "Découvrir",
    career: "Carrière",
    expand: "Déplier",
    collapse: "Replier",
    skipToContent: "Aller au contenu",
    backToApp: "Retour à {assistant}",
  },

  landing: {
    eyebrow: "Votre accompagnement de carrière par IA",
    headline: "Trouvez un poste qui vous correspond vraiment.",
    headlineLine1: "Trouvez un poste",
    headlineLine2: "qui vous correspond vraiment.",
    subheadline:
      "{assistant} comprend votre expérience, trouve des postes récents issus de sources " +
      "vérifiées et vous accompagne de l'orientation à la candidature.",
    ctaPrimary: "Commencer gratuitement avec {assistant}",
    ctaSecondary: "Comment ça marche",

    coreLine1: "Nous ne vous montrons pas plus d'offres.",
    coreLine2: "Nous vous montrons les bonnes.",
    coreSub: "Pas 10 000 résultats. Les quelques occasions qui comptent vraiment.",

    learnsEyebrow: "Ce que {assistant} apprend de vous",
    learnsTitle: "Comprendre d'abord, chercher ensuite.",
    learnsBody:
      "Des situations concrètes plutôt qu'une description de soi. Ce que vous avez fait, ce " +
      "qui en est sorti, ce à quoi on le reconnaîtrait. Voilà sur quoi un profil peut reposer.",
    rolesEyebrow: "Directions",
    rolesTitle: "Des métiers qui vous vont — et d'autres auxquels vous n'auriez pas pensé.",
    rolesBody:
      "Voisins, adjacents, inattendus. Pour chacun : sur quoi il repose, ce qui changerait, " +
      "ce qui manque — et comment le tester à petite échelle.",
    jobsEyebrow: "Postes actuels",
    jobsTitle: "Chaque recommandation avec sa raison, sa source et ce qui reste ouvert.",
    jobsBody:
      "De vraies annonces issues de sources ouvertement proposées, liées à l'original, avec " +
      "la date de la dernière vérification. Le salaire seulement s'il y figure.",
    applyEyebrow: "Candidature",
    applyTitle: "Quand un poste convient, {assistant} vous prépare.",
    applyBody:
      "Des documents ajustés au poste — la langue et l'ordre des priorités, pas la vérité. " +
      "Rien n'est envoyé sans votre accord explicite.",
    pathEyebrow: "Le parcours",
    pathTitle: "De ce que vous savez faire à ce que vous obtenez.",
    pathBody:
      "Chaque étape repose sur la précédente. Ce qui n'est pas étayé n'est pas affirmé — ni " +
      "dans une recommandation, ni dans une candidature.",

    step1: "Votre expérience",
    step1Detail: "Ce que vous avez réellement fait — pas ce que dit le CV.",
    step2: "{assistant} vous comprend",
    step2Detail: "Une conversation sur des situations, pas sur des mots-clés.",
    step3: "Compétences et façon de travailler",
    step3Detail: "Étayées, avec leur origine. Rien d'inventé.",
    step4: "Des métiers réalistes",
    step4Detail: "Trois à cinq directions, chacune avec sa raison.",
    step5: "Postes récents",
    step5Detail: "De sources vérifiées, avec le lien d'origine et l'heure du contrôle.",
    step6: "Adéquation et réalité",
    step6Detail: "Ce qui convient, ce qui ne convient pas, ce qui reste ouvert.",
    step7: "Candidature",
    step7Detail: "Uniquement des affirmations que vous pouvez étayer.",

    diffUnderstand: "Comprendre",
    diffUnderstandBody: "{assistant} ne part pas d'un intitulé de poste. Elle part de vous.",
    diffCheck: "Vérifier",
    diffCheckBody:
      "Chaque poste est examiné : adéquation, fraîcheur, conditions et questions ouvertes.",
    diffAct: "Agir",
    diffActBody:
      "{assistant} prépare l'étape suivante qui a du sens — de la candidature à l'entretien.",

    closingTitle: "Commencez par une conversation.",
    closingBody:
      "Pas d'inscription pour un premier aperçu, pas d'e-mail publicitaire, aucun partage de " +
      "votre profil. Chaque détail reste entre vos mains.",

    navProduct: "Produit",
    navHow: "Comment ça marche",
    navSecurity: "Sécurité",
    navSignIn: "Se connecter",
    footerPrivacy: "Confidentialité",
    footerSecurity: "Sécurité",
    footerMethodology: "Méthodologie",
    footerImprint: "Mentions légales",
    footerTerms: "Conditions",
  },

  auth: {
    loginTitle: "Se connecter",
    registerTitle: "Créer un compte",
    email: "Adresse e-mail",
    password: "Mot de passe",
    passwordHint: "Au moins douze caractères. La longueur compte plus que les caractères spéciaux.",
    login: "Se connecter",
    register: "Créer un compte",
    magicLink: "M'envoyer un lien",
    magicLinkSent: "Si un compte existe pour cette adresse, un lien est en route.",
    forgotPassword: "Mot de passe oublié ?",
    noAccount: "Pas encore de compte ?",
    hasAccount: "Vous avez déjà un compte ?",
    errorInvalid: "Cette adresse e-mail ou ce mot de passe ne convient pas.",
    errorEmailTaken: "Un compte existe déjà pour cette adresse.",
    errorPasswordShort: "Ce mot de passe est trop court. Il lui faut au moins huit caractères.",
    errorEmailInvalid: "Cette adresse e-mail semble incomplète.",
  },

  consent: {
    title: "Avant de commencer",
    intro:
      "Trois choses à décider. Vous pourrez les modifier à tout moment dans le centre de " +
      "confidentialité.",
    language: "Langue",
    country: "Pays",
    location: "Votre localisation",
    workModel: "Mode de travail",
    careerProfile: "Constituer un profil professionnel",
    careerProfileBody:
      "Vos réponses sont conservées afin qu'un profil puisse en être tiré. Rien d'autre ne " +
      "fonctionne sans cela.",
    documentAnalysis: "Analyser les documents",
    documentAnalysisBody:
      "Si vous déposez un CV, son texte est analysé pour préremplir votre profil. Facultatif.",
    voiceInput: "Saisie vocale",
    voiceInputBody:
      "Vous pouvez parler à {assistant} plutôt qu'écrire. Vous décidez séparément si la " +
      "transcription est conservée.",
    transcriptStorage: "Conserver la transcription",
    transcriptStorageBody:
      "Sans ce consentement, le texte dicté est traité mais jamais conservé.",
    externalAi: "Traitement par un prestataire externe",
    externalAiBodyActive:
      "Votre texte est transmis à un prestataire d'IA externe pour analyse. Les identifiants " +
      "directs comme l'adresse e-mail et le numéro de téléphone sont retirés au préalable.",
    externalAiBodyInactive:
      "Aucun prestataire d'IA n'est configuré pour le moment. {assistant} ne répondra pas — nous " +
      "ne produisons délibérément aucune réponse d'exemple, car elle serait indiscernable " +
      "d'une vraie.",
    privacyCenter: "Aller au centre de confidentialité",
    start: "Commencer la conversation",
  },

  interview: {
    title: "Conversation avec {assistant}",
    intro:
      "Avant de vous montrer des offres, je veux comprendre ce que vous savez vraiment faire, " +
      "ce qui vous donne de l'énergie et quelles conditions vous sont nécessaires. Vous pouvez " +
      "corriger ou passer n'importe quoi à tout moment.",
    progress: "{done} sujets sur {total} compris",
    yourAnswer: "Comment puis-je t'aider pour la suite ?",
    send: "Envoyer",
    voiceMode: "Parler",
    textMode: "Écrire",
    voiceUnavailable:
      "Le mode vocal n'est pas disponible : aucun prestataire de reconnaissance vocale n'est " +
      "connecté. L'écriture fonctionne entièrement.",
    listening: "Je vous écoute",
    paused: "En pause",
    pause: "Mettre en pause",
    resume: "Reprendre",
    interrupt: "Interrompre",
    liveTranscript: "Transcription en direct",
    whyThisQuestion: "Pourquoi cette question ?",
    recognisedSoFar: "Ce que j'ai compris jusqu'ici",
    openHypotheses: "Déductions encore ouvertes",
    skipQuestion: "Passer cette question",
    pauseSession: "Interrompre la conversation",
    resumeLater: "Vous pourrez reprendre exactement ici plus tard.",
    thinking: "{assistant} écrit",
  },

  profile: {
    title: "Votre profil professionnel",
    compass: "Votre boussole professionnelle",
    confirmedStrengths: "Forces étayées",
    energising: "Le travail qui vous donne de l'énergie",
    draining: "Vous le faites bien, mais cela vous coûte",
    interests: "Intérêts et objectifs d'apprentissage",
    values: "Valeurs et arbitrages",
    workStyle: "Façon de travailler préférée",
    hardNoGos: "Limites fermes",
    roleClusters: "Directions qui conviennent",
    surprising: "Moins évident",
    gaps: "Lacunes et déductions ouvertes",
    coverage: "Couverture des données",
    coverageBody:
      "Quelle part de votre profil est étayée. Ce qui manque abaisse la confiance des " +
      "recommandations, pas leur qualité.",
    showEvidence: "Afficher les éléments",
    addEvidence: "Ajouter un élément",
    changeWeight: "Modifier la pondération",
    confirmAll: "Confirmer le profil",
    confirmAllBody:
      "Ensuite je débloque des suggestions d'offres personnalisées. Vous pourrez continuer à " +
      "tout modifier.",
    confirmed: "confirmé",
    hypothesis: "déduction",
    fromDocument: "d'après vos documents",
    rejected: "refusé",
    empty: "Rien ici pour l'instant. La conversation avec {assistant} le remplit.",
  },

  jobs: {
    title: "La sélection de {assistant} pour vous",
    titleGeneric: "Sélection pour vous",
    locked: "Pas encore débloqué",
    lockedBody:
      "Les suggestions personnalisées n'apparaissent qu'une fois votre profil constitué. " +
      "Sinon, ce seraient des devinettes.",
    lockedCta: "Poursuivre la conversation",
    sortBy: "Trier par",
    sortBestOverall: "Meilleur ensemble",
    sortHighestFit: "Meilleure adéquation",
    sortBestQuality: "Meilleure qualité de poste",
    sortHighestSalary: "Salaire le plus élevé",
    sortFutureRobust: "Robuste dans la durée",
    sortShortestCommute: "Trajet le plus court",
    sortNewest: "Annonces les plus récentes",
    filters: "Filtres",
    showBlocked: "Afficher les offres exclues",
    blockedBecause: "Exclue en raison de",
    fit: "Adéquation",
    fitHigh: "forte adéquation",
    fitMedium: "adéquation moyenne",
    fitExploratory: "exploratoire",
    fitInsufficient: "adéquation encore ouverte",
    confidence: "Confiance",
    confidenceHigh: "élevée",
    confidenceMedium: "moyenne",
    confidenceLow: "faible",
    jobQuality: "Qualité du poste",
    aiTransition: "Ce que l'IA pourrait y changer",
    listingConfidence: "Confiance dans l'annonce",
    published: "Publiée",
    daysAgo: "il y a {n} jours",
    mainReason: "Pourquoi cela vous convient",
    mainReservation: "Ce à quoi faire attention",
    view: "Voir",
    save: "Enregistrer",
    saved: "Enregistrée",
    discuss: "En parler avec {assistant}",
    empty: "Rien ne correspond à ces filtres pour l'instant. Élargissez un peu la recherche.",
    emptyAll: "Aucune offre n'a encore été chargée.",
  },

  jobDetail: {
    whyShown: "Pourquoi {assistant} vous montre cette offre",
    tabOverview: "Aperçu",
    tabMatch: "Votre correspondance",
    tabQuality: "Qualité du poste",
    tabFuture: "Avenir et IA",
    tabCompany: "Entreprise et retours",
    tabSource: "Annonce d'origine et sources",
    coreTasks: "Ce que vous feriez réellement",
    mustHave: "Exigences indispensables",
    niceToHave: "Exigences souhaitées",
    covered: "couvert par votre expérience",
    notCovered: "pas encore étayé",
    transferable: "transférable depuis",
    learningCurve: "Courbe d'apprentissage probable",
    commute: "Trajet",
    questionsToAsk: "Questions à poser en entretien",
    prepareApplication: "Préparer la candidature",
    whyNotHigher: "Pourquoi la correspondance n'est-elle pas plus élevée ?",
    closeGap: "Quelle lacune pourrais-je combler rapidement ?",
    tasksChanging: "Quelles tâches l'IA pourrait-elle changer ?",
    compare: "Comparer avec une autre offre",
    retrievedAt: "Récupérée le",
    sourceKind: "Type de source",
    sampleSize: "Taille de l'échantillon",
    period: "Période",
    aiSummary: "Résumé par IA",
    aiSummaryNote:
      "Ce résumé provient d'un modèle de langue, pas de la source elle-même. Les avis " +
      "individuels figurent dans l'original.",
    smallSample:
      "Échantillon très réduit. Les avis isolés y pèsent lourd — généraliser ne serait pas " +
      "solide.",
    realityCheck: "Ce que l'annonce promet — et ce que d'autres rapportent",
    staleWarning: "Cette annonce n'est peut-être plus à jour.",
    repostWarning:
      "Une annonce identique existait auparavant. Cela peut signifier un remplacement, ou " +
      "simplement une republication.",
  },

  applications: {
    title: "Vos candidatures",
    viewKanban: "Tableau",
    viewList: "Liste",
    viewCalendar: "Échéances",
    stageSaved: "Enregistrée",
    stagePreparing: "En préparation",
    stageSent: "Envoyée",
    stageAcknowledged: "Accusé de réception",
    stageInterview: "Entretien",
    stageOffer: "Proposition",
    stageRejected: "Refusée",
    stageWithdrawn: "Retirée",
    stageAccepted: "Acceptée",
    lastContact: "Dernier contact",
    nextStep: "Prochaine étape",
    noNextStep: "Aucune étape définie",
    documents: "Documents",
    notes: "Notes",
    funnelTitle: "Ce que montrent vos chiffres",
    funnelTooFew:
      "Il y a encore trop peu de candidatures pour en tirer un diagnostic. À partir d'une " +
      "dizaine de candidatures envoyées, une tendance devient lisible — avant cela, toute " +
      "affirmation serait une devinette.",
    empty: "Aucune candidature pour l'instant. Elles partent des offres enregistrées.",
  },

  studio: {
    title: "Préparer la candidature",
    requirements: "Ce que le poste exige",
    yourEvidence: "Votre expérience étayée",
    document: "Document",
    checks: "Les vérifications de {assistant}",
    openPoints: "Points ouverts",
    generateCv: "Créer un CV",
    generateCvAts: "Version adaptée aux logiciels de tri",
    generateCoverLetter: "Créer une lettre de motivation",
    generateEmail: "Court e-mail de candidature",
    coverLetterNotNeeded:
      "Ce poste ne demande pas de lettre de motivation. Un court e-mail suffira probablement.",
    claimSupported: "étayé",
    claimUnsupported: "non étayé",
    claimNeedsConfirmation: "à confirmer",
    unsupportedBlocked:
      "Tant qu'une affirmation n'est pas étayée, le document ne peut pas être validé. Ajoutez " +
      "un élément ou atténuez l'affirmation.",
    acceptChange: "Accepter",
    rejectChange: "Écarter",
    showDiff: "Voir la modification",
    reason: "Raison",
    preview: "Aperçu avant envoi",
    recipient: "Destinataire",
    subject: "Objet",
    attachments: "Pièces jointes",
    confirmSend: "J'ai tout vérifié et je veux envoyer cette candidature",
    send: "Envoyer maintenant",
    exportDraft: "Télécharger comme brouillon",
    draftOnlySendNotice:
      "Aucun compte e-mail n'est connecté. Rien ne sera envoyé — vous recevez un brouillon à " +
      "télécharger.",
    portalGuide: "Guidez-moi dans le portail",
  },

  coaching: {
    title: "Préparation à l'entretien",
    modePractice: "Entraînement",
    modeSimulation: "Simulation réaliste",
    modeCase: "Étude de cas",
    startSession: "Commencer",
    repeatAnswer: "Refaire la réponse",
    feedbackRelevance: "Pertinence par rapport à la question",
    feedbackStructure: "Structure",
    feedbackEvidence: "Éléments concrets",
    feedbackClarity: "Clarté",
    feedbackMissing: "Ce qui manque encore",
    starStories: "Vos exemples issus du profil",
    questionsForCompany: "Questions pour l'entreprise",
    noBehaviourScoring:
      "Seuls le contenu et la structure de votre réponse sont évalués. Ni votre voix, ni votre " +
      "visage, ni votre accent, ni votre présence.",
  },

  settings: {
    title: "Paramètres",
    language: "Langue",
    region: "Pays et région",
    theme: "Apparence",
    themeLight: "Clair",
    themeDark: "Sombre",
    themeSystem: "Système",
    notifications: "Notifications",
    integrations: "Services connectés",
    microphone: "Micro et transcriptions",
    privacyCenter: "Centre de confidentialité",
    memory: "Ce que {assistant} sait de vous",
    memoryBody: "Chaque entrée peut être consultée, modifiée et supprimée individuellement.",
    consents: "Vos consentements",
    exportData: "Exporter les données",
    exportBody: "Vous recevez l'ensemble sous forme de fichier JSON.",
    deleteAccount: "Supprimer le compte",
    deleteAccountBody: "Supprime toutes vos données. C'est irréversible.",
    sessions: "Appareils connectés",
    revokeSession: "Déconnecter",
    currentSession: "Cet appareil",
    aiProvider: "Traitement par IA",
    aiProviderNone:
      "Aucun prestataire d'IA n'est configuré pour le moment. Aucun texte n'est transmis — et " +
      "{assistant} ne répond pas non plus.",
    aiProviderExternal:
      "Traitement par un prestataire externe. La finalité, la région et le prestataire sont " +
      "indiqués ci-dessous.",
  },

  states: {
    loading: "Chargement",
    errorTitle: "Cela n'a pas fonctionné",
    errorBody: "Réessayez. Si cela se reproduit, ce n'est pas de votre faute.",
    offlineTitle: "Pas de connexion",
    offlineBody: "Vos brouillons sont en sécurité. Nous reprenons dès votre retour en ligne.",
    permissionDenied: "Vous n'avez pas l'autorisation pour cela.",
    insufficientData: "Il y a trop peu de données pour cela.",
    notConnectedTitle: "Non connecté",
    notConnectedBody: "Ce service n'est pas configuré, la fonction est donc inactive.",
    emptyTitle: "Rien ici pour l'instant",
  },

  nina: {
    askBar: "Demander à {assistant}",
    suggestionProfileGap:
      "Votre profil comporte encore une lacune importante. Ajoutons-nous un projet concret ?",
    suggestionNoSalary:
      "Ce poste vous convient sur le fond, mais aucun salaire n'est indiqué. Voulez-vous que " +
      "je prépare quelques questions ?",
    suggestionReviewsFirst:
      "Préférez-vous ouvrir d'abord les avis des salariés, ou comparer les exigences avec " +
      "votre profil ?",
    suggestionUnsupportedClaim:
      "Cette affirmation de votre lettre n'est pas encore étayée. L'atténuons-nous ou " +
      "ajoutons-nous un exemple ?",
    suggestionInterviewSoon:
      "Votre entretien a lieu dans trois jours. Simulons-nous les questions les plus probables ?",
    suggestionFunnelPattern:
      "Vos huit dernières candidatures partageaient un critère indispensable qui n'est pas " +
      "étayé dans votre profil. Corrigeons-nous la recherche ?",
  },
};
