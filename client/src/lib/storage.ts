const SLUGS_KEY = 'tmh.slugs';
const ACTIVE_KEY = 'tmh.active';
const THEME_KEY = 'tmh.theme';

export function loadSlugs(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SLUGS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSlugs(slugs: string[]): void {
  localStorage.setItem(SLUGS_KEY, JSON.stringify(slugs.slice(0, 20)));
}

/** Add a slug to the tab list (deduped) and make it the active one. */
export function addSlug(slug: string): void {
  const slugs = loadSlugs();
  saveSlugs(slugs.includes(slug) ? slugs : [...slugs, slug]);
  saveActiveSlug(slug);
}

export function loadActiveSlug(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveSlug(slug: string): void {
  localStorage.setItem(ACTIVE_KEY, slug);
}

export type Theme = 'light' | 'dark';

export function loadTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
}
