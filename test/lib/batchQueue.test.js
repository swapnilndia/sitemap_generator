import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchQueue } from '../../lib/batchQueue.js';
import { BATCH_STATUS, FILE_STATUS } from '../../lib/batchProcessing.js';

// Mock the file processing function
const mockProcessFile = vi.fn();

describe('BatchQueue', () => {
  let batchQueue;
  let mockBatchJob;

  beforeEach(() => {
    vi.clearAllMocks();
    batchQueue = new BatchQueue(mockProcessFile, { maxConcurrent: 2 });
    
    mockBatchJob = {
      batchId: 'batch_123_abc',
      status: BATCH_STATUS.QUEUED,
      files: [
        { fileId: 'file1', status: FILE_STATUS.PENDING, originalName: 'test1.xlsx' },
        { fileId: 'file2', status: FILE_STATUS.PENDING, originalName: 'test2.xlsx' },
        { fileId: 'file3', status: FILE_STATUS.PENDING, originalName: 'test3.xlsx' }
      ],
      progress: { totalFiles: 3, completedFiles: 0, processingFiles: 0, pendingFiles: 3 }
    };
  });

  describe('Queue Management', () => {
    it('should add batch to queue', async () => {
      const result = await batchQueue.addBatch(mockBatchJob);
      expect(result.success).toBe(true);
      expect(batchQueue.getQueueStatus().totalBatches).toBe(1);
    });

    it('should reject duplicate batch IDs', async () => {
      await batchQueue.addBatch(mockBatchJob);
      const result = await batchQueue.addBatch(mockBatchJob);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should process files concurrently', async () => {
      mockProcessFile.mockResolvedValue({ success: true });
      
      await batchQueue.addBatch(mockBatchJob);
      await batchQueue.processBatch(mockBatchJob.batchId);
      
      // Should process up to maxConcurrent files
      expect(mockProcessFile).toHaveBeenCalledTimes(2);
    });

    it('should handle processing errors gracefully', async () => {
      mockProcessFile.mockRejectedValue(new Error('Processing failed'));
      
      await batchQueue.addBatch(mockBatchJob);
      const result = await batchQueue.processBatch(mockBatchJob.batchId);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Progress Tracking', () => {
    it('should track processing progress', async () => {
      mockProcessFile.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      
      await batchQueue.addBatch(mockBatchJob);
      const progressPromise = batchQueue.processBatch(mockBatchJob.batchId);
      
      // Check progress during processing
      const status = batchQueue.getBatchStatus(mockBatchJob.batchId);
      expect(status).toBeDefined();
      
      await progressPromise;
    });

    it('should update file status during processing', async () => {
      mockProcessFile.mockResolvedValue({ success: true });
      
      await batchQueue.addBatch(mockBatchJob);
      await batchQueue.processBatch(mockBatchJob.batchId);
      
      const updatedBatch = batchQueue.getBatch(mockBatchJob.batchId);
      expect(updatedBatch.files.some(f => f.status === FILE_STATUS.COMPLETED)).toBe(true);
    });
  });

  describe('Error Handling and Retry', () => {
    it('should retry failed files', async () => {
      mockProcessFile
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({ success: true });
      
      await batchQueue.addBatch(mockBatchJob);
      await batchQueue.processBatch(mockBatchJob.batchId);
      
      // Should retry the failed file
      expect(mockProcessFile).toHaveBeenCalledTimes(3); // 2 initial + 1 retry
    });

    it('should limit retry attempts', async () => {
      mockProcessFile.mockRejectedValue(new Error('Persistent failure'));
      
      const queueWithRetries = new BatchQueue(mockProcessFile, { 
        maxConcurrent: 1, 
        maxRetries: 2 
      });
      
      await queueWithRetries.addBatch(mockBatchJob);
      await queueWithRetries.processBatch(mockBatchJob.batchId);
      
      // Should try initial + maxRetries times
      expect(mockProcessFile).toHaveBeenCalledTimes(3);
    });
  });

  describe('Batch Completion', () => {
    it('should mark batch as completed when all files succeed', async () => {
      mockProcessFile.mockResolvedValue({ success: true });
      
      await batchQueue.addBatch(mockBatchJob);
      await batchQueue.processBatch(mockBatchJob.batchId);
      
      const completedBatch = batchQueue.getBatch(mockBatchJob.batchId);
      expect(completedBatch.status).toBe(BATCH_STATUS.COMPLETED);
    });

    it('should mark batch as failed when critical errors occur', async () => {
      mockProcessFile.mockRejectedValue(new Error('Critical failure'));
      
      const queueWithNoRetries = new BatchQueue(mockProcessFile, { 
        maxConcurrent: 1, 
        maxRetries: 0 
      });
      
      await queueWithNoRetries.addBatch(mockBatchJob);
      await queueWithNoRetries.processBatch(mockBatchJob.batchId);
      
      const failedBatch = queueWithNoRetries.getBatch(mockBatchJob.batchId);
      expect(failedBatch.status).toBe(BATCH_STATUS.FAILED);
    });
  });

  describe('Queue Status and Monitoring', () => {
    it('should provide queue statistics', () => {
      const status = batchQueue.getQueueStatus();
      expect(status).toHaveProperty('totalBatches');
      expect(status).toHaveProperty('activeBatches');
      expect(status).toHaveProperty('completedBatches');
      expect(status).toHaveProperty('failedBatches');
    });

    it('should allow pausing and resuming batches', async () => {
      await batchQueue.addBatch(mockBatchJob);
      
      const pauseResult = batchQueue.pauseBatch(mockBatchJob.batchId);
      expect(pauseResult.success).toBe(true);
      
      const resumeResult = batchQueue.resumeBatch(mockBatchJob.batchId);
      expect(resumeResult.success).toBe(true);
    });

    it('should allow canceling batches', async () => {
      await batchQueue.addBatch(mockBatchJob);
      
      const cancelResult = batchQueue.cancelBatch(mockBatchJob.batchId);
      expect(cancelResult.success).toBe(true);
      
      const canceledBatch = batchQueue.getBatch(mockBatchJob.batchId);
      expect(canceledBatch.status).toBe(BATCH_STATUS.CANCELLED);
    });
  });
});