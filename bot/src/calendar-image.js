// Rasteriza el SVG del calendario a PNG con resvg (binario precompilado, sin dependencias del sistema).

import { Resvg } from '@resvg/resvg-js'
import { buildDaySvg, buildWeekSvg } from './calendar-svg.js'

const BACKGROUND = '#11121b'
const FONT = 'Segoe UI, Inter, Arial, sans-serif'

const render = (svg, width) => {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: BACKGROUND,
    font: { loadSystemFonts: true, defaultFontFamily: FONT, sansSerifFamily: FONT },
  })
  return resvg.render().asPng()
}

export const dayCalendarPng = ({ dateKey, events, timeZone, width = 1200 }) =>
  render(buildDaySvg({ dateKey, events, timeZone }), width)

export const weekCalendarPng = ({ days, timeZone, width = 1500 }) =>
  render(buildWeekSvg({ days, timeZone }), width)
