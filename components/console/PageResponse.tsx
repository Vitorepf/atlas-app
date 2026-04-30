import { StyleSheet } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { EditorialMarkdown } from './EditorialMarkdown'

type Tone = 'operational' | 'contemplative' | 'error'

interface Props {
  text: string
  tone?: Tone
}

// Atlas's response rendered as a page of body text — no card, no badge,
// no surrounding box. Sits directly on the paper surface. Markdown emitted
// by the model is parsed and rendered through Atlas typography (italic =
// oralidade, bold = peso, mono = registro). Errors stay as a single italic
// line in recRed; no markdown parsing for that path.
//
// Arrives with a soft fade-in + 12px translateY drop — the page "descends"
// onto the surface rather than appearing.
export function PageResponse({ text, tone = 'operational' }: Props) {
  const c = usePalette()
  return (
    <Animated.View
      entering={FadeInDown.duration(420).springify().damping(20).mass(0.85)}
      style={styles.body}
    >
      {tone === 'error' ? (
        <Frau italic size={15} lineHeight={22} color={c.recRed}>
          {text}
        </Frau>
      ) : (
        <EditorialMarkdown text={text} tone={tone} />
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: 4,
  },
})
