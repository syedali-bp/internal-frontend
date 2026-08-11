// Single source of truth for palette values. Components import from here so a
// rebrand is one edit rather than a grep across every StyleSheet.
export const colors = {
  // Surfaces
  screen: '#ffffff',
  surface: '#ffffff',
  headerBg: '#f7f8fa',
  border: '#dfe3e8',
  inputBorder: '#c9ced6',
  backdrop: 'rgba(0,0,0,0.35)',

  // Text
  text: '#1f2430',
  textSubtle: '#3a4250',
  textMuted: '#5b6472',
  placeholder: '#9aa0aa',

  // Variant / brand accent
  primary: '#6b4ef0',
  primarySoft: '#b3a4e8',
  primaryBorder: '#d9cffa',
  primaryBg: '#faf8ff',
  primaryHighlight: '#f0ecfe',

  // Attribute section accent
  attribute: '#2e7d4f',
  attributeBorder: '#cfe9d5',
  attributeBg: '#f5fbf6',

  // Feedback
  danger: '#d14343',
  dangerText: '#c0392b',
  dangerBorder: '#f3c2c2',
  dangerBg: '#fdf3f3',

  // Call to action
  accent: '#f26522',
  onAccent: '#ffffff',

  // JSON preview
  codeBg: '#1f2430',
  codeText: '#d7e3ff',
  codeLabel: '#9aa0aa',
} as const
