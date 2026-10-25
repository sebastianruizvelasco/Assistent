// Proxy de IA de AURA para DESARROLLO: vite.config.ts lo monta como /api/assistant en `npm run dev`.
// En producción (InfinityFree) el mismo endpoint lo atiende public/api/assistant.php, que replica esta lógica:
// si cambias una, cambia la otra. No importa nada del proyecto, así que también podría desplegarse como
// función serverless (Vercel, Netlify...) si algún día cambias de hosting.

const SYSTEM_PROMPT =
  'Eres AURA, un asistente de calendario en español. Responde de forma breve y útil. Puedes sugerir cambios, pero no inventes eventos ni confirmes cambios que el usuario no haya pedido.'

const MAX_MESSAGES = 60
const MAX_CONTENT_LENGTH = 40_000
const MAX_BODY_BYTES = 400_000
const UPSTREAM_TIMEOUT_MS = 45_000

type ProviderName = 'openrouter' | 'openai' | 'gemini' | 'anthropic'
type ChatMessage = { role: string; content: string }

const PROVIDERS: Record<ProviderName, { envKey: string; envModel: string; defaultModel: string }> = {
  openrouter: { envKey: 'OPENROUTER_API_KEY', envModel: 'OPENROUTER_MODEL', defaultModel: 'openai/gpt-4o-mini' },
  openai: { envKey: 'OPENAI_API_KEY', envModel: 'OPENAI_MODEL', defaultModel: 'gpt-4o-mini' },
  gemini: { envKey: 'GEMINI_API_KEY', envModel: 'GEMINI_MODEL', defaultModel: 'gemini-2.0-flash' },
  anthropic: { envKey: 'ANTHROPIC_API_KEY', envModel: 'ANTHROPIC_MODEL', defaultModel: 'claude-3-5-haiku-20241022' },
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

const isProvider = (value: string): value is ProviderName => value in PROVIDERS

// Quita mensajes mal formados y recorta tamaños para que el endpoint no se pueda abusar con cargas enormes.
const sanitizeMessages = (input: unknown): ChatMessage[] => {
  if (!Array.isArray(input)) return []
  return input
    .filter((item): item is ChatMessage => Boolean(item) && typeof item === 'object' && typeof (item as ChatMessage).role === 'string' && typeof (item as ChatMessage).content === 'string')
    .slice(-MAX_MESSAGES)
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content.slice(0, MAX_CONTENT_LENGTH) }))
}

const readJson = async (response: Response): Promise<Record<string, any>> => {
  try {
    return (await response.json()) as Record<string, any>
  } catch {
    return {}
  }
}

const upstreamError = (data: Record<string, any>) => {
  const raw = data?.error
  if (typeof raw === 'string') return raw
  if (raw && typeof raw.message === 'string') return raw.message
  return 'El proveedor de IA no devolvió una respuesta válida.'
}

export async function POST(request: Request): Promise<Response> {
  const env = process.env

  let body: { provider?: unknown; apiKey?: unknown; model?: unknown; messages?: unknown }
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'La solicitud es demasiado grande.' })
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'La solicitud no es un JSON válido.' })
  }

  const requested = String(body.provider || 'openrouter').toLowerCase()
  const provider: ProviderName = isProvider(requested) ? requested : 'openrouter'
  const config = PROVIDERS[provider]

  // La clave que escribe el usuario en el panel tiene prioridad; la del servidor solo es un respaldo opcional.
  const apiKey = (typeof body.apiKey === 'string' ? body.apiKey.trim() : '') || env[config.envKey] || ''
  if (!apiKey) {
    return json(503, { error: `Falta configurar la clave API de ${provider.toUpperCase()} en el panel del asistente.` })
  }

  const model = (typeof body.model === 'string' ? body.model.trim() : '') || env[config.envModel] || config.defaultModel
  if (model.length > 200 || !/^[\w.:/-]+$/.test(model)) {
    return json(400, { error: 'El nombre del modelo no es válido.' })
  }

  const messages = sanitizeMessages(body.messages)
  const origin = request.headers.get('origin') || env.SITE_URL || 'http://localhost:5173'
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)

  try {
    let upstream: Response
    if (provider === 'openrouter' || provider === 'openai') {
      upstream = await fetch(provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(provider === 'openrouter' ? { 'HTTP-Referer': origin, 'X-Title': 'AURA Assistant' } : {}),
        },
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: 800, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages] }),
      })
    } else if (provider === 'anthropic') {
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 800, system: SYSTEM_PROMPT, messages }),
      })
    } else {
      const contents = messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }))
      upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: contents.length ? contents : [{ role: 'user', parts: [{ text: 'Hola' }] }],
        }),
      })
    }

    const data = await readJson(upstream)
    if (!upstream.ok || data?.error) {
      const authFailed = upstream.status === 401 || upstream.status === 403
      return json(authFailed ? 401 : 502, { error: upstreamError(data) })
    }

    const reply =
      provider === 'anthropic'
        ? data.content?.[0]?.text
        : provider === 'gemini'
          ? data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('')
          : data.choices?.[0]?.message?.content

    if (!reply) return json(502, { error: 'No pude obtener una respuesta del proveedor de IA.' })
    return json(200, { reply })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return json(timedOut ? 504 : 502, { error: timedOut ? 'El proveedor de IA tardó demasiado en responder.' : 'No pude conectar con el proveedor de IA.' })
  }
}
