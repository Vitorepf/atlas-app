import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  hash: string
}

// Short merge hash chip · Mono bronze "#" + first 7 chars. The caller hides this
// entirely when merge_performed is false / hash is empty (no fabricated merge).
export function MergeHashChip({ hash }: Props) {
  const c = usePalette()
  const short = hash.trim().slice(0, 7)
  if (short === '') return null
  return (
    <Mono size={11} lineHeight={16} letterSpacing={0.2} color={c.bronze}>
      {`#${short}`}
    </Mono>
  )
}
