import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { POST as assistantHandler } from './api/assistant.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Las variables del .env (claves de IA opcionales, modelos) quedan disponibles para api/assistant.ts, igual que en Vercel.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) process.env[key] ??= value

  return {
    plugins: [
      react(),
      {
        // En desarrollo, /api/assistant usa exactamente el mismo código que la función serverless de producción.
        name: 'aura-assistant-api',
        configureServer(server) {
          server.middlewares.use('/api/assistant', async (request, response) => {
            if (request.method !== 'POST') {
              response.statusCode = 405
              response.setHeader('Allow', 'POST')
              response.end('Method not allowed')
              return
            }

            const chunks: Buffer[] = []
            for await (const chunk of request) chunks.push(Buffer.from(chunk))

            const headers = new Headers()
            for (const [name, value] of Object.entries(request.headers)) {
              if (typeof value === 'string') headers.set(name, value)
            }

            const result = await assistantHandler(
              new Request(`http://${request.headers.host || 'localhost'}/api/assistant`, { method: 'POST', headers, body: Buffer.concat(chunks) }),
            )

            response.statusCode = result.status
            result.headers.forEach((value, name) => response.setHeader(name, value))
            response.end(await result.text())
          })
        },
      },
    ],
  }
})
