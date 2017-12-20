import { stripLastPathElement } from '../src/common';

describe('string functions:', () => {
  describe('stripLastPathElement', () => {
    it('should strip trailing filenames from a path', () => {
      const result = stripLastPathElement('/some/path/to/file.html');
      expect(result).toBe('/some/path/to');
    });

    it('should strip a filename (with no extension) from a path ', () => {
      const result = stripLastPathElement('/some/path/to/file');
      expect(result).toBe('/some/path/to');
    });

    it('should strip trailing filenames from a root path', () => {
      const result = stripLastPathElement('/file.html');
      expect(result).toBe('');
    });

    it('should strip a filename (with no extension) from a root path', () => {
      const result = stripLastPathElement('/file');
      expect(result).toBe('');
    });

    it('should strip a trailing slash', () => {
      expect(stripLastPathElement('/path/')).toBe('/path');
      expect(stripLastPathElement('/path/foo/')).toBe('/path/foo');
    });

    it('should return empty string given an empty string', () => {
      const result = stripLastPathElement('');
      expect(result).toBe('');
    });

    it('should return an empty string given a slash', () => {
      const result = stripLastPathElement('/');
      expect(result).toBe('');
    });
  });
});
