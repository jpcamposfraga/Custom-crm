export interface QueryOptions {
  busca?: string;
  nicho?: string;
  regiao?: string;
}

/**
 * Builds a search query string from CLI arguments or user input.
 */
export function buildSearchQuery(options: QueryOptions): string {
  if (options.busca && options.busca.trim()) {
    return options.busca.trim();
  }

  const parts: string[] = [];
  if (options.nicho && options.nicho.trim()) {
    parts.push(options.nicho.trim());
  }

  if (options.regiao && options.regiao.trim()) {
    if (parts.length > 0) {
      parts.push(`em ${options.regiao.trim()}`);
    } else {
      parts.push(options.regiao.trim());
    }
  }

  return parts.join(' ');
}
