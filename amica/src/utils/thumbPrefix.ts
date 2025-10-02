/**
 * Generate thumbnail path by adding "thumb-" prefix to filename
 * @param path - Original file path
 * @returns Path with thumb- prefix added to filename
 * @example thumbPrefix("/images/avatar.jpg") => "/images/thumb-avatar.jpg"
 */
export function thumbPrefix(path: string) {
  const a = path.split("/");
  a[a.length - 1] = "thumb-" + a[a.length - 1];
  return a.join("/");
}
