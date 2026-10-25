// Bot de Discord de AURA. Ejecuta: npm start (después de npm run deploy-commands).

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, GatewayIntentBits, MessageFlags } from 'discord.js'
import { addEvent, listEvents, removeEvents } from './aura.js'
import { addDays, findEventsByTitle, humanDate, normalizeDuration, normalizeTime, resolveDate, shortHumanDate, todayKey } from './dates.js'

const token = process.env.DISCORD_TOKEN
const userId = process.env.AURA_USER_ID

if (!token || !userId) {
  console.error('Faltan DISCORD_TOKEN o AURA_USER_ID. Copia bot/.env.example a bot/.env y rellénalo.')
  process.exit(1)
}

const COLOR = 0x5b5bd6
const DONE = 0x37a169
const WARN = 0xd9584f

const byTime = (a, b) => String(a.time ?? '').localeCompare(String(b.time ?? ''))
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const placeOf = (event) => (event.place && event.place !== 'Agenda personal' ? ` · ${event.place}` : '')

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

// Próxima hora en punto, para cuando no se indica hora.
const nextHour = () => {
  const now = new Date()
  const hour = (now.getHours() + 1) % 24
  return `${String(hour).padStart(2, '0')}:00`
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once(Events.ClientReady, (ready) => {
  console.log(`AURA en Discord: conectado como ${ready.user.tag} (${ready.guilds.cache.size} servidores).`)
  const logChannel = process.env.DISCORD_LOG_CHANNEL_ID
  if (logChannel) {
    const channel = ready.channels.cache.get(logChannel)
    if (channel?.isTextBased()) void channel.send('AURA está en línea y lista para consultar tu agenda.').catch(() => undefined)
  }
})

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Botones de confirmación de borrado.
    if (interaction.isButton() && interaction.customId.startsWith('aura:borrar:')) {
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
  void client.destroy().finally(() => process.exit(0))
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

await client.login(token)
