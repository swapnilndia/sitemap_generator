import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/batch-upload/route.js';

// Mock dependencies
vi.mock('../../lib/batchClient.js', () => ({
  generateBatchId: vi.fn(() => 'batch_123_abc'),
  createBatchJob: vi.fn(() => ({
    batchId: 'batch_123_abc',
    files: [],
    status: 'uploaded',
    createdAt: new Date()
  }))
}));

vi.mock('../../lib/batchProcessing.js', () => ({
  storeBatchJob: vi.fn(() => Promise.resolve())
}));

vi.mock('../../lib/jsonConverter.js', () => ({
  processFilePreview: vi.fn(() => Promise.resolve({
    headers: ['url', 'title', 'description'],
    sampleData: [
      { url: 'https://example.com/1', title: 'Test 1', description: 'Desc 1' },
      { url: 'https://example.com/2', title: 'Test 2', description: 'Desc 2' }
    ],
    totalRows: 100,
    totalSampled: 2
  }))
}));

describe('Batch Upload API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/batch-upload', () => {
    it('should handle valid multi-file upload', async () => {
      const formData = new FormData();
      formData.append('file1', new File(['url,title,description\nhttps://example.com/1,Test 1,Desc 1'], 'test1.csv', { type: 'text/csv' }));
      formData.append('file2', new File(['url,title,description\nhttps://example.com/2,Test 2,Desc 2'], 'test2.csv', { type: 'text/csv' }));

      const request = new NextRequest('https://example.com/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.batchId).toBeDefined();
      expect(data.fileCount).toBe(2);
      expect(data.headers).toEqual(['url', 'title', 'description']);
    });

    it('should handle Excel files', async () => {
      const formData = new FormData();
      formData.append('file1', new File(['mock excel content'], 'test1.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

      const request = new NextRequest('https://example.com/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.files[0].fileType).toBe('xlsx');
    });

    it('should reject uploads without files', async () => {
      const formData = new FormData();

      const request = new NextRequest('https://example.com/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('No files provided');
    });

    it('should validate file types', async () => {
      const formData = new FormData();
      formData.append('file1', new File(['content'], 'test.txt', { type: 'text/plain' }));

      const request = new NextRequest('https://example.com/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unsupported file type');
    });

    it('should handle file processing errors', async () => {
      const { processFilePreview } = await import('../../lib/jsonConverter.js');
      processFilePreview.mockRejectedValueOnce(new Error('File processing failed'));

      const formData = new FormData();
      formData.append('file1', new File(['content'], 'test1.csv', { type: 'text/csv' }));

      const request = new NextRequest('https://example.com/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('File processing failed');
    });

    it('should extract and merge headers from multiple files', async () => {
      const formData = new FormData();
      formData.append('file1', new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' }));
      formData.append('file2', new File(['url,description\nhttps://example.com/2,Desc 2'], 'test2.csv', { type: 'text/csv' }));

      const request = new NextRequest('https://example.com/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.headers).toContain('url');
      expect(data.headers).toContain('title');
      expect(data.headers).toContain('description');
    });

    it('should handle large file uploads', async () => {
      const largeContent = 'url,title,description\n' + 
        Array.from({ length: 10000 }, (_, i) => `https://example.com/${i},Title ${i},Description ${i}`).join('\n');
      
      const formData = new FormData();
      formData.append('file1', new File([largeContent], 'large.csv', { type: 'text/csv' }));

      const request = new NextRequest('https://example.com/api/batch-upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.files[0].totalRows).toBe(10000);
    });
  });
});
