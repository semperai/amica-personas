import { describe, it, expect } from 'vitest';
import { addThumbnailPrefix } from '../src/utils/addThumbnailPrefix';

describe('addThumbnailPrefix', () => {
  it('should add thumb- prefix to filename in simple path', () => {
    expect(addThumbnailPrefix('avatar.jpg')).toBe('thumb-avatar.jpg');
  });

  it('should add thumb- prefix to filename with directory path', () => {
    expect(addThumbnailPrefix('/images/avatar.jpg')).toBe('/images/thumb-avatar.jpg');
  });

  it('should add thumb- prefix to filename with multiple directory levels', () => {
    expect(addThumbnailPrefix('/assets/images/avatars/user.png')).toBe('/assets/images/avatars/thumb-user.png');
  });

  it('should handle files without extension', () => {
    expect(addThumbnailPrefix('/images/avatar')).toBe('/images/thumb-avatar');
  });

  it('should handle files with multiple dots in name', () => {
    expect(addThumbnailPrefix('/images/my.avatar.image.jpg')).toBe('/images/thumb-my.avatar.image.jpg');
  });

  it('should handle empty string', () => {
    expect(addThumbnailPrefix('')).toBe('thumb-');
  });

  it('should handle root path with filename', () => {
    expect(addThumbnailPrefix('/avatar.jpg')).toBe('/thumb-avatar.jpg');
  });

  it('should handle relative paths', () => {
    expect(addThumbnailPrefix('./images/avatar.jpg')).toBe('./images/thumb-avatar.jpg');
    expect(addThumbnailPrefix('../images/avatar.jpg')).toBe('../images/thumb-avatar.jpg');
  });

  it('should preserve trailing slash behavior', () => {
    expect(addThumbnailPrefix('/images/')).toBe('/images/thumb-');
  });

  it('should handle Windows-style paths', () => {
    expect(addThumbnailPrefix('C:\\images\\avatar.jpg')).toBe('C:\\images\\thumb-avatar.jpg');
  });
});
