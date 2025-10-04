/**
 * Generate thumbnail path by adding "thumb-" prefix to filename
 * @param path - Original file path
 * @returns Path with thumb- prefix added to filename
 * @example addThumbnailPrefix("/images/avatar.jpg") => "/images/thumb-avatar.jpg"
 */
export function addThumbnailPrefix(path: string) {
  const separator = path.includes('\\') ? '\\' : '/';
  const a = path.split(separator);
  a[a.length - 1] = "thumb-" + a[a.length - 1];
  return a.join(separator);
}
