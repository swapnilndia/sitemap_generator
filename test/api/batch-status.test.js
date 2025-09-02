import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../app/api/batch-status/[batchId]/route.js';

// Mock dependencies
vi.mock('../../../../lib/batchClient.js', () => ({
  isValidBatchId: vi.fn(() => true)
}));

// Mock global fileStorage
global.fileStorage = new Map();

describe('Batch Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fileStorage.clear();
    
    // Setup mock batch files
    global.fileStorage.set('batch_123_abc_file1', {
      fileId: 'batch_123_abc_file1',
      originalName: 'test1.xlsx',
      fileType: 'xlsx',
      batchId: 'batch_123_abc',
      createdAt: new Date('2023-01-01T00:00:00Z')
    });
    
    global.fileStorage.set('batch_123_abc_file1_json', {
      fileId: 'batch_123_abc_file1_json',
      originalName: 'test1.xlsx',
      batchId: 'batch_123_abc',
      json: {
        data: [
          { url: 'https://example.com/1', group: 'products' },
          { url: 'https://example.com/2', group: 'products' }
        ],
        statistics: { validUrls: 2, totalRows: 2 }
      },
      createdAt: new Date('2023-01-01T00:01:00Z')
    });
    
    global.fileStorage.set('batch_123_abc_file2', {
      fileId: 'batch_123_abc_file2',
      originalName: 'test2.xlsx',
      fileType: 'xlsx',
      batchId: 'batch_123_abc',
      createdAt: new Date('2023-01-01T00:00:00Z')
    });
    
    global.fileStorage.set('batch_123_abc_file2_json', {
      fileId: 'batch_123_abc_file2_json',
      originalName: 'test2.xlsx',
      batchId: 'batch_123_abc',
      json: {
        data: [
          { url: 'https://example.com/3', group: 'products' }
        ],
        statistics: { validUrls: 1, totalRows: 1 }
      },
      createdAt: new Date('2023-01-01T00:01:00Z')
    });
  });

  describe('GET /api/batch-status/[batchId]', () => {
    it('should return batch status successfully', async () => {
      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc');

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.batchId).toBe('batch_123_abc');
      expect(data.status).toBe('completed');
      expect(data.files).toHaveLength(2);
      expect(data.totalFiles).toBe(2);
      expect(data.completedFiles).toBe(2);
      expect(data.totalUrls).toBe(3);
      expect(data.validUrls).toBe(3);
    });

    it('should handle batch with mixed completion status', async () => {
      // Remove one JSON file to simulate incomplete conversion
      global.fileStorage.delete('batch_123_abc_file2_json');

      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc');

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('processing');
      expect(data.files).toHaveLength(2);
      expect(data.totalFiles).toBe(2);
      expect(data.completedFiles).toBe(1);
      expect(data.processingFiles).toBe(1);
    });

    it('should handle invalid batch ID', async () => {
      const { isValidBatchId } = await import('../../../../lib/batchClient.js');
      isValidBatchId.mockReturnValueOnce(false);

      const params = { batchId: 'invalid_batch_id' };
      const request = new NextRequest('http://localhost/api/batch-status/invalid_batch_id');

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid batch ID');
    });

    it('should handle batch not found', async () => {
      global.fileStorage.clear();

      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc');

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Batch not found');
    });

    it('should calculate progress correctly', async () => {
      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc');

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.progress).toBe(100); // All files completed
      expect(data.totalFiles).toBe(2);
      expect(data.completedFiles).toBe(2);
      expect(data.failedFiles).toBe(0);
    });

    it('should include file details in response', async () => {
      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc');

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.files).toHaveLength(2);
      
      const file1 = data.files.find(f => f.fileId === 'batch_123_abc_file1');
      expect(file1).toBeDefined();
      expect(file1.originalName).toBe('test1.xlsx');
      expect(file1.status).toBe('completed');
      expect(file1.statistics.validUrls).toBe(2);
    });

    it('should handle files with errors', async () => {
      // Add a file with error status
      global.fileStorage.set('batch_123_abc_file3', {
        fileId: 'batch_123_abc_file3',
        originalName: 'test3.xlsx',
        fileType: 'xlsx',
        batchId: 'batch_123_abc',
        status: 'error',
        error: 'File processing failed',
        createdAt: new Date('2023-01-01T00:00:00Z')
      });

      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc');

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalFiles).toBe(3);
      expect(data.completedFiles).toBe(2);
      expect(data.failedFiles).toBe(1);
      
      const errorFile = data.files.find(f => f.fileId === 'batch_123_abc_file3');
      expect(errorFile.status).toBe('error');
      expect(errorFile.error).toBe('File processing failed');
    });
  });

  describe('POST /api/batch-status/[batchId]', () => {
    it('should update batch status successfully', async () => {
      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc', {
        method: 'POST',
        body: JSON.stringify({
          status: 'completed',
          completedAt: new Date().toISOString()
        })
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Batch status updated');
    });

    it('should handle invalid batch ID in POST', async () => {
      const { isValidBatchId } = await import('../../../../lib/batchClient.js');
      isValidBatchId.mockReturnValueOnce(false);

      const params = { batchId: 'invalid_batch_id' };
      const request = new NextRequest('http://localhost/api/batch-status/invalid_batch_id', {
        method: 'POST',
        body: JSON.stringify({ status: 'completed' })
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid batch ID');
    });

    it('should handle batch not found in POST', async () => {
      global.fileStorage.clear();

      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc', {
        method: 'POST',
        body: JSON.stringify({ status: 'completed' })
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Batch not found');
    });

    it('should validate status update data', async () => {
      const params = { batchId: 'batch_123_abc' };
      const request = new NextRequest('http://localhost/api/batch-status/batch_123_abc', {
        method: 'POST',
        body: JSON.stringify({}) // Empty body
      });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Status update data is required');
    });
  });
});
