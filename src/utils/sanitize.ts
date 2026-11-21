/**
 * Escapes special regex characters in user search input to prevent ReDoS and NoSQL regex injection.
 */
export const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
