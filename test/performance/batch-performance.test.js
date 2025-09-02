import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBatchJob, calculateBatchProgress } from '../../lib/batchProcessing.js';
import { BatchQueue } from '../../lib/batchQueue.js';

describe('Batch Processing Performance Tests', () => {
  let mockProcessFile;
  let performanceQueue;

  beforeEach(() => {
    mockProcessFile = vi.fn().mockImplementation(async (file) => {
      // Simulate variable processing time based on file size
      const processingTime = Math.min(file.size / 1000, 500); // Max 500ms
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      return {
        success: true,
        fileId: file.fileId,
        processingTime
      };
    });

    performanceQueue = new BatchQueue(mockProcessFile, {
      maxConcurrent: 4,
      maxRetries: 1
    });
  });

  describe('Large Batch Processing', () => {
    it('should handle 50 files efficiently', async () => {
      const largeFileSet = Array.from({ length: 50 }, (_, i) => ({
        name: `file${i + 1}.xlsx`,
        size: 1000 + (i * 50), // Varying file sizes
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));

      const config = {
        columnMapping: { link: 'url', title: 'name' },
        urlPattern: 'https://example.com/{link}',
        environment: 'production',
        maxConcurrentFiles: 4
      };

      const startTime = performance.now();
      
      const batchJob = createBatchJob(largeFileSet, config, 'perf-test-user');
      await performanceQueue.addBatch(batchJob);
      await performanceQueue.processBatch(batchJob.batchId);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const finalBatch = performanceQueue.getBatch(batchJob.batchId);
      
      expect(finalBatch.files).toHaveLength(50);
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      // Calculate throughput
      const throughput = 50 / (totalTime / 1000); // files per second
      expect(throughput).toBeGreaterThan(3); // At least 3 files per second
      
      console.log(`Processed 50 files in ${totalTime.toFixed(2)}ms (${throughput.toFixed(2)} files/sec)`);
    }, 20000);

    it('should maintain performance with varying file sizes', async () => {
      const mixedSizeFiles = [
        ...Array.from({ length: 10 }, (_, i) => ({ // Small files
          name: `small${i + 1}.xlsx`,
          size: 500,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })),
        ...Array.from({ length: 10 }, (_, i) => ({ // Medium files
          name: `medium${i + 1}.xlsx`,
          size: 2000,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })),
        ...Array.from({ length: 5 }, (_, i) => ({ // Large files
          name: `large${i + 1}.xlsx`,
          size: 5000,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }))
      ];

      const config = {
        columnMapping: { link: 'url' },
        urlPattern: 'https://example.com/{link}',
        environment: 'production'
      };

      const startTime = performance.now();
      
      const batchJob = createBatchJob(mixedSizeFiles, config, 'mixed-size-test');
      await performanceQueue.addBatch(batchJob);
      await performanceQueue.processBatch(batchJob.batchId);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const finalBatch = performanceQueue.getBatch(batchJob.batchId);
      
      expect(finalBatch.files).toHaveLength(25);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify all files processed successfully
      const successfulFiles = finalBatch.files.filter(f => f.status === 'completed');
      expect(successfulFiles).toHaveLength(25);
      
      console.log(`Processed mixed-size batch in ${totalTime.toFixed(2)}ms`);
    }, 15000);
  });

  describe('Concurrency Performance', () => {
    it('should scale with increased concurrency', async () => {
      const testFiles = Array.from({ length: 20 }, (_, i) => ({
        name: `concurrent${i + 1}.xlsx`,
        size: 1500,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));

      const config = {
        columnMapping: { link: 'url' },
        urlPattern: 'https://example.com/{link}',
        environment: 'production'
      };

      const concurrencyLevels = [1, 2, 4, 8];
      const results = [];

      for (const concurrency of concurrencyLevels) {
        const queue = new BatchQueue(mockProcessFile, {
          maxConcurrent: concurrency,
          maxRetries: 0
        });

        const startTime = performance.now();
        
        const batchJob = createBatchJob(testFiles, config, `concurrency-${concurrency}`);
        await queue.addBatch(batchJob);
        await queue.processBatch(batchJob.batchId);
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        results.push({
          concurrency,
          time: processingTime,
          throughput: 20 / (processingTime / 1000)
        });
        
        console.log(`Concurrency ${concurrency}: ${processingTime.toFixed(2)}ms (${(20 / (processingTime / 1000)).toFixed(2)} files/sec)`);
      }

      // Verify that higher concurrency generally improves performance
      expect(results[3].time).toBeLessThan(results[0].time); // 8 concurrent should be faster than 1
      expect(results[3].throughput).toBeGreaterThan(results[0].throughput);
    }, 30000);

    it('should handle concurrent batch submissions', async () => {
      const batchCount = 5;
      const filesPerBatch = 10;
      
      const batches = Array.from({ length: batchCount }, (_, batchIndex) => {
        const files = Array.from({ length: filesPerBatch }, (_, fileIndex) => ({
          name: `batch${batchIndex}_file${fileIndex}.xlsx`,
          size: 1000,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }));
        
        return createBatchJob(files, {
          columnMapping: { link: 'url' },
          urlPattern: 'https://example.com/{link}',
          environment: 'production'
        }, `concurrent-batch-${batchIndex}`);
      });

      const startTime = performance.now();
      
      // Submit all batches concurrently
      const batchPromises = batches.map(async (batch) => {
        await performanceQueue.addBatch(batch);
        return performanceQueue.processBatch(batch.batchId);
      });
      
      await Promise.all(batchPromises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Verify all batches completed
      batches.forEach(batch => {
        const completedBatch = performanceQueue.getBatch(batch.batchId);
        expect(completedBatch.files).toHaveLength(filesPerBatch);
      });
      
      const totalFiles = batchCount * filesPerBatch;
      const throughput = totalFiles / (totalTime / 1000);
      
      expect(throughput).toBeGreaterThan(2); // Should maintain reasonable throughput
      
      console.log(`Processed ${batchCount} concurrent batches (${totalFiles} files) in ${totalTime.toFixed(2)}ms`);
    }, 25000);
  });

  describe('Memory Usage Performance', () => {
    it('should handle large batches without excessive memory usage', async () => {
      const largeFileSet = Array.from({ length: 100 }, (_, i) => ({
        name: `memory-test-${i + 1}.xlsx`,
        size: 2000,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));

      const config = {
        columnMapping: { link: 'url', title: 'name' },
        urlPattern: 'https://example.com/{link}',
        environment: 'production'
      };

      // Mock process.memoryUsage for memory tracking
      const originalMemoryUsage = process.memoryUsage;
      const memorySnapshots = [];
      
      process.memoryUsage = vi.fn().mockImplementation(() => {
        const usage = originalMemoryUsage();
        memorySnapshots.push(usage.heapUsed);
        return usage;
      });

      const batchJob = createBatchJob(largeFileSet, config, 'memory-test');
      
      // Take initial memory snapshot
      process.memoryUsage();
      
      await performanceQueue.addBatch(batchJob);
      
      // Take snapshot after batch creation
      process.memoryUsage();
      
      await performanceQueue.processBatch(batchJob.batchId);
      
      // Take final snapshot
      process.memoryUsage();
      
      // Restore original function
      process.memoryUsage = originalMemoryUsage;
      
      const finalBatch = performanceQueue.getBatch(batchJob.batchId);
      expect(finalBatch.files).toHaveLength(100);
      
      // Memory should not grow excessively (allow for some variance)
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);
      
      expect(memoryGrowthMB).toBeLessThan(100); // Should not use more than 100MB additional memory
      
      console.log(`Memory growth for 100-file batch: ${memoryGrowthMB.toFixed(2)}MB`);
    }, 30000);
  });

  describe('Progress Calculation Performance', () => {
    it('should calculate progress efficiently for large batches', async () => {
      const largeFileSet = Array.from({ length: 1000 }, (_, i) => ({
        fileId: `file_${i}`,
        status: i < 300 ? 'completed' : i < 600 ? 'processing' : 'pending',
        processingStarted: i < 600 ? new Date(Date.now() - (i * 1000)) : null,
        processingCompleted: i < 300 ? new Date() : null
      }));

      const iterations = 100;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        calculateBatchProgress(largeFileSet);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;
      
      expect(avgTime).toBeLessThan(10); // Should calculate progress in less than 10ms on average
      
      console.log(`Progress calculation for 1000 files: ${avgTime.toFixed(2)}ms average`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle failures efficiently without blocking other files', async () => {
      const testFiles = Array.from({ length: 20 }, (_, i) => ({
        name: `error-test-${i + 1}.xlsx`,
        size: 1000,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));

      // Mock function that fails for every 5th file
      const mockProcessWithFailures = vi.fn().mockImplementation(async (file, index) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (index % 5 === 0) {
          throw new Error(`Simulated failure for file ${index}`);
        }
        
        return {
          success: true,
          fileId: file.fileId,
          processingTime: 100
        };
      });

      const errorQueue = new BatchQueue(mockProcessWithFailures, {
        maxConcurrent: 4,
        maxRetries: 1
      });

      const config = {
        columnMapping: { link: 'url' },
        urlPattern: 'https://example.com/{link}',
        environment: 'production'
      };

      const startTime = performance.now();
      
      const batchJob = createBatchJob(testFiles, config, 'error-handling-test');
      await errorQueue.addBatch(batchJob);
      await errorQueue.processBatch(batchJob.batchId);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const finalBatch = errorQueue.getBatch(batchJob.batchId);
      const successfulFiles = finalBatch.files.filter(f => f.status === 'completed');
      const failedFiles = finalBatch.files.filter(f => f.status === 'failed');
      
      expect(successfulFiles.length).toBe(16); // 4 files should fail (every 5th)
      expect(failedFiles.length).toBe(4);
      expect(totalTime).toBeLessThan(8000); // Should complete within 8 seconds despite failures
      
      console.log(`Handled batch with failures in ${totalTime.toFixed(2)}ms (${successfulFiles.length} success, ${failedFiles.length} failed)`);
    }, 15000);
  });
});