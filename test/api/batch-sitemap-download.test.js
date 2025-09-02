import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../../app/api/batch-sitemap-download/route.js';

// Mock dependencies
vi.mock('../../lib/batchSitemap.js', () => ({
  getSitemapJobStatus: vi.fn(),
  getSitemapFiles: vi.fn(),
  createSitemapZip: vi.fn()
}));

vi.mock('../../lib/batchDownload.js', () => ({
  generateDownloadUrl: vi.fn(() => 'download_token_123'),
  validateDownloadToken: vi.fn()
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  access: vi.fn()
}));

describe('Batch Sitemap Download API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/batch-sitemap-download', () => {
    it('should prepare ZIP download successfully', async () => {
      const { getSitemapJobStatus, createSitemapZip } = await import('../../lib/batchSitemap.js');
      const { generateDownloadUrl } = await import('../../lib/batchDownload.js');

      getSitemapJobStatus.mockReturnValue({
        jobId: 'sitemap_job_123',
        status: 'completed',
        sitemapCount: 2
      });

      createSitemapZip.mockResolvedValue({
        success: true,
        zipPath: '/temp/sitemaps/sitemaps_job_123.zip',
        zipFileName: 'sitemaps_job_123.zip',
        fileSize: 1024
      });

      generateDownloadUrl.mockReturnValue('download_token_123');

      const request = new NextRequest('http://localhost/api/batch-sitemap-download', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'sitemap_job_123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.downloadToken).toBe('download_token_123');
      expect(data.type).toBe('zip');
      expect(data.fileName).toBe('sitemaps_job_123.zip');
    });

    it('should prepare single file download successfully', async () => {
      const { getSitemapJobStatus, getSitemapFiles } = await import('../../lib/batchSitemap.js');
      const { generateDownloadUrl } = await import('../../lib/batchDownload.js');

      getSitemapJobStatus.mockReturnValue({
        jobId: 'sitemap_job_123',
        status: 'completed'
      });

      getSitemapFiles.mockResolvedValue({
        success: true,
        files: [
          {
            fileName: 'sitemap1.xml',
            filePath: '/temp/sitemaps/job_123/sitemap1.xml',
            fileSize: 512
          }
        ]
      });

      generateDownloadUrl.mockReturnValue('download_token_123');

      const request = new NextRequest('http://localhost/api/batch-sitemap-download', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'sitemap_job_123',
          fileName: 'sitemap1.xml'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.downloadToken).toBe('download_token_123');
      expect(data.type).toBe('single');
      expect(data.fileName).toBe('sitemap1.xml');
    });

    it('should handle missing job ID', async () => {
      const request = new NextRequest('http://localhost/api/batch-sitemap-download', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Job ID is required');
    });

    it('should handle job not found in memory but files exist on disk', async () => {
      const { getSitemapJobStatus, createSitemapZip } = await import('../../lib/batchSitemap.js');
      const { generateDownloadUrl } = await import('../../lib/batchDownload.js');

      getSitemapJobStatus.mockReturnValue(null); // Job not in memory
      createSitemapZip.mockResolvedValue({
        success: true,
        zipPath: '/temp/sitemaps/sitemaps_job_123.zip',
        zipFileName: 'sitemaps_job_123.zip',
        fileSize: 1024
      });

      generateDownloadUrl.mockReturnValue('download_token_123');

      const request = new NextRequest('http://localhost/api/batch-sitemap-download', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'sitemap_job_123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.downloadToken).toBe('download_token_123');
    });

    it('should handle ZIP creation failure', async () => {
      const { getSitemapJobStatus, createSitemapZip } = await import('../../lib/batchSitemap.js');

      getSitemapJobStatus.mockReturnValue({
        jobId: 'sitemap_job_123',
        status: 'completed'
      });

      createSitemapZip.mockResolvedValue({
        success: false,
        error: 'No sitemap files found'
      });

      const request = new NextRequest('http://localhost/api/batch-sitemap-download', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'sitemap_job_123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('No sitemap files found');
    });

    it('should handle single file not found', async () => {
      const { getSitemapJobStatus, getSitemapFiles } = await import('../../lib/batchSitemap.js');

      getSitemapJobStatus.mockReturnValue({
        jobId: 'sitemap_job_123',
        status: 'completed'
      });

      getSitemapFiles.mockResolvedValue({
        success: true,
        files: [
          {
            fileName: 'sitemap1.xml',
            filePath: '/temp/sitemaps/job_123/sitemap1.xml',
            fileSize: 512
          }
        ]
      });

      const request = new NextRequest('http://localhost/api/batch-sitemap-download', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'sitemap_job_123',
          fileName: 'nonexistent.xml'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Sitemap file not found');
    });
  });

  describe('GET /api/batch-sitemap-download', () => {
    it('should download ZIP file successfully', async () => {
      const { validateDownloadToken } = await import('../../lib/batchDownload.js');
      const fs = await import('fs/promises');

      validateDownloadToken.mockReturnValue({
        type: 'sitemap_zip',
        id: 'sitemap_job_123'
      });

      fs.readdir.mockResolvedValue(['sitemaps_sitemap_job_123_1234567890.zip']);
      fs.readFile.mockResolvedValue(Buffer.from('mock zip content'));
      fs.stat.mockResolvedValue({ size: 1024 });

      const request = new NextRequest('http://localhost/api/batch-sitemap-download?token=download_token_123');

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/zip');
      expect(response.headers.get('Content-Disposition')).toContain('sitemaps_sitemap_job_123_1234567890.zip');
    });

    it('should download single XML file successfully', async () => {
      const { validateDownloadToken } = await import('../../lib/batchDownload.js');
      const fs = await import('fs/promises');

      validateDownloadToken.mockReturnValue({
        type: 'sitemap_file',
        id: 'sitemap_job_123/sitemap1.xml'
      });

      fs.readFile.mockResolvedValue('<?xml version="1.0"?><urlset><url><loc>https://example.com</loc></url></urlset>');

      const request = new NextRequest('http://localhost/api/batch-sitemap-download?token=download_token_123');

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/xml');
      expect(response.headers.get('Content-Disposition')).toContain('sitemap1.xml');
    });

    it('should handle missing download token', async () => {
      const request = new NextRequest('http://localhost/api/batch-sitemap-download');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Download token is required');
    });

    it('should handle invalid download token', async () => {
      const { validateDownloadToken } = await import('../../lib/batchDownload.js');

      validateDownloadToken.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/batch-sitemap-download?token=invalid_token');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid or expired download token');
    });

    it('should create ZIP if it does not exist', async () => {
      const { validateDownloadToken, createSitemapZip } = await import('../../lib/batchDownload.js');
      const { createSitemapZip: createSitemapZipMock } = await import('../../lib/batchSitemap.js');
      const fs = await import('fs/promises');

      validateDownloadToken.mockReturnValue({
        type: 'sitemap_zip',
        id: 'sitemap_job_123'
      });

      fs.readdir.mockResolvedValue([]); // No ZIP file found
      createSitemapZipMock.mockResolvedValue({
        success: true,
        zipPath: '/temp/sitemaps/sitemaps_job_123.zip',
        zipFileName: 'sitemaps_job_123.zip',
        fileSize: 1024
      });
      fs.readFile.mockResolvedValue(Buffer.from('mock zip content'));

      const request = new NextRequest('http://localhost/api/batch-sitemap-download?token=download_token_123');

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(createSitemapZipMock).toHaveBeenCalledWith('sitemap_job_123');
    });

    it('should handle file not found errors', async () => {
      const { validateDownloadToken } = await import('../../lib/batchDownload.js');
      const fs = await import('fs/promises');

      validateDownloadToken.mockReturnValue({
        type: 'sitemap_file',
        id: 'sitemap_job_123/nonexistent.xml'
      });

      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const request = new NextRequest('http://localhost/api/batch-sitemap-download?token=download_token_123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Sitemap file not found');
    });

    it('should handle unknown download type', async () => {
      const { validateDownloadToken } = await import('../../lib/batchDownload.js');

      validateDownloadToken.mockReturnValue({
        type: 'unknown_type',
        id: 'some_id'
      });

      const request = new NextRequest('http://localhost/api/batch-sitemap-download?token=download_token_123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unknown download type');
    });
  });
});
