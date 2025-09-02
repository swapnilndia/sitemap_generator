import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generateBatchSitemaps, 
  generateSitemapForFile, 
  createSitemapFile, 
  groupUrls,
  getSitemapJobStatus,
  getSitemapFiles,
  createSitemapZip
} from '../../lib/batchSitemap.js';

// Mock dependencies
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  readdir: vi.fn(() => Promise.resolve(['sitemap1.xml', 'sitemap2.xml'])),
  stat: vi.fn(() => Promise.resolve({ size: 1024, birthtime: new Date() })),
  access: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve())
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/'))
}));

vi.mock('archiver', () => ({
  create: vi.fn(() => ({
    append: vi.fn(),
    finalize: vi.fn(() => Promise.resolve()),
    on: vi.fn()
  }))
}));

// Mock global sitemapJobs
global.sitemapJobs = new Map();

describe('Batch Sitemap Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.sitemapJobs.clear();
  });

  describe('generateBatchSitemaps', () => {
    it('should generate sitemaps for batch successfully', async () => {
      const batchId = 'batch_123_abc';
      const config = {
        grouping: 'group',
        changefreq: 'weekly',
        priority: '0.8',
        includeLastmod: false
      };

      const filesToProcess = [
        {
          fileId: 'file1',
          originalName: 'test1.xlsx',
          json: {
            data: [
              { url: 'https://example.com/1', group: 'products' },
              { url: 'https://example.com/2', group: 'products' }
            ],
            statistics: { validUrls: 2 }
          }
        }
      ];

      // Mock the generateSitemapForFile function
      vi.spyOn(require('../../lib/batchSitemap.js'), 'generateSitemapForFile')
        .mockResolvedValue({
          fileId: 'file1',
          sitemapCount: 1,
          sitemapFiles: ['sitemap1.xml'],
          urlCount: 2
        });

      const result = await generateBatchSitemaps(batchId, config);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].sitemapCount).toBe(1);
    });

    it('should handle sitemap generation errors', async () => {
      const batchId = 'batch_123_abc';
      const config = {
        grouping: 'group',
        changefreq: 'weekly',
        priority: '0.8',
        includeLastmod: false
      };

      const filesToProcess = [
        {
          fileId: 'file1',
          originalName: 'test1.xlsx',
          json: {
            data: [
              { url: 'https://example.com/1', group: 'products' }
            ],
            statistics: { validUrls: 1 }
          }
        }
      ];

      // Mock the generateSitemapForFile function to throw an error
      vi.spyOn(require('../../lib/batchSitemap.js'), 'generateSitemapForFile')
        .mockRejectedValue(new Error('Sitemap generation failed'));

      const result = await generateBatchSitemaps(batchId, config);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Sitemap generation failed');
    });
  });

  describe('generateSitemapForFile', () => {
    it('should generate sitemap for file with group grouping', async () => {
      const batchId = 'batch_123_abc';
      const file = {
        fileId: 'file1',
        originalName: 'test1.xlsx',
        json: {
          data: [
            { url: 'https://example.com/1', group: 'products' },
            { url: 'https://example.com/2', group: 'products' },
            { url: 'https://example.com/3', group: 'categories' }
          ],
          statistics: { validUrls: 3 }
        }
      };
      const config = {
        grouping: 'group',
        changefreq: 'weekly',
        priority: '0.8',
        includeLastmod: false
      };
      const jobId = 'sitemap_job_123';

      // Mock the createSitemapFile function
      vi.spyOn(require('../../lib/batchSitemap.js'), 'createSitemapFile')
        .mockResolvedValue({
          success: true,
          sitemapPath: '/temp/sitemaps/sitemap1.xml',
          urlCount: 2
        })
        .mockResolvedValueOnce({
          success: true,
          sitemapPath: '/temp/sitemaps/sitemap1.xml',
          urlCount: 2
        })
        .mockResolvedValueOnce({
          success: true,
          sitemapPath: '/temp/sitemaps/sitemap2.xml',
          urlCount: 1
        });

      const result = await generateSitemapForFile(batchId, file, config, jobId);

      expect(result.fileId).toBe('file1');
      expect(result.sitemapCount).toBe(2);
      expect(result.sitemapFiles).toHaveLength(2);
      expect(result.urlCount).toBe(3);
    });

    it('should handle file with no URLs', async () => {
      const batchId = 'batch_123_abc';
      const file = {
        fileId: 'file1',
        originalName: 'test1.xlsx',
        json: {
          data: [],
          statistics: { validUrls: 0 }
        }
      };
      const config = {
        grouping: 'group',
        changefreq: 'weekly',
        priority: '0.8',
        includeLastmod: false
      };
      const jobId = 'sitemap_job_123';

      const result = await generateSitemapForFile(batchId, file, config, jobId);

      expect(result.fileId).toBe('file1');
      expect(result.sitemapCount).toBe(0);
      expect(result.sitemapFiles).toHaveLength(0);
      expect(result.urlCount).toBe(0);
    });

    it('should handle file with invalid JSON structure', async () => {
      const batchId = 'batch_123_abc';
      const file = {
        fileId: 'file1',
        originalName: 'test1.xlsx',
        json: {
          // Missing data array
          statistics: { validUrls: 0 }
        }
      };
      const config = {
        grouping: 'group',
        changefreq: 'weekly',
        priority: '0.8',
        includeLastmod: false
      };
      const jobId = 'sitemap_job_123';

      const result = await generateSitemapForFile(batchId, file, config, jobId);

      expect(result.fileId).toBe('file1');
      expect(result.sitemapCount).toBe(0);
      expect(result.sitemapFiles).toHaveLength(0);
      expect(result.urlCount).toBe(0);
    });
  });

  describe('createSitemapFile', () => {
    it('should create valid XML sitemap file', async () => {
      const urls = [
        { url: 'https://example.com/1', group: 'products' },
        { url: 'https://example.com/2', group: 'products' }
      ];
      const config = {
        changefreq: 'weekly',
        priority: '0.8',
        includeLastmod: false
      };
      const fileId = 'file1';
      const groupName = 'products';
      const jobId = 'sitemap_job_123';

      const result = await createSitemapFile(urls, config, fileId, groupName, jobId);

      expect(result.success).toBe(true);
      expect(result.sitemapPath).toBeDefined();
      expect(result.urlCount).toBe(2);
    });

    it('should handle empty URL list', async () => {
      const urls = [];
      const config = {
        changefreq: 'weekly',
        priority: '0.8',
        includeLastmod: false
      };
      const fileId = 'file1';
      const groupName = 'products';
      const jobId = 'sitemap_job_123';

      const result = await createSitemapFile(urls, config, fileId, groupName, jobId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No URLs to process');
    });

    it('should handle XML generation errors', async () => {
      const urls = [
        { url: 'https://example.com/1', group: 'products' }
      ];
      const config = {
        changefreq: 'weekly',
        priority: '0.8',
        includeLastmod: false
      };
      const fileId = 'file1';
      const groupName = 'products';
      const jobId = 'sitemap_job_123';

      // Mock fs.writeFile to throw an error
      const fs = await import('fs/promises');
      fs.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      const result = await createSitemapFile(urls, config, fileId, groupName, jobId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Write failed');
    });
  });

  describe('groupUrls', () => {
    it('should group URLs by group property', () => {
      const urls = [
        { url: 'https://example.com/1', group: 'products' },
        { url: 'https://example.com/2', group: 'products' },
        { url: 'https://example.com/3', group: 'categories' }
      ];
      const config = { grouping: 'group' };

      const result = groupUrls(urls, config);

      expect(result).toEqual({
        'products': [
          { url: 'https://example.com/1', group: 'products' },
          { url: 'https://example.com/2', group: 'products' }
        ],
        'categories': [
          { url: 'https://example.com/3', group: 'categories' }
        ]
      });
    });

    it('should use auto grouping when group property is missing', () => {
      const urls = [
        { url: 'https://example.com/1' },
        { url: 'https://example.com/2' }
      ];
      const config = { grouping: 'group' };

      const result = groupUrls(urls, config);

      expect(result).toEqual({
        'sitemap': [
          { url: 'https://example.com/1' },
          { url: 'https://example.com/2' }
        ]
      });
    });

    it('should use none grouping', () => {
      const urls = [
        { url: 'https://example.com/1', group: 'products' },
        { url: 'https://example.com/2', group: 'categories' }
      ];
      const config = { grouping: 'none' };

      const result = groupUrls(urls, config);

      expect(result).toEqual({
        'sitemap': [
          { url: 'https://example.com/1', group: 'products' },
          { url: 'https://example.com/2', group: 'categories' }
        ]
      });
    });
  });

  describe('getSitemapJobStatus', () => {
    it('should return job status when job exists', () => {
      const jobId = 'sitemap_job_123';
      const job = {
        jobId,
        batchId: 'batch_123_abc',
        status: 'completed',
        config: { grouping: 'group' },
        files: [{ fileId: 'file1' }],
        results: [{ sitemapCount: 1 }],
        errors: [],
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date()
      };

      global.sitemapJobs.set(jobId, job);

      const result = getSitemapJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result.jobId).toBe(jobId);
      expect(result.status).toBe('completed');
      expect(result.sitemapCount).toBe(1);
    });

    it('should return null when job does not exist', () => {
      const result = getSitemapJobStatus('nonexistent_job');

      expect(result).toBeNull();
    });
  });

  describe('getSitemapFiles', () => {
    it('should return sitemap files for job', async () => {
      const jobId = 'sitemap_job_123';
      const job = {
        jobId,
        batchId: 'batch_123_abc',
        status: 'completed'
      };

      global.sitemapJobs.set(jobId, job);

      const fs = await import('fs/promises');
      fs.readdir.mockResolvedValue(['sitemap1.xml', 'sitemap2.xml']);
      fs.stat
        .mockResolvedValueOnce({ size: 1024, birthtime: new Date() })
        .mockResolvedValueOnce({ size: 2048, birthtime: new Date() });

      const result = await getSitemapFiles(jobId);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files[0].fileName).toBe('sitemap1.xml');
      expect(result.files[1].fileName).toBe('sitemap2.xml');
    });

    it('should handle job not found in memory but files exist on disk', async () => {
      const jobId = 'sitemap_job_123';

      // Job not in memory
      global.sitemapJobs.clear();

      const fs = await import('fs/promises');
      fs.readdir.mockResolvedValue(['sitemap1.xml']);
      fs.stat.mockResolvedValue({ size: 1024, birthtime: new Date() });

      const result = await getSitemapFiles(jobId);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
    });

    it('should handle directory not found', async () => {
      const jobId = 'sitemap_job_123';
      const job = {
        jobId,
        batchId: 'batch_123_abc',
        status: 'completed'
      };

      global.sitemapJobs.set(jobId, job);

      const fs = await import('fs/promises');
      fs.readdir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await getSitemapFiles(jobId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No sitemap files found');
    });
  });

  describe('createSitemapZip', () => {
    it('should create ZIP archive of sitemap files', async () => {
      const jobId = 'sitemap_job_123';
      const job = {
        jobId,
        batchId: 'batch_123_abc',
        status: 'completed'
      };

      global.sitemapJobs.set(jobId, job);

      const fs = await import('fs/promises');
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: 1024 });

      const result = await createSitemapZip(jobId);

      expect(result.success).toBe(true);
      expect(result.zipPath).toBeDefined();
      expect(result.zipFileName).toBeDefined();
      expect(result.fileSize).toBe(1024);
    });

    it('should handle job not found in memory but files exist on disk', async () => {
      const jobId = 'sitemap_job_123';

      // Job not in memory
      global.sitemapJobs.clear();

      const fs = await import('fs/promises');
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: 1024 });

      const result = await createSitemapZip(jobId);

      expect(result.success).toBe(true);
      expect(result.zipPath).toBeDefined();
    });

    it('should handle no sitemap files found', async () => {
      const jobId = 'sitemap_job_123';
      const job = {
        jobId,
        batchId: 'batch_123_abc',
        status: 'completed'
      };

      global.sitemapJobs.set(jobId, job);

      const fs = await import('fs/promises');
      fs.access.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await createSitemapZip(jobId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No sitemap files found');
    });
  });
});
