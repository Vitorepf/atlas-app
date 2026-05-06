// Atlas design tokens — warm-premium identity (Parfums de Marly / Aesop, not Linear).

export type ThemeName = 'light' | 'dark'

export interface AtlasPalette {
  // Surfaces (color depth · 4 variações de bege para z-axis implícito)
  bg: string
  bgRecessed: string  // áreas afundadas (search, dock backdrop)
  bgRaised: string    // áreas elevadas (card on hover/press)
  bgDeep: string      // afundadas profundamente (selection state)
  bgFresh: string     // capturas <30s (com edge bronze topo)
  surface: string
  premium: string
  // Ink
  ink: string
  ink2: string
  ink3: string
  border: string
  borderSoft: string
  // Accents
  prussian: string
  bronze: string
  bronzeDeep: string
  bronzeLight: string
  recRed: string
  recRedOxide: string  // tinta-sangue oxidado · só em recording
  recRedMuted: string  // arquivar · destrutivo discreto
  moss: string
  amber: string  // adiar · swipe reveal
  // Domains
  domBlackink: string
  domAtlas: string
  domSaude: string
  domFinancas: string
  domOutro: string
  // Status bar / dynamic island
  pureBlack: string
  // Inverted ink for buttons painted on ink color
  onInk: string
}

export const lightPalette: AtlasPalette = {
  bg:          '#F4EFE6',
  bgRecessed:  '#EFE8DA',
  bgRaised:    '#F8F2E9',
  bgDeep:      '#E8E0CC',
  bgFresh:     '#F8F1E1',
  surface:     '#EAE3D6',
  premium:     '#E0D8C9',
  ink:         '#1A1612',
  ink2:        '#6B6358',
  ink3:        '#A89F90',
  border:      '#D4CCBC',
  borderSoft:  '#DCD3C0',
  prussian:    '#1B3A57',
  bronze:      '#9B7A3F',
  bronzeDeep:  '#7A5E2F',
  bronzeLight: '#C9A663',
  recRed:      '#8B2635',
  recRedOxide: '#A8312A',
  recRedMuted: '#9C4651',
  moss:        '#4A5D3A',
  amber:       '#B8814A',
  domBlackink: '#1B3A57',
  domAtlas:    '#5D4A8A',
  domSaude:    '#4A5D3A',
  domFinancas: '#9B7A3F',
  domOutro:    '#6B6358',
  pureBlack:   '#000000',
  onInk:       '#F4EFE6',
}

export const darkPalette: AtlasPalette = {
  bg:          '#1C1916',
  bgRecessed:  '#16130F',
  bgRaised:    '#252119',
  bgDeep:      '#100D0A',
  bgFresh:     '#26211A',
  surface:     '#252119',
  premium:     '#2D2820',
  ink:         '#F4EFE6',
  ink2:        '#A89F90',
  ink3:        '#6B6358',
  border:      '#3A3328',
  borderSoft:  '#2F2A21',
  prussian:    '#6892B5',
  bronze:      '#C9A663',
  bronzeDeep:  '#9B7A3F',
  bronzeLight: '#D4B57A',
  recRed:      '#C9505F',
  recRedOxide: '#C9505F',
  recRedMuted: '#A85261',
  moss:        '#7A9A65',
  amber:       '#C9A07A',
  domBlackink: '#6892B5',
  domAtlas:    '#B6A6E8',
  domSaude:    '#7A9A65',
  domFinancas: '#C9A663',
  domOutro:    '#A89F90',
  pureBlack:   '#000000',
  onInk:       '#1C1916',
}

export const palettes: Record<ThemeName, AtlasPalette> = {
  light: lightPalette,
  dark:  darkPalette,
}

// Spatial system — 4pt baseline.
export const space = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  22,
  xxl: 28,
  xxxl: 36,
} as const

export const radii = {
  chip: 20,
  card: 12,
  bigCard: 14,
  modal: 20,
  sheet: 22,
  pill:  999,
  full:  9999,
} as const

// Typography scale — Fraunces (display/contemplative), Inter (functional), JetBrains Mono (data).
export const fonts = {
  serif:  'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifMd: 'Fraunces_500Medium',
  sans:   'Inter_400Regular',
  sansMd: 'Inter_500Medium',
  sansSb: 'Inter_600SemiBold',
  sansBd: 'Inter_700Bold',
  mono:   'JetBrainsMono_400Regular',
  monoMd: 'JetBrainsMono_500Medium',
} as const

// Motion tokens · consolidados v5+ (Apple SwiftUI springs + Aesop assentamento + Hermès breathing)
// Easings como tuples Bezier — para usar com Reanimated `Easing.bezier(...spread)`.
export const ease = {
  editorial:  [0.22, 1, 0.36, 1] as const,    // default tween (quart-out)
  ceremonial: [0.16, 1, 0.3, 1] as const,     // page load, sheets (expo-out)
  iOSSmooth:  [0.32, 0.72, 0, 1] as const,    // layout shifts
  exit:       [0.4, 0, 1, 1] as const,        // dismiss (in-quart)
  hermes:     [0.45, 0, 0.55, 1] as const,    // breathing sin-like
} as const

export const dur = {
  instinct:   180,
  considered: 320,
  ceremonial: 480,
  sacred:     620,  // captura saved
} as const

// Spring configs · Reanimated `withSpring(value, config)`.
// Bounce máximo do sistema = 0.25. Acima é Material/Duolingo.
export const spring = {
  gestural: { damping: 22, stiffness: 280, mass: 1 },   // swipe, drag
  sheet:    { damping: 24, stiffness: 250, mass: 1 },   // bottom sheets
  toast:    { damping: 22, stiffness: 270, mass: 1 },   // notifications
  overdamped: { damping: 32, stiffness: 280, mass: 1 }, // pill morph (recording)
} as const

export const type = {
  displayXl: { family: fonts.serif, size: 56, lineHeight: 56,  letterSpacing: -1.7 },
  displayLg: { family: fonts.serif, size: 42, lineHeight: 44,  letterSpacing: -1.05 },
  displayMd: { family: fonts.serif, size: 32, lineHeight: 35,  letterSpacing: -0.64 },
  greet:     { family: fonts.serif, size: 38, lineHeight: 40,  letterSpacing: -0.95 },
  fraunces22:{ family: fonts.serif, size: 22, lineHeight: 28,  letterSpacing: -0.44 },
  fraunces20:{ family: fonts.serif, size: 20, lineHeight: 28,  letterSpacing: -0.3 },
  fraunces18:{ family: fonts.serif, size: 18, lineHeight: 26 },
  fraunces17:{ family: fonts.serif, size: 17, lineHeight: 26 },
  fraunces15:{ family: fonts.serif, size: 15, lineHeight: 22 },
  fraunces14:{ family: fonts.serif, size: 14, lineHeight: 20 },
  titleFn:   { family: fonts.sansSb, size: 22, lineHeight: 27, letterSpacing: -0.22 },
  body17:    { family: fonts.sans,   size: 17, lineHeight: 26 },
  body16:    { family: fonts.sans,   size: 16, lineHeight: 25 },
  body15:    { family: fonts.sans,   size: 15, lineHeight: 22 },
  body14:    { family: fonts.sans,   size: 14, lineHeight: 21 },
  body13:    { family: fonts.sans,   size: 13, lineHeight: 18 },
  body12:    { family: fonts.sans,   size: 12, lineHeight: 17 },
  label:     { family: fonts.sansMd, size: 11, lineHeight: 14, letterSpacing: 1.1 },
  mono14:    { family: fonts.mono,   size: 14, lineHeight: 20 },
  mono13:    { family: fonts.mono,   size: 13, lineHeight: 18 },
  mono12:    { family: fonts.mono,   size: 12, lineHeight: 16 },
  mono11:    { family: fonts.mono,   size: 11, lineHeight: 14 },
  capCounter:{ family: fonts.monoMd, size: 56, lineHeight: 56, letterSpacing: -1.1 },
} as const
