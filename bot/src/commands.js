import { SlashCommandBuilder } from 'discord.js'

// Definición de los comandos. `deploy-commands.js` los publica en Discord.
export const commands = [
  new SlashCommandBuilder()
    .setName('vincular')
    .setDescription('Vincula tu cuenta de AURA con este Discord')
    .addStringOption((option) => option
      .setName('codigo')
      .setDescription('Código que muestra AURA en Perfil → Vincular Discord')
      .setRequired(true)
      .setMaxLength(12)),

  new SlashCommandBuilder()
    .setName('desvincular')
    .setDescription('Quita el vínculo entre este Discord y tu cuenta de AURA'),

  new SlashCommandBuilder()
    .setName('agenda')
    .setDescription('Muestra los eventos de un día')
    .addStringOption((option) => option
      .setName('fecha')
      .setDescription('hoy, mañana, 25/10 o 2026-10-25 (por defecto hoy)')
      .setRequired(false)),

  new SlashCommandBuilder()
    .setName('semana')
    .setDescription('Resumen de los próximos siete días'),

  new SlashCommandBuilder()
    .setName('nuevo')
    .setDescription('Crea un evento en AURA')
    .addStringOption((option) => option.setName('titulo').setDescription('Qué vas a hacer').setRequired(true).setMaxLength(120))
    .addStringOption((option) => option.setName('fecha').setDescription('hoy, mañana, 25/10 o 2026-10-25 (por defecto hoy)'))
    .addStringOption((option) => option.setName('hora').setDescription('Hora en formato 24 h, por ejemplo 16:30 (por defecto la próxima en punto)'))
    .addStringOption((option) => option.setName('duracion').setDescription('30 min, 1 h… (por defecto 30 min)'))
    .addStringOption((option) => option.setName('lugar').setDescription('Dónde es')),

  new SlashCommandBuilder()
    .setName('aura')
    .setDescription('Habla con AURA igual que en el panel: agenda, mueve o pregunta')
    .addStringOption((option) => option
      .setName('mensaje')
      .setDescription('Por ejemplo: «agéndame una reunión mañana a las 4»')
      .setRequired(true)
      .setMaxLength(1000)),

  new SlashCommandBuilder()
    .setName('borrar')
    .setDescription('Borra un evento por su título')
    .addStringOption((option) => option.setName('titulo').setDescription('Título del evento').setRequired(true)),
].map((command) => command.toJSON())
