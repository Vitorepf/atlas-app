/**
 * Cartografia · universe scene · os 6 continentes do Vault.
 *
 * Primeira cena visível ao abrir a Cartografia. Atoms em coords curados
 * (`UNIVERSE_CONTINENTS` em `map/layout.ts`). Sem trails — universo é
 * geografia, conexões entre continentes não fazem sentido visual aqui;
 * conexões aparecem dentro de cada continente (flow scene).
 */
import { ContinentAtom } from '../map/ContinentAtom'
import { UniverseTrails } from '../map/UniverseTrails'
import { UNIVERSE_CONTINENTS, type LodLevel } from '../map/layout'

interface Props {
  lod: LodLevel
  onContinentPress: (id: string) => void
  /** Long-press = abre peek preview · canon iOS 3D Touch ancestor */
  onContinentLongPress?: (id: string) => void
}

export function UniverseScene({ lod, onContinentPress, onContinentLongPress }: Props) {
  return (
    <>
      {/* Trails primeiro (atrás dos atoms) · Atlas central irradia
          pra cada lateral. Pulse vivo via Animated.View wrapper. */}
      <UniverseTrails />
      {UNIVERSE_CONTINENTS.map((continent, i) => (
        <ContinentAtom
          key={continent.id}
          continent={continent}
          lod={lod}
          onPress={onContinentPress}
          onLongPress={onContinentLongPress}
          // Atlas sempre primeiro (centro do mundo); orbitais entram depois
          revealIndex={continent.id === 'atlas' ? 0 : i + 1}
        />
      ))}
    </>
  )
}
