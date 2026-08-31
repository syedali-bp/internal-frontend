// Single source of truth for palette values. Components import from here so a
// rebrand is one edit rather than a grep across every StyleSheet.
//
// Two palettes, same keys. `darkColors` is the original and remains what a
// plain `colors` import gets, so the screens that have not been migrated to the
// theme hook keep rendering exactly as before — see the note on `colors` below.
export const darkColors = {
  // Surfaces
  screen: '#050607',
  surface: '#0f1311',
  headerBg: '#111613',
  border: '#223027',
  inputBorder: '#304237',
  backdrop: 'rgba(0,0,0,0.72)',

  // Text
  text: '#eef3ee',
  textSubtle: '#c5d0c6',
  textMuted: '#8fa094',
  placeholder: '#65746a',

  // Variant / brand accent
  primary: '#27c26a',
  primarySoft: '#3b7a54',
  primaryBorder: '#244c32',
  primaryBg: '#0f1a13',
  primaryHighlight: '#16331f',

  // Attribute section accent
  attribute: '#66d18a',
  attributeBorder: '#23402d',
  attributeBg: '#0d1510',

  // Feedback
  danger: '#ff6b6b',
  dangerText: '#ff8a8a',
  dangerBorder: '#4d2424',
  dangerBg: '#1a0f10',

  // Call to action
  accent: '#27c26a',
  onAccent: '#07110a',

  // Eyebrow / attention label. The only warm value in the palette, so it reads
  // as a badge rather than as another piece of body text.
  eyebrow: '#f5b544',

  // JSON preview
  codeBg: '#0b0f0d',
  codeText: '#d8ffe5',
  codeLabel: '#89a18f',
} as const

/**
 * The light palette.
 *
 * Same keys as `darkColors`, and `Palette` below makes that a compile error to
 * get wrong rather than a missing colour discovered by looking at a screen.
 *
 * Not a mechanical inversion: on a light ground the accent green has to darken
 * to stay legible as text, and the near-black surfaces become near-whites
 * separated by borders rather than by brightness.
 */
export const lightColors: Palette = {
  // Surfaces
  screen: '#f5f6f5',
  surface: '#ffffff',
  headerBg: '#ffffff',
  border: '#dbe2dc',
  inputBorder: '#c3cec6',
  backdrop: 'rgba(15,19,17,0.35)',

  // Text
  text: '#0d1310',
  textSubtle: '#3d4a41',
  textMuted: '#5f6f65',
  placeholder: '#93a099',

  // Variant / brand accent. Darker than the dark palette's: #27c26a on white
  // does not carry enough contrast for text.
  primary: '#0f8f45',
  primarySoft: '#3b7a54',
  primaryBorder: '#b7ddc6',
  primaryBg: '#eef8f2',
  primaryHighlight: '#dcf0e5',

  // Attribute section accent
  attribute: '#0f8f45',
  attributeBorder: '#c6e3d2',
  attributeBg: '#f1f9f4',

  // Feedback
  danger: '#c0392b',
  dangerText: '#a5281c',
  dangerBorder: '#efc2bd',
  dangerBg: '#fdf1ef',

  // Call to action. Kept the saturated green so the primary button reads the
  // same in both themes; only the text on it changes.
  accent: '#12a355',
  onAccent: '#ffffff',

  // Eyebrow / attention label, darkened from #f5b544 which is unreadable on
  // white while staying the same warm hue.
  eyebrow: '#9a6b06',

  // JSON preview
  codeBg: '#f0f4f1',
  codeText: '#123a22',
  codeLabel: '#5f7368',
}

/**
 * Every palette has exactly these keys.
 *
 * The values widen to `string` because `darkColors` is `as const`, which pins
 * each one to its own literal — without this, a light palette could only
 * type-check by being the dark palette. The keys stay exact, so a missing or
 * misspelled colour is still a compile error.
 */
export type Palette = { -readonly [K in keyof typeof darkColors]: string }

/**
 * The dark palette, under its original name.
 *
 * Kept so the screens still importing `colors` directly — Scan, Add, Review and
 * the shared components — go on working untouched. Those read it at module
 * scope inside `StyleSheet.create`, which evaluates once at import and so can
 * never react to a theme change; migrating them means moving their styles into
 * the component. Until that happens they are dark regardless of the toggle.
 *
 * New code should use `useColors()` instead.
 */
export const colors = darkColors
