/**
 * Generate a numeric hash code from a string
 * @param str - String to hash
 * @returns Hash code as a string
 */
export function hashCode(str: string): string {
  var hash = 0, i = 0, len = str.length;
  while ( i < len ) {
      hash  = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
  }
  return hash.toString();
}
