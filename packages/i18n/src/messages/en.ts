import type { Messages } from "./de.ts";

/**
 * English texts. Typed against the German file, so a missing key is a
 * compile error rather than a blank spot in the interface.
 */

export const en: Messages = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
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
    demoMode: "Demo mode",
    demoNotice: "This data is invented. These are not real jobs and not real companies.",
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
    skipToContent: "Skip to content",
  },

  landing: {
    headline: "Don't find just any job. Find the one that actually fits.",
    subheadline:
      "{assistant} understands your experience, strengths and conditions, discovers roles that " +
      "suit you, and stays with you from the search through to the interview.",
    ctaVoice: "Talk to {assistant}",
    ctaText: "I'd rather type",
    ctaSecondary: "How it works",
    stepsTitle: "Three steps",
    step1Title: "Understand",
    step1Body:
      "Before you see any roles, we work out what you can actually do - from concrete " +
      "situations, not self-assessments.",
    step2Title: "Compare",
    step2Body:
      "You get a few reasoned suggestions instead of hundreds of listings. Each with a reason " +
      "and a reservation.",
    step3Title: "Apply",
    step3Body:
      "Documents are built from your evidenced experience. Every claim traces back to something " +
      "you confirmed.",
    matchTitle: "A match that can explain itself",
    matchBody: "Instead of a percentage, you see what it is made of - and where the data is thin.",
    evidenceTitle: "An everyday experience becomes an evidenced strength",
    evidenceBody:
      "What a CV calls \"customer service\" is usually something far more specific. That is what " +
      "{assistant} asks about.",
    realityTitle: "What the ad says - and what it doesn't",
    realityBody:
      "Employee voices, customer ratings and employer statements stay separate. A customer " +
      "rating of a location says nothing about the workplace culture.",
    privacyTitle: "Your data stays yours",
    privacyBody:
      "You can see what is stored, change or delete each item, and withdraw every consent " +
      "separately.",
    closingTitle: "Start with what you can already do",
    closingBody: "The conversation takes about fifteen minutes. You can pause at any point.",
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
      "No external provider is connected at the moment. A local demo provider is running; its " +
      "answers are examples with no substantive meaning.",
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
    claimWeakened: "softened",
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
    demoSendNotice:
      "No email account is connected. Nothing will be sent - you get a draft to download.",
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
    aiProviderMock:
      "A local demo provider is running. No data leaves this machine.",
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
