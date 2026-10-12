// src/lib/milestone/harness/contrast.ts — WCAG 2.x contrast ratio (pure, code-only — 8.2.2/8.3)
// Kanuni (WCAG): luminance L ya (R,G,B) sRGB → ratio (L1+0.05)/(L2+0.05). LLM haitumiki kabisa.

export interface Rgba { r: number; g: number; b: number; a: number; }

const NAMED: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", gray: "#808080", grey: "#808080", silver: "#c0c0c0", maroon: "#800000",
  purple: "#800080", fuchsia: "#ff00ff", lime: "#00ff00", olive: "#808000", navy: "#000080",
  teal: "#008080", aqua: "#00ffff", orange: "#ffa500", transparent: "rgba(0,0,0,0)",
};

/** Badilisha `color` ya CSS (hex/#rgb/#rrggbb, rgb()/rgba(), majina machache) kuwa Rgba; sivyo → null. */
export function parseColor(input: string): Rgba | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (NAMED[s]) s = NAMED[s];
  if (s.startsWith("#")) {
    const h = s.slice(1);
    if (h.length === 3) {
      const n = (i: number) => parseInt(h[i] + h[i], 16);
      return { r: n(0), g: n(1), b: n(2), a: 1 };
    }
    if (h.length === 6) {
      const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
      return { r: n(0), g: n(2), b: n(4), a: 1 };
    }
    return null;
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: clamp255(+m[1]), g: clamp255(+m[2]), b: clamp255(+m[3]), a: clamp01(a) };
  }
  return null;
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Uunganishaji wa alpha juu ya usuli (compositing) — `fg` juu ya `bg`. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  if (fg.a >= 1) return fg;
  const r = fg.a * fg.r + (1 - fg.a) * bg.r;
  const g = fg.a * fg.g + (1 - fg.a) * bg.g;
  const b = fg.a * fg.b + (1 - fg.a) * bg.b;
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: 1 };
}

/** Luminance I ya rango (WCAG formula) — bek ya code halisi, sio makadirio. */
export function luminance(c: Rgba): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** WCAG contrast ratio — 1..21. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Kigezo cha 8.3 `contrast_min` — YES (PASS au FAIL) + ratio ya kueleza. */
export function contrastPasses(fg: string, bg: string, min: number): { pass: boolean; ratio: number; detail: string } {
  const a = parseColor(fg);
  const b = parseColor(bg) || { r: 255, g: 255, b: 255, a: 1 }; // flat default ya usuli
  if (!a) return { pass: false, ratio: 0, detail: `color isiyosomwa: "${fg}"` };
  const eff = composite(a, b);
  const ratio = Math.round(contrastRatio(eff, b) * 100) / 100;
  return { pass: ratio >= min, ratio, detail: `contrast ${ratio} vs min ${min}` };
}
