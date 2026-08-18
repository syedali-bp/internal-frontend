// Single source of truth for palette values. Components import from here so a
// rebrand is one edit rather than a grep across every StyleSheet.
export const colors = {
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

  // JSON preview
  codeBg: '#0b0f0d',
  codeText: '#d8ffe5',
  codeLabel: '#89a18f',
} as const
