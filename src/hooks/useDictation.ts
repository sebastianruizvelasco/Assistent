import { useCallback, useEffect, useRef, useState } from 'react'

// Dictado con la Web Speech API del navegador. No hay servidor ni clave: el audio lo procesa
// el propio navegador (Chrome/Edge lo envían a su servicio de reconocimiento).

type SpeechRecognitionAlternativeLike = { transcript: string }
type SpeechRecognitionResultLike = {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}
type SpeechRecognitionEventLike = {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

// El constructor no está en los tipos estándar de TypeScript: en Chrome/Edge es `webkitSpeechRecognition`.
const getRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null
}

const errorMessage = (code: string) => {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'El navegador bloqueó el micrófono. Permite el acceso desde la barra de direcciones.'
  if (code === 'no-speech') return 'No te he oído. Pulsa el micrófono y vuelve a intentarlo.'
  if (code === 'audio-capture') return 'No encontré ningún micrófono conectado.'
  if (code === 'network') return 'El dictado necesita conexión y no pudo conectar.'
  return 'No pude dictar tu mensaje. Vuelve a intentarlo o escríbelo.'
}

type UseDictationParams = {
  onTranscript: (text: string) => void
  onError: (message: string) => void
  lang?: string
}

// Devuelve si el navegador admite dictado y el estado de la escucha.
export function useDictation({ onTranscript, onError, lang = 'es-ES' }: UseDictationParams) {
  const [supported] = useState(() => Boolean(getRecognition()))
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const callbacksRef = useRef({ onTranscript, onError })

  useEffect(() => { callbacksRef.current = { onTranscript, onError } })

  const stop = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    try { recognition.stop() } catch { /* la escucha ya había terminado */ }
  }, [])

  const start = useCallback(() => {
    const Recognition = getRecognition()
    if (!Recognition) {
      callbacksRef.current.onError('Este navegador no admite dictado por voz. Prueba Chrome o Edge, o escribe la instrucción.')
      return
    }
    if (recognitionRef.current) return
    const recognition = new Recognition()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onresult = (event) => {
      let final = ''
      let partial = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (!result) continue
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) final += transcript
        else partial += transcript
      }
      setInterim(partial)
      if (final.trim()) {
        setInterim('')
        callbacksRef.current.onTranscript(final.trim())
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      callbacksRef.current.onError(errorMessage(event.error))
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      setInterim('')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      callbacksRef.current.onError('No pude activar el micrófono. Inténtalo de nuevo.')
    }
  }, [lang])

  const toggle = useCallback(() => {
    if (recognitionRef.current) stop()
    else start()
  }, [start, stop])

  // Corta el micrófono si el componente desaparece (cambio de sección, cierre de sesión…).
  useEffect(() => () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      try { recognition.abort() } catch { /* el navegador ya lo había cerrado */ }
    }
  }, [])

  return { supported, listening, interim, start, stop, toggle }
}
