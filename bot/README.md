# Bot de Discord de AURA

Consulta tu agenda y habla con AURA desde Discord. Cada persona vincula su cuenta de AURA con su
cuenta de Discord una vez, y a partir de ahí el bot usa **su** agenda y **su** clave de IA.

## Comandos

| Comando | Qué hace |
|---|---|
| `/vincular codigo:<código>` | Vincula este Discord con tu cuenta de AURA. El código se genera en la web. |
| `/desvincular` | Quita el vínculo; el bot deja de ver tu agenda. |
| `/aura mensaje:<texto>` | Habla con AURA como en el panel: entiende lenguaje natural y **crea, mueve o edita** eventos de verdad. |
| `/agenda [fecha]` | Eventos de un día (`hoy`, `mañana`, `25/10`, `2026-10-25`). Sin fecha, hoy. |
| `/semana` | Resumen de los próximos siete días. |
| `/nuevo titulo:<texto> [fecha] [hora] [duracion] [lugar]` | Crea un evento. Sin hora usa la próxima en punto; sin duración, 30 min. |
| `/borrar titulo:<texto>` | Busca por título y pide confirmación con botones. |

Todo menos `/vincular` y `/desvincular` exige tener la cuenta vinculada; si no, el bot te recuerda
dónde se genera el código.

## Chat privado (la forma normal de usarlo)

Puedes hablarle por **mensaje directo**, como en WhatsApp: en tu servidor, clic derecho sobre el
bot → **Mensaje**, y escribe con naturalidad. No hacen falta comandos:

- «¿qué tengo mañana?»
- «agéndame una reunión con Laura el jueves a las 16:00»
- «crea una rutina de gimnasio de lunes a viernes a las 7»
- `vincular K7M2QX` para vincular la cuenta desde el propio chat
- `desvincular` para cortar el acceso

**Requisito**: activa **Message Content Intent** en el Developer Portal (tu app → **Bot** →
*Privileged Gateway Intents* → **MESSAGE CONTENT INTENT**). Sin eso el bot no puede leer lo que le
escribes: al arrancar te avisará y se cerrará.

Si además quieres que responda en un canal concreto del servidor, pon su ID en
`DISCORD_CHAT_CHANNEL_ID`; si lo dejas vacío, solo habla por privado.

## 1. Crear la aplicación en Discord

1. Entra en <https://discord.com/developers/applications> → **New Application**.
2. **Bot** → **Reset Token** → copia el token (solo se muestra una vez).
3. En **Installation** (o *OAuth2 → URL Generator*) marca los scopes `bot` y `applications.commands`,
   y el permiso **Send Messages**. Abre la URL generada y añade el bot a tu servidor.
4. Copia el **Application ID** de *General Information*.

No hace falta activar ningún *Privileged Intent*: el bot solo usa comandos de barra.

## 2. Preparar Supabase

1. **Project Settings → API** → copia `Project URL` y la clave **service_role** (no la `anon`).
2. En el **SQL Editor**, ejecuta [`../supabase/discord.sql`](../supabase/discord.sql). Crea:
   - `discord_links`: qué Discord pertenece a qué cuenta de AURA (solo la toca el bot).
   - `discord_link_codes`: códigos de un solo uso que genera la web (RLS por usuario).

> La clave `service_role` se salta RLS y da acceso total a la base de datos. Vive solo en
> `bot/.env`, nunca en el frontend ni en el repositorio.

## 3. Arrancar

```bash
cd bot
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
# DISCORD_TOKEN, DISCORD_APP_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# opcional: DISCORD_GUILD_ID (comandos al instante) y AI_API_KEY (respaldo)
npm run deploy-commands
npm start
```

Si rellenas `DISCORD_GUILD_ID`, los comandos aparecen al instante en ese servidor; si lo dejas
vacío se registran globalmente y pueden tardar hasta una hora.

## 4. Vincular tu cuenta

1. Abre AURA en el navegador e inicia sesión.
2. Arriba a la derecha, tu avatar → **Vincular Discord**.
3. Copia el comando que aparece (algo como `/vincular codigo:K7M2QX`) y pégalo en el canal donde
   esté el bot. Caduca a los 10 minutos y solo sirve una vez.

Cada persona repite esto con su propia cuenta. Un mismo Discord puede re-vincularse a otra cuenta
cuando quiera; `/desvincular` corta el acceso.

## 5. Claves de IA

`/aura` usa el proveedor, el modelo y la clave que esa persona tiene guardados en AURA (panel del
asistente → ajustes de IA). No hay una clave compartida.

`AI_PROVIDER`, `AI_MODEL` y `AI_API_KEY` en `bot/.env` son solo el **respaldo** cuando alguien
vinculó su cuenta pero todavía no guardó ninguna clave en la web. Si no hay ni clave propia ni
respaldo, `/aura` lo explica y el resto de comandos sigue funcionando.

## 6. Mantenerlo encendido

El bot necesita un proceso Node 20+ siempre activo (no puede vivir en InfinityFree).

- **Tu PC**: desde `bot/`, `pm2 start ecosystem.config.cjs` y luego `pm2 save`. Se cae al apagar
  el equipo; para que arranque solo al iniciar sesión, `pm2-startup install` (paquete
  `pm2-windows-startup`).

  En Windows **no** uses `pm2 start npm -- start`: pm2 no reenvía bien los argumentos y falla con
  `Script not found: …\start`. El `ecosystem.config.cjs` del repo lanza `src/index.js` con
  `--env-file=.env` y evita ese problema.
- **Un VPS pequeño** (1 GB de RAM basta): la opción estable.
- **PaaS con plan gratuito** (Railway, Fly.io, Render): cómodo, pero duermen la instancia o piden
  tarjeta. Si duerme, los comandos no responden.

## Advertencias

- **No uses el bot con AURA abierta en el navegador.** La app guarda el documento completo con
  un retardo de ~1,2 s: si el bot escribe mientras la pestaña está abierta, la app puede
  sobrescribir el cambio al guardar. Recarga la app (o ciérrala) después de usar el bot.
- El historial de `/aura` vive en memoria (20 mensajes por persona) y se pierde al reiniciar.
- Las funciones de `bot/src/planner.js` y `bot/src/assistant.js` son una copia en JavaScript de
  `src/lib/schedule.ts`, `src/lib/dates.ts` y `src/lib/assistant.ts`. Si cambias una regla en la
  web, cámbiala también aquí.
- Los recordatorios siguen dependiendo de la app abierta, no del bot.
