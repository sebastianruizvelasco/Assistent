import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
  plugins: [react(), {
    name: 'aura-assistant-api',
    configureServer(server) {
      server.middlewares.use('/api/assistant', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end('Method not allowed')
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          provider?: string
          apiKey?: string
          model?: string
          messages?: Array<{ role: string; content: string }>
        }

        const requestedProvider = (body.provider || 'openrouter').toLowerCase()
        const providerApiKey = (body.apiKey || '').trim()
        const providerDefaults = {
          openrouter: { envKey: 'OPENROUTER_API_KEY', model: env.OPENROUTER_MODEL || 'openai/gpt-4o-mini', url: 'https://openrouter.ai/api/v1/chat/completions', headers: { 'HTTP-Referer': 'http://127.0.0.1:5173', 'X-Title': 'AURA Assistant' } },
          openai: { envKey: 'OPENAI_API_KEY', model: env.OPENAI_MODEL || 'gpt-4o-mini', url: 'https://api.openai.com/v1/chat/completions', headers: {} },
          gemini: { envKey: 'GEMINI_API_KEY', model: env.GEMINI_MODEL || 'gemini-2.0-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models', headers: {} },
          anthropic: { envKey: 'ANTHROPIC_API_KEY', model: env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022', url: 'https://api.anthropic.com/v1/messages', headers: { 'anthropic-version': '2023-06-01' } },
        } as const
        const providerConfig = providerDefaults[requestedProvider as keyof typeof providerDefaults] || providerDefaults.openrouter
        const apiKey = providerApiKey || env[providerConfig.envKey as keyof typeof env]

        if (!apiKey) {
          response.statusCode = 503
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: `Falta configurar la clave API de ${requestedProvider.toUpperCase()} en la app o en el entorno del servidor.` }))
          return
        }

        const messages = body.messages || []
        const requestedModel = (body.model || providerConfig.model).trim()

        let result: any
        if (requestedProvider === 'openrouter' || requestedProvider === 'openai') {
          const targetUrl = requestedProvider === 'openrouter' ? providerConfig.url : 'https://api.openai.com/v1/chat/completions'
          const payload = requestedProvider === 'openrouter'
            ? {
                model: requestedModel,
                temperature: 0.3,
                max_tokens: 800,
                messages: [
                  { role: 'system', content: 'Eres AURA, un asistente de calendario en español. Responde de forma breve y útil. Puedes sugerir cambios, pero no inventes eventos ni confirmes cambios que el usuario no haya pedido.' },
                  ...messages,
                ],
              }
            : {
                model: requestedModel,
                temperature: 0.3,
                max_tokens: 800,
                messages: [
                  { role: 'system', content: 'Eres AURA, un asistente de calendario en español. Responde de forma breve y útil.' },
                  ...messages,
                ],
              }

          const openAiResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
              ...(requestedProvider === 'openrouter' ? { 'HTTP-Referer': 'http://127.0.0.1:5173', 'X-Title': 'AURA Assistant' } : {}),
            },
            body: JSON.stringify(payload),
          })
          result = await openAiResponse.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
        } else if (requestedProvider === 'anthropic') {
          const anthropicResponse = await fetch(providerConfig.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: requestedModel,
              max_tokens: 800,
              system: 'Eres AURA, un asistente de calendario en español. Responde de forma breve y útil. Puedes sugerir cambios, pero no inventes eventos ni confirmes cambios que el usuario no haya pedido.',
              messages: messages.map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content })),
            }),
          })
          result = await anthropicResponse.json() as { content?: Array<{ text?: string }>; error?: { message?: string } }
        } else if (requestedProvider === 'gemini') {
          const refreshInput = messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }))
          const geminiResponse = await fetch(`${providerConfig.url}/${requestedModel}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: 'Eres AURA, un asistente de calendario en español. Responde de forma breve y útil. Puedes sugerir cambios, pero no inventes eventos ni confirmes cambios que el usuario no haya pedido.' }] },
              contents: refreshInput.length ? refreshInput : [{ role: 'user', parts: [{ text: 'Hola' }] }],
            }),
          })
          result = await geminiResponse.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } }
        }

        const reply = requestedProvider === 'anthropic'
          ? result.content?.[0]?.text || result.error?.message || 'No pude obtener una respuesta.'
          : requestedProvider === 'gemini'
            ? result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || result.error?.message || 'No pude obtener una respuesta.'
            : result.choices?.[0]?.message?.content || result.error?.message || 'No pude obtener una respuesta.'

        response.statusCode = requestedProvider === 'anthropic' ? (result.error ? 400 : 200) : 200
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ reply }))
      })
    },
  }],
  }
})
