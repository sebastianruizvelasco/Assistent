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

const browserName = () => {
  if (typeof navigator === 'undefined') return 'tu navegador'
  const agent = navigator.userAgent
  if (/Firefox\//.test(agent)) return 'Firefox'
  if (/Edg\//.test(agent)) return 'Edge'
  if (/OPR\//.test(agent)) return 'Opera'
  if (/Chrome\//.test(agent)) return 'Chrome'
  if (/Safari\//.test(agent)) return 'Safari'
  return 'tu navegador'
}

const unsupportedMessage = () =>
  `El dictado no está disponible en ${browserName()}. Usa Chrome o Edge actualizados, o escribe la instrucción.`

const errorMessage = (code: string) => {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'El navegador bloqueó el micrófono. Revisa el candado de la barra de direcciones y el permiso del sistema.'
  if (code === 'no-speech') return 'No te he oído. Pulsa el micrófono y vuelve a intentarlo.'
  if (code === 'audio-capture') return 'No encontré ningún micrófono conectado.'
  if (code === 'network') return 'El dictado necesita conexión y no pudo conectar.'
  return 'No pude dictar tu mensaje. Vuelve a intentarlo o escríbelo.'
}

// Espera máxima a que el navegador confirme que empezó a escuchar. Si no llega, se avisa:
// un permiso pendiente o un fallo silencioso no deben quedarse en «no pasa nada».
const START_TIMEOUT_MS = 3000

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

  // Pista única en la consola para saber qué ve el navegador. Sirve para diagnosticar
  // «no pasa nada» sin tener que abrir DevTools a adivinar.
  useEffect(() => {
    console.info(`[AURA dictado] soporte=${supported} navegador=${browserName()} contextoSeguro=${window.isSecureContext}`)
  }, [supported])

  const stop = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    try { recognition.stop() } catch { /* la escucha ya había terminado */ }
  }, [])

  const start = useCallback(() => {
    const Recognition = getRecognition()
    if (!Recognition) {
      callbacksRef.current.onError(unsupportedMessage())
      return
    }
    if (recognitionRef.current) return
    const recognition = new Recognition()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let started = false
    const watchdog = window.setTimeout(() => {
      if (started) return
      callbacksRef.current.onError('El navegador no abrió el micrófono. Acepta el permiso del sitio (candado → Micrófono) y comprueba que ninguna otra pestaña lo esté usando.')
      try { recognition.abort() } catch { /* el navegador ya lo había cerrado */ }
    }, START_TIMEOUT_MS)

    recognition.onstart = () => { started = true; window.clearTimeout(watchdog); setListening(true) }
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
      window.clearTimeout(watchdog)
      if (event.error === 'aborted') return
      // Deja rastro en la consola: distingue permiso denegado, micrófono ocupado o falta de servicio.
      console.warn(`[AURA dictado] error: ${event.error}`)
      callbacksRef.current.onError(errorMessage(event.error))
    }
    recognition.onend = () => {
      window.clearTimeout(watchdog)
      recognitionRef.current = null
      setListening(false)
      setInterim('')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      window.clearTimeout(watchdog)
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
