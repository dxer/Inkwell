/**
 * Resolve a category color for display in light/dark mode.
 *
 * Returns inline style objects for a tinted pill: low-opacity background in the
 * category hue + the hue itself as text color. In dark mode the text color is
 * lightened (better contrast against dark surfaces) and the tint is slightly
 * stronger.
 *
 * Falls back to the brand terracotta for invalid/missing input.
 */

const BRAND_FALLBACK = '#C15F3C'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Parse a #RRGGBB (or #RGB) hex string into [r, g, b] (0-255). */
function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('')
  }
  if (!/^([0-9a-fA-F]{6})$/.test(h)) return null
  const num = parseInt(h, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4; break
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}

export interface CategoryPillStyle {
  backgroundColor: string
  color: string
}

/**
 * @param hex   Category color as #RRGGBB. Invalid values fall back to terracotta.
 * @param dark  Whether to render for dark mode.
 */
export function categoryColor(hex: string | null | undefined, dark: boolean): CategoryPillStyle {
  const rgb = hexToRgb(hex || BRAND_FALLBACK) ?? hexToRgb(BRAND_FALLBACK)!
  const [h, s, l] = rgbToHsl(...rgb)

  const textL = dark ? clamp(l + 0.15, 0, 1) : l
  const textColor = `hsl(${h.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(textL * 100).toFixed(0)}%)`
  const bgAlpha = dark ? 0.2 : 0.13

  return {
    backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${bgAlpha})`,
    color: textColor,
  }
}
