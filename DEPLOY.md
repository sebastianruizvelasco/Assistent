# Publicar AURA en `auraassistent.freehosting.dev` (InfinityFree)

AURA se publica como **archivos estáticos** (carpeta `dist/`) más un **proxy PHP** (`public/api/assistant.php`) que reenvía el chat a OpenRouter, OpenAI, Gemini o Anthropic. Vite copia `public/` dentro de `dist/`, así que el proxy y el `.htaccess` ya van incluidos en el build.

## 1. Compilar en tu computadora

1. Crea un archivo `.env` (copia de `.env.example`) con **solo** las variables públicas:

   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon
   VITE_GOOGLE_CLIENT_ID=tu-id.apps.googleusercontent.com
   ```

   Estas variables se incrustan en el JavaScript durante el build; InfinityFree no tiene variables de entorno. Son claves públicas por diseño (Supabase las protege con RLS).
2. Ejecuta:

   ```bash
   npm install
   npm run build
   ```

3. Comprueba que existen `dist/index.html`, `dist/.htaccess` y `dist/api/assistant.php`. El `.htaccess` es un archivo oculto: actívalo en tu explorador si no lo ves.

## 2. Subir a InfinityFree

1. En el panel de InfinityFree abre tu cuenta de hosting → **File Manager** (o conéctate por FTP con las credenciales de la cuenta).
2. Entra en `htdocs/` y borra el `index2.html` que crea InfinityFree por defecto.
3. Sube **el contenido** de `dist/` (no la carpeta `dist` en sí) dentro de `htdocs/`, incluido `.htaccess`. Por FTP es más cómodo, porque el File Manager web a veces omite archivos ocultos.
4. Abre `https://auraassistent.freehosting.dev`. Si el navegador avisa de certificado, activa el SSL gratuito desde el panel y espera unos minutos.

Cada vez que cambies el código: `npm run build` y vuelve a subir `dist/`.

## 3. Actualizar Supabase, Google y Discord (obligatorio para iniciar sesión)

- **Supabase > Authentication > URL Configuration**
  - Site URL: `https://auraassistent.freehosting.dev`
  - Redirect URLs: añade `https://auraassistent.freehosting.dev/**` (conserva las de localhost).
- **Google Cloud > Credenciales > tu ID de cliente OAuth Web**
  - Orígenes autorizados de JavaScript: añade `https://auraassistent.freehosting.dev`.
- **Discord (solo si usas «Continuar con Discord»)**
  - En el Discord Developer Portal, *OAuth2 > Redirects*: `https://<project-ref>.supabase.co/auth/v1/callback`.
  - En Supabase, *Authentication > Providers > Discord*: activado con su Client ID y Secret.

## 4. Lista de comprobación

- [ ] La web abre por **HTTPS** y al recargar una ruta interna no da 404.
- [ ] Registro/inicio de sesión (correo, Google y Discord) funciona.
- [ ] El chat responde con una clave real. Si falla con `Unexpected token <`, la respuesta fue la página de verificación de InfinityFree en vez de JSON (ver abajo).
- [ ] **Conectar Google Calendar** abre el consentimiento sin errores de origen.
- [ ] El **dictado** pide permiso del micrófono (la cabecera `Permissions-Policy` debe incluir `microphone=(self)`).

## Limitaciones del hosting gratuito

- **Verificación de navegador de InfinityFree.** Las cuentas gratuitas exigen JavaScript y cookies en cada petición. Las llamadas del navegador a su propio dominio (como `/api/assistant`) funcionan; lo que no funciona son clientes externos (apps, `curl`, webhooks). Según la documentación de InfinityFree no se puede desactivar en el plan gratuito.
- **Las claves de IA pasan por tu servidor.** El proxy no las guarda ni las registra; solo las reenvía. Por eso solo acepta peticiones cuyo origen sea tu propio dominio.
- **El proxy PHP replica a `api/assistant.ts`** (que solo se usa en `npm run dev`). Si cambias la lógica de uno, cambia el otro.
- **Sin límites de uso propios.** Si algún día lo abres a mucho público, conviene añadir limitación por IP o pasar a un hosting con funciones serverless (el archivo `api/assistant.ts` ya está escrito para poder desplegarse así).

## Endurecimiento pendiente (opcional)

- Añadir una **Content-Security-Policy** en `.htaccess`. No está incluida porque hay que listar con cuidado Supabase, Google Identity Services y el servicio del clima, y una política mal ajustada rompería el inicio de sesión.
