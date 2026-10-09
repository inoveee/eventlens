// @TheTechMargin 2026

/**
 * Relative luminance per WCAG 2.1 (sRGB, gamma-expanded).
 * Returns 0 (black) … 1 (white).
 */
export function relativeLuminance(hexColor: string): number {
  const normalized = normalizeHex(hexColor);
  if (!normalized) return 0;

  const channel = (offset: number) => {
    // offset counts hex digits after the leading "#"
    const c = parseInt(normalized.slice(offset + 1, offset + 3), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * Returns "#000000" or "#ffffff" — whichever reads better on `hexColor`.
 *
 * Uses the WCAG contrast ratio so the label on a filled brand button stays
 * legible whatever color the organizer picks (a dark navy needs white text,
 * a neon yellow needs black). Threshold 0.179 is the luminance point where
 * black and white are equally contrasty against the background.
 */
export function contrastOn(hexColor: string): "#000000" | "#ffffff" {
  return relativeLuminance(hexColor) > 0.179 ? "#000000" : "#ffffff";
}

/** Accepts "2563eb", "#2563eb", "#RGB". Returns lowercase "#rrggbb" or null. */
export function normalizeHex(value: string | undefined | null): string | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;

  const short = /^#?([0-9a-f]{3})$/.exec(v);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  const full = /^#?([0-9a-f]{6})$/.exec(v);
  return full ? `#${full[1]}` : null;
}
