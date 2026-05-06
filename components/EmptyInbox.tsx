import { StyleSheet, View } from 'react-native'
import { Frau } from '../design/Type'
import { useTheme } from '../design/theme'

// Empty states editoriais · voz Atlas adaptativa, sem CTA.
// Apenas hairline ornamentado e voz Frau italic — Cap. 0 v6: Inbox é caderno, não fila.

interface Props {
  variant?:
    | 'inbox'
    | 'open'
    | 'no_destination'
    | 'candidate'
    | 'proposal'
    | 'snoozed'
    | 'failed'
    | 'pending'
    | 'routed'
    | 'archived'
}

const VOICES: Record<NonNullable<Props['variant']>, { line: string; sub: string }> = {
  inbox:          { line: 'o dia ainda está por dizer.',           sub: 'capture o primeiro fragmento abaixo. áudio, texto ou foto.' },
  open:           { line: 'nada aberto agora.',                    sub: 'tudo o que veio já tem destino.' },
  no_destination: { line: 'todas têm casa.',                       sub: 'nenhuma captura sem domínio aguarda.' },
  candidate:      { line: 'nenhuma candidata por enquanto.',       sub: 'aclare uma captura aberta para que ela apareça aqui.' },
  proposal:       { line: 'sem propostas pendentes.',              sub: 'atlas vai curar essa noite às 02:00.' },
  snoozed:        { line: 'nada adiado.',                          sub: 'presente limpo.' },
  failed:         { line: 'sem falhas.',                           sub: 'transcrição em ordem.' },
  pending:        { line: 'sem pendências.',                       sub: 'todas as capturas terminaram de processar.' },
  routed:         { line: 'nenhuma roteada ainda.',                sub: 'a primeira virá quando você promover.' },
  archived:       { line: 'nada arquivado.',                       sub: 'dataset sagrado preserva tudo · soft-delete sempre.' },
}

export function EmptyInbox({ variant = 'inbox' }: Props) {
  const { c } = useTheme()
  const voice = VOICES[variant] ?? VOICES.inbox
  return (
    <View style={styles.wrap}>
      <Frau italic size={22} lineHeight={28} letterSpacing={-0.22} color={c.ink3} style={styles.ornament}>
        —
      </Frau>
      <Frau
        italic
        size={22}
        lineHeight={32}
        letterSpacing={-0.26}
        color={c.ink}
        align="left"
        style={styles.line}
      >
        {voice.line}
      </Frau>
      <Frau
        italic
        size={14.5}
        lineHeight={21}
        letterSpacing={-0.07}
        color={c.ink2}
        align="left"
        style={styles.subline}
      >
        {voice.sub}
      </Frau>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: 'flex-start',
  },
  ornament: {
    opacity: 0.4,
    marginBottom: 12,
  },
  line: {
    maxWidth: 320,
  },
  subline: {
    marginTop: 10,
    maxWidth: 320,
    opacity: 0.85,
  },
})
