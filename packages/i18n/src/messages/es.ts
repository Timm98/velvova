import type { Messages } from "./de.ts";

/**
 * Textos en español.
 *
 * Tipados según el archivo alemán: una clave que falte es un error de
 * compilación, no un hueco en la interfaz.
 *
 * ── Para revisión por hablante nativo ───────────────────────────
 *
 * Dos partes sobre todo. La sección `consent` contiene formulaciones
 * jurídicas: un consentimiento mal traducido no solo molesta, no vale
 * nada. Y en `studio` la distinción entre «avalado» y «sin aval»
 * sostiene toda la promesa del producto — tiene que quedar nítida.
 */
export const es: Messages = {
  common: {
    appName: "{brand}",
    assistant: "{assistant}",
    example: "Ejemplo",
    save: "Guardar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    edit: "Editar",
    delete: "Eliminar",
    reject: "Rechazar",
    back: "Atrás",
    next: "Siguiente",
    skip: "Omitir",
    close: "Cerrar",
    loading: "Cargando",
    retry: "Intentar de nuevo",
    showMore: "Mostrar más",
    showLess: "Mostrar menos",
    notSpecified: "sin especificar",
    unknown: "desconocido",
    notConnected: "no conectado",
    openOriginal: "Abrir el anuncio original",
    dismiss: "No volver a mostrar",
  },

  nav: {
    home: "Inicio",
    assistant: "{assistant}",
    jobs: "Empleos",
    applications: "Candidaturas",
    profile: "Perfil",
    coaching: "Preparación",
    offers: "Propuestas",
    checkIns: "Seguimiento",
    settings: "Ajustes",
    logout: "Cerrar sesión",
    howItWorks: "Cómo funciona",
    methodology: "Método",
    security: "Seguridad",
    privacy: "Privacidad",
    imprint: "Aviso legal",
    matches: "Coincidencias",
    careerProfile: "Perfil profesional",
    growth: "Carrera",
    notifications: "Notificaciones",
    search: "Buscar",
    languageRegion: "Idioma y región",
    appearance: "Apariencia",
    privacyData: "Privacidad y datos",
    help: "Ayuda",
    discover: "Descubrir",
    career: "Carrera",
    expand: "Desplegar",
    collapse: "Plegar",
    skipToContent: "Ir al contenido",
    backToApp: "Volver a {assistant}",
  },

  landing: {
    eyebrow: "Tu acompañamiento profesional con IA",
    headline: "Encuentra un empleo que de verdad encaje contigo.",
    headlineLine1: "Encuentra un empleo",
    headlineLine2: "que de verdad encaje contigo.",
    subheadline:
      "{assistant} entiende tu experiencia, encuentra puestos recientes de fuentes " +
      "verificadas y te acompaña desde la orientación hasta la candidatura.",
    ctaPrimary: "Empezar gratis con {assistant}",
    ctaSecondary: "Cómo funciona",

    coreLine1: "No te mostramos más ofertas.",
    coreLine2: "Te mostramos las adecuadas.",
    coreSub: "No 10.000 resultados. Las pocas oportunidades que de verdad importan.",

    learnsEyebrow: "Lo que {assistant} aprende de ti",
    learnsTitle: "Entender primero, buscar después.",
    learnsBody:
      "Situaciones concretas en lugar de autodescripción. Qué hiciste, qué salió de ello, en " +
      "qué se reconocería. Sobre eso puede sostenerse un perfil.",
    rolesEyebrow: "Direcciones",
    rolesTitle: "Puestos que encajan y otros en los que no habrías pensado.",
    rolesBody:
      "Cercanos, adyacentes, inesperados. De cada uno: en qué se apoya, qué cambiaría, qué " +
      "falta — y cómo probarlo a pequeña escala.",
    jobsEyebrow: "Puestos actuales",
    jobsTitle: "Cada recomendación con su motivo, su fuente y lo que queda abierto.",
    jobsBody:
      "Anuncios reales de fuentes ofrecidas abiertamente, enlazados al original y con la hora " +
      "de la última comprobación. El salario solo si figura allí.",
    applyEyebrow: "Candidatura",
    applyTitle: "Cuando un puesto encaja, {assistant} te prepara.",
    applyBody:
      "Documentos ajustados al puesto — el lenguaje y el orden de prioridades, no la verdad. " +
      "Nada se envía sin tu aprobación explícita.",
    pathEyebrow: "El recorrido",
    pathTitle: "De lo que sabes hacer a lo que consigues.",
    pathBody:
      "Cada paso se apoya en el anterior. Lo que no está avalado no se afirma — ni en una " +
      "recomendación ni en una candidatura.",

    step1: "Tu experiencia",
    step1Detail: "Lo que hiciste realmente, no lo que dice el currículum.",
    step2: "{assistant} te entiende",
    step2Detail: "Una conversación sobre situaciones, no sobre palabras de moda.",
    step3: "Competencias y forma de trabajar",
    step3Detail: "Avaladas, con su procedencia. Nada inventado.",
    step4: "Puestos realistas",
    step4Detail: "De tres a cinco direcciones, cada una con su motivo.",
    step5: "Puestos recientes",
    step5Detail: "De fuentes verificadas, con enlace original y hora de comprobación.",
    step6: "Encaje y realidad",
    step6Detail: "Qué encaja, qué no y qué sigue abierto.",
    step7: "Candidatura",
    step7Detail: "Solo afirmaciones que puedas respaldar.",

    diffUnderstand: "Entender",
    diffUnderstandBody: "{assistant} no parte de un título de puesto. Parte de ti.",
    diffCheck: "Comprobar",
    diffCheckBody:
      "Cada puesto se revisa: encaje, actualidad, condiciones y preguntas abiertas.",
    diffAct: "Actuar",
    diffActBody:
      "{assistant} prepara el siguiente paso con sentido — de la candidatura a la entrevista.",

    closingTitle: "Empieza con una conversación.",
    closingBody:
      "Sin registro para un primer vistazo, sin correos publicitarios, sin compartir tu " +
      "perfil. Cada detalle sigue en tus manos.",

    navProduct: "Producto",
    navHow: "Cómo funciona",
    navSecurity: "Seguridad",
    navSignIn: "Iniciar sesión",
    footerPrivacy: "Privacidad",
    footerSecurity: "Seguridad",
    footerMethodology: "Metodología",
    footerImprint: "Aviso legal",
    footerTerms: "Condiciones",
  },

  auth: {
    loginTitle: "Iniciar sesión",
    registerTitle: "Crear cuenta",
    email: "Dirección de correo",
    password: "Contraseña",
    passwordHint: "Al menos doce caracteres. La longitud importa más que los caracteres especiales.",
    login: "Iniciar sesión",
    register: "Crear cuenta",
    magicLink: "Enviarme un enlace",
    magicLinkSent: "Si existe una cuenta para esta dirección, el enlace va en camino.",
    forgotPassword: "¿Has olvidado la contraseña?",
    noAccount: "¿Aún no tienes cuenta?",
    hasAccount: "¿Ya tienes cuenta?",
    errorInvalid: "Esa dirección de correo o esa contraseña no son correctas.",
    errorEmailTaken: "Ya existe una cuenta para esta dirección.",
    errorPasswordShort: "Esa contraseña es demasiado corta. Necesita al menos ocho caracteres.",
    errorEmailInvalid: "Esa dirección de correo no parece completa.",
  },

  consent: {
    title: "Antes de empezar",
    intro:
      "Tres cosas que decidir. Puedes cambiarlas cuando quieras en el centro de privacidad.",
    language: "Idioma",
    country: "País",
    location: "Tu ubicación",
    workModel: "Modelo de trabajo",
    careerProfile: "Crear un perfil profesional",
    careerProfileBody:
      "Tus respuestas se guardan para poder construir un perfil a partir de ellas. Sin esto no " +
      "funciona nada más.",
    documentAnalysis: "Analizar documentos",
    documentAnalysisBody:
      "Si subes un currículum, su texto se analiza para rellenar tu perfil. Opcional.",
    voiceInput: "Entrada por voz",
    voiceInputBody:
      "Puedes hablar con {assistant} en lugar de escribir. Por separado decides si se guarda " +
      "la transcripción.",
    transcriptStorage: "Guardar la transcripción",
    transcriptStorageBody:
      "Sin este consentimiento, el texto hablado se procesa pero nunca se conserva.",
    externalAi: "Tratamiento por un proveedor externo",
    externalAiBodyActive:
      "Tu texto se envía a un proveedor de IA externo para su análisis. Los identificadores " +
      "directos, como la dirección de correo y el número de teléfono, se eliminan antes.",
    externalAiBodyInactive:
      "Ahora mismo no hay ningún proveedor de IA configurado. {assistant} no responderá — " +
      "deliberadamente no producimos una respuesta de ejemplo, porque sería indistinguible " +
      "de una real.",
    privacyCenter: "Ir al centro de privacidad",
    start: "Empezar la conversación",
  },

  interview: {
    title: "Conversación con {assistant}",
    intro:
      "Antes de mostrarte ofertas quiero entender qué sabes hacer realmente, qué te da energía " +
      "y qué condiciones necesitas. Puedes corregir u omitir cualquier cosa en cualquier momento.",
    progress: "{done} de {total} temas entendidos",
    yourAnswer: "¿Cómo puedo ayudarte con tu siguiente paso?",
    send: "Enviar",
    voiceMode: "Hablar",
    textMode: "Escribir",
    voiceUnavailable:
      "El modo de voz no está disponible porque no hay ningún proveedor de voz conectado. " +
      "Escribir funciona por completo.",
    listening: "Te escucho",
    paused: "En pausa",
    pause: "Pausar",
    resume: "Continuar",
    interrupt: "Interrumpir",
    liveTranscript: "Transcripción en directo",
    whyThisQuestion: "¿Por qué esta pregunta?",
    recognisedSoFar: "Lo que he entendido hasta ahora",
    openHypotheses: "Deducciones aún abiertas",
    skipQuestion: "Omitir esta pregunta",
    pauseSession: "Interrumpir la conversación",
    resumeLater: "Podrás retomarla exactamente aquí más tarde.",
    thinking: "{assistant} está escribiendo",
  },

  profile: {
    title: "Tu perfil profesional",
    compass: "Tu brújula profesional",
    confirmedStrengths: "Fortalezas avaladas",
    energising: "El trabajo que te da energía",
    draining: "Lo haces bien, pero te cuesta energía",
    interests: "Intereses y objetivos de aprendizaje",
    values: "Valores y compromisos",
    workStyle: "Forma de trabajar preferida",
    hardNoGos: "Límites firmes",
    roleClusters: "Direcciones que encajan",
    surprising: "Menos evidente",
    gaps: "Lagunas y deducciones abiertas",
    coverage: "Cobertura de datos",
    coverageBody:
      "Qué parte de tu perfil está avalada. Lo que falta reduce la confianza de las " +
      "recomendaciones, no su calidad.",
    showEvidence: "Mostrar el respaldo",
    addEvidence: "Añadir respaldo",
    changeWeight: "Cambiar la ponderación",
    confirmAll: "Confirmar el perfil",
    confirmAllBody:
      "Después desbloqueo sugerencias de empleo personalizadas. Podrás seguir cambiándolo todo.",
    confirmed: "confirmado",
    hypothesis: "deducción",
    fromDocument: "de tus documentos",
    rejected: "rechazado",
    empty: "Aquí no hay nada todavía. La conversación con {assistant} lo llena.",
  },

  jobs: {
    title: "La selección de {assistant} para ti",
    titleGeneric: "Selección para ti",
    locked: "Aún no desbloqueado",
    lockedBody:
      "Las sugerencias personalizadas solo aparecen cuando tu perfil está listo. De lo " +
      "contrario serían conjeturas.",
    lockedCta: "Continuar la conversación",
    sortBy: "Ordenar por",
    sortBestOverall: "Mejor en conjunto",
    sortHighestFit: "Mayor encaje",
    sortBestQuality: "Mejor calidad del puesto",
    sortHighestSalary: "Salario más alto",
    sortFutureRobust: "Sólido a futuro",
    sortShortestCommute: "Trayecto más corto",
    sortNewest: "Anuncios más recientes",
    filters: "Filtros",
    showBlocked: "Mostrar empleos excluidos",
    blockedBecause: "Excluido por",
    fit: "Encaje",
    fitHigh: "encaje alto",
    fitMedium: "encaje medio",
    fitExploratory: "exploratorio",
    fitInsufficient: "encaje aún abierto",
    confidence: "Confianza",
    confidenceHigh: "alta",
    confidenceMedium: "media",
    confidenceLow: "baja",
    jobQuality: "Calidad del puesto",
    aiTransition: "Cómo podría cambiarlo la IA",
    listingConfidence: "Confianza en el anuncio",
    published: "Publicado",
    daysAgo: "hace {n} días",
    mainReason: "Por qué encaja",
    mainReservation: "Qué tener en cuenta",
    view: "Ver",
    save: "Guardar",
    saved: "Guardado",
    discuss: "Comentar con {assistant}",
    empty: "Ahora mismo nada coincide con estos filtros. Amplía un poco la búsqueda.",
    emptyAll: "Todavía no se ha cargado ningún empleo.",
  },

  jobDetail: {
    whyShown: "Por qué {assistant} te muestra esto",
    tabOverview: "Resumen",
    tabMatch: "Tu coincidencia",
    tabQuality: "Calidad del puesto",
    tabFuture: "Futuro e IA",
    tabCompany: "Empresa y experiencias",
    tabSource: "Anuncio original y fuentes",
    coreTasks: "Lo que harías realmente",
    mustHave: "Requisitos imprescindibles",
    niceToHave: "Requisitos deseables",
    covered: "cubierto por tu experiencia",
    notCovered: "aún sin avalar",
    transferable: "transferible desde",
    learningCurve: "Curva de aprendizaje probable",
    commute: "Trayecto",
    questionsToAsk: "Preguntas que merece la pena hacer en la entrevista",
    prepareApplication: "Preparar la candidatura",
    whyNotHigher: "¿Por qué la coincidencia no es mayor?",
    closeGap: "¿Qué laguna podría cerrar rápidamente?",
    tasksChanging: "¿Qué tareas podría cambiar la IA?",
    compare: "Comparar con otro empleo",
    retrievedAt: "Recuperado el",
    sourceKind: "Tipo de fuente",
    sampleSize: "Tamaño de la muestra",
    period: "Periodo",
    aiSummary: "Resumen por IA",
    aiSummaryNote:
      "Este resumen procede de un modelo de lenguaje, no de la fuente misma. Las opiniones " +
      "concretas están en el original.",
    smallSample:
      "Muestra muy pequeña. Aquí las opiniones sueltas pesan mucho — generalizar no sería " +
      "sólido.",
    realityCheck: "Lo que promete el anuncio y lo que cuentan otros",
    staleWarning: "Puede que este anuncio ya no esté vigente.",
    repostWarning:
      "Antes existió un anuncio idéntico. Puede significar una contratación de reemplazo o " +
      "simplemente una republicación.",
  },

  applications: {
    title: "Tus candidaturas",
    viewKanban: "Tablero",
    viewList: "Lista",
    viewCalendar: "Fechas",
    stageSaved: "Guardada",
    stagePreparing: "En preparación",
    stageSent: "Enviada",
    stageAcknowledged: "Acuse de recibo",
    stageInterview: "Entrevista",
    stageOffer: "Oferta",
    stageRejected: "Rechazada",
    stageWithdrawn: "Retirada",
    stageAccepted: "Aceptada",
    lastContact: "Último contacto",
    nextStep: "Siguiente paso",
    noNextStep: "Sin siguiente paso definido",
    documents: "Documentos",
    notes: "Notas",
    funnelTitle: "Lo que dicen tus números",
    funnelTooFew:
      "Todavía hay muy pocas candidaturas para un diagnóstico. A partir de unas diez enviadas " +
      "se hace legible un patrón; antes, cualquier afirmación sería una conjetura.",
    empty: "Aún no hay candidaturas. Empiezan en los empleos guardados.",
  },

  studio: {
    title: "Preparar la candidatura",
    requirements: "Lo que exige el puesto",
    yourEvidence: "Tu experiencia avalada",
    document: "Documento",
    checks: "Las comprobaciones de {assistant}",
    openPoints: "Puntos abiertos",
    generateCv: "Crear currículum",
    generateCvAts: "Versión apta para sistemas de selección",
    generateCoverLetter: "Crear carta de presentación",
    generateEmail: "Correo breve de candidatura",
    coverLetterNotNeeded:
      "Este puesto no pide carta de presentación. Probablemente baste un correo breve.",
    claimSupported: "avalado",
    claimUnsupported: "sin aval",
    claimNeedsConfirmation: "pendiente de confirmar",
    unsupportedBlocked:
      "Mientras una afirmación no tenga respaldo, el documento no puede aprobarse. Añade un " +
      "respaldo o suaviza la afirmación.",
    acceptChange: "Aceptar",
    rejectChange: "Descartar",
    showDiff: "Ver el cambio",
    reason: "Motivo",
    preview: "Vista previa antes de enviar",
    recipient: "Destinatario",
    subject: "Asunto",
    attachments: "Adjuntos",
    confirmSend: "Lo he revisado todo y quiero enviar esta candidatura",
    send: "Enviar ahora",
    exportDraft: "Descargar como borrador",
    draftOnlySendNotice:
      "No hay ninguna cuenta de correo conectada. No se enviará nada — recibes un borrador " +
      "para descargar.",
    portalGuide: "Guíame por el portal",
  },

  coaching: {
    title: "Preparación de la entrevista",
    modePractice: "Práctica",
    modeSimulation: "Simulación realista",
    modeCase: "Caso práctico",
    startSession: "Empezar",
    repeatAnswer: "Repetir la respuesta",
    feedbackRelevance: "Pertinencia respecto a la pregunta",
    feedbackStructure: "Estructura",
    feedbackEvidence: "Ejemplos concretos",
    feedbackClarity: "Claridad",
    feedbackMissing: "Lo que aún falta",
    starStories: "Tus ejemplos del perfil",
    questionsForCompany: "Preguntas para la empresa",
    noBehaviourScoring:
      "Solo se evalúan el contenido y la estructura de tu respuesta. Ni tu voz, ni tu cara, ni " +
      "tu acento, ni tu presencia.",
  },

  settings: {
    title: "Ajustes",
    language: "Idioma",
    region: "País y región",
    theme: "Apariencia",
    themeLight: "Claro",
    themeDark: "Oscuro",
    themeSystem: "Sistema",
    notifications: "Notificaciones",
    integrations: "Servicios conectados",
    microphone: "Micrófono y transcripciones",
    privacyCenter: "Centro de privacidad",
    memory: "Lo que {assistant} sabe de ti",
    memoryBody: "Cada entrada puede consultarse, cambiarse y borrarse por separado.",
    consents: "Tus consentimientos",
    exportData: "Exportar datos",
    exportBody: "Recibes todo en un archivo JSON.",
    deleteAccount: "Eliminar la cuenta",
    deleteAccountBody: "Borra todos tus datos. No se puede deshacer.",
    sessions: "Dispositivos con sesión iniciada",
    revokeSession: "Cerrar sesión",
    currentSession: "Este dispositivo",
    aiProvider: "Tratamiento por IA",
    aiProviderNone:
      "Ahora mismo no hay ningún proveedor de IA configurado. No se transmite ningún texto, y " +
      "{assistant} tampoco responde.",
    aiProviderExternal:
      "Tratamiento por un proveedor externo. La finalidad, la región y el proveedor se indican " +
      "más abajo.",
  },

  states: {
    loading: "Cargando",
    errorTitle: "Eso no ha funcionado",
    errorBody: "Inténtalo de nuevo. Si vuelve a ocurrir, no es culpa tuya.",
    offlineTitle: "Sin conexión",
    offlineBody: "Tus borradores están a salvo. Seguimos en cuanto vuelvas a estar en línea.",
    permissionDenied: "No tienes permiso para eso.",
    insufficientData: "Hay muy pocos datos para eso.",
    notConnectedTitle: "No conectado",
    notConnectedBody: "Este servicio no está configurado, así que la función está inactiva.",
    emptyTitle: "Aquí no hay nada todavía",
  },

  nina: {
    askBar: "Preguntar a {assistant}",
    suggestionProfileGap:
      "Tu perfil todavía tiene una laguna importante. ¿Añadimos un proyecto concreto?",
    suggestionNoSalary:
      "Este empleo encaja bien en lo profesional, pero no indica salario. ¿Te preparo algunas " +
      "preguntas?",
    suggestionReviewsFirst:
      "¿Prefieres abrir primero las opiniones de empleados o comparar los requisitos con tu " +
      "perfil?",
    suggestionUnsupportedClaim:
      "Esta afirmación de tu carta aún no tiene respaldo. ¿La suavizamos o añadimos un ejemplo?",
    suggestionInterviewSoon:
      "Tu entrevista es dentro de tres días. ¿Simulamos las preguntas más probables?",
    suggestionFunnelPattern:
      "Tus últimas ocho candidaturas compartían un requisito imprescindible que no está " +
      "avalado en tu perfil. ¿Corregimos la búsqueda?",
  },
};
