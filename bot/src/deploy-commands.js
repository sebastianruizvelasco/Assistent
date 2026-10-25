// Publica los comandos en Discord. Ejecuta: npm run deploy-commands
// Con DISCORD_GUILD_ID aparecen al instante en ese servidor; sin él, globalmente (hasta 1 h).

import { REST, Routes } from 'discord.js'
import { commands } from './commands.js'

const token = process.env.DISCORD_TOKEN
const appId = process.env.DISCORD_APP_ID
const guildId = process.env.DISCORD_GUILD_ID

if (!token || !appId) {
  console.error('Faltan DISCORD_TOKEN o DISCORD_APP_ID en bot/.env')
  process.exit(1)
}

const rest = new REST({ version: '10' }).setToken(token)

try {
  const route = guildId ? Routes.applicationGuildCommands(appId, guildId) : Routes.applicationCommands(appId)
  const data = await rest.put(route, { body: commands })
  console.log(`Listo: ${data.length} comandos registrados ${guildId ? `en el servidor ${guildId}` : 'globalmente'}.`)
} catch (error) {
  console.error('No pude registrar los comandos:', error.message)
  process.exit(1)
}
