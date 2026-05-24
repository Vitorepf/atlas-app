import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Appearance } from 'react-native'
import { atlasStorage } from '../lib/storage'
import { palettes, type AtlasPalette, type ThemeName } from './tokens'

type ThemeMode = 'light' | 'dark' | 'auto'

interface AtlasThemeContextValue {
  name: ThemeName
  mode: ThemeMode
  c: AtlasPalette
  setMode: (m: ThemeMode) => void
  toggle: () => void
}

const AtlasThemeContext = createContext<AtlasThemeContextValue | null>(null)

const STORAGE_KEY = 'atlas-theme.mode'

function resolveName(mode: ThemeMode): ThemeName {
  if (mode === 'auto') return Appearance.getColorScheme() === 'light' ? 'light' : 'dark'
  return mode
}

interface AtlasThemeProviderProps {
  children: ReactNode
}

export function AtlasThemeProvider({ children }: AtlasThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>('dark')
  const [name, setName] = useState<ThemeName>(resolveName('dark'))

  // Hydrate from disk on first render.
  useEffect(() => {
    let cancelled = false
    atlasStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return
      const m = (stored ?? 'dark') as ThemeMode
      setModeState(m)
      setName(resolveName(m))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Follow system color scheme when mode is auto.
  useEffect(() => {
    if (mode !== 'auto') return
    const sub = Appearance.addChangeListener(() => setName(resolveName('auto')))
    return () => sub.remove()
  }, [mode])

  const setMode = useCallback((m: ThemeMode) => {
    atlasStorage.setItem(STORAGE_KEY, m).catch(() => {})
    setModeState(m)
    setName(resolveName(m))
  }, [])

  const toggle = useCallback(() => {
    const next: ThemeMode = name === 'dark' ? 'light' : 'dark'
    setMode(next)
  }, [name, setMode])

  const value = useMemo<AtlasThemeContextValue>(
    () => ({ name, mode, c: palettes[name], setMode, toggle }),
    [name, mode, setMode, toggle],
  )

  return <AtlasThemeContext.Provider value={value}>{children}</AtlasThemeContext.Provider>
}

export function useTheme(): AtlasThemeContextValue {
  const v = useContext(AtlasThemeContext)
  if (!v) throw new Error('useTheme must be used within AtlasThemeProvider')
  return v
}

export function usePalette(): AtlasPalette {
  return useTheme().c
}
