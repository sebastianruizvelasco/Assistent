# Bot de Discord de AURA

Consulta y crea eventos de tu agenda desde Discord. Lee y escribe el mismo documento de
Supabase que usa la app, así que no hay que sincronizar nada a mano.

## Comandos

| Comando | Qué hace |
|---|---|
| `/aura mensaje:<texto>` | Habla con AURA como en el panel: entiende lenguaje natural y **crea, mueve o edita** eventos de verdad. |
| `/agenda [fecha]` | Eventos de un día (`hoy`, `mañana`, `25/10`, `2026-10-25`). Sin fecha, hoy. |
| `/semana` | Resumen de los próximos siete días. |
| `/nuevo titulo:<texto> [fecha] [hora] [duracion] [lugar]` | Crea un evento. Sin hora usa la próxima en punto; sin duración, 30 min. |
| `/borrar titulo:<texto>` | Busca por título y pide confirmación con botones. |

## Conversar con AURA (`/aura`)

`/aura` usa el mismo prompt, el mismo contexto de agenda y el mismo contrato de acciones JSON que
el panel de la web (`src/lib/assistant.ts` → `bot/src/assistant.js`). Puedes escribir cosas como:

- «¿qué tengo mañana?»
- «agéndame una reunión con Laura el jueves a las 4»
- «crea una rutina de gimnasio de lunes a viernes a las 7»
- «mueve la serie de gimnasio a las 6:30»

El bot aplica el cambio en Supabase y te confirma qué hizo. La respuesta es **privada** (solo la
ves tú) porque el contexto incluye tus memorias y preferencias. El historial de la conversación
vive en memoria y se pierde al reiniciar el bot.

Configura el modelo en `bot/.env` con `AI_PROVIDER`, `AI_MODEL` y `AI_API_KEY`. Sin clave, el
resto de comandos sigue funcionando.

> Las funciones de `bot/src/planner.js` y `bot/src/assistant.js` son una copia en JavaScript de
> `src/lib/schedule.ts`, `src/lib/dates.ts` y `src/lib/assistant.ts`. Si cambias una regla en la
> web, cámbiala también aquí.

## 1. Crear la aplicación en Discord

1. Entra en <https://discord.com/developers/applications> → **New Application** y ponle nombre.
2. **Bot** → **Reset Token** → copia el token (solo se muestra una vez).
3. En **Installation** (o *OAuth2 → URL Generator*) marca los scopes `bot` y `applications.commands`,
   y el permiso **Send Messages**. Abre la URL generada y añade el bot a tu servidor.
4. Copia el **Application ID** de *General Information*.

No hace falta activar ningún *Privileged Intent*: el bot solo usa comandos de barra.

## 2. Datos de Supabase

En **Project Settings → API** copia `Project URL` y la clave **service_role** (no la `anon`).
En **Authentication → Users** copia el UUID de tu cuenta: es el `AURA_USER_ID`.

> La clave `service_role` se salta RLS y da acceso total a la base de datos. Vive solo en
> `bot/.env`, nunca en el frontend ni en el repositorio.

## 3. Arrancar

```bash
cd bot
npm install
copy .env.example .env      # en macOS/Linux: cp .env.example .env
# rellena DISCORD_TOKEN, DISCORD_APP_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AURA_USER_ID
npm run deploy-commands     # publica /agenda, /semana, /nuevo y /borrar
npm start
```

Si rellenas `DISCORD_GUILD_ID`, los comandos aparecen al instante en ese servidor; si lo dejas
vacío se registran globalmente y pueden tardar hasta una hora.

## 4. Mantenerlo encendido

El bot necesita un proceso Node 20+ siempre activo (no puede vivir en InfinityFree, que solo
sirve archivos estáticos y PHP).

- **Tu PC**: lo más simple para empezar. `npm start` y listo; se cae al apagar el equipo.
  Para que arranque solo, usa el Programador de tareas de Windows o `pm2` + `pm2-windows-startup`.
- **Un VPS pequeño** (1 GB de RAM basta): la opción estable y barata a medio plazo.
  `pm2 start src/index.js --name aura-bot && pm2 save && pm2 startup`.
- **PaaS con plan gratuito** (Railway, Fly.io, Render): cómodo de desplegar, pero los planes
  gratuitos duermen la instancia o piden tarjeta. Si el bot duerme, los comandos no responden.

## Advertencias

- **Una sola cuenta por bot.** `AURA_USER_ID` fija el dueño de la agenda. Para varias personas
  haría falta un flujo de vinculación (código temporal desde la app) y una tabla de vínculos.
- **No uses el bot con AURA abierta en el navegador.** La app guarda el documento completo con
  un retardo de ~1,2 s: si el bot escribe mientras la pestaña está abierta, la app puede
  sobrescribir el cambio al guardar. Recarga la app (o ciérrala) después de usar el bot.
- `/nuevo` no usa IA: crea el evento tal cual, con los datos que le pasas.
- Los recordatorios y las notificaciones siguen dependiendo de la app abierta, no del bot.
