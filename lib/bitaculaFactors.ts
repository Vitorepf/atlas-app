import type {
  BehaviorCategory,
  BehaviorGranularityLevel,
  BehaviorSensitivityLevel,
  BitaculaNormalizationSuggestion,
} from './api/client'

export interface CanonicalBehaviorFactor {
  id: string
  label: string
  category: BehaviorCategory
  parentFactor: string
  factorCondition: string
  questionText: string
  targetOutcomes: string[]
  expectedLag: string
  expectedDirection: string
  granularityLevel: BehaviorGranularityLevel
  sensitivityLevel: BehaviorSensitivityLevel
  guidance?: string
}

export interface NormalizedBehaviorFactor extends CanonicalBehaviorFactor {
  confidence: number
  matchedText: string
  normalizer?: string
  matchReason?: string
}

const FACTORS: CanonicalBehaviorFactor[] = [
  {
    id: 'caffeine_late',
    label: 'Cafeína após 14h',
    category: 'substancias',
    parentFactor: 'caffeine',
    factorCondition: 'after_14h',
    questionText: 'Ontem teve cafeína depois das 14h?',
    targetOutcomes: ['sleep', 'hrv', 'resting_heart_rate', 'anxiety'],
    expectedLag: 'same_night_next_morning',
    expectedDirection: 'negative',
    granularityLevel: 'binary',
    sensitivityLevel: 'normal',
  },
  {
    id: 'caffeine_morning',
    label: 'Cafeína pela manhã',
    category: 'substancias',
    parentFactor: 'caffeine',
    factorCondition: 'morning',
    questionText: 'Ontem teve cafeína pela manhã?',
    targetOutcomes: ['focus', 'anxiety', 'appetite', 'reflux'],
    expectedLag: 'same_day',
    expectedDirection: 'mixed',
    granularityLevel: 'binary',
    sensitivityLevel: 'normal',
    guidance: 'Use só se houver hipótese sobre foco, ansiedade, apetite ou refluxo. Se for diário, trate como baseline.',
  },
  {
    id: 'caffeine_any',
    label: 'Cafeína',
    category: 'substancias',
    parentFactor: 'caffeine',
    factorCondition: 'any',
    questionText: 'Ontem teve cafeína?',
    targetOutcomes: ['focus', 'sleep', 'anxiety'],
    expectedLag: 'same_day_or_same_night',
    expectedDirection: 'mixed',
    granularityLevel: 'intensity',
    sensitivityLevel: 'normal',
    guidance: 'Fator amplo. Melhor especificar horário se a hipótese for sono ou ansiedade.',
  },
  {
    id: 'alcohol_any',
    label: 'Álcool',
    category: 'substancias',
    parentFactor: 'alcohol',
    factorCondition: 'any',
    questionText: 'Ontem teve álcool?',
    targetOutcomes: ['sleep', 'hrv', 'resting_heart_rate', 'mood'],
    expectedLag: 'same_night_next_morning',
    expectedDirection: 'negative',
    granularityLevel: 'binary',
    sensitivityLevel: 'sensitive',
  },
  {
    id: 'late_heavy_meal',
    label: 'Jantar pesado tarde',
    category: 'alimentacao',
    parentFactor: 'meal',
    factorCondition: 'heavy_late',
    questionText: 'Ontem teve jantar pesado ou tarde?',
    targetOutcomes: ['sleep', 'hrv', 'reflux', 'energy'],
    expectedLag: 'same_night_next_morning',
    expectedDirection: 'negative',
    granularityLevel: 'binary',
    sensitivityLevel: 'normal',
  },
  {
    id: 'screen_in_bed',
    label: 'Tela na cama',
    category: 'digital',
    parentFactor: 'screen',
    factorCondition: 'in_bed',
    questionText: 'Ontem teve tela na cama?',
    targetOutcomes: ['sleep', 'mood', 'focus'],
    expectedLag: 'same_night_next_morning',
    expectedDirection: 'negative',
    granularityLevel: 'binary',
    sensitivityLevel: 'normal',
  },
  {
    id: 'intense_training_evening',
    label: 'Treino intenso à noite',
    category: 'treino_movimento',
    parentFactor: 'training',
    factorCondition: 'intense_evening',
    questionText: 'Ontem teve treino intenso à noite?',
    targetOutcomes: ['sleep', 'hrv', 'resting_heart_rate', 'energy'],
    expectedLag: 'same_night_next_morning',
    expectedDirection: 'mixed',
    granularityLevel: 'binary',
    sensitivityLevel: 'normal',
  },
  {
    id: 'relational_conflict',
    label: 'Conversa difícil',
    category: 'relacional',
    parentFactor: 'relational_stress',
    factorCondition: 'difficult_conversation',
    questionText: 'Ontem teve conversa difícil ou conflito?',
    targetOutcomes: ['sleep', 'hrv', 'mood', 'focus'],
    expectedLag: 'same_day_next_morning',
    expectedDirection: 'negative',
    granularityLevel: 'binary',
    sensitivityLevel: 'relational',
  },
  {
    id: 'social_event',
    label: 'Socialização relevante',
    category: 'relacional',
    parentFactor: 'social_contact',
    factorCondition: 'meaningful',
    questionText: 'Ontem teve socialização relevante?',
    targetOutcomes: ['mood', 'energy', 'sleep'],
    expectedLag: 'same_day_next_morning',
    expectedDirection: 'mixed',
    granularityLevel: 'binary',
    sensitivityLevel: 'relational',
  },
  {
    id: 'algorithmic_input_morning',
    label: 'Input algorítmico pela manhã',
    category: 'digital',
    parentFactor: 'algorithmic_input',
    factorCondition: 'morning',
    questionText: 'Ontem teve input algorítmico antes do trabalho?',
    targetOutcomes: ['focus', 'mood', 'application_ratio'],
    expectedLag: 'same_day',
    expectedDirection: 'negative',
    granularityLevel: 'binary',
    sensitivityLevel: 'normal',
  },
  {
    id: 'recovery_protocol',
    label: 'Protocolo de recuperação',
    category: 'recuperacao',
    parentFactor: 'recovery_protocol',
    factorCondition: 'any',
    questionText: 'Ontem teve protocolo de recuperação relevante?',
    targetOutcomes: ['hrv', 'energy', 'sleep', 'mood'],
    expectedLag: 'same_day_next_morning',
    expectedDirection: 'positive',
    granularityLevel: 'binary',
    sensitivityLevel: 'normal',
    guidance: 'Fator amplo. Em experimento, separar protocolo, duração e horário.',
  },
  {
    id: 'travel_or_routine_break',
    label: 'Viagem ou quebra de rotina',
    category: 'ambiente_rotina',
    parentFactor: 'routine',
    factorCondition: 'break',
    questionText: 'Ontem teve viagem ou quebra forte de rotina?',
    targetOutcomes: ['sleep', 'hrv', 'energy', 'focus'],
    expectedLag: 'same_day_next_morning',
    expectedDirection: 'mixed',
    granularityLevel: 'binary',
    sensitivityLevel: 'normal',
  },
  {
    id: 'illness_symptom',
    label: 'Doença ou sintoma',
    category: 'saude_sintoma',
    parentFactor: 'symptom',
    factorCondition: 'illness_or_pain',
    questionText: 'Ontem teve doença, dor ou sintoma relevante?',
    targetOutcomes: ['sleep', 'hrv', 'energy', 'mood'],
    expectedLag: 'same_day_next_morning',
    expectedDirection: 'negative',
    granularityLevel: 'binary',
    sensitivityLevel: 'medical',
  },
  {
    id: 'medication_or_supplement',
    label: 'Medicação ou suplemento',
    category: 'substancias',
    parentFactor: 'medication_supplement',
    factorCondition: 'any',
    questionText: 'Ontem teve medicação ou suplemento relevante?',
    targetOutcomes: ['sleep', 'hrv', 'energy', 'mood'],
    expectedLag: 'same_day_next_morning',
    expectedDirection: 'mixed',
    granularityLevel: 'intensity',
    sensitivityLevel: 'medical',
    guidance: 'Fator amplo. Em experimento, separar substância, dose e horário.',
  },
]

const CANONICAL_CATEGORIES = new Set<BehaviorCategory>([
  'substancias',
  'alimentacao',
  'sono_ritmo',
  'treino_movimento',
  'recuperacao',
  'digital',
  'trabalho_cognicao',
  'relacional',
  'saude_sintoma',
  'ambiente_rotina',
  'outro',
])

const CATEGORY_ALIASES: Record<string, BehaviorCategory> = {
  bebida: 'substancias',
  suplemento: 'substancias',
  conflito: 'relacional',
  social: 'relacional',
  sono: 'sono_ritmo',
  treino: 'treino_movimento',
  trabalho: 'trabalho_cognicao',
  saude: 'saude_sintoma',
}

const CAFFEINE_TERMS = [
  'cafe',
  'cafezinho',
  'cafeina',
  'espresso',
  'expresso',
  'capuccino',
  'cappuccino',
  'pre treino',
  'pre-treino',
  'pre workout',
  'preworkout',
  'mate',
  'cha mate',
  'erva mate',
  'terere',
  'tereré',
  'chimarrao',
  'chimarrão',
  'guarana',
  'guaraná',
  'energetico',
  'energético',
  'red bull',
  'monster',
  'cha preto',
  'chá preto',
  'cha verde',
  'chá verde',
]

const LATE_CAFFEINE_TERMS = [
  'tarde',
  'fim da tarde',
  'noite',
  'depois do almoco',
  'depois do almoço',
  'pos almoco',
  'pós almoço',
  'apos almoco',
  'após almoço',
]

const MORNING_TERMS = ['manha', 'manhã', 'cedo', 'acordar', 'ao acordar', 'cafe da manha', 'café da manhã']

export function canonicalBehaviorFactors(): CanonicalBehaviorFactor[] {
  return FACTORS
}

export function canonicalBehaviorCategory(category: BehaviorCategory | string | null | undefined): BehaviorCategory {
  const normalized = String(category ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\s-]+/g, '_')
    .replace(/_+/g, '_')

  if (CANONICAL_CATEGORIES.has(normalized as BehaviorCategory)) return normalized as BehaviorCategory

  return CATEGORY_ALIASES[normalized] ?? 'outro'
}

export function normalizedFactorFromServer(suggestion: BitaculaNormalizationSuggestion): NormalizedBehaviorFactor {
  return {
    id: suggestion.id,
    label: suggestion.label,
    category: canonicalBehaviorCategory(suggestion.category),
    parentFactor: suggestion.parent_factor,
    factorCondition: suggestion.factor_condition,
    questionText: suggestion.question_text,
    targetOutcomes: suggestion.target_outcomes,
    expectedLag: suggestion.expected_lag,
    expectedDirection: suggestion.expected_direction,
    granularityLevel: suggestion.granularity_level,
    sensitivityLevel: suggestion.sensitivity_level,
    guidance: suggestion.guidance ?? undefined,
    confidence: suggestion.confidence,
    matchedText: suggestion.matched_text,
    normalizer: 'canonical_catalog_v2',
    matchReason: suggestion.match_reason,
  }
}

export function normalizeBehaviorFactor(text: string): NormalizedBehaviorFactor | null {
  const normalized = normalizeText(text)
  if (!normalized) return null

  const clockHours = extractClockHours(normalized)
  const caffeine = hasAny(normalized, CAFFEINE_TERMS)
  const lateCaffeineTiming = detectLateCaffeineTiming(normalized, clockHours)
  if (caffeine && lateCaffeineTiming) {
    return match('caffeine_late', text, lateCaffeineTiming === 'clock' ? 0.96 : 0.91)
  }
  if (caffeine && hasMorningTiming(normalized, clockHours)) {
    return match('caffeine_morning', text, 0.82)
  }
  if (caffeine) {
    return match('caffeine_any', text, 0.62)
  }

  if (hasAny(normalized, ['alcool', 'cerveja', 'vinho', 'drink', 'whisky', 'vodka'])) return match('alcohol_any', text, 0.92)
  if (hasAny(normalized, ['jantar pesado', 'refeicao tarde', 'comida pesada', 'jantar tarde', 'comer tarde', '21h', '22h'])) return match('late_heavy_meal', text, 0.9)
  if (hasAny(normalized, ['tela na cama', 'celular na cama', 'iphone na cama', 'scroll na cama', 'doomscroll noite'])) return match('screen_in_bed', text, 0.9)
  if (hasAny(normalized, ['treino intenso noite', 'treino pesado noite', 'treino a noite', 'cardio noite'])) return match('intense_training_evening', text, 0.86)
  if (hasAny(normalized, ['conflito', 'briga', 'discussao', 'conversa dificil', 'tensao com'])) return match('relational_conflict', text, 0.88)
  if (hasAny(normalized, ['social', 'amigos', 'familia', 'evento', 'jantar com', 'encontro'])) return match('social_event', text, 0.72)
  if (hasAny(normalized, ['youtube manha', 'rede social manha', 'instagram manha', 'tiktok manha', 'input algoritmico'])) return match('algorithmic_input_morning', text, 0.88)
  if (hasAny(normalized, ['sauna', 'banho frio', 'banho gelado', 'crioterapia', 'massagem', 'mobilidade', 'alongamento', 'respiracao', 'nsdr', 'yoga nidra', 'meditacao'])) return match('recovery_protocol', text, 0.78)
  if (hasAny(normalized, ['viagem', 'viajei', 'deslocamento', 'fora da rotina', 'rotina fora'])) return match('travel_or_routine_break', text, 0.84)
  if (hasAny(normalized, ['doente', 'doenca', 'dor', 'enxaqueca', 'sintoma', 'febre', 'gripe'])) return match('illness_symptom', text, 0.82)
  if (hasAny(normalized, ['remedio', 'medicacao', 'medicamento', 'suplemento', 'creatina', 'magnesio', 'melatonina'])) return match('medication_or_supplement', text, 0.78)

  return null
}

export function behaviorFactorPayload(factor: NormalizedBehaviorFactor | null): {
  parent_factor?: string | null
  factor_condition?: string | null
  target_outcomes?: string[]
  expected_lag?: string | null
  expected_direction?: string | null
  granularity_level?: BehaviorGranularityLevel
  sensitivity_level?: BehaviorSensitivityLevel
  derived_from?: Record<string, unknown>
  operator_confirmed?: boolean
} {
  if (!factor) {
    return {
      target_outcomes: [],
      granularity_level: 'binary',
      sensitivity_level: 'normal',
      derived_from: { normalizer: 'local_catalog_v2', status: 'unmatched' },
      operator_confirmed: true,
    }
  }

  return {
    parent_factor: factor.parentFactor,
    factor_condition: factor.factorCondition,
    target_outcomes: factor.targetOutcomes,
    expected_lag: factor.expectedLag,
    expected_direction: factor.expectedDirection,
    granularity_level: factor.granularityLevel,
    sensitivity_level: factor.sensitivityLevel,
    derived_from: {
      normalizer: factor.normalizer ?? 'local_catalog_v2',
      canonical_factor: factor.id,
      matched_text: factor.matchedText,
      match_reason: factor.matchReason ?? 'local_rule_match',
      confidence: factor.confidence,
    },
    operator_confirmed: true,
  }
}

function match(id: string, matchedText: string, confidence: number): NormalizedBehaviorFactor {
  const factor = FACTORS.find((item) => item.id === id)
  if (!factor) throw new Error(`Unknown Bitacula factor: ${id}`)

  return { ...factor, confidence, matchedText }
}

function hasAny(value: string, needles: string[]): boolean {
  const haystack = ` ${value} `
  return needles.some((needle) => {
    const normalizedNeedle = normalizeText(needle)
    return normalizedNeedle.length > 0 && haystack.includes(` ${normalizedNeedle} `)
  })
}

function detectLateCaffeineTiming(value: string, clockHours: number[]): 'clock' | 'semantic' | null {
  if (clockHours.some((hour) => hour >= 14)) return 'clock'
  if (hasAny(value, LATE_CAFFEINE_TERMS)) return 'semantic'

  return null
}

function hasMorningTiming(value: string, clockHours: number[]): boolean {
  if (clockHours.some((hour) => hour >= 4 && hour < 12)) return true

  return hasAny(value, MORNING_TERMS)
}

function extractClockHours(value: string): number[] {
  const hours = new Set<number>()
  const patterns = [
    /\b(?:apos as|apos das?|apos de|apos|pos as|pos das?|pos|depois das?|depois de|a partir das?|a partir de|por volta das?|perto das?|la pelas?|as)\s+(\d{1,2})(?:\s+(\d{2}))?\s*(?:h|horas?)?\b/g,
    /\b(\d{1,2})\s*(?:h|horas?)\b/g,
  ]

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const hour = Number(match[1])
      const minute = match[2] ? Number(match[2]) : 0
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59) {
        hours.add(hour)
      }
    }
  }

  return Array.from(hours)
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
