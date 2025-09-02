import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateBatchId,
  createBatchJob,
  isValidBatchId,
  getBatchSummary,
  BATCH_STATUS,
  FILE_STATUS
} from '../../lib/batchClient.js';

describe('Batch Client Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateBatchId', () => {
    it('should generate unique batch IDs', () => {
      const id1 = generateBatchId();
      const id2 = generateBatchId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^batch_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^batch_\d+_[a-z0-9]+$/);
    });

    it('should include timestamp in batch ID', () => {
      const before = Date.now();
      const id = generateBatchId();
      const after = Date.now();

      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should include random suffix in batch ID', () => {
      const id = generateBatchId();
      const parts = id.split('_');
      
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('batch');
      expect(parts[1]).toMatch(/^\d+$/);
      expect(parts[2]).toMatch(/^[a-z0-9]+$/);
      expect(parts[2].length).toBeGreaterThanOrEqual(8);
      expect(parts[2].length).toBeLessThanOrEqual(10);
    });
  });

  describe('createBatchJob', () => {
    it('should create batch job with correct structure', () => {
      const files = [
        { name: 'test1.xlsx' },
        { name: 'test2.xlsx' }
      ];
      const config = {
        columnMapping: { link: 'url' },
        urlPattern: 'https://example.com/{link}',
        environment: 'dev'
      };

      const batchJob = createBatchJob(files, config);

      expect(batchJob).toBeDefined();
      expect(batchJob.batchId).toBeDefined();
      expect(batchJob.files).toHaveLength(2);
      expect(batchJob.files[0].originalName).toBe('test1.xlsx');
      expect(batchJob.files[1].originalName).toBe('test2.xlsx');
      expect(batchJob.config).toEqual(config);
      expect(batchJob.status).toBe(BATCH_STATUS.QUEUED);
      expect(batchJob.createdAt).toBeDefined();
      expect(batchJob.createdAt).toBeDefined();
      expect(typeof batchJob.createdAt).toBe('string');
    });

    it('should generate unique batch IDs for different jobs', () => {
      const files = [{ name: 'test1.xlsx' }];
      const config = { columnMapping: { link: 'url' } };

      const job1 = createBatchJob(files, config);
      const job2 = createBatchJob(files, config);

      expect(job1.batchId).not.toBe(job2.batchId);
    });

    it('should handle empty files array', () => {
      const files = [];
      const config = { columnMapping: { link: 'url' } };

      const batchJob = createBatchJob(files, config);

      expect(batchJob.files).toEqual([]);
      expect(batchJob.batchId).toBeDefined();
    });

    it('should handle minimal config', () => {
      const files = [{ name: 'test1.xlsx' }];
      const config = {};

      const batchJob = createBatchJob(files, config);

      expect(batchJob.config).toEqual({
        columnMapping: {},
        urlPattern: '',
        environment: 'production'
      });
      expect(batchJob.batchId).toBeDefined();
    });
  });

  describe('isValidBatchId', () => {
    it('should validate correct batch ID format', () => {
      const validIds = [
        'batch_1234567890_abcdef1234',
        'batch_1756789107203_dh6f4415m',
        'batch_1756789119823_iz00xv9gg'
      ];

      validIds.forEach(id => {
        expect(isValidBatchId(id)).toBe(true);
      });
    });

    it('should reject invalid batch ID formats', () => {
      const invalidIds = [
        'invalid_id',
        'batch_123',
        'batch_123_',
        'batch_abc_123',
        'batch_123_abc_extra',
        '',
        null,
        undefined
      ];

      invalidIds.forEach(id => {
        expect(isValidBatchId(id)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(isValidBatchId('batch_0_a')).toBe(true); // Single character suffix is valid
      expect(isValidBatchId('batch_12345678901234567890_abcdef1234')).toBe(true); // Long timestamp
      expect(isValidBatchId('batch_1234567890_abcdef1234567890')).toBe(true); // Long suffix
    });
  });

  describe('getBatchSummary', () => {
    it('should calculate summary for completed batch', () => {
      const batchStatus = {
        files: [
          {
            status: FILE_STATUS.COMPLETED,
            statistics: { validUrls: 100, totalRows: 100 }
          },
          {
            status: FILE_STATUS.COMPLETED,
            statistics: { validUrls: 50, totalRows: 50 }
          }
        ],
        createdAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:01:00Z'
      };

      const summary = getBatchSummary(batchStatus);

      expect(summary.totalFiles).toBe(2);
      expect(summary.completedFiles).toBe(2);
      expect(summary.failedFiles).toBe(0);
      expect(summary.totalUrls).toBe(150);
      expect(summary.validUrls).toBe(150);
      expect(summary.progress).toBe(100);
      expect(summary.successRate).toBe(100);
      expect(summary.duration).toBe(60000); // 1 minute
    });

    it('should calculate summary for processing batch', () => {
      const batchStatus = {
        files: [
          {
            status: FILE_STATUS.COMPLETED,
            statistics: { validUrls: 100, totalRows: 100 }
          },
          {
            status: FILE_STATUS.PROCESSING,
            statistics: { validUrls: 0, totalRows: 0 }
          },
          {
            status: FILE_STATUS.PENDING,
            statistics: { validUrls: 0, totalRows: 0 }
          }
        ],
        createdAt: '2023-01-01T00:00:00Z'
      };

      const summary = getBatchSummary(batchStatus);

      expect(summary.totalFiles).toBe(3);
      expect(summary.completedFiles).toBe(1);
      expect(summary.failedFiles).toBe(0);
      expect(summary.totalUrls).toBe(100);
      expect(summary.validUrls).toBe(100);
      expect(summary.progress).toBe(33); // 1/3 files completed
      expect(summary.successRate).toBe(33);
      expect(summary.duration).toBeNull(); // Not completed yet
    });

    it('should calculate summary for batch with errors', () => {
      const batchStatus = {
        files: [
          {
            status: FILE_STATUS.COMPLETED,
            statistics: { validUrls: 100, totalRows: 100 }
          },
          {
            status: FILE_STATUS.ERROR,
            statistics: { validUrls: 0, totalRows: 0 }
          }
        ],
        createdAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:01:00Z'
      };

      const summary = getBatchSummary(batchStatus);

      expect(summary.totalFiles).toBe(2);
      expect(summary.completedFiles).toBe(1);
      expect(summary.failedFiles).toBe(1);
      expect(summary.totalUrls).toBe(100);
      expect(summary.validUrls).toBe(100);
      expect(summary.progress).toBe(50); // 1/2 files completed
      expect(summary.successRate).toBe(50); // 1/2 files successful
      expect(summary.duration).toBe(60000);
    });

    it('should handle empty batch', () => {
      const batchStatus = {
        files: [],
        createdAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:01:00Z'
      };

      const summary = getBatchSummary(batchStatus);

      expect(summary.totalFiles).toBe(0);
      expect(summary.completedFiles).toBe(0);
      expect(summary.failedFiles).toBe(0);
      expect(summary.totalUrls).toBe(0);
      expect(summary.validUrls).toBe(0);
      expect(summary.progress).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.duration).toBe(60000);
    });

    it('should handle missing timestamps', () => {
      const batchStatus = {
        files: [
          {
            status: FILE_STATUS.COMPLETED,
            statistics: { validUrls: 100, totalRows: 100 }
          }
        ]
      };

      const summary = getBatchSummary(batchStatus);

      expect(summary.totalFiles).toBe(1);
      expect(summary.completedFiles).toBe(1);
      expect(summary.duration).toBeNull();
    });

    it('should handle files without statistics', () => {
      const batchStatus = {
        files: [
          {
            status: FILE_STATUS.COMPLETED
            // No statistics
          },
          {
            status: FILE_STATUS.COMPLETED,
            statistics: { validUrls: 50, totalRows: 50 }
          }
        ],
        createdAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:01:00Z'
      };

      const summary = getBatchSummary(batchStatus);

      expect(summary.totalFiles).toBe(2);
      expect(summary.completedFiles).toBe(2);
      expect(summary.totalUrls).toBe(50);
      expect(summary.validUrls).toBe(50);
    });

    it('should handle zero duration', () => {
      const batchStatus = {
        files: [
          {
            status: FILE_STATUS.COMPLETED,
            statistics: { validUrls: 100, totalRows: 100 }
          }
        ],
        createdAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:00:00Z' // Same time
      };

      const summary = getBatchSummary(batchStatus);

      expect(summary.duration).toBe(0);
    });
  });

  describe('Constants', () => {
    it('should have correct BATCH_STATUS values', () => {
      expect(BATCH_STATUS.QUEUED).toBe('queued');
      expect(BATCH_STATUS.PROCESSING).toBe('processing');
      expect(BATCH_STATUS.COMPLETED).toBe('completed');
      expect(BATCH_STATUS.FAILED).toBe('failed');
      expect(BATCH_STATUS.CANCELLED).toBe('cancelled');
    });

    it('should have correct FILE_STATUS values', () => {
      expect(FILE_STATUS.PENDING).toBe('pending');
      expect(FILE_STATUS.PROCESSING).toBe('processing');
      expect(FILE_STATUS.COMPLETED).toBe('completed');
      expect(FILE_STATUS.ERROR).toBe('error');
      expect(FILE_STATUS.CANCELLED).toBe('cancelled');
    });
  });
});
