import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveJsonFile, loadJsonFile, clearAllFiles } from '../../lib/fileStorage.js';
import { processJsonForSitemap, previewSitemapsFromJson } from '../../lib/jsonToSitemap.js';

describe('Large File Performance', () => {
  beforeEach(async () => {
    await clearAllFiles();
  });

  afterEach(async () => {
    await clearAllFiles();
  });

  it('should handle 100k URLs efficiently', async () => {
    const startTime = Date.now();
    
    // Create large dataset
    const largeDataset = {
      data: Array(100000).fill(null).map((_, i) => ({
        processed: {
          url: `https://example.com/page${i}`,
          group: `category${i % 10}`, // 10 different categories
          lastmod: '2024-01-01',
          changefreq: 'weekly',
          priority: '0.5',
          excluded: false,
          isDuplicate: false
        }
      }))
    };

    // Save large file
    const saveResult = await saveJsonFile('large_test', largeDataset);
    expect(saveResult.success).toBe(true);
    expect(saveResult.statistics.validUrls).toBe(100000);

    const saveTime = Date.now() - startTime;
    console.log(`Save time for 100k URLs: ${saveTime}ms`);
    expect(saveTime).toBeLessThan(5000); // Should complete within 5 seconds

    // Load and verify
    const loadStart = Date.now();
    const loadResult = await loadJsonFile('large_test');
    const loadTime = Date.now() - loadStart;
    
    expect(loadResult.success).toBe(true);
    expect(loadResult.data.urls).toHaveLength(100000);
    
    console.log(`Load time for 100k URLs: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds
  }, 10000); // 10 second timeout

  it('should process large datasets for sitemap generation efficiently', async () => {
    // Create optimized large dataset
    const largeOptimizedDataset = {
      urls: Array(50000).fill(null).map((_, i) => ({
        loc: `https://example.com/page${i}`,
        group: `category${i % 5}`,
        lastmod: '2024-01-01',
        changefreq: 'weekly',
        priority: '0.5'
      })),
      statistics: {
        validUrls: 50000,
        totalUrls: 50000,
        excludedUrls: 0,
        duplicateUrls: 0
      },
      metadata: {
        createdAt: new Date().toISOString(),
        fileId: 'large_test'
      }
    };

    const processStart = Date.now();
    const processed = processJsonForSitemap(largeOptimizedDataset, 50000);
    const processTime = Date.now() - processStart;

    expect(processed.totalValidUrls).toBe(50000);
    expect(processed.sitemapFiles).toHaveLength(5); // 5 groups = 5 files
    expect(processed.groupedUrls.size).toBe(5);

    console.log(`Process time for 50k URLs: ${processTime}ms`);
    expect(processTime).toBeLessThan(1000); // Should process within 1 second
  });

  it('should generate preview for large datasets efficiently', async () => {
    const largeOptimizedDataset = {
      urls: Array(75000).fill(null).map((_, i) => ({
        loc: `https://example.com/page${i}`,
        group: `category${i % 3}`,
        lastmod: '2024-01-01'
      })),
      statistics: { validUrls: 75000 }
    };

    const previewStart = Date.now();
    const preview = previewSitemapsFromJson(largeOptimizedDataset, 50000);
    const previewTime = Date.now() - previewStart;

    expect(preview.totalFiles).toBe(3); // 3 groups = 3 files (each group has 25k URLs, under 50k limit)
    expect(preview.needsIndex).toBe(true);
    expect(preview.groups).toHaveLength(3);

    console.log(`Preview time for 75k URLs: ${previewTime}ms`);
    expect(previewTime).toBeLessThan(500); // Should preview within 0.5 seconds
  });

  it('should handle memory efficiently with very large datasets', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Create and process multiple large datasets
    for (let i = 0; i < 5; i++) {
      const dataset = {
        urls: Array(20000).fill(null).map((_, j) => ({
          loc: `https://example.com/batch${i}/page${j}`,
          group: 'default'
        })),
        statistics: { validUrls: 20000 }
      };

      await saveJsonFile(`batch_${i}`, { data: [] }); // Simulate conversion
      const processed = processJsonForSitemap(dataset, 50000);
      expect(processed.totalValidUrls).toBe(20000);
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

    console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    expect(memoryIncrease).toBeLessThan(100); // Should not increase by more than 100MB
  });

  it('should handle concurrent file operations', async () => {
    const concurrentOperations = Array(10).fill(null).map(async (_, i) => {
      const dataset = {
        data: Array(1000).fill(null).map((_, j) => ({
          processed: {
            url: `https://example.com/concurrent${i}/page${j}`,
            excluded: false,
            isDuplicate: false
          }
        }))
      };

      const saveResult = await saveJsonFile(`concurrent_${i}`, dataset);
      expect(saveResult.success).toBe(true);

      const loadResult = await loadJsonFile(`concurrent_${i}`);
      expect(loadResult.success).toBe(true);
      expect(loadResult.data.urls).toHaveLength(1000);

      return `concurrent_${i}`;
    });

    const results = await Promise.all(concurrentOperations);
    expect(results).toHaveLength(10);
  });
});