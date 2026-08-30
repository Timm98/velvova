import type { Messages } from "./de.ts";

/**
 * English texts. Typed against the German file, so a missing key is a
 * compile error rather than a blank spot in the interface.
 */

export const en: Messages = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
    example: "Example",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    edit: "Edit",
    delete: "Delete",
    reject: "Reject",
    back: "Back",
    next: "Next",
    skip: "Skip",
    close: "Close",
    loading: "Loading",
    retry: "Try again",
    showMore: "Show more",
    showLess: "Show less",
    notSpecified: "not specified",
    unknown: "unknown",
    notConnected: "not connected",
    openOriginal: "Open the original",
    dismiss: "Don't show again",
  },

  nav: {
    home: "Home",
    assistant: "{assistant}",
    jobs: "Jobs",
    applications: "Applications",
    profile: "Profile",
    coaching: "Coaching",
    offers: "Offers",
    checkIns: "Check-ins",
    settings: "Settings",
    logout: "Sign out",
    howItWorks: "How it works",
    methodology: "Method",
    security: "Security",
    privacy: "Privacy",
    imprint: "Legal notice",
    matches: "Matches",
    careerProfile: "Career profile",
    growth: "Career",
    notifications: "Notifications",
    search: "Search",
    languageRegion: "Language & region",
    appearance: "Appearance",
    privacyData: "Privacy & data",
    help: "Help",
    discover: "Discover",
    career: "Career",
    expand: "Expand",
    collapse: "Collapse",
    skipToContent: "Skip to content",
  },

  landing: {
    eyebrow: "Your personal AI career companion",
    headline: "Find a job that genuinely fits you.",
    headlineLine1: "Find a job",
    headlineLine2: "that genuinely fits you.",
    subheadline:
      "{assistant} understands your experience, finds fresh roles from verified sources and " +
      "stays with you from orientation to application.",
    ctaPrimary: "Start free with {assistant}",
    ctaSecondary: "How {assistant} works",

    coreLine1: "We do not show you more jobs.",
    coreLine2: "We show you the right ones.",
    coreSub: "Not 10,000 results. The few chances that actually matter.",

    learnsEyebrow: "What {assistant} learns about you",
    learnsTitle: "Understand first, then search.",
    learnsBody:
      "Concrete situations instead of self-description. What you did, what came of it, " +
      "how someone would recognise it. That is what a profile can rest on.",
    rolesEyebrow: "Directions",
    rolesTitle: "Fitting and unexpected roles.",
    rolesBody:
      "Adjacent, neighbouring, unusual. For each: what it rests on, what would differ, " +
      "what is missing — and how to test it small.",
    jobsEyebrow: "Current roles",
    jobsTitle: "Every recommendation with reasoning, source and open uncertainty.",
    jobsBody:
      "Real listings from openly offered sources, linked to the original, with the time " +
      "of the last check. Salary only when it is stated there.",
    applyEyebrow: "Application",
    applyTitle: "When a job fits, {assistant} gets you ready.",
    applyBody:
      "Documents tailored to the role — language and priority, not the truth. Nothing is " +
      "sent without your explicit approval.",
    pathEyebrow: "The path",
    pathTitle: "From what you can do to what you get.",
    pathBody:
      "Every step rests on the one before. What is not evidenced is not claimed — neither in a " +
      "recommendation nor in an application.",

    step1: "Your experience",
    step1Detail: "What you actually did — not what the CV says.",
    step2: "{assistant} understands you",
    step2Detail: "A conversation about situations, not about buzzwords.",
    step3: "Skills and working style",
    step3Detail: "Evidenced, with provenance. Nothing invented.",
    step4: "Realistic roles",
    step4Detail: "Three to five directions, each with a reason.",
    step5: "Fresh roles",
    step5Detail: "From verified sources, with original link and check time.",
    step6: "Fit and reality",
    step6Detail: "What fits, what does not, what is still open.",
    step7: "Application",
    step7Detail: "Only statements you can back up.",

    diffUnderstand: "Understand",
    diffUnderstandBody: "{assistant} does not start with a job title. She starts with you.",
    diffCheck: "Verify",
    diffCheckBody: "Every role is checked for fit, freshness, conditions and open questions.",
    diffAct: "Act",
    diffActBody:
      "{assistant} prepares the next sensible step – from the application to the interview.",

    closingTitle: "Start with a conversation.",
    closingBody:
      "No sign-up required for a first look, no marketing email, no sharing of your profile. " +
      "Every detail stays in your hands.",

    navProduct: "Product",
    navHow: "How it works",
    navSecurity: "Security",
    navSignIn: "Sign in",
    footerPrivacy: "Privacy",
    footerSecurity: "Security",
    footerMethodology: "Methodology",
    footerImprint: "Imprint",
    footerTerms: "Terms",
  },

  auth: {
    loginTitle: "Sign in",
    registerTitle: "Create account",
    email: "Email address",
    password: "Password",
    passwordHint: "At least twelve characters. Length matters more than special characters.",
    login: "Sign in",
    register: "Create account",
    magicLink: "Send me a link",
    magicLinkSent: "If an account exists for this address, a link is on its way.",
    forgotPassword: "Forgotten your password?",
    noAccount: "No account yet?",
    hasAccount: "Already have an account?",
    errorInvalid: "That email address or password is not right.",
    errorEmailTaken: "An account already exists for this address.",
    errorPasswordShort: "That password is too short. It needs at least twelve characters.",
    errorEmailInvalid: "That email address does not look complete.",
  },

  consent: {
    title: "Before we start",
    intro: "Three things for you to decide. You can change any of them later in the Privacy Center.",
    language: "Language",
    country: "Country",
    location: "Your location",
    workModel: "Work model",
    careerProfile: "Build a career profile",
    careerProfileBody:
      "Your answers are stored so a profile can be built from them. Nothing else works without this.",
    documentAnalysis: "Analyse documents",
    documentAnalysisBody:
      "If you upload a CV, its text is analysed to pre-fill your profile. Optional.",
    voiceInput: "Voice input",
    voiceInputBody:
      "You can speak to {assistant} instead of typing. Separately, you decide whether the " +
      "transcript is stored.",
    transcriptStorage: "Store transcript",
    transcriptStorageBody:
      "Without this consent, spoken text is processed but never kept.",
    externalAi: "Processing by an external provider",
    externalAiBodyActive:
      "Your text is sent to an external AI provider for analysis. Direct identifiers such as " +
      "email address and phone number are removed first.",
    externalAiBodyInactive:
      "No AI provider is configured at the moment. Nina will not answer — we deliberately " +
      "produce no sample answer, because it would be indistinguishable from a real one.",
    privacyCenter: "Go to the Privacy Center",
    start: "Start the conversation",
  },

  interview: {
    title: "Conversation with {assistant}",
    intro:
      "Before I show you any jobs, I want to understand what you can really do, what gives you " +
      "energy and what conditions you need. You can correct or skip anything at any time.",
    progress: "{done} of {total} topics understood",
    yourAnswer: "Your answer",
    send: "Send",
    voiceMode: "Speak",
    textMode: "Type",
    voiceUnavailable:
      "Voice mode is unavailable because no speech provider is connected. Typing works fully.",
    listening: "I'm listening",
    paused: "Paused",
    pause: "Pause",
    resume: "Resume",
    interrupt: "Interrupt",
    liveTranscript: "Live transcript",
    whyThisQuestion: "Why this question?",
    recognisedSoFar: "What I have understood so far",
    openHypotheses: "Still open inferences",
    skipQuestion: "Skip this question",
    pauseSession: "Pause the conversation",
    resumeLater: "You can pick up exactly here later.",
    thinking: "{assistant} is writing",
  },

  profile: {
    title: "Your career profile",
    compass: "Your career compass",
    confirmedStrengths: "Evidenced strengths",
    energising: "Work that gives you energy",
    draining: "You do it well, but it costs energy",
    interests: "Interests and learning goals",
    values: "Values and trade-offs",
    workStyle: "Preferred way of working",
    hardNoGos: "Hard limits",
    roleClusters: "Directions that fit",
    surprising: "Less obvious",
    gaps: "Gaps and open inferences",
    coverage: "Data coverage",
    coverageBody:
      "How much of your profile is evidenced. What is missing lowers the confidence of the " +
      "recommendations, not their quality.",
    showEvidence: "Show evidence",
    addEvidence: "Add evidence",
    changeWeight: "Change weighting",
    confirmAll: "Confirm profile",
    confirmAllBody:
      "After that I unlock personalised job suggestions. You can keep changing everything.",
    confirmed: "confirmed",
    hypothesis: "inference",
    fromDocument: "from your documents",
    rejected: "rejected",
    empty: "Nothing here yet. The conversation with {assistant} fills this in.",
  },

  jobs: {
    title: "{assistant}'s selection for you",
    titleGeneric: "Selection for you",
    locked: "Not unlocked yet",
    lockedBody:
      "Personalised suggestions only appear once your profile stands. Otherwise they would be " +
      "guesses.",
    lockedCta: "Continue the conversation",
    sortBy: "Sort by",
    sortBestOverall: "Best overall",
    sortHighestFit: "Highest fit",
    sortBestQuality: "Best job quality",
    sortHighestSalary: "Highest salary",
    sortFutureRobust: "Future-robust",
    sortShortestCommute: "Shortest commute",
    sortNewest: "Newest listings",
    filters: "Filters",
    showBlocked: "Show excluded jobs",
    blockedBecause: "Excluded because of",
    fit: "Fit",
    fitHigh: "strong fit",
    fitMedium: "moderate fit",
    fitExploratory: "exploratory",
    fitInsufficient: "not enough data",
    confidence: "Confidence",
    confidenceHigh: "high",
    confidenceMedium: "medium",
    confidenceLow: "low",
    jobQuality: "Job quality",
    aiTransition: "How AI may change it",
    listingConfidence: "Trust in the listing",
    published: "Published",
    daysAgo: "{n} days ago",
    mainReason: "Why it fits",
    mainReservation: "What to consider",
    view: "View",
    save: "Save",
    saved: "Saved",
    discuss: "Discuss with {assistant}",
    empty: "Nothing matches these filters right now. Widen the search a little.",
    emptyAll: "No jobs have been loaded yet.",
  },

  jobDetail: {
    whyShown: "Why {assistant} is showing you this",
    tabOverview: "Overview",
    tabMatch: "Your match",
    tabQuality: "Job quality",
    tabFuture: "Future & AI",
    tabCompany: "Company & experiences",
    tabSource: "Original listing & sources",
    coreTasks: "What you would actually do",
    mustHave: "Must-have requirements",
    niceToHave: "Nice-to-have requirements",
    covered: "covered by your experience",
    notCovered: "not evidenced yet",
    transferable: "transferable from",
    learningCurve: "Likely learning curve",
    commute: "Commute",
    questionsToAsk: "Questions worth asking in the interview",
    prepareApplication: "Prepare application",
    whyNotHigher: "Why isn't the match higher?",
    closeGap: "Which gap could I close quickly?",
    tasksChanging: "Which tasks might AI change?",
    compare: "Compare with another job",
    retrievedAt: "Retrieved on",
    sourceKind: "Type of source",
    sampleSize: "Sample size",
    period: "Period",
    aiSummary: "AI summary",
    aiSummaryNote:
      "This summary comes from a language model, not from the source itself. The individual " +
      "voices are in the original.",
    smallSample:
      "Very small sample. Single voices carry a lot of weight here - generalising would not be " +
      "sound.",
    realityCheck: "What the ad promises - and what others report",
    staleWarning: "This listing may no longer be current.",
    repostWarning:
      "An identical listing existed earlier. That can mean a replacement hire, or simply a repost.",
  },

  applications: {
    title: "Your applications",
    viewKanban: "Board",
    viewList: "List",
    viewCalendar: "Dates",
    stageSaved: "Saved",
    stagePreparing: "Preparing",
    stageSent: "Sent",
    stageAcknowledged: "Acknowledged",
    stageInterview: "Interview",
    stageOffer: "Offer",
    stageRejected: "Rejected",
    stageWithdrawn: "Withdrawn",
    stageAccepted: "Accepted",
    lastContact: "Last contact",
    nextStep: "Next step",
    noNextStep: "No next step set",
    documents: "Documents",
    notes: "Notes",
    funnelTitle: "What your numbers show",
    funnelTooFew:
      "There are still too few applications for a diagnosis. From around ten sent applications " +
      "a pattern becomes readable - before that, any statement would be a guess.",
    empty: "No applications yet. They start from saved jobs.",
  },

  studio: {
    title: "Prepare application",
    requirements: "What the role requires",
    yourEvidence: "Your evidenced experience",
    document: "Document",
    checks: "{assistant}'s checks",
    openPoints: "Open points",
    generateCv: "Create CV",
    generateCvAts: "ATS-friendly version",
    generateCoverLetter: "Create cover letter",
    generateEmail: "Short application email",
    coverLetterNotNeeded:
      "This role does not ask for a cover letter. A short email is probably enough.",
    claimSupported: "evidenced",
    claimUnsupported: "not evidenced",
    claimNeedsConfirmation: "needs confirmation",
    unsupportedBlocked:
      "While a claim has no evidence, the document cannot be approved. Add evidence or soften " +
      "the claim.",
    acceptChange: "Accept",
    rejectChange: "Discard",
    showDiff: "See the change",
    reason: "Reason",
    preview: "Preview before sending",
    recipient: "Recipient",
    subject: "Subject",
    attachments: "Attachments",
    confirmSend: "I have checked everything and want to send this application",
    send: "Send now",
    exportDraft: "Download as draft",
    draftOnlySendNotice:
      "No email account is connected. Nothing will be sent — you get a draft to download.",
    portalGuide: "Guide me through the portal",
  },

  coaching: {
    title: "Interview preparation",
    modePractice: "Practice",
    modeSimulation: "Realistic simulation",
    modeCase: "Case task",
    startSession: "Start",
    repeatAnswer: "Repeat the answer",
    feedbackRelevance: "Relevance to the question",
    feedbackStructure: "Structure",
    feedbackEvidence: "Concrete evidence",
    feedbackClarity: "Clarity",
    feedbackMissing: "What is still missing",
    starStories: "Your stories from the profile",
    questionsForCompany: "Questions for the company",
    noBehaviourScoring:
      "Only the content and structure of your answer are assessed. Not your voice, your face, " +
      "your accent or your presence.",
  },

  settings: {
    title: "Settings",
    language: "Language",
    region: "Country and region",
    theme: "Appearance",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    notifications: "Notifications",
    integrations: "Connected services",
    microphone: "Microphone and transcripts",
    privacyCenter: "Privacy Center",
    memory: "What {assistant} knows about you",
    memoryBody: "Every entry can be viewed, changed and deleted individually.",
    consents: "Your consents",
    exportData: "Export data",
    exportBody: "You get everything as a JSON file.",
    deleteAccount: "Delete account",
    deleteAccountBody: "Deletes all your data. This cannot be undone.",
    sessions: "Signed-in devices",
    revokeSession: "Sign out",
    currentSession: "This device",
    aiProvider: "AI processing",
    aiProviderNone:
      "No AI provider is configured at the moment. No text is transmitted — and Nina does " +
      "not answer either.",
    aiProviderExternal:
      "Processing by an external provider. Purpose, region and provider are listed below.",
  },

  states: {
    loading: "Loading",
    errorTitle: "That didn't work",
    errorBody: "Try again. If it keeps happening, it isn't your fault.",
    offlineTitle: "No connection",
    offlineBody: "Your drafts are safe. We'll continue as soon as you're back online.",
    permissionDenied: "You don't have permission for that.",
    insufficientData: "There is too little data for that.",
    notConnectedTitle: "Not connected",
    notConnectedBody: "This service is not set up, so the feature is inactive.",
    emptyTitle: "Nothing here yet",
  },

  nina: {
    askBar: "Ask {assistant}",
    suggestionProfileGap:
      "Your profile still has an important gap. Shall we add a concrete project?",
    suggestionNoSalary:
      "This job fits well professionally, but no salary is stated. Shall I prepare some " +
      "questions for you?",
    suggestionReviewsFirst:
      "Would you like to open the employee reviews first, or compare the requirements with " +
      "your profile?",
    suggestionUnsupportedClaim:
      "This statement in your cover letter has no evidence yet. Shall we soften it or add an " +
      "example?",
    suggestionInterviewSoon:
      "Your interview is in three days. Shall we simulate the most likely questions?",
    suggestionFunnelPattern:
      "Your last eight applications shared one must-have criterion that isn't evidenced in your " +
      "profile. Shall we correct the search?",
  },
};
