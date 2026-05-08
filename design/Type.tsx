import { Text, type StyleProp, type TextStyle } from 'react-native'
import { type ReactNode } from 'react'
import { usePalette } from './theme'
import { fonts } from './tokens'

interface BaseProps {
  children?: ReactNode
  style?: StyleProp<TextStyle>
  numberOfLines?: number
  size?: number
  lineHeight?: number
  letterSpacing?: number
  color?: string
  align?: 'left' | 'center' | 'right'
}

type Weight = 'reg' | 'med' | 'sb' | 'bd'

const sansFamily = (w: Weight | undefined): string => {
  switch (w) {
    case 'med': return fonts.sansMd
    case 'sb':  return fonts.sansSb
    case 'bd':  return fonts.sansBd
    default:    return fonts.sans
  }
}

function buildStyle(
  family: string,
  defaultColor: string,
  { color, size, lineHeight, letterSpacing, align }: BaseProps,
  override?: StyleProp<TextStyle>,
): StyleProp<TextStyle> {
  return [
    {
      fontFamily: family,
      color: color ?? defaultColor,
      ...(size != null && { fontSize: size }),
      ...(lineHeight != null && { lineHeight }),
      ...(letterSpacing != null && { letterSpacing }),
      ...(align != null && { textAlign: align }),
    },
    override,
  ]
}

interface FrauProps extends BaseProps {
  italic?: boolean
  weight?: 'reg' | 'med'
}

// italic + med agora suportado · serifItalicMd carregado em fonts.ts
// (necessário pra ativos do Dock matchearem F's font-weight: 500 italic).
export function Frau({
  children,
  italic,
  weight,
  style,
  numberOfLines,
  ...rest
}: FrauProps) {
  const c = usePalette()
  const family = italic
    ? weight === 'med'
      ? fonts.serifItalicMd
      : fonts.serifItalic
    : weight === 'med'
      ? fonts.serifMd
      : fonts.serif
  return (
    <Text numberOfLines={numberOfLines} style={buildStyle(family, c.ink, rest, style)}>
      {children}
    </Text>
  )
}

interface SansProps extends BaseProps {
  weight?: Weight
}

export function Sans({
  children,
  weight = 'reg',
  style,
  numberOfLines,
  ...rest
}: SansProps) {
  const c = usePalette()
  return (
    <Text
      numberOfLines={numberOfLines}
      style={buildStyle(sansFamily(weight), c.ink, rest, style)}
    >
      {children}
    </Text>
  )
}

interface MonoProps extends BaseProps {
  weight?: 'reg' | 'med'
}

export function Mono({
  children,
  weight = 'reg',
  style,
  numberOfLines,
  ...rest
}: MonoProps) {
  const c = usePalette()
  const family = weight === 'med' ? fonts.monoMd : fonts.mono
  return (
    <Text
      numberOfLines={numberOfLines}
      style={buildStyle(family, c.ink2, rest, style)}
    >
      {children}
    </Text>
  )
}

export function Label({
  children,
  style,
  numberOfLines,
  ...rest
}: BaseProps) {
  const c = usePalette()
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: fonts.sansMd,
          color: rest.color ?? c.ink2,
          fontSize: 11,
          lineHeight: 14,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          ...(rest.align != null && { textAlign: rest.align }),
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}
