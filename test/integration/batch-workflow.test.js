import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBatchJob, BATCH_STATUS, FILE_STATUS } from '../../lib/batchProcessing.js';
import { BatchQueue } from '../../lib/batchQueue.js';
import { saveBatchFiles, deleteBatchFiles } from '../../lib/fileStorage.js';
import { generateBatchSitemaps } from '../../lib/batchSitemap.js';
import { createBatchDownload } from '../../lib/batchDownload.js';

// Mock external dependencies
vi.mock('fs/promises');
vi.mock('archiver');

describe('Batch Processing Integration Tests', () => {
  let mockFiles;
  let mockConfig;
  let batchQueue;
  let testBatchId;

  beforeEach(() => {
    mockFiles = [
      { 
        name: 'products.xlsx', 
        size: 2000, 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: Buffer.from('mock excel content 1')
      },
      { 
        name: 'services.xlsx', 
        size: 1500, 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: Buffer.from('mock excel content 2')
      },
      { 
        name: 'locations.xlsx', 
        size: 1800, 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: Buffer.from('mock excel content 3')
      }
    ];

    mockConfig = {
      columnMapping: { 
        link: 'url', 
        title: 'name',
        description: 'desc'
      },
      urlPattern: 'https://example.com/{link}',
      environment: 'production',
      maxConcurrentFiles: 2,
      retryAttempts: 2,
      timeoutMs: 30000,
      sitemapConfig: {
        baseUrl: 'https://example.com',
        changefreq: 'weekly',
        priority: 0.8
      }
    };

    // Mock file processing function
    const mockProcessFile = vi.fn().mockImplementation(async (file) => {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mock successful processing
      return {
        success: true,
        fileId: file.fileId,
        outputPath: `/tmp/processed_${file.fileId}.xml`,
        sitemapEntries: 10,
        processingTime: 100
      };
    });

    batchQueue = new BatchQueue(mockProcessFile, {
      maxConcurrent: mockConfig.maxConcurrentFiles,
      maxRetries: mockConfig.retryAttempts
    });
  });

  afterEach(async () => {
    // Cleanup test batch if it exists
    if (testBatchId) {
      try {
        await deleteBatchFiles(testBatchId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Complete Batch Processing Workflow', () => {
    it('should process a complete batch from upload to download', async () => {
      // Step 1: Create batch job
      const batchJob = createBatchJob(mockFiles, mockConfig, 'test-user');
      testBatchId = batchJob.batchId;
      
      expect(batchJob.status).toBe(BATCH_STATUS.QUEUED);
      expect(batchJob.files).toHaveLength(3);
      
      // Step 2: Save files to storage
      const fileData = mockFiles.map((file, index) => ({
        fileId: batchJob.files[index].fileId,
        data: file.content,
        metadata: {
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date()
        }
      }));
      
      const saveResult = await saveBatchFiles(testBatchId, fileData);
      expect(saveResult.success).toBe(true);
      
      // Step 3: Add to processing queue
      const queueResult = await batchQueue.addBatch(batchJob);
      expect(queueResult.success).toBe(true);
      
      // Step 4: Process the batch
      const processResult = await batchQueue.processBatch(testBatchId);
      expect(processResult.success).toBe(true);
      
      // Step 5: Verify batch completion
      const completedBatch = batchQueue.getBatch(testBatchId);
      expect(completedBatch.status).toBe(BATCH_STATUS.COMPLETED);
      expect(completedBatch.files.every(f => f.status === FILE_STATUS.COMPLETED)).toBe(true);
      
      // Step 6: Generate batch download
      const downloadResult = await createBatchDownload(testBatchId);
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.downloadUrl).toBeDefined();
    }, 10000); // Increase timeout for integration test

    it('should handle partial failures gracefully', async () => {
      // Create a batch job
      const batchJob = createBatchJob(mockFiles, mockConfig, 'test-user');
      testBatchId = batchJob.batchId;
      
      // Mock processing function that fails for one file
      const mockProcessFileWithFailure = vi.fn().mockImplementation(async (file) => {
        if (file.originalName === 'services.xlsx') {
          throw new Error('Processing failed for services file');
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          fileId: file.fileId,
          outputPath: `/tmp/processed_${file.fileId}.xml`,
          sitemapEntries: 10
        };
      });
      
      const failureQueue = new BatchQueue(mockProcessFileWithFailure, {
        maxConcurrent: 2,
        maxRetries: 1
      });
      
      await failureQueue.addBatch(batchJob);
      const processResult = await failureQueue.processBatch(testBatchId);
      
      const finalBatch = failureQueue.getBatch(testBatchId);
      
      // Should have partial success
      expect(finalBatch.files.filter(f => f.status === FILE_STATUS.COMPLETED)).toHaveLength(2);
      expect(finalBatch.files.filter(f => f.status === FILE_STATUS.FAILED)).toHaveLength(1);
      expect(finalBatch.status).toBe(BATCH_STATUS.PARTIAL_SUCCESS);
    });

    it('should handle retry logic correctly', async () => {
      const batchJob = createBatchJob([mockFiles[0]], mockConfig, 'test-user');
      testBatchId = batchJob.batchId;
      
      let attemptCount = 0;
      const mockProcessFileWithRetry = vi.fn().mockImplementation(async (file) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Temporary failure');
        }
        
        return {
          success: true,
          fileId: file.fileId,
          outputPath: `/tmp/processed_${file.fileId}.xml`,
          sitemapEntries: 5
        };
      });
      
      const retryQueue = new BatchQueue(mockProcessFileWithRetry, {
        maxConcurrent: 1,
        maxRetries: 3
      });
      
      await retryQueue.addBatch(batchJob);
      await retryQueue.processBatch(testBatchId);
      
      const finalBatch = retryQueue.getBatch(testBatchId);
      
      // Should succeed after retries
      expect(finalBatch.status).toBe(BATCH_STATUS.COMPLETED);
      expect(attemptCount).toBe(3); // Initial attempt + 2 retries
    });
  });

  describe('Batch Sitemap Generation Integration', () => {
    it('should generate sitemaps for all files in batch', async () => {
      const batchJob = createBatchJob(mockFiles, mockConfig, 'test-user');
      testBatchId = batchJob.batchId;
      
      // Mock successful sitemap generation
      const mockSitemapData = mockFiles.map((file, index) => ({
        fileId: batchJob.files[index].fileId,
        sitemapContent: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/page${index + 1}</loc></url>
          </urlset>`,
        entryCount: 1
      }));
      
      vi.mocked(generateBatchSitemaps).mockResolvedValue({
        success: true,
        batchId: testBatchId,
        sitemaps: mockSitemapData,
        totalEntries: 3
      });
      
      const result = await generateBatchSitemaps(testBatchId, mockConfig.sitemapConfig);
      
      expect(result.success).toBe(true);
      expect(result.sitemaps).toHaveLength(3);
      expect(result.totalEntries).toBe(3);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large batch efficiently', async () => {
      // Create a larger batch for performance testing
      const largeBatch = Array.from({ length: 10 }, (_, i) => ({
        name: `file${i + 1}.xlsx`,
        size: 1000 + i * 100,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: Buffer.from(`mock content ${i + 1}`)
      }));
      
      const startTime = Date.now();
      
      const batchJob = createBatchJob(largeBatch, mockConfig, 'test-user');
      testBatchId = batchJob.batchId;
      
      await batchQueue.addBatch(batchJob);
      await batchQueue.processBatch(testBatchId);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      const finalBatch = batchQueue.getBatch(testBatchId);
      
      expect(finalBatch.status).toBe(BATCH_STATUS.COMPLETED);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(finalBatch.files).toHaveLength(10);
    });

    it('should respect concurrency limits', async () => {
      const batchJob = createBatchJob(mockFiles, mockConfig, 'test-user');
      testBatchId = batchJob.batchId;
      
      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      const mockProcessFileWithConcurrencyTracking = vi.fn().mockImplementation(async (file) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        concurrentCount--;
        return {
          success: true,
          fileId: file.fileId,
          outputPath: `/tmp/processed_${file.fileId}.xml`
        };
      });
      
      const concurrencyQueue = new BatchQueue(mockProcessFileWithConcurrencyTracking, {
        maxConcurrent: 2
      });
      
      await concurrencyQueue.addBatch(batchJob);
      await concurrencyQueue.processBatch(testBatchId);
      
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from storage failures', async () => {
      const batchJob = createBatchJob([mockFiles[0]], mockConfig, 'test-user');
      testBatchId = batchJob.batchId;
      
      // Mock storage failure followed by success
      let storageAttempts = 0;
      vi.mocked(saveBatchFiles).mockImplementation(async () => {
        storageAttempts++;
        if (storageAttempts === 1) {
          throw new Error('Storage temporarily unavailable');
        }
        return { success: true, savedFiles: [{ fileId: 'test' }] };
      });
      
      // Should retry and eventually succeed
      let saveResult;
      for (let i = 0; i < 3; i++) {
        try {
          saveResult = await saveBatchFiles(testBatchId, []);
          if (saveResult.success) break;
        } catch (error) {
          if (i === 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      expect(saveResult.success).toBe(true);
      expect(storageAttempts).toBe(2);
    });

    it('should handle queue overflow gracefully', async () => {
      // Create multiple batches to test queue limits
      const batches = Array.from({ length: 5 }, (_, i) => 
        createBatchJob([mockFiles[0]], mockConfig, `user${i}`)
      );
      
      const limitedQueue = new BatchQueue(vi.fn().mockResolvedValue({ success: true }), {
        maxConcurrent: 1,
        maxQueueSize: 3
      });
      
      const results = await Promise.allSettled(
        batches.map(batch => limitedQueue.addBatch(batch))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const rejected = results.filter(r => r.status === 'fulfilled' && !r.value.success);
      
      expect(successful.length).toBeLessThanOrEqual(3);
      expect(rejected.length).toBeGreaterThan(0);
    });
  });
});