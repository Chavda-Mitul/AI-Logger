/**
 * Auth helpers - store/retrieve JWT from localStorage.
 */

const TOKEN_KEY = 'regulateai_token';
const USER_KEY = 'regulateai_user';

export function saveAuth(token: string, user: object) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser<T = unknown>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
