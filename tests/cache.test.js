const { Cache, swapCache } = require('../lib/cache');

describe('Cache Module', () => {
  describe('Cache class', () => {
    let cache;

    beforeEach(() => {
      cache = new Cache(60000);
    });

    test('should return null for non-existent key', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeNull();
    });

    test('should store and retrieve data', () => {
      const testData = { paths: ['path1', 'path2'] };
      cache.set('testKey', testData);
      const result = cache.get('testKey');
      expect(result).toEqual(testData);
    });

    test('should generate correct cache key', () => {
      const key = cache.generateKey('XLM', 'USDC', '100');
      expect(key).toBe('XLM_USDC_100');
    });

    test('should clear all cached data', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    test('should return same result from cache', () => {
      const testData = { paths: ['cached_path'] };
      swapCache.set('test_key', testData);
      const cached = swapCache.get('test_key');
      expect(cached).toEqual(testData);
    });
  });
});
