import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/batch-convert/route.js';

// Mock dependencies
vi.mock('../../lib/batchClient.js', () => ({
  isValidBatchId: vi.fn(() => true)
}));

vi.mock('../../lib/jsonConverter.js', () => ({
  convertFileToJson: vi.fn(() => Promise.resolve({
    data: [
      { url: 'https://example.com/1', title: 'Test 1', group: 'products' },
      { url: 'https://example.com/2', title: 'Test 2', group: 'products' }
    ],
    statistics: {
      totalRows: 2,
      validUrls: 2,
      invalidUrls: 0,
      excludedRows: 0
    }
  }))
}));

// Mock global fileStorage
global.fileStorage = new Map();

describe('Batch Convert API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fileStorage.clear();
    
    // Setup mock batch files
    global.fileStorage.set('batch_123_abc_file1', {
      fileId: 'batch_123_abc_file1',
      originalName: 'test1.xlsx',
      fileType: 'xlsx',
      buffer: Buffer.from('mock content'),
      batchId: 'batch_123_abc'
    });
    
    global.fileStorage.set('batch_123_abc_file2', {
      fileId: 'batch_123_abc_file2',
      originalName: 'test2.xlsx',
      fileType: 'xlsx',
      buffer: Buffer.from('mock content'),
      batchId: 'batch_123_abc'
    });
  });

  describe('POST /api/batch-convert', () => {
    it('should convert batch files successfully', async () => {
      const request = new NextRequest('http://localhost/api/batch-convert', {
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

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.batchId).toBe('batch_123_abc');
      expect(data.convertedFiles).toBe(2);
      expect(data.totalUrls).toBe(4);
      expect(data.validUrls).toBe(4);
    });

    it('should handle invalid batch ID', async () => {
      const { isValidBatchId } = await import('../../lib/batchClient.js');
      isValidBatchId.mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'invalid_batch_id'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid batch ID');
    });

    it('should handle missing batch ID', async () => {
      const request = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Batch ID is required');
    });

    it('should handle batch with no files', async () => {
      global.fileStorage.clear();

      const request = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('No files found for batch');
    });

    it('should handle file conversion errors', async () => {
      const { convertFileToJson } = await import('../../lib/jsonConverter.js');
      convertFileToJson.mockRejectedValueOnce(new Error('Conversion failed'));

      const request = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Conversion failed');
    });

    it('should store converted JSON files with correct structure', async () => {
      const request = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Check that JSON files were stored
      const jsonFile1 = global.fileStorage.get('batch_123_abc_file1_json');
      const jsonFile2 = global.fileStorage.get('batch_123_abc_file2_json');

      expect(jsonFile1).toBeDefined();
      expect(jsonFile2).toBeDefined();
      expect(jsonFile1.batchId).toBe('batch_123_abc');
      expect(jsonFile2.batchId).toBe('batch_123_abc');
    });

    it('should handle mixed file types in batch', async () => {
      global.fileStorage.set('batch_123_abc_file3', {
        fileId: 'batch_123_abc_file3',
        originalName: 'test3.csv',
        fileType: 'csv',
        buffer: Buffer.from('mock content'),
        batchId: 'batch_123_abc'
      });

      const request = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.convertedFiles).toBe(3);
    });

    it('should calculate correct statistics', async () => {
      const { convertFileToJson } = await import('../../lib/jsonConverter.js');
      convertFileToJson
        .mockResolvedValueOnce({
          data: [{ url: 'https://example.com/1' }, { url: 'invalid-url' }],
          statistics: { totalRows: 2, validUrls: 1, invalidUrls: 1, excludedRows: 0 }
        })
        .mockResolvedValueOnce({
          data: [{ url: 'https://example.com/2' }],
          statistics: { totalRows: 1, validUrls: 1, invalidUrls: 0, excludedRows: 0 }
        });

      const request = new NextRequest('http://localhost/api/batch-convert', {
        method: 'POST',
        body: JSON.stringify({
          batchId: 'batch_123_abc'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalUrls).toBe(3);
      expect(data.validUrls).toBe(2);
      expect(data.invalidUrls).toBe(1);
    });
  });
});
