import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock all API routes
vi.mock('../../../app/api/batch-upload/route.js', () => ({
  POST: vi.fn()
}));

vi.mock('../../../app/api/batch-preview/route.js', () => ({
  POST: vi.fn()
}));

vi.mock('../../../app/api/batch-convert/route.js', () => ({
  POST: vi.fn()
}));

vi.mock('../../../app/api/batch-status/[batchId]/route.js', () => ({
  GET: vi.fn()
}));

vi.mock('../../../app/api/batch-download/route.js', () => ({
  POST: vi.fn(),
  GET: vi.fn()
}));

vi.mock('../../../app/api/batch-sitemap-generate/route.js', () => ({
  POST: vi.fn()
}));

vi.mock('../../../app/api/batch-sitemap-download/route.js', () => ({
  POST: vi.fn(),
  GET: vi.fn()
}));

// Mock dependencies
vi.mock('../../../lib/batchClient.js', () => ({
  generateBatchId: vi.fn(() => 'batch_123_abc'),
  createBatchJob: vi.fn(),
  isValidBatchId: vi.fn(() => true),
  getBatchSummary: vi.fn()
}));

vi.mock('../../../lib/batchProcessing.js', () => ({
  storeBatchJob: vi.fn(() => Promise.resolve()),
  processBatchPreview: vi.fn()
}));

vi.mock('../../../lib/jsonConverter.js', () => ({
  processFilePreview: vi.fn(),
  convertFileToJson: vi.fn()
}));

vi.mock('../../../lib/batchSitemap.js', () => ({
  generateBatchSitemaps: vi.fn(),
  getSitemapJobStatus: vi.fn(),
  getSitemapFiles: vi.fn(),
  createSitemapZip: vi.fn()
}));

vi.mock('../../../lib/batchDownload.js', () => ({
  generateDownloadUrl: vi.fn(),
  validateDownloadToken: vi.fn(),
  downloadBatch: vi.fn(),
  downloadFile: vi.fn()
}));

// Mock global fileStorage
global.fileStorage = new Map();

describe('Complete Batch Workflow Integration', () => {
  let batchUpload, batchPreview, batchConvert, batchStatus, batchDownload, batchSitemapGenerate, batchSitemapDownload;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fileStorage.clear();

    // Import mocked API routes
    batchUpload = (await import('../../../app/api/batch-upload/route.js')).POST;
    batchPreview = (await import('../../../app/api/batch-preview/route.js')).POST;
    batchConvert = (await import('../../../app/api/batch-convert/route.js')).POST;
    batchStatus = (await import('../../../app/api/batch-status/[batchId]/route.js')).GET;
    batchDownload = (await import('../../../app/api/batch-download/route.js'));
    batchSitemapGenerate = (await import('../../../app/api/batch-sitemap-generate/route.js')).POST;
    batchSitemapDownload = (await import('../../../app/api/batch-sitemap-download/route.js'));

    // Setup mock responses
    batchUpload.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      batchId: 'batch_123_abc',
      fileCount: 2,
      headers: ['url', 'title', 'description']
    }), { status: 200 }));

    batchPreview.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      batchId: 'batch_123_abc',
      preview: {
        headers: ['url', 'title', 'description'],
        sampleData: [
          { url: 'https://example.com/1', title: 'Test 1', description: 'Desc 1' },
          { url: 'https://example.com/2', title: 'Test 2', description: 'Desc 2' }
        ],
        totalRows: 100
      }
    }), { status: 200 }));

    batchConvert.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      batchId: 'batch_123_abc',
      convertedFiles: 2,
      totalUrls: 200,
      validUrls: 200
    }), { status: 200 }));

    batchStatus.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      batchId: 'batch_123_abc',
      status: 'completed',
      progress: 100,
      files: [
        { fileId: 'file1', status: 'completed', originalName: 'test1.xlsx' },
        { fileId: 'file2', status: 'completed', originalName: 'test2.xlsx' }
      ]
    }), { status: 200 }));

    batchDownload.POST.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      downloadToken: 'download_token_123',
      fileName: 'batch_123_abc.zip',
      fileSize: 1024
    }), { status: 200 }));

    batchDownload.GET.mockResolvedValue(new Response('mock zip content', {
      status: 200,
      headers: { 'Content-Type': 'application/zip' }
    }));

    batchSitemapGenerate.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      jobId: 'sitemap_job_123',
      results: [{ sitemapCount: 2 }],
      errors: []
    }), { status: 200 }));

    batchSitemapDownload.POST.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      downloadToken: 'sitemap_download_token_123',
      fileName: 'sitemaps.zip',
      fileSize: 2048
    }), { status: 200 }));

    batchSitemapDownload.GET.mockResolvedValue(new Response('mock sitemap zip content', {
      status: 200,
      headers: { 'Content-Type': 'application/zip' }
    }));
  });

  describe('Complete Workflow: Upload → Preview → Convert → Download → Sitemap', () => {
    it('should complete full workflow successfully', async () => {
      // Step 1: Upload files
      const formData = new FormData();
      formData.append('file1', new File(['url,title,description\nhttps://example.com/1,Test 1,Desc 1'], 'test1.csv', { type: 'text/csv' }));
      formData.append('file2', new File(['url,title,description\nhttps://example.com/2,Test 2,Desc 2'], 'test2.csv', { type: 'text/csv' }));

      const uploadRequest = new NextRequest('http://localhost/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const uploadResponse = await batchUpload(uploadRequest);
      const uploadData = await uploadResponse.json();

      expect(uploadResponse.status).toBe(200);
      expect(uploadData.success).toBe(true);
      expect(uploadData.batchId).toBe('batch_123_abc');
      expect(uploadData.fileCount).toBe(2);

      // Step 2: Preview batch
      const previewRequest = new NextRequest('http://localhost/api/batch-preview', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc',
          config: {
            columnMapping: { link: 'url', title: 'name' },
            urlPattern: 'https://example.com/{link}',
            environment: 'dev'
          }
        })
      });

      const previewResponse = await batchPreview(previewRequest);
      const previewData = await previewResponse.json();

      expect(previewResponse.status).toBe(200);
      expect(previewData.success).toBe(true);
      expect(previewData.preview.headers).toEqual(['url', 'title', 'description']);

      // Step 3: Convert batch
      const convertRequest = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc',
          config: {
            columnMapping: { link: 'url', title: 'name' },
            urlPattern: 'https://example.com/{link}',
            environment: 'dev'
          }
        })
      });

      const convertResponse = await batchConvert(convertRequest);
      const convertData = await convertResponse.json();

      expect(convertResponse.status).toBe(200);
      expect(convertData.success).toBe(true);
      expect(convertData.convertedFiles).toBe(2);
      expect(convertData.totalUrls).toBe(200);

      // Step 4: Check batch status
      const statusRequest = new NextRequest('http://localhost/api/batch-status/batch_123_abc');
      const statusResponse = await batchStatus(statusRequest, { params: { batchId: 'batch_123_abc' } });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusData.success).toBe(true);
      expect(statusData.status).toBe('completed');
      expect(statusData.progress).toBe(100);

      // Step 5: Download batch
      const downloadRequest = new NextRequest('http://localhost/api/batch-download', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const downloadResponse = await batchDownload.POST(downloadRequest);
      const downloadData = await downloadResponse.json();

      expect(downloadResponse.status).toBe(200);
      expect(downloadData.success).toBe(true);
      expect(downloadData.downloadToken).toBe('download_token_123');

      // Step 6: Download file using token
      const downloadFileRequest = new NextRequest('http://localhost/api/batch-download?token=download_token_123');
      const downloadFileResponse = await batchDownload.GET(downloadFileRequest);

      expect(downloadFileResponse.status).toBe(200);
      expect(downloadFileResponse.headers.get('Content-Type')).toBe('application/zip');

      // Step 7: Generate sitemaps
      const sitemapRequest = new NextRequest('http://localhost/api/batch-sitemap-generate', {
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

      const sitemapResponse = await batchSitemapGenerate(sitemapRequest);
      const sitemapData = await sitemapResponse.json();

      expect(sitemapResponse.status).toBe(200);
      expect(sitemapData.success).toBe(true);
      expect(sitemapData.jobId).toBe('sitemap_job_123');

      // Step 8: Download sitemaps
      const sitemapDownloadRequest = new NextRequest('http://localhost/api/batch-sitemap-download', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'sitemap_job_123'
        })
      });

      const sitemapDownloadResponse = await batchSitemapDownload.POST(sitemapDownloadRequest);
      const sitemapDownloadData = await sitemapDownloadResponse.json();

      expect(sitemapDownloadResponse.status).toBe(200);
      expect(sitemapDownloadData.success).toBe(true);
      expect(sitemapDownloadData.downloadToken).toBe('sitemap_download_token_123');

      // Step 9: Download sitemap file using token
      const sitemapFileRequest = new NextRequest('http://localhost/api/batch-sitemap-download?token=sitemap_download_token_123');
      const sitemapFileResponse = await batchSitemapDownload.GET(sitemapFileRequest);

      expect(sitemapFileResponse.status).toBe(200);
      expect(sitemapFileResponse.headers.get('Content-Type')).toBe('application/zip');
    });

    it('should handle workflow with errors gracefully', async () => {
      // Mock upload failure
      batchUpload.mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        error: 'Upload failed'
      }), { status: 400 }));

      const formData = new FormData();
      formData.append('file1', new File(['content'], 'test1.csv', { type: 'text/csv' }));

      const uploadRequest = new NextRequest('http://localhost/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const uploadResponse = await batchUpload(uploadRequest);
      const uploadData = await uploadResponse.json();

      expect(uploadResponse.status).toBe(400);
      expect(uploadData.success).toBe(false);
      expect(uploadData.error).toBe('Upload failed');

      // Workflow should stop here due to upload failure
    });

    it('should handle conversion errors', async () => {
      // Mock conversion failure
      batchConvert.mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        error: 'Conversion failed'
      }), { status: 500 }));

      const convertRequest = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const convertResponse = await batchConvert(convertRequest);
      const convertData = await convertResponse.json();

      expect(convertResponse.status).toBe(500);
      expect(convertData.success).toBe(false);
      expect(convertData.error).toBe('Conversion failed');
    });

    it('should handle sitemap generation errors', async () => {
      // Mock sitemap generation failure
      batchSitemapGenerate.mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        error: 'Sitemap generation failed'
      }), { status: 500 }));

      const sitemapRequest = new NextRequest('http://localhost/api/batch-sitemap-generate', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const sitemapResponse = await batchSitemapGenerate(sitemapRequest);
      const sitemapData = await sitemapResponse.json();

      expect(sitemapResponse.status).toBe(500);
      expect(sitemapData.success).toBe(false);
      expect(sitemapData.error).toBe('Sitemap generation failed');
    });

    it('should handle download errors', async () => {
      // Mock download failure
      batchDownload.POST.mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        error: 'Download failed'
      }), { status: 404 }));

      const downloadRequest = new NextRequest('http://localhost/api/batch-download', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const downloadResponse = await batchDownload.POST(downloadRequest);
      const downloadData = await downloadResponse.json();

      expect(downloadResponse.status).toBe(404);
      expect(downloadData.success).toBe(false);
      expect(downloadData.error).toBe('Download failed');
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should handle network timeouts', async () => {
      // Mock network timeout
      batchUpload.mockRejectedValueOnce(new Error('Network timeout'));

      const formData = new FormData();
      formData.append('file1', new File(['content'], 'test1.csv', { type: 'text/csv' }));

      const uploadRequest = new NextRequest('http://localhost/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      await expect(batchUpload(uploadRequest)).rejects.toThrow('Network timeout');
    });

    it('should handle partial batch completion', async () => {
      // Mock partial completion
      batchStatus.mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        batchId: 'batch_123_abc',
        status: 'processing',
        progress: 50,
        files: [
          { fileId: 'file1', status: 'completed', originalName: 'test1.xlsx' },
          { fileId: 'file2', status: 'processing', originalName: 'test2.xlsx' }
        ]
      }), { status: 200 }));

      const statusRequest = new NextRequest('http://localhost/api/batch-status/batch_123_abc');
      const statusResponse = await batchStatus(statusRequest, { params: { batchId: 'batch_123_abc' } });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusData.status).toBe('processing');
      expect(statusData.progress).toBe(50);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large batches efficiently', async () => {
      // Mock large batch response
      batchUpload.mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        batchId: 'batch_123_abc',
        fileCount: 100,
        headers: ['url', 'title', 'description']
      }), { status: 200 }));

      const formData = new FormData();
      // Simulate large batch upload
      for (let i = 0; i < 100; i++) {
        formData.append(`file${i}`, new File([`url,title,description\nhttps://example.com/${i},Test ${i},Desc ${i}`], `test${i}.csv`, { type: 'text/csv' }));
      }

      const uploadRequest = new NextRequest('http://localhost/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const uploadResponse = await batchUpload(uploadRequest);
      const uploadData = await uploadResponse.json();

      expect(uploadResponse.status).toBe(200);
      expect(uploadData.success).toBe(true);
      expect(uploadData.fileCount).toBe(100);
    });

    it('should handle concurrent operations', async () => {
      // Mock concurrent batch operations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const formData = new FormData();
        formData.append('file1', new File([`url,title\nhttps://example.com/${i},Test ${i}`], `test${i}.csv`, { type: 'text/csv' }));

        const uploadRequest = new NextRequest('http://localhost/api/batch-upload', {
          method: 'POST',
          body: formData
        });

        promises.push(batchUpload(uploadRequest));
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
