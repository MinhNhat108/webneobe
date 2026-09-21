/// <reference types="vite/client" />

/**
 * Resolves static asset paths relative to Vite's base URL.
 * Ensures compatibility with both local development (http://localhost:5173/)
 * and GitHub Pages subpaths (e.g. https://minhnhat108.github.io/webneobe/).
 */
export function resolveAssetUrl(url?: string): string {
  if (!url) return '';
  if (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }

  // Strip leading slash
  const clean = url.startsWith('/') ? url.slice(1) : url;
  const base = ((import.meta as any).env?.BASE_URL as string) || './';

  if (base.endsWith('/')) {
    return `${base}${clean}`;
  }
  return `${base}/${clean}`;
}
