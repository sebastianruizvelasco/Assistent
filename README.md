# React + TypeScript + Vite

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
```

## Activar cuentas y sincronización

1. Crea un proyecto Supabase y habilita **Authentication > Providers > Email** y **Google**.
2. En el SQL Editor de Supabase ejecuta [`supabase/schema.sql`](supabase/schema.sql). Crea una sola fila JSONB por usuario y activa RLS para que cada cuenta solo pueda leer y modificar sus propios datos.
3. Copia `.env.example` a `.env` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los datos públicos del proyecto.
4. En Google Cloud crea un OAuth Client ID de tipo Web y añade como URI de redirección autorizada `https://<project-ref>.supabase.co/auth/v1/callback`. Copia el Client ID y Client Secret en el proveedor Google de Supabase.
5. En **Supabase > Authentication > URL Configuration**, configura el Site URL de producción y añade como Redirect URLs los orígenes donde abrirás AURA, por ejemplo `http://localhost:5173/**`, `http://127.0.0.1:5174/**` y el dominio de producción.
6. Reinicia Vite después de editar `.env`. En la pantalla de acceso aparecerá **Continuar con Google**; también puedes registrarte por correo. Si Supabase pide confirmar correo, confirma el mensaje antes de iniciar sesión.

La clave `anon`/publishable de Supabase está diseñada para el cliente y queda protegida por RLS. **Nunca** pongas una clave `service_role` en una variable `VITE_*` ni en el frontend.

## Almacenamiento y privacidad

- Eventos, proyectos, memorias y conversaciones se sincronizan como un documento JSONB compacto por usuario.
- Las claves API de los proveedores de IA no se suben a Supabase; permanecen en el almacenamiento local del navegador.
- Si Supabase no está configurado, puedes continuar en modo local. En ese modo los datos solo están disponibles en ese navegador/dispositivo.
- En el primer inicio cloud de este navegador, AURA migra los datos locales una sola vez; las cuentas nuevas posteriores empiezan separadas. Al cerrar sesión se limpia la caché de agenda del navegador, pero los datos siguen en Supabase.

## Tecnologías

- React 19, TypeScript y Vite.
- Supabase Auth para correo/contraseña y Postgres JSONB con Row Level Security para sincronización.
- `src/App.tsx`: aplicación, calendario, asistente y sincronización.
- `src/supabase.ts`: cliente opcional de Supabase.
- `src/App.css`: estilos de la aplicación y acceso.

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
