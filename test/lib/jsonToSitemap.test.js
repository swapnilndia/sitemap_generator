import { describe, it, expect } from 'vitest';
import {
  processJsonForSitemap,
  previewSitemapsFromJson,
  convertJsonToUrlGenerator
} from '../../lib/jsonToSitemap.js';

describe('JSON to Sitemap', () => {
  const mockOptimizedJsonData = {
    urls: [
      {
        loc: 'https://example.com/page1',
        lastmod: '2024-01-01',
        changefreq: 'weekly',
        priority: '0.8',
        group: 'products'
      },
      {
        loc: 'https://example.com/page2',
        group: 'blog'
      },
      {
        loc: 'https://example.com/page3',
        lastmod: '2024-01-02',
        group: 'products'
      }
    ],
    statistics: {
      validUrls: 3,
      totalUrls: 3,
      excludedUrls: 0,
      duplicateUrls: 0
    },
    metadata: {
      createdAt: '2024-01-01T00:00:00.000Z',
      fileId: 'test_123'
    }
  };

  describe('processJsonForSitemap', () => {
    it('should process optimized JSON data correctly', () => {
      const result = processJsonForSitemap(mockOptimizedJsonData, 50000);
      
      expect(result.totalValidUrls).toBe(3);
      expect(result.sitemapFiles).toHaveLength(2); // Two groups = two files
      expect(result.groupedUrls.size).toBe(2); // products and blog groups
      
      // Check that files are created for each group
      const filenames = result.sitemapFiles.map(f => f.filename);
      expect(filenames).toContain('sitemap_products_1.xml');
      expect(filenames).toContain('sitemap_blog_1.xml');
    });

    it('should split large datasets into multiple files', () => {
      const largeDataset = {
        ...mockOptimizedJsonData,
        urls: Array(150000).fill(null).map((_, i) => ({
          loc: `https://example.com/page${i}`,
          group: 'default'
        })),
        statistics: { validUrls: 150000 }
      };

      const result = processJsonForSitemap(largeDataset, 50000);
      
      expect(result.sitemapFiles.length).toBe(3); // 150k / 50k = 3 files
      expect(result.sitemapFiles[0].filename).toBe('sitemap_default_1.xml');
      expect(result.sitemapFiles[1].filename).toBe('sitemap_default_2.xml');
      expect(result.sitemapFiles[2].filename).toBe('sitemap_default_3.xml');
    });

    it('should handle empty URL array', () => {
      const emptyData = {
        urls: [],
        statistics: { validUrls: 0 },
        metadata: {}
      };

      const result = processJsonForSitemap(emptyData, 50000);
      
      expect(result.totalValidUrls).toBe(0);
      expect(result.sitemapFiles).toHaveLength(0);
      expect(result.groupedUrls.size).toBe(0);
    });

    it('should preserve URL attributes correctly', () => {
      const result = processJsonForSitemap(mockOptimizedJsonData, 50000);
      const firstUrl = result.sitemapFiles[0].urls[0];
      
      expect(firstUrl.loc).toBe('https://example.com/page1');
      expect(firstUrl.lastmod).toBe('2024-01-01');
      expect(firstUrl.changefreq).toBe('weekly');
      expect(firstUrl.priority).toBe('0.8');
    });
  });

  describe('previewSitemapsFromJson', () => {
    it('should generate correct preview information', () => {
      const preview = previewSitemapsFromJson(mockOptimizedJsonData, 50000);
      
      expect(preview.totalFiles).toBe(2); // Two groups = two files
      expect(preview.needsIndex).toBe(true); // Multiple files need index
      expect(preview.files).toHaveLength(2);
      expect(preview.groups).toContain('products');
      expect(preview.groups).toContain('blog');
      expect(preview.statistics.validUrls).toBe(3);
    });

    it('should indicate need for index when multiple files', () => {
      const largeDataset = {
        ...mockOptimizedJsonData,
        urls: Array(75000).fill(null).map((_, i) => ({
          loc: `https://example.com/page${i}`,
          group: 'default'
        })),
        statistics: { validUrls: 75000 }
      };

      const preview = previewSitemapsFromJson(largeDataset, 50000);
      
      expect(preview.totalFiles).toBe(2);
      expect(preview.needsIndex).toBe(true);
      expect(preview.files[0].filename).toBe('sitemap_default_1.xml');
      expect(preview.files[1].filename).toBe('sitemap_default_2.xml');
    });

    it('should handle empty data gracefully', () => {
      const emptyData = {
        urls: [],
        statistics: { validUrls: 0 }
      };

      const preview = previewSitemapsFromJson(emptyData, 50000);
      
      expect(preview.totalFiles).toBe(0);
      expect(preview.needsIndex).toBe(false);
      expect(preview.files).toHaveLength(0);
      expect(preview.groups).toHaveLength(0);
    });
  });

  describe('convertJsonToUrlGenerator', () => {
    it('should convert legacy JSON format to URL generator format', async () => {
      const legacyJsonData = {
        data: [
          {
            'Product Name': 'Test Product',
            'SKU': 'TEST123',
            processed: {
              url: 'https://example.com/products/test123',
              excluded: false,
              isDuplicate: false,
              group: 'products'
            },
            rowNumber: 1
          }
        ]
      };

      const generator = convertJsonToUrlGenerator(legacyJsonData);
      const urls = [];
      
      for await (const urlEntry of generator) {
        urls.push(urlEntry);
      }
      
      expect(urls).toHaveLength(1);
      expect(urls[0].loc).toBe('https://example.com/products/test123');
      expect(urls[0].group).toBe('products');
      expect(urls[0].rowNumber).toBe(1);
    });

    it('should handle missing required fields', async () => {
      const invalidData = {
        data: [
          {
            'Product Name': 'Test Product',
            processed: {
              excluded: true,
              isDuplicate: false
            }
          },
          {
            'Product Name': 'Valid Product',
            processed: {
              url: 'https://example.com/valid',
              excluded: false,
              isDuplicate: false,
              group: 'products'
            },
            rowNumber: 2
          }
        ]
      };

      const generator = convertJsonToUrlGenerator(invalidData);
      const urls = [];
      
      for await (const urlEntry of generator) {
        urls.push(urlEntry);
      }
      
      expect(urls).toHaveLength(1); // Should skip excluded entries
      expect(urls[0].loc).toBe('https://example.com/valid');
    });
  });
});