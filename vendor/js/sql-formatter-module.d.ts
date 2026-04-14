/**
 * Type declarations for the vendored sql-formatter module wrapper.
 */
export type SqlFormatOptions = {
  language?: string;
  indent?: string;
  uppercase?: boolean;
  linesBetweenQueries?: number;
  [key: string]: unknown;
};

export function format(sql: string, options?: SqlFormatOptions): string;
