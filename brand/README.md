# Kit de marca de AURA

Todo el arte de la app, en un solo sitio. Los **SVG son la fuente**: puedes cambiar colores y texto
sin perder calidad. Los PNG de `png/` son exportaciones listas para usar.

## Qué hay

| Archivo | Para qué |
|---|---|
| `logo-mark.svg` | Marca principal (halo + chispa) con degradado. 48×48, escala a cualquier tamaño. |
| `logo-mark-mono-white.svg` | Marca monocroma clara, sin fondo. Para fondos oscuros o impresión a una tinta. |
| `logo-mark-mono-black.svg` | Marca monocroma oscura, sin fondo. Para fondos claros. |
| `logo-lockup-dark.svg` | Marca + «AURA» + lema, para fondos oscuros. 640×160. |
| `logo-lockup-light.svg` | Lo mismo para fondos claros. 640×160. |
| `social-card.svg` | Tarjeta 1200×630 para Open Graph, X, Discord o presentaciones. |
| `banner.svg` | Cabecera 1500×500 para Discord, YouTube o GitHub. |
| `brand-sheet.svg` | Hoja resumen: logotipo, paletas, tipografía y gradiente. |
| `favicon.svg` | Icono de pestaña (copia del que sirve la app en `public/`). |
| `colors.json` | Los mismos colores en JSON, por si los necesitas en código. |
| `png/` | Exportaciones: icono 1024 y 512, lockups a 1280, tarjeta social, banner y hoja de marca. |

## La marca

El símbolo es un **halo que dibuja una A** con una chispa en el centro: la idea de una agenda que
se ordena sola. El cuadrado redondeado con degradado es el contenedor; en las versiones monocromas
se quita y quedan solo el arco y la chispa.

- Lema: **Autonomous Unified Routine Assistant**
- Reclamo: **Tu agenda, contigo.**

## Color

| Tema claro | | Tema oscuro | |
|---|---|---|---|
| Fondo | `#f5f6fb` | Fondo | `#0e0f1a` |
| Superficie | `#ffffff` | Superficie | `#161726` |
| Borde | `#e2e4f0` | Borde | `#2a2d46` |
| Primario | `#5b5bd6` | Primario | `#8b89f5` |
| Texto | `#1b1c2e` | Texto | `#eceefa` |
| Texto suave | `#9094ab` | Texto suave | `#70749a` |

Gradiente de marca: `#4f46e5 → #7c5cf0 → #b86cf5`, a 135°.

Categorías de evento: focus `#4f7cf0`, move `#2bab68`, rest `#8c5af0`, personal `#ec6a5c`,
aviso `#f2a516`.

## Tipografía

- **Fraunces** (serif, 400–600): marca y títulos. En la app, `--font-display`.
- **DM Sans** (sans, 400–700): interfaz y texto. En la app, `--font-body`.

Ambas se cargan desde Google Fonts en `src/index.css`.

## Reglas rápidas

1. **Espacio libre**: deja alrededor del logotipo al menos media altura del icono.
2. **Tamaño mínimo**: 24 px de alto para la marca sola, 120 px de ancho para el lockup.
3. **No** deformes, gires ni recolorees el degradado. Si necesitas una tinta, usa las versiones monocromas.
4. Sobre foto o vídeo, pon el lockup claro con un velo oscuro detrás (mínimo 40 % de opacidad).
5. El icono de la app ya incluye el cuadrado redondeado: no le añadas otro borde.

## Regenerar los PNG

Los PNG se generan con [`@resvg/resvg-js`](https://github.com/thx/resvg-js), que ya es dependencia
del bot. Desde `bot/`:

```bash
node -e "..."   # ver commit b57a81c: el script usa Resvg con fontFiles de Fraunces y DM Sans
```

Si cambias un SVG, basta con volver a rasterizarlo al ancho que necesites:

```js
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
const svg = fs.readFileSync('../brand/logo-lockup-dark.svg', 'utf8')
const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1280 },
  font: { fontFiles: ['ruta/DMSans.ttf', 'ruta/Fraunces.ttf'], loadSystemFonts: true },
}).render().asPng()
fs.writeFileSync('../brand/png/logo-lockup-dark-1280.png', png)
```

Las fuentes se descargan de [google/fonts](https://github.com/google/fonts) (`ofl/dmsans`, `ofl/fraunces`).
Sin ellas, el texto cae a Georgia y Segoe UI.

## Dónde se usa cada cosa en la app

- `src/components/Logo.tsx` — la marca dibujada en React (misma geometría que `logo-mark.svg`).
- `public/favicon.svg` — icono de pestaña; es la misma marca con ids propios.
- `bot/src/calendar-svg.js` — usa la paleta oscura y los colores de categoría para las imágenes del
  calendario que envía Discord.
- `src/App.css` — los tokens (`--bg`, `--primary`, `--brand-gradient`…) que reflejan estas tablas.
