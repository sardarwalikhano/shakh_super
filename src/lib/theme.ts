export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeValue = 'light' | 'dark';

export function resolveTheme(preference: ThemePreference): ThemeValue {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference: ThemePreference): ThemeValue {
  const actual = resolveTheme(preference);
  const root = document.documentElement;
  root.dataset.theme = actual;
  root.style.colorScheme = actual;
  window.dispatchEvent(new CustomEvent('shakh-theme-change', {
    detail: { preference, actual },
  }));
  return actual;
}

export function getCurrentTheme(): ThemeValue {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
