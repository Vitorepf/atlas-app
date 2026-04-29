// Atlas design tokens — warm-premium identity (Parfums de Marly / Aesop, not Linear).

export type ThemeName = 'light' | 'dark'

export interface AtlasPalette {
  // Surfaces
  bg: string
  surface: string
  premium: string
  // Ink
  ink: string
  ink2: string
  ink3: string
  border: string
  // Accents
  prussian: string
  bronze: string
  recRed: string
  moss: string
  // Domains
  domBlackink: string
  domSaude: string
  domFinancas: string
  domOutro: string
  // Status bar / dynamic island
  pureBlack: string
  // Inverted ink for buttons painted on ink color
  onInk: string
}

export const lightPalette: AtlasPalette = {
  bg:        '#F4EFE6',
  surface:   '#EAE3D6',
  premium:   '#E0D8C9',
  ink:       '#1A1612',
  ink2:      '#6B6358',
  ink3:      '#A89F90',
  border:    '#D4CCBC',
  prussian:  '#1B3A57',
  bronze:    '#9B7A3F',
  recRed:    '#8B2635',
  moss:      '#4A5D3A',
  domBlackink: '#1B3A57',
  domSaude:    '#4A5D3A',
  domFinancas: '#9B7A3F',
  domOutro:    '#6B6358',
  pureBlack:   '#000000',
  onInk:       '#F4EFE6',
}

export const darkPalette: AtlasPalette = {
  bg:        '#1C1916',
  surface:   '#252119',
  premium:   '#2D2820',
  ink:       '#F4EFE6',
  ink2:      '#A89F90',
  ink3:      '#6B6358',
  border:    '#3A3328',
  prussian:  '#6892B5',
  bronze:    '#C9A663',
  recRed:    '#C9505F',
  moss:      '#7A9A65',
  domBlackink: '#6892B5',
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
