export interface StoredEndpoint {
  token: string;
  name: string;
  createdAt: number;
}

const KEY = 'testmyhook.endpoints';

export function listStoredEndpoints(): StoredEndpoint[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberEndpoint(entry: StoredEndpoint): void {
  const rest = listStoredEndpoints().filter(e => e.token !== entry.token);
  localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, 50)));
}

export function forgetEndpoint(token: string): void {
  localStorage.setItem(KEY, JSON.stringify(listStoredEndpoints().filter(e => e.token !== token)));
}

export function renameStoredEndpoint(oldToken: string, next: Partial<StoredEndpoint>): void {
  const entries = listStoredEndpoints().map(e => (e.token === oldToken ? { ...e, ...next } : e));
  localStorage.setItem(KEY, JSON.stringify(entries));
}
