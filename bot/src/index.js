// Bot de Discord de AURA. Ejecuta: npm start (después de npm run deploy-commands).
// Cada persona vincula su cuenta con /vincular y el bot usa su agenda y su clave de IA.

import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js'
import { applyAssistantAction, buildAssistantContext, buildSeriesCatalog, parseAssistantResult, requestAssistant } from './assistant.js'
import { accountEmail, addEvent, aiSettingsFor, linkDiscordAccount, listEvents, readMemories, removeEvents, resolveUserId, saveEvents, supabase, unlinkDiscordAccount } from './aura.js'
import { dayCalendarPng, weekCalendarPng } from './calendar-image.js'
import { pushConfigured } from './push.js'
import { runReminderPass } from './reminder-runner.js'
import { addDays, findEventsByTitle, humanDate, normalizeDuration, normalizeTime, resolveDate, shortHumanDate, startOfWeekKey, todayKey, weekKeys } from './dates.js'

const token = process.env.DISCORD_TOKEN
if (!token) {
  console.error('Falta DISCORD_TOKEN. Copia bot/.env.example a bot/.env y rellénalo.')
  process.exit(1)
}

const COLOR = 0x5b5bd6
const DONE = 0x37a169
const WARN = 0xd9584f

// Respaldo si la persona todavía no tiene clave guardada en AURA.
const fallbackProvider = process.env.AI_PROVIDER || 'openrouter'
const fallbackModel = process.env.AI_MODEL || 'openai/gpt-6.1-sol'
const fallbackApiKey = process.env.AI_API_KEY || ''
const PROVIDER_ORDER = ['openrouter', 'openai', 'gemini', 'anthropic']

// Historial de conversación por persona (en memoria; se pierde al reiniciar el bot).
const conversations = new Map()

// Recordatorios: el bot ya está encendido, así que revisa la agenda cada minuto y envía
// notificaciones Web Push aunque la web esté cerrada.
const REMINDER_INTERVAL_MS = 60_000
let reminderTimer = null

const startReminderLoop = () => {
  if (!pushConfigured) {
    console.log('Recordatorios push: sin claves VAPID, desactivados.')
    return
  }
  // Si falta la migración, no tiene sentido reintentar cada minuto: se avisa una vez y se para.
  let stopped = false
  const stop = (reason) => {
    stopped = true
    if (reminderTimer) clearInterval(reminderTimer)
    reminderTimer = null
    console.error(`Recordatorios push desactivados: ${reason}`)
  }
  const tick = async () => {
    if (stopped) return
    try {
      const { sent } = await runReminderPass()
      if (sent) console.log(`Recordatorios push enviados: ${sent}`)
    } catch (error) {
      const message = error?.message || ''
      if (/Could not find the table|PGRST205/i.test(message)) {
        stop('falta ejecutar supabase/migrations/0004_push.sql en Supabase.')
        return
      }
      console.error('Recordatorios push:', message)
    }
  }
  // Comprueba las tablas al arrancar: si faltan, mejor saberlo ahora que cuando toque avisar.
  const boot = async () => {
    const { error } = await supabase.from('push_subscriptions').select('endpoint').limit(1)
    if (error) {
      stop(/Could not find the table|PGRST205/i.test(error.message)
        ? 'falta ejecutar supabase/migrations/0004_push.sql en Supabase.'
        : `no pude leer push_subscriptions (${error.message}).`)
      return
    }
    await tick()
    if (stopped) return
    reminderTimer = setInterval(() => { void tick() }, REMINDER_INTERVAL_MS)
    console.log('Recordatorios push: activos (revisión cada minuto).')
  }
  void boot()
}

const byTime = (a, b) => String(a.time ?? '').localeCompare(String(b.time ?? ''))
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const placeOf = (event) => (event.place && event.place !== 'Agenda personal' ? ` · ${event.place}` : '')
const normalizeCode = (value) => String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

const eventLine = (event) => {
  const strike = event.completed ? '~~' : ''
  return `${strike}**${event.time}** ${event.title} (${event.duration || '30 min'})${placeOf(event)}${strike}`
}

const dayEvents = (events, key) => events.filter((event) => event.date === key).sort(byTime)

const dayEmbed = (events, key) => {
  const list = dayEvents(events, key)
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(capitalize(humanDate(key)))
    .setFooter({ text: list.length ? `${list.length} evento${list.length === 1 ? '' : 's'}` : 'Sin eventos' })
  embed.setDescription(list.length ? list.map(eventLine).join('\n') : 'Nada agendado. Disfruta del hueco.')
  return embed
}

const errorEmbed = (message) => new EmbedBuilder().setColor(WARN).setDescription(message)

const linkPrompt = () => 'Este Discord no está vinculado a ninguna cuenta de AURA.\nAbre AURA → tu perfil (arriba a la derecha) → **Vincular Discord** y escribe aquí:\n`vincular CODIGO`\n(o el comando `/vincular codigo:…` en el servidor).'

// Envía textos largos partiendo por líneas: Discord corta los mensajes a 2000 caracteres.
const sendLong = async (target, text) => {
  const chunks = String(text).match(/[\s\S]{1,1900}/g) || ['']
  for (const chunk of chunks) await target.send(chunk)
}

// Detecta «mándame una foto de la agenda», «cómo se ve mi semana», «pásame el calendario».
const IMAGE_HINT = /(imagen|foto|captura|pantallazo|pantalla|\bpng\b|adjunt)/i
const CALENDAR_WORD = /(calendario|agenda|semana|horario|eventos|d[ií]a)/i
const looksLikeImageRequest = (text) => (IMAGE_HINT.test(text) && CALENDAR_WORD.test(text))
  || /(m[aá]nda(me|r)?|env[ií]a(me|r)?|p[aá]sa(me|r)?|mu[eé]stra(me)?|ens[eé]ñame|dame).{0,32}(calendario|agenda|semana|horario)/i.test(text)

const wantsWeek = (text) => /\bsemana\b/i.test(text)

// Genera el PNG del día o de la semana y lo devuelve como adjunto listo para Discord.
const buildCalendarFiles = async ({ userId, dateKey, view }) => {
  const events = await listEvents(userId)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (view === 'week') {
    const start = startOfWeekKey(dateKey || todayKey())
    const days = weekKeys(start).map((key) => ({ key, events: events.filter((event) => event.date === key), isToday: key === todayKey() }))
    return [new AttachmentBuilder(weekCalendarPng({ days, timeZone }), { name: `aura-semana-${start}.png` })]
  }
  const day = dateKey || todayKey()
  return [new AttachmentBuilder(dayCalendarPng({ dateKey: day, events: events.filter((event) => event.date === day), timeZone }), { name: `aura-${day}.png` })]
}

// Próxima hora en punto, para cuando no se indica hora.
const nextHour = () => {
  const now = new Date()
  return `${String((now.getHours() + 1) % 24).padStart(2, '0')}:00`
}

// Núcleo compartido por /aura y por el chat privado: contexto + modelo + acciones aplicadas.
const askAura = async ({ userId, text, historyKey }) => {
  const settings = await aiSettingsFor(userId)
  const provider = PROVIDER_ORDER.find((name) => settings?.[name]?.apiKey) || fallbackProvider
  const ownKey = settings?.[provider]?.apiKey || ''
  const apiKey = ownKey || fallbackApiKey
  const model = settings?.[provider]?.model || fallbackModel
  if (!apiKey) throw new Error('No hay ninguna clave de IA guardada en esta cuenta. Abre AURA con la cuenta vinculada, ve al panel del asistente → ajustes de IA, pega la clave y pulsa Guardar.')

  const events = await listEvents(userId)
  const memories = await readMemories(userId)
  const now = new Date()
  const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const history = conversations.get(historyKey) || []
  const context = buildAssistantContext({
    localDate: todayKey(),
    localTime,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    seriesCatalog: buildSeriesCatalog(events),
    events,
    memories,
    text,
  })
  const raw = await requestAssistant({ provider, model, apiKey, messages: [...history, { role: 'user', content: context }] })
  const result = parseAssistantResult(raw)
  const applied = applyAssistantAction({ result, events, now })
  if (applied.changed) await saveEvents(userId, applied.events)
  conversations.set(historyKey, [...history, { role: 'user', content: text }, { role: 'assistant', content: applied.reply }].slice(-20))
  return { reply: applied.reply, changed: applied.changed, ownKey, provider }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // Chat privado: leer el texto de los mensajes es un intent privilegiado que hay que
    // activar en el portal (Bot → Privileged Gateway Intents → Message Content Intent).
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // Los canales de DM no llegan en caché: sin esto el bot no ve el primero de la conversación.
  partials: [Partials.Channel],
})

client.once(Events.ClientReady, (ready) => {
  console.log(`AURA en Discord: conectado como ${ready.user.tag} (${ready.guilds.cache.size} servidores).`)
  const logChannel = process.env.DISCORD_LOG_CHANNEL_ID
  if (logChannel) {
    const channel = ready.channels.cache.get(logChannel)
    if (channel?.isTextBased()) void channel.send('AURA está en línea. Vincula tu cuenta desde la web y prueba `/agenda`.').catch(() => undefined)
  }
  startReminderLoop()
})

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return
    const isDm = message.channel.isDMBased()
    // Un canal concreto es opcional; por defecto el chat vive en privado.
    if (!isDm && message.channel.id !== (process.env.DISCORD_CHAT_CHANNEL_ID || '')) return
    const text = message.content.trim()
    if (!text) return

    // Vinculación escrita a mano, para no depender de los comandos de barra en privado.
    const linkMatch = text.match(/^\/?vincular\s+([A-Za-z0-9-]+)$/i)
    if (linkMatch) {
      const result = await linkDiscordAccount({ discordUserId: message.author.id, code: normalizeCode(linkMatch[1]) })
      if (!result.ok) {
        await message.reply(result.reason === 'expired'
          ? 'Ese código caducó. Genera otro en AURA → perfil → Vincular Discord.'
          : 'No existe ningún código así. Revisa que lo copiaste completo.')
        return
      }
      const email = await accountEmail(result.userId)
      await message.reply(`Listo${email ? `, este Discord usará la agenda de **${email}**` : ''}. Ya puedes hablarme con normalidad.`)
      return
    }

    if (/^\/?desvincular\s*$/i.test(text)) {
      await unlinkDiscordAccount(message.author.id)
      await message.reply('Vínculo eliminado. Ya no tengo acceso a tu agenda.')
      return
    }

    const userId = await resolveUserId(message.author.id)
    if (!userId) {
      await message.reply(linkPrompt())
      return
    }

    await message.channel.sendTyping()
    if (looksLikeImageRequest(text)) {
      const isWeek = wantsWeek(text)
      const dateKey = isWeek ? todayKey() : (/mañana|manana/i.test(text) ? addDays(todayKey(), 1) : todayKey())
      const files = await buildCalendarFiles({ userId, dateKey, view: isWeek ? 'week' : 'day' })
      await message.reply({ files })
      return
    }
    const { reply } = await askAura({ userId, text, historyKey: message.author.id })
    await sendLong(message.channel, reply)
  } catch (error) {
    console.error('Error en el chat privado:', error)
    await message.reply(`Algo falló: ${error.message}`).catch(() => undefined)
  }
})

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Botones de confirmación de borrado.
    if (interaction.isButton() && interaction.customId.startsWith('aura:borrar:')) {
      const userId = await resolveUserId(interaction.user.id)
      if (!userId) {
        await interaction.reply({ embeds: [errorEmbed(linkPrompt())], flags: MessageFlags.Ephemeral })
        return
      }
      const id = Number(interaction.customId.split(':')[2])
      await interaction.deferUpdate()
      const removed = await removeEvents(userId, [id])
      const target = removed[0]
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(DONE).setDescription(target ? `Borré **${target.title}** del ${humanDate(target.date)}.` : 'Ese evento ya no existía.')],
        components: [],
      })
      return
    }

    if (!interaction.isChatInputCommand()) return

    if (interaction.commandName === 'vincular') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral })
      const code = normalizeCode(interaction.options.getString('codigo', true))
      const result = await linkDiscordAccount({ discordUserId: interaction.user.id, code })
      if (!result.ok) {
        await interaction.editReply({
          embeds: [errorEmbed(result.reason === 'expired'
            ? 'Ese código caducó. Genera otro en AURA → perfil → **Vincular Discord**.'
            : 'No existe ningún código así. Revisa que lo copiaste completo y sin espacios.')],
        })
        return
      }
      const email = await accountEmail(result.userId)
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(DONE)
          .setTitle('Cuenta vinculada')
          .setDescription(`Listo${email ? `, este Discord usará la agenda de **${email}**` : ''}. Prueba \`/agenda\` o habla con \`/aura\`.`)
          .setFooter({ text: 'Puedes deshacerlo con /desvincular' })],
      })
      return
    }

    if (interaction.commandName === 'desvincular') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral })
      await unlinkDiscordAccount(interaction.user.id)
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR).setDescription('Vínculo eliminado. Este Discord ya no puede ver tu agenda.')] })
      return
    }

    // A partir de aquí todo necesita una cuenta vinculada.
    const userId = await resolveUserId(interaction.user.id)
    if (!userId) {
      await interaction.reply({ embeds: [errorEmbed(linkPrompt())], flags: MessageFlags.Ephemeral })
      return
    }

    if (interaction.commandName === 'imagen') {
      await interaction.deferReply()
      const view = interaction.options.getString('vista') === 'week' ? 'week' : 'day'
      const dateKey = resolveDate(interaction.options.getString('fecha')) || todayKey()
      const files = await buildCalendarFiles({ userId, dateKey, view })
      await interaction.editReply({ files })
      return
    }

    if (interaction.commandName === 'agenda') {
      await interaction.deferReply()
      const requested = interaction.options.getString('fecha')
      const key = resolveDate(requested)
      if (!key) {
        await interaction.editReply({ embeds: [errorEmbed(`No entendí la fecha «${requested}». Prueba con hoy, mañana, 25/10 o 2026-10-25.`)] })
        return
      }
      await interaction.editReply({ embeds: [dayEmbed(await listEvents(userId), key)] })
      return
    }

    if (interaction.commandName === 'semana') {
      await interaction.deferReply()
      const events = await listEvents(userId)
      const start = todayKey()
      const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
      const embed = new EmbedBuilder().setColor(COLOR).setTitle('Próximos siete días')
      for (const key of days) {
        const list = dayEvents(events, key)
        embed.addFields({
          name: capitalize(shortHumanDate(key)),
          value: list.length ? list.map(eventLine).join('\n').slice(0, 1020) : '—',
        })
      }
      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (interaction.commandName === 'nuevo') {
      await interaction.deferReply()
      const title = interaction.options.getString('titulo', true).trim()
      const requestedDate = interaction.options.getString('fecha')
      const date = resolveDate(requestedDate)
      if (!date) {
        await interaction.editReply({ embeds: [errorEmbed(`No entendí la fecha «${requestedDate}». Prueba con hoy, mañana, 25/10 o 2026-10-25.`)] })
        return
      }
      const requestedTime = interaction.options.getString('hora')
      const time = requestedTime ? normalizeTime(requestedTime) : nextHour()
      if (!time) {
        await interaction.editReply({ embeds: [errorEmbed(`No entendí la hora «${requestedTime}». Usa el formato 24 h, por ejemplo 16:30.`)] })
        return
      }
      const requestedDuration = interaction.options.getString('duracion')
      const duration = normalizeDuration(requestedDuration)
      if (!duration) {
        await interaction.editReply({ embeds: [errorEmbed(`No entendí la duración «${requestedDuration}». Prueba con 30 min o 1 h.`)] })
        return
      }
      const created = await addEvent(userId, {
        date,
        time,
        title: title.slice(0, 120),
        place: (interaction.options.getString('lugar') || 'Agenda personal').slice(0, 120),
        category: 'personal',
        duration,
        accent: 'coral',
        priority: 'media',
        tag: 'Discord',
      })
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(DONE)
          .setTitle('Evento creado')
          .setDescription(`**${created.title}**\n${capitalize(humanDate(created.date))} a las ${created.time} (${created.duration})${placeOf(created)}`)
          .setFooter({ text: 'Aparecerá en AURA la próxima vez que abras o recargues la app.' })],
      })
      return
    }

    if (interaction.commandName === 'aura') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral })
      const text = interaction.options.getString('mensaje', true).trim()
      const { reply, changed, ownKey, provider } = await askAura({ userId, text, historyKey: interaction.user.id })
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(changed ? DONE : COLOR)
          .setDescription(reply)
          .setFooter({ text: `${provider} · ${ownKey ? 'tu clave' : 'clave del bot'}${changed ? ' · guardado en AURA' : ''}` })],
      })
      return
    }

    if (interaction.commandName === 'borrar') {
      await interaction.deferReply()
      const query = interaction.options.getString('titulo', true)
      const matches = findEventsByTitle(await listEvents(userId), query).sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b))
      if (!matches.length) {
        await interaction.editReply({ embeds: [errorEmbed(`No encontré ningún evento que se llame «${query}».`)] })
        return
      }
      const shown = matches.slice(0, 5)
      const row = new ActionRowBuilder().addComponents(shown.map((event) => new ButtonBuilder()
        .setCustomId(`aura:borrar:${event.id}`)
        .setLabel(`${shortHumanDate(event.date)} · ${event.title}`.slice(0, 78))
        .setStyle(ButtonStyle.Danger)))
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLOR)
          .setDescription(matches.length === 1 ? '¿Borro este evento?' : `Encontré ${matches.length}. ¿Cuál borro?`)
          .addFields(shown.map((event) => ({ name: `${event.title}`, value: `${capitalize(shortHumanDate(event.date))} · ${event.time}` })))],
        components: [row],
      })
      return
    }

    await interaction.reply({ content: 'Comando no reconocido.', flags: MessageFlags.Ephemeral })
  } catch (error) {
    console.error('Error atendiendo la interacción:', error)
    const payload = { embeds: [errorEmbed(`Algo falló: ${error.message}`)] }
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => undefined)
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => undefined)
  }
})

const shutdown = (signal) => {
  console.log(`Recibido ${signal}, cerrando el bot…`)
  if (reminderTimer) clearInterval(reminderTimer)
  void client.destroy().finally(() => process.exit(0))
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

try {
  await client.login(token)
} catch (error) {
  if (/disallowed intents/i.test(String(error.message))) {
    console.error('Discord rechazó el intent de contenido de mensajes, que hace falta para el chat privado.')
    console.error('Actívalo en el Developer Portal: tu app → Bot → Privileged Gateway Intents → MESSAGE CONTENT INTENT, y vuelve a arrancar.')
  } else {
    console.error('No pude conectar con Discord:', error.message)
  }
  await client.destroy().catch(() => undefined)
  process.exitCode = 1
}
