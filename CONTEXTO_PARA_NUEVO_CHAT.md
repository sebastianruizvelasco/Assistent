# Contexto de AURA para continuar en otro chat

## Objetivo

AURA es un asistente personal con calendario. La meta es que la persona pueda organizar su agenda en lenguaje natural, revisar proyectos y memorias, y mantener control manual sobre las decisiones de la IA.

El usuario quiere que el próximo chat lea este documento y pueda responder preguntas o seguir trabajando sobre el proyecto sin volver a reunir todo el historial de conversaciones.

## Proyecto

- Ruta del proyecto: `Assistent/`
- Tecnologías: React 19, TypeScript 6, Vite 8.
- Punto de entrada: `src/App.tsx` (acceso y sincronización); la interfaz principal está en `src/components/PlannerApp.tsx`. Ver “Estructura del código”.
- Estilos: `src/App.css` y `src/index.css`.
- Proxy de IA: middleware de desarrollo definido en `vite.config.ts`, endpoint `/api/assistant`.
- Persistencia local en `localStorage` más autenticación opcional con Supabase Auth y sincronización cloud en una fila JSONB por usuario.
- Seguridad de datos cloud: `supabase/schema.sql` habilita RLS y limita cada fila al usuario autenticado.
- Si no hay variables Supabase, la pantalla permite continuar en modo local.
- API keys de IA nunca se suben; se guardan localmente bajo claves separadas por usuario cuando se usa cloud.
- Scripts: `npm run dev`, `npm run build`, `npm run lint`.

## Funciones implementadas

### Calendario

- Vistas de día, semana, mes y año.
- Crear eventos haciendo clic o arrastrando sobre el calendario; mover eventos con drag and drop.
- La fecha se calcula con la zona horaria local del navegador.
- Si el usuario no indica fecha al agendar, se usa hoy cuando la hora sigue pendiente y mañana cuando ya pasó.
- Semana: filas horarias de 1 AM a 12 PM; los eventos se colocan según hora y duración.
- Mes: muestra hora, título y duración; limita los eventos visibles y agrupa el resto con “+ más”.
- Año: los días con eventos llevan marcador y exponen hora, título y duración como detalle accesible.
- Conflictos, prioridad, tareas completadas, filtros y recordatorios del navegador.

### Flexibilidad, duración y recordatorios

- La flexibilidad del evento puede ser fija, un margen en minutos o una ventana de fecha y hora.
- En una ventana, AURA busca un hueco libre en intervalos de 15 minutos que quepa en la duración solicitada.
- El organizador del día no mueve eventos fijos ni sale de la flexibilidad guardada.
- Duración personalizada como número y unidad: minutos u horas.
- Recordatorio personalizado como número y unidad: minutos u horas antes.

### Repeticiones

- Recurrencias diarias, semanales o mensuales, generadas para aproximadamente un año.
- Cada fecha es una ocurrencia independiente; “Eliminar solo este día” no borra las demás.
- Cada serie nueva usa un `seriesId`; el menú también permite “Eliminar serie”.
- Las repeticiones mensuales conservan el día del mes y se ajustan al último día existente cuando ese mes es más corto.
- AURA puede crear una serie con horarios distintos por grupos de días. Ejemplo: lunes a viernes a las 16:00 y sábado/domingo a las 07:30.
- AURA puede editar los horarios de una serie existente y conserva las ocurrencias que ya fueron borradas.
- Días en el contrato interno: 0 domingo, 1 lunes, ..., 6 sábado.

### Asistente IA

- Chat en español con historial persistente.
- Proveedores soportados por el proxy: OpenRouter, OpenAI, Google Gemini y Anthropic.
- Configuración de claves/modelos desde el panel del asistente; también existen opciones por variables de entorno.
- El asistente puede crear tareas/eventos, crear series, editar series, proponer organización diaria y responder preguntas con contexto de la agenda y memorias.
- Las solicitudes de calendario devuelven acciones estructuradas y la app las aplica al estado de eventos; no basta con que el modelo diga que las agendó.
- Las llamadas reales requieren configurar una clave válida del proveedor.
- Dictado con la Web Speech API (`src/hooks/useDictation.ts`): el micrófono transcribe al campo de mensaje y no envía solo; si el navegador no lo admite, el botón queda desactivado.
- Modelos por defecto revisados en octubre de 2026 (`gpt-6.1-sol`, `gpt-6-luna`, `gemini-3.8-flash`, `claude-haiku-5-5`). El selector admite **Otro modelo (ID personalizado)** para no depender del catálogo del código.
- Los atajos locales de mover y borrar solo actúan cuando el título mencionado coincide con **un único** evento; si hay empate preguntan cuál. Ya no borran «el primer evento del día» cuando no encuentran el título (`src/lib/text.ts`).

### Conversaciones

- Las sesiones se guardan en `localStorage` bajo `aura-conversations` y la sesión activa bajo `aura-active-conversation`.
- Se conserva compatibilidad con el historial anterior `aura-conversation`.
- El usuario puede crear una conversación nueva, duplicar la activa y alternar entre sesiones.
- La copia conserva los mensajes y luego es independiente de la original.
- El selector se bloquea mientras el modelo procesa una solicitud.
- Esta función duplica conversaciones dentro de AURA; no clona una sesión de GitHub Copilot/VS Code.

### Inicio de sesión y sincronización

- Supabase Auth permite crear cuenta e iniciar/cerrar sesión con correo/contraseña, Google o Discord cuando se configuran `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` y se habilita el proveedor en el dashboard.
- `src/supabase.ts` crea el cliente solo si ambas variables están presentes.
- `supabase/schema.sql` crea `public.aura_user_data`, con una fila JSONB por usuario y políticas RLS para `select`, `insert` y `update`.
- AURA sincroniza eventos, proyectos, memorias, conversaciones, preferencias de calendario y modelos IA seleccionados con debounce.
- Las claves API de IA se excluyen del snapshot cloud y se mantienen localmente por usuario autenticado.
- El primer acceso cloud en un navegador puede migrar la caché local una vez; las cuentas nuevas siguientes comienzan con datos iniciales separados.
- Al cerrar sesión se espera a guardar el snapshot final y se borra la caché compartida de agenda del navegador; los datos permanecen en la cuenta Supabase.
- Para activarlo, configurar `.env` a partir de `.env.example`, ejecutar `supabase/schema.sql`, habilitar Email/Google en Supabase y configurar el callback Google `${SUPABASE_URL}/auth/v1/callback` y las URLs de retorno permitidas.

### Google Calendar (dos vías)

- Se activa con `VITE_GOOGLE_CLIENT_ID` (cliente OAuth Web de Google Cloud, sin secreto) y el botón del menú de perfil. Usa Google Identity Services (token de ~1 h en memoria, sin refresh token) con los permisos `calendar.events` y `userinfo.email`.
- Cada evento sincronizado lleva `google: { id, account, hash, updated }`. `hash` resume título/fecha/hora/duración/recordatorio para saber si cambió en AURA; `updated` es la marca de Google para saber si cambió allí. Si cambian ambos, gana Google.
- El borrado en AURA se detecta comparando contra la lista de ids vinculados de la última sincronización (`aura-google-known:<cuenta>` en localStorage). Más de 5 borrados en un lado exigen confirmación; la primera sincronización siempre la pide.
- Los eventos que AURA crea en Google llevan `extendedProperties.private.auraId` para poder revincularlos si se pierde el vínculo y para que un segundo dispositivo conserve el mismo id.
- Se omiten eventos de día completo y de más de 24 h. Ventana: 30 días atrás a 400 adelante.
- Código: `src/lib/googleCalendar.ts` (planificación pura + cliente de la API), `src/lib/googleAuth.ts`, `src/hooks/useGoogleCalendar.ts`, `src/components/GoogleCalendarMenu.tsx`. Duplicar un evento elimina el vínculo (`google: undefined`); cualquier código que clone eventos debe hacer lo mismo.

### Otras áreas

- Proyectos y memorias personales en localStorage y snapshot cloud cuando Supabase está activo.
- Tema claro/oscuro, reloj y zona horaria local, clima y ubicación si el navegador los permite.
- Notificaciones del navegador sujetas a permiso.
- Dictado con la Web Speech API: pide el micrófono con `getUserMedia` antes de escuchar (para que el navegador muestre el aviso), vigila que la escucha arranque de verdad y registra `[AURA dictado]` en la consola.

### Discord

- **Acceso**: botón «Continuar con Discord» en la pantalla de acceso mediante `supabase.auth.signInWithOAuth({ provider: 'discord' })`. Requiere habilitar el proveedor Discord en Supabase y su redirect `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Bot**: `bot/` es un proyecto Node independiente (discord.js + `@supabase/supabase-js` con clave de servicio). Comandos `/aura`, `/agenda`, `/semana`, `/nuevo`, `/borrar`; lee y escribe `events` dentro del JSONB de `public.aura_user_data` conservando el resto del documento.
- **`/aura`** replica el panel: mismo `SYSTEM_PROMPT`, mismo contexto (fecha/hora/zona, catálogo de series, eventos, memorias) y mismo contrato JSON (`create_event`, `create_series`, `edit_series`, `reply`). La lógica está en `bot/src/assistant.js` y `bot/src/planner.js`, copia en JS de `src/lib/*.ts`; si cambias una regla en la web, actualízala también ahí.
- **Vínculo multiusuario**: la web genera un código de 10 minutos (`src/lib/discord.ts`, tabla `discord_link_codes` con RLS por usuario) desde *perfil → Vincular Discord*; en Discord se canjea con `/vincular codigo:…`, que crea la fila en `discord_links` (sin políticas: solo la toca el bot con `service_role`). Cada comando resuelve el `user_id` de AURA a partir del `discord_user_id`.
- **Claves de IA por persona**: `snapshotForCloud` ya no vacía `aiSettings.apiKey`, así que la clave que cada persona guarda en el panel se sincroniza a su fila de Supabase y el bot la usa (`aiSettingsFor`). `AI_PROVIDER/AI_MODEL/AI_API_KEY` del `.env` son solo respaldo. Esto cambia la política anterior de «las claves no salen del navegador».
- **Chat privado**: el bot responde a los mensajes directos (`Events.MessageCreate`, intents `DirectMessages` + `MessageContent` + `Partials.Channel`). En privado se puede escribir `vincular CODIGO` / `desvincular` sin comandos de barra, y el resto del texto va al mismo `askAura` que `/aura`. `DISCORD_CHAT_CHANNEL_ID` permite habilitar además un canal concreto.
- **Imágenes del calendario**: `bot/src/calendar-svg.js` compone el SVG (vista de día y de semana) y `bot/src/calendar-image.js` lo rasteriza a PNG con `@resvg/resvg-js`. Se dispara con frases como «mándame una foto de la agenda» o «cómo va mi semana», y con `/imagen`; no usa la IA, así que no gasta tokens.
- El bot corre fuera de InfinityFree (necesita un proceso Node 20+). No debe usarse con la app abierta: el guardado con debounce de la app puede sobrescribir sus cambios.

## Arquitectura relevante

- El código se dividió en módulos pequeños (ver “Estructura del código”). `PlannerApp` es el contenedor: guarda el estado y los manejadores y compone los componentes de presentación.
- `EventItem` contiene el modelo de evento, incluidos campos opcionales de recurrencia, flexibilidad, recordatorio y `seriesId`.
- La organización diaria (`organizeSelectedDay` en `src/hooks/useAssistant.ts`) usa `validateSchedule` (`src/lib/schedule.ts`) para validar horas, solapamientos y límites antes de aplicar una propuesta.
- La búsqueda de espacio libre usa `findAvailableSlot` y la duración se normaliza con `durationToMinutes`.
- Los comandos de IA pasan por `applyCommand` (`src/hooks/useAssistant.ts`); sus respuestas se parsean como acciones JSON antes de cambiar el calendario.
- `vite.config.ts` implementa el proxy de desarrollo de IA. Las claves introducidas en el panel se guardan en el navegador y no se sincronizan a Supabase.
- `src/supabase.ts` implementa la conexión opcional a Auth/Postgres.
- `supabase/migrations/` lleva el esquema versionado (`0001_init`, `0002_discord`, `0003_updated_at`); los `.sql` sueltos de `supabase/` se mantienen por compatibilidad.
- `.github/workflows/ci.yml` ejecuta tipos, lint, pruebas, build y carga de los módulos del bot en cada push.
- `public/manifest.webmanifest` + `public/icons/` dan la app instalable (PWA) con los iconos del kit de marca.
- **Recordatorios push con la app cerrada**: `public/sw.js` (service worker) + `src/lib/push.ts` (suscripción y guardado en `push_subscriptions`) + `bot/src/reminder-runner.js` (el bot revisa cada minuto y envía con `web-push`). Deduplica con `push_sent` y tolera 15 min de retraso. Las claves VAPID: pública en la web, privada solo en el bot.

## Estructura del código

- `src/App.tsx`: sesión de Supabase, carga/guardado del snapshot y elección de pantalla (acceso o agenda).
- `src/types.ts`, `src/constants.ts`, `src/initialData.ts`: tipos, catálogos de modelos y datos iniciales.
- `src/lib/`: lógica pura sin React. `dates.ts` (fechas locales), `schedule.ts` (duraciones, recordatorios, huecos libres, series, validación del horario), `snapshot.ts` (lectura/mezcla de datos locales y cloud), `snapshot-merge.ts` (unión por id para no pisar lo que escribió el bot), `validate.ts` (saneado del JSON que llega de Supabase), `ics.ts` (exportar `.ics` y copias `.json`), `profile.ts` (nombre, foto e iniciales del usuario a partir de la cuenta de Supabase/Google), `assistant.ts` (prompt, llamada a `/api/assistant`, lectura de la acción JSON).
- `src/hooks/`: `useAssistant` (`applyCommand`, `organizeSelectedDay`), `useGoogleCalendar`, `useCloudSync`, `useLocalPersistence`, `useReminders`, `useClock`, `useWeather`, `useNotice`.
- `src/components/`: `PlannerApp` (contenedor), `Topbar`, `CalendarHeader`, `CalendarBody` (vistas día/semana/mes/año), `ProductivityPanel`, `AssistantPanel`, `AddEventModal`, `SectionHub` (Proyectos y Memoria), `AuthScreen`, `LoadingScreen`, `UserMenu` (botón con el nombre del usuario y su menú), `GoogleCalendarMenu`.

## Validación reciente

- `npm run build`: pasa.
- `npm run lint`: pasa sin advertencias en la última verificación.
- `npm test`: 18 pruebas de `src/lib/text.ts` y `src/lib/assistant.ts` (detección de menciones, horas, intención de borrar y extracción del JSON del modelo).
- `get_errors` sobre `src/App.tsx`: sin errores.
- Pruebas de navegador realizadas para: agenda en ventana flexible, duración personalizada, repetición diaria, eliminación individual, creación/edición de series IA con endpoint simulado, detalle temporal en vistas de calendario y duplicación/persistencia de conversaciones.
- Las pruebas del proveedor IA fueron simuladas; no verifican una llamada externa ni requieren exponer una clave.
- El dictado no se ha probado con micrófono real: depende de Chrome/Edge y del permiso del sistema.

## Cambios recientes (25/10/2026)

1. **Dictado real** en `src/hooks/useDictation.ts`; `PlannerApp` lo conecta y `AssistantPanel` muestra el estado real de la escucha (antes el botón solo cambiaba un texto y decía «Escuchando» sin escuchar nada).
2. **Proxy de IA (`api/assistant.ts`)**: valida el `Origin` igual que la versión PHP y ya no usa la clave del servidor en producción salvo `AURA_ALLOW_SERVER_KEY=1`. Para OpenAI envía `max_completion_tokens` en lugar de `temperature`/`max_tokens`, que los modelos razonadores rechazan.
3. **Catálogo de modelos actualizado** en `src/constants.ts` y en los valores por defecto de los dos proxies, con opción de ID personalizado en la interfaz.
4. **Borrado y movimiento seguros** en `src/hooks/useAssistant.ts` con `src/lib/text.ts`: coincidencia por título sin acentos, tolerancia a plurales, sin falsos positivos por subcadenas y sin borrar un evento al azar.
5. **`extractJsonObject`** en `src/lib/assistant.ts`: extrae el primer objeto JSON completo contando llaves, así una respuesta con texto o llaves anidadas ya no rompe el parseo.
6. **Marca de migración por usuario** (`aura-cloud-migration-complete:<userId>`) en `src/App.tsx`; antes era global del navegador.
7. **El modelo elegido se restaura** al abrir la app (antes siempre arrancaba con el primero de OpenRouter).
8. **Vitest** añadido (`npm test`) con pruebas de la lógica pura.

## Pendientes / límites conocidos

- No existe sincronización con Outlook.
- Google Calendar: la lógica se probó contra un Google simulado en memoria (paginación, cuota, 401/403, dos dispositivos, cambio de cuenta, borrados masivos) y el flujo completo de la interfaz, pero **no contra el servicio real**. Falta validar con un ID de cliente real.
- Google Calendar: sin servidor no hay refresh token; la conexión caduca en ~1 h y hay que pulsar «Reconectar».
- La autenticación/sincronización Supabase requiere que el usuario cree y configure su proyecto y variables locales; no hay credenciales de proyecto incluidas en el repositorio.
- Las recurrencias se generan por un año; no son reglas infinitas de calendario.
- La edición por IA de series requiere series creadas con `seriesId`; series antiguas sin ese identificador pueden no ser elegibles para edición automática.
- La organización automática del día opera sobre el día seleccionado; no debe mover eventos a otras fechas.
- Las llamadas reales a modelos deben probarse con la clave API configurada por el usuario.
- Validar el flujo cloud de registro, confirmación de email y sincronización después de configurar un proyecto Supabase real.

## Para el próximo chat

1. Lee este archivo y luego inspecciona `src/components/PlannerApp.tsx`, `src/hooks/` y `src/App.css` antes de asumir que el código sigue exactamente igual.
2. Ejecuta `npm run build` y `npm run lint` después de cambios.
3. Mantén la zona horaria local al interpretar fechas y horas.
4. No confirmes acciones de IA sin aplicar y guardar los cambios correspondientes.
5. Conserva la aprobación del usuario cuando la IA vaya a reorganizar eventos existentes.
6. No reemplaces ni borres cambios del usuario que no estén relacionados con la solicitud.