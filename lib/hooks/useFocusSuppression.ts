import { useCallback, useEffect, useRef, useState } from 'react'

// iOS UITextView herda de UIScrollView e mantém um UITextTapRecognizer interno
// vivo mesmo com scrollEnabled={false}. Quando o usuário arrasta para fechar o
// teclado dentro do input, o "touch end" cai dentro do UITextView e o UIKit
// reativa becomeFirstResponder — independente de blur()/Keyboard.dismiss().
//
// A receita comprovada: setar editable=false por ~80ms durante o blur. Isso
// faz a UITextView responder NO ao becomeFirstResponder, matando o tap
// recognizer pendente. 80ms é suficiente para o gesture end sair da fila do
// UIKit; menor que isso e o tap recognizer ainda dispara; maior e o usuário
// sente lag se tentar tocar imediatamente.
export function useFocusSuppression(durationMs = 80) {
  const [editable, setEditable] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const suppress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setEditable(false)
    timerRef.current = setTimeout(() => {
      setEditable(true)
      timerRef.current = null
    }, durationMs)
  }, [durationMs])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return { editable, suppress }
}
