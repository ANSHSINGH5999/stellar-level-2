const { formatAmount } = require('../lib/stellar');

describe('Stellar Module', () => {
  describe('formatAmount', () => {
    test('should format amount with default decimals', () => {
      expect(formatAmount('100.1234567')).toBe('100.1234567');
    });

    test('should format amount with custom decimals', () => {
      expect(formatAmount('100.1234567', 2)).toBe('100.12');
    });

    test('should handle zero', () => {
      expect(formatAmount('0')).toBe('0.0000000');
    });

    test('should format small decimal amounts', () => {
      expect(formatAmount('0.5', 2)).toBe('0.50');
    });

    test('should handle NaN input', () => {
      expect(formatAmount('invalid')).toBe('0.0000000');
    });

    test('should handle numeric input directly', () => {
      expect(formatAmount(5.5, 2)).toBe('5.50');
    });
  });

  describe('Swap function returns data', () => {
    test('should return cached result when available', () => {
      const mockPathData = {
        paths: [{ source_amount: '100', destination_amount: '50' }],
        timestamp: Date.now()
      };

      const { swapCache } = require('../lib/cache');
      swapCache.set('XLM:USDC_100', mockPathData);

      const cached = swapCache.get('XLM:USDC_100');
      expect(cached).toEqual(mockPathData);
    });
  });

  describe('Caching returns same result', () => {
    test('should return same cached result', () => {
      const { swapCache } = require('../lib/cache');
      const testData = { paths: ['path1'], timestamp: Date.now() };

      swapCache.set('test_key', testData);
      const result = swapCache.get('test_key');

      expect(result).toBe(testData);
    });

    test('should return null for expired cache', () => {
      const { Cache } = require('../lib/cache');
      const shortCache = new Cache(1);

      shortCache.set('key', 'data');

      return new Promise(resolve => {
        setTimeout(() => {
          const result = shortCache.get('key');
          expect(result).toBeNull();
          resolve();
        }, 10);
      });
    });

    test('should not return cached result after clear', () => {
      const { swapCache } = require('../lib/cache');
      swapCache.set('clear_test', { paths: [] });
      swapCache.clear();
      expect(swapCache.get('clear_test')).toBeNull();
    });
  });
});
