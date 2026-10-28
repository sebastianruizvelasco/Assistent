# AURA

[![CI](https://github.com/sebastianruizvelasco/Assistent/actions/workflows/ci.yml/badge.svg)](https://github.com/sebastianruizvelasco/Assistent/actions/workflows/ci.yml)

Asistente personal de calendario hecho con React, TypeScript y Vite. Incluye inicio de sesión opcional con Supabase y sincronización de los datos de agenda por usuario.

## Ejecutar

```bash
npm install
npm run dev
```

Comprobaciones:

```bash
npm run build
npm run lint
npm test
```

## Activar cuentas y sincronización

1. Crea un proyecto Supabase y habilita **Authentication > Providers > Email** y **Google**.
2. En el SQL Editor de Supabase ejecuta [`supabase/schema.sql`](supabase/schema.sql). Crea una sola fila JSONB por usuario y activa RLS para que cada cuenta solo pueda leer y modificar sus propios datos.
3. Copia `.env.example` a `.env` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los datos públicos del proyecto.
4. En Google Cloud crea un OAuth Client ID de tipo Web y añade como URI de redirección autorizada `https://<project-ref>.supabase.co/auth/v1/callback`. Copia el Client ID y Client Secret en el proveedor Google de Supabase.
5. En **Supabase > Authentication > URL Configuration**, configura el Site URL de producción y añade como Redirect URLs los orígenes donde abrirás AURA, por ejemplo `http://localhost:5173/**`, `http://127.0.0.1:5174/**` y el dominio de producción.
6. Reinicia Vite después de editar `.env`. En la pantalla de acceso aparecerá **Continuar con Google**; también puedes registrarte por correo. Si Supabase pide confirmar correo, confirma el mensaje antes de iniciar sesión.

La clave `anon`/publishable de Supabase está diseñada para el cliente y queda protegida por RLS. **Nunca** pongas una clave `service_role` en una variable `VITE_*` ni en el frontend.

## Entrar con Discord

1. En el [Discord Developer Portal](https://discord.com/developers/applications) crea una aplicación y copia **Client ID** y **Client Secret** de *OAuth2*.
2. En esa aplicación, añade como **Redirect** `https://<project-ref>.supabase.co/auth/v1/callback` (el mismo que usas con Google).
3. En Supabase ve a **Authentication > Providers > Discord**, actívalo y pega el Client ID y el Secret.
4. Reinicia Vite si hace falta: en la pantalla de acceso aparecerá **Continuar con Discord**.

## Bot de Discord

`bot/` contiene un bot con comandos —`/vincular`, `/aura`, `/agenda`, `/semana`, `/nuevo`, `/borrar`— que lee y escribe tu agenda en Supabase, sin pasar por la interfaz. `/aura` conversa con el mismo modelo y el mismo contrato de acciones que el panel, usando **la clave de IA de cada persona**.

Para activarlo:

1. Ejecuta [`supabase/discord.sql`](supabase/discord.sql) en el SQL Editor (crea las tablas de vínculos y códigos).
2. Arranca el bot siguiendo [`bot/README.md`](bot/README.md).
3. En AURA, abre tu perfil (arriba a la derecha) → **Vincular Discord** → copia el comando y pégalo en Discord.

Necesita un proceso Node encendido (no cabe en InfinityFree).

## Sincronizar con Google Calendar

AURA se sincroniza en dos vías con tu calendario principal de Google: lo que creas o cambias en AURA aparece en Google Calendar y viceversa. No necesita servidor propio: usa el inicio de sesión de Google en el navegador y no hay ningún secreto que proteger.

### Configuración (una sola vez)

1. En [Google Cloud Console](https://console.cloud.google.com/) usa el proyecto que ya creaste para el login con Google de Supabase, o crea uno nuevo.
2. **APIs y servicios > Biblioteca**: busca **Google Calendar API** y pulsa **Habilitar**.
3. **APIs y servicios > Pantalla de consentimiento de OAuth** (en el menú nuevo: *Google Auth Platform*): tipo de usuario **Externo**, nombre `AURA` y tu correo. En **Acceso a los datos** añade los permisos `.../auth/calendar.events` y `.../auth/userinfo.email`. En **Público** (o *Usuarios de prueba*) añade tu cuenta de Gmail: mientras la app esté en modo de prueba solo esas cuentas pueden conectarse.
4. **Credenciales > Crear credenciales > ID de cliente de OAuth**, tipo **Aplicación web**. En **Orígenes autorizados de JavaScript** añade `http://localhost:5173` y, si la publicas, la URL de producción. No hace falta URI de redirección.
5. Copia el ID de cliente (`...apps.googleusercontent.com`) en tu `.env` como `VITE_GOOGLE_CLIENT_ID` y reinicia `npm run dev`.
6. En AURA abre tu avatar y pulsa **Conectar Google Calendar**. Google mostrará "Google no ha verificado esta aplicación": es normal en modo de prueba; elige **Avanzado > Ir a AURA** y deja marcadas todas las casillas.

### Cómo funciona

- **Qué se sincroniza:** título, fecha, hora, duración y recordatorio. Prioridad, categoría, etiqueta, lugar, "completado" y flexibilidad solo existen en AURA.
- **Ventana:** desde 30 días atrás hasta 400 días adelante, solo el calendario principal.
- **Primera vez:** AURA te muestra cuántos eventos enviará e importará y pide confirmación antes de escribir nada (así los eventos de ejemplo no se cuelan en tu calendario real sin que lo decidas).
- **Cambios automáticos:** unos segundos después de editar algo en AURA, y cada 5 minutos para traer lo que cambió en Google. También tienes **Sincronizar ahora** en el menú del perfil.
- **Conflictos:** si cambias el mismo evento en los dos lados entre dos sincronizaciones, gana la versión de Google.
- **Borrados:** se propagan en ambos sentidos. Si una sincronización fuera a borrar más de 5 eventos de golpe (en Google o en AURA), AURA pide confirmación y no actúa sola.
- **Se omiten** los eventos de día completo y los de más de 24 h, porque AURA trabaja con franjas horarias. Las series de AURA se envían como eventos individuales, y las repeticiones de Google se importan como ocurrencias sueltas.
- **Duración de la conexión:** Google concede un acceso de ~1 hora. Al caducar, AURA deja de sincronizar (sin perder nada) y en el perfil aparece **Reconectar**; si tu sesión de Google sigue abierta, la ventana se cierra casi al instante. Evitarlo requeriría un servidor que guarde un refresh token.

### Privacidad

El token de acceso solo vive en la memoria de la pestaña; nunca se guarda ni se sube a Supabase. Junto a cada evento vinculado se guardan el correo de la cuenta de Google y el id del evento espejo (y se sincronizan con tu Supabase si lo usas). **Desconectar** revoca el acceso y limpia el estado de sincronización, pero conserva tus eventos en AURA y en Google.

## Publicar en un dominio

La guía completa (InfinityFree, Supabase y Google) está en [`DEPLOY.md`](DEPLOY.md). El proxy de IA es `api/assistant.ts` en desarrollo y `public/api/assistant.php` en producción.

## Copias de seguridad y exportación

En el menú del perfil (arriba a la derecha):

- **Exportar agenda (.ics)**: descarga un calendario con todos los eventos, listo para Google Calendar, Apple Calendar u Outlook.
- **Copia de seguridad**: un `.json` con eventos, proyectos, memorias y conversaciones.
- **Restaurar copia**: vuelve a importar ese `.json`. Lo importado manda para los ids repetidos y se conserva lo que no venía en el archivo.

## Recordatorios con la app cerrada

Con las notificaciones push activadas (avatar → **Activar recordatorios**), el bot de Discord envía
los avisos desde el service worker (`public/sw.js`) aunque AURA esté cerrada. Hace falta:

- `VITE_VAPID_PUBLIC_KEY` en `.env` (la privada vive solo en `bot/.env`).
- La migración `supabase/migrations/0004_push.sql`.
- El bot encendido: es quien revisa la agenda cada minuto y envía.

Sin el bot, los recordatorios vuelven a depender de tener la pestaña abierta.

## Instalar como aplicación (PWA)

La app trae `manifest.webmanifest` e iconos, así que el navegador la ofrece como aplicación instalable (Chrome: menú → **Instalar AURA**). Sin service worker todavía: no hay uso sin conexión ni notificaciones con la pestaña cerrada.

## Despliegue continuo

`.github/workflows/ci.yml` ejecuta en cada push y en cada PR: `tsc`, lint, las pruebas, el build y una carga de los módulos del bot. El despliegue en InfinityFree sigue siendo manual (`npm run build` + subir `dist/`).

## Almacenamiento y privacidad

- Eventos, proyectos, memorias y conversaciones se sincronizan como un documento JSONB compacto por usuario.
- Las claves API de los proveedores de IA se guardan en el navegador **y en tu propia fila de Supabase**, para que el bot de Discord pueda usar tu clave. La fila está protegida por RLS: solo tu cuenta la lee desde la app; el bot la lee con la clave de servicio del servidor. Si prefieres que la clave no salga del navegador, no vincules Discord.
- Si Supabase no está configurado, puedes continuar en modo local. En ese modo los datos solo están disponibles en ese navegador/dispositivo.
- En el primer inicio cloud de este navegador, AURA migra los datos locales una sola vez; las cuentas nuevas posteriores empiezan separadas. Al cerrar sesión se limpia la caché de agenda del navegador, pero los datos siguen en Supabase.

## Tecnologías

- React 19, TypeScript y Vite.
- Supabase Auth para correo/contraseña y Postgres JSONB con Row Level Security para sincronización.
- `src/App.tsx`: sesión, acceso y sincronización con Supabase.
- `src/components/`: interfaz (`PlannerApp` es el contenedor; calendario, asistente, modal de eventos, proyectos y memoria son componentes propios).
- `src/hooks/` y `src/lib/`: lógica del asistente, sincronización con la nube y con Google Calendar, recordatorios, fechas y horarios.
- `src/supabase.ts`: cliente opcional de Supabase.
- `src/App.css`: estilos de la aplicación y acceso.
- Dictado con la Web Speech API del navegador (sin servidor ni clave): el texto reconocido se añade al mensaje y no se envía solo. Si el navegador no lo admite, el micrófono queda desactivado.
- El selector de modelo incluye **Otro modelo (ID personalizado)**: los catálogos de modelos cambian a menudo y así no hace falta esperar a una actualización del código.
- `tests/`: pruebas de la lógica pura con Vitest (`npm test`).
- `brand/`: kit de marca con los SVG editables (logotipo, lockup, tarjeta social, banner) y sus PNG exportados.
- `bot/`: bot de Discord (Node + discord.js) con su propio `package.json` y `README.md`.

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
