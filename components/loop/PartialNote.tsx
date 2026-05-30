import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  returned: number
  total: number
}

// "mostrando {returned} de {total}" — the calm honesty footer under every
// capped list. Moved verbatim from the local helper in app/loop.tsx so the
// screen and LoadMoreList share one renderer. Mono 11 ink3, 32px rail.
export function PartialNote({ returned, total }: Props) {
  const c = usePalette()
  return (
    <Mono size={11} lineHeight={15} color={c.ink3} style={{ marginHorizontal: 32, marginTop: 8 }}>
      {`mostrando ${returned} de ${total}`}
    </Mono>
  )
}
