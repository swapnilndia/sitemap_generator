import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/batch-sitemap-generate/route.js';

// Mock dependencies
vi.mock('../../lib/batchSitemap.js', () => ({
  generateBatchSitemaps: vi.fn(() => Promise.resolve({
    success: true,
    jobId: 'sitemap_job_123',
    results: [
      {
        fileId: 'file1',
        sitemapCount: 1,
        sitemapFiles: ['sitemap1.xml'],
        urlCount: 100
      }
    ],
    errors: []
  }))
}));

// Mock global fileStorage
global.fileStorage = new Map();

describe('Batch Sitemap Generate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fileStorage.clear();
    
    // Setup mock converted JSON files
    global.fileStorage.set('batch_123_abc_file1_json', {
      fileId: 'batch_123_abc_file1_json',
      originalName: 'test1.xlsx',
      batchId: 'batch_123_abc',
      json: {
        data: [
          { url: 'https://example.com/1', group: 'products' },
          { url: 'https://example.com/2', group: 'products' }
        ],
        statistics: { validUrls: 2 }
      }
    });
  });

  describe('POST /api/batch-sitemap-generate', () => {
    it('should generate sitemaps successfully', async () => {
      const request = new NextRequest('https://example.com/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc',
          sitemapConfig: {
            grouping: 'group',
            changefreq: 'weekly',
            priority: '0.8',
            includeLastmod: false
          }
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBeDefined();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].sitemapCount).toBe(1);
    });

    it('should use default sitemap config when not provided', async () => {
      const request = new NextRequest('https://example.com/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Check that default config was used
      const { generateBatchSitemaps } = await import('../../lib/batchSitemap.js');
      expect(generateBatchSitemaps).toHaveBeenCalledWith(
        'batch_123_abc',
        expect.objectContaining({
          grouping: 'group', // Default should be 'group'
          changefreq: 'weekly',
          priority: '0.8',
          includeLastmod: false
        })
      );
    });

    it('should handle missing batch ID', async () => {
      const request = new NextRequest('https://example.com/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Batch ID is required');
    });

    it('should handle batch with no converted files', async () => {
      global.fileStorage.clear();

      const request = new NextRequest('https://example.com/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('No converted files found for batch');
    });

    it('should handle sitemap generation errors', async () => {
      const { generateBatchSitemaps } = await import('../../lib/batchSitemap.js');
      generateBatchSitemaps.mockRejectedValueOnce(new Error('Sitemap generation failed'));

      const request = new NextRequest('https://example.com/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Sitemap generation failed');
    });

    it('should handle different grouping configurations', async () => {
      const request = new NextRequest('https://example.com/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc',
          sitemapConfig: {
            grouping: 'none',
            changefreq: 'daily',
            priority: '1.0',
            includeLastmod: true
          }
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Check that custom config was used
      const { generateBatchSitemaps } = await import('../../lib/batchSitemap.js');
      expect(generateBatchSitemaps).toHaveBeenCalledWith(
        'batch_123_abc',
        expect.objectContaining({
          grouping: 'none',
          changefreq: 'daily',
          priority: '1.0',
          includeLastmod: true
        })
      );
    });

    it('should handle multiple files in batch', async () => {
      global.fileStorage.set('batch_123_abc_file2_json', {
        fileId: 'batch_123_abc_file2_json',
        originalName: 'test2.xlsx',
        batchId: 'batch_123_abc',
        json: {
          data: [
            { url: 'https://example.com/3', group: 'products' }
          ],
          statistics: { validUrls: 1 }
        }
      });

      const { generateBatchSitemaps } = await import('../../lib/batchSitemap.js');
      generateBatchSitemaps.mockResolvedValueOnce({
        success: true,
        jobId: 'sitemap_job_123',
        results: [
          {
            fileId: 'file1',
            sitemapCount: 1,
            sitemapFiles: ['sitemap1.xml'],
            urlCount: 2
          },
          {
            fileId: 'file2',
            sitemapCount: 1,
            sitemapFiles: ['sitemap2.xml'],
            urlCount: 1
          }
        ],
        errors: []
      });

      const request = new NextRequest('https://example.com/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(2);
      expect(data.totalSitemaps).toBe(2);
      expect(data.totalUrls).toBe(3);
    });

    it('should handle sitemap generation with errors', async () => {
      const { generateBatchSitemaps } = await import('../../lib/batchSitemap.js');
      generateBatchSitemaps.mockResolvedValueOnce({
        success: true,
        jobId: 'sitemap_job_123',
        results: [
          {
            fileId: 'file1',
            sitemapCount: 1,
            sitemapFiles: ['sitemap1.xml'],
            urlCount: 2
          }
        ],
        errors: [
          {
            fileId: 'file2',
            error: 'Invalid URL format'
          }
        ]
      });

      const request = new NextRequest('https://example.com/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(1);
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0].error).toContain('Invalid URL format');
    });
  });
});
