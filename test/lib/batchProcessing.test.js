import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateBatchId,
  generateFileId,
  isValidBatchId,
  sanitizeFilename,
  createBatchJob,
  updateBatchStatus,
  updateFileStatus,
  calculateBatchProgress,
  createBatchError,
  isRetryableError,
  getBatchSummary,
  validateBatchConfig,
  getFilesByStatus,
  getNextFilesToProcess,
  isBatchComplete,
  getRetryableFiles,
  BATCH_STATUS,
  FILE_STATUS,
  ERROR_CATEGORIES
} from '../../lib/batchProcessing.js';

describe('Batch Processing Utilities', () => {
  let mockFiles;
  let mockConfig;

  beforeEach(() => {
    mockFiles = [
      { name: 'test1.xlsx', size: 1000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'test2.xlsx', size: 2000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'test3.xlsx', size: 1500, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    ];

    mockConfig = {
      columnMapping: { link: 'url', title: 'name' },
      urlPattern: 'https://example.com/{link}',
      environment: 'dev',
      maxConcurrentFiles: 2,
      retryAttempts: 1,
      timeoutMs: 60000
    };
  });

  describe('ID Generation', () => {
    it('should generate valid batch IDs', () => {
      const batchId = generateBatchId();
      expect(batchId).toMatch(/^batch_\d+_[a-z0-9]+$/);
      expect(isValidBatchId(batchId)).toBe(true);
    });

    it('should generate unique batch IDs', () => {
      const id1 = generateBatchId();
      const id2 = generateBatchId();
      expect(id1).not.toBe(id2);
    });

    it('should generate valid file IDs', () => {
      const batchId = generateBatchId();
      const fileId = generateFileId(batchId, 'test.xlsx');
      expect(fileId).toContain(batchId);
      expect(fileId).toContain('test');
    });

    it('should validate batch ID format', () => {
      expect(isValidBatchId('batch_1234567890_abc123')).toBe(true);
      expect(isValidBatchId('invalid_id')).toBe(false);
      expect(isValidBatchId('')).toBe(false);
      expect(isValidBatchId(null)).toBe(false);
    });
  });

  describe('Filename Sanitization', () => {
    it('should sanitize filenames correctly', () => {
      expect(sanitizeFilename('test file.xlsx')).toBe('test_file');
      expect(sanitizeFilename('test@#$%file.xlsx')).toBe('test_file');
      expect(sanitizeFilename('Test File With Spaces.xlsx')).toBe('test_file_with_spaces');
      expect(sanitizeFilename('')).toBe('file');
      expect(sanitizeFilename(null)).toBe('unnamed_file');
    });

    it('should handle special characters', () => {
      expect(sanitizeFilename('file-name_123.xlsx')).toBe('file-name_123');
      expect(sanitizeFilename('файл.xlsx')).toBe('_');
    });
  });

  describe('Batch Job Creation', () => {
    it('should create a valid batch job', () => {
      const batchJob = createBatchJob(mockFiles, mockConfig, 'user123');
      
      expect(batchJob.batchId).toMatch(/^batch_\d+_[a-z0-9]+$/);
      expect(batchJob.userId).toBe('user123');
      expect(batchJob.status).toBe(BATCH_STATUS.QUEUED);
      expect(batchJob.files).toHaveLength(3);
      expect(batchJob.progress.totalFiles).toBe(3);
      expect(batchJob.metadata.totalSize).toBe(4500);
    });

    it('should generate unique file IDs for each file', () => {
      const batchJob = createBatchJob(mockFiles, mockConfig);
      const fileIds = batchJob.files.map(f => f.fileId);
      const uniqueIds = new Set(fileIds);
      expect(uniqueIds.size).toBe(fileIds.length);
    });

    it('should set initial file status to pending', () => {
      const batchJob = createBatchJob(mockFiles, mockConfig);
      batchJob.files.forEach(file => {
        expect(file.status).toBe(FILE_STATUS.PENDING);
      });
    });
  });

  describe('Status Updates', () => {
    let batchJob;

    beforeEach(() => {
      batchJob = createBatchJob(mockFiles, mockConfig);
    });

    it('should update batch status', () => {
      const updatedJob = updateBatchStatus(batchJob, BATCH_STATUS.PROCESSING);
      expect(updatedJob.status).toBe(BATCH_STATUS.PROCESSING);
      expect(updatedJob.progress.startedAt).toBeInstanceOf(Date);
    });

    it('should update file status', () => {
      const fileId = batchJob.files[0].fileId;
      const updatedJob = updateFileStatus(batchJob, fileId, FILE_STATUS.PROCESSING);
      
      const updatedFile = updatedJob.files.find(f => f.fileId === fileId);
      expect(updatedFile.status).toBe(FILE_STATUS.PROCESSING);
      expect(updatedFile.processingStarted).toBeInstanceOf(Date);
    });

    it('should update batch status when all files complete', () => {
      let updatedJob = batchJob;
      
      // Complete all files
      batchJob.files.forEach(file => {
        updatedJob = updateFileStatus(updatedJob, file.fileId, FILE_STATUS.COMPLETED);
      });
      
      expect(updatedJob.status).toBe(BATCH_STATUS.COMPLETED);
      expect(updatedJob.progress.completedFiles).toBe(3);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress correctly', () => {
      const files = [
        { status: FILE_STATUS.COMPLETED, processingStarted: new Date(Date.now() - 5000), processingCompleted: new Date() },
        { status: FILE_STATUS.PROCESSING, processingStarted: new Date() },
        { status: FILE_STATUS.PENDING }
      ];
      
      const progress = calculateBatchProgress(files);
      expect(progress.totalFiles).toBe(3);
      expect(progress.completedFiles).toBe(1);
      expect(progress.processingFiles).toBe(1);
      expect(progress.pendingFiles).toBe(1);
    });

    it('should estimate completion time', () => {
      const now = Date.now();
      const files = [
        { 
          status: FILE_STATUS.COMPLETED, 
          processingStarted: new Date(now - 10000), 
          processingCompleted: new Date(now - 5000) 
        },
        { status: FILE_STATUS.PENDING }
      ];
      
      const progress = calculateBatchProgress(files);
      expect(progress.estimatedCompletion).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should create batch errors', () => {
      const error = createBatchError(
        ERROR_CATEGORIES.PROCESSING,
        'File processing failed',
        'file123',
        { code: 'PARSE_ERROR' }
      );
      
      expect(error.category).toBe(ERROR_CATEGORIES.PROCESSING);
      expect(error.message).toBe('File processing failed');
      expect(error.fileId).toBe('file123');
      expect(error.retryable).toBe(false);
    });

    it('should identify retryable errors', () => {
      expect(isRetryableError(ERROR_CATEGORIES.TIMEOUT, 'Request timeout')).toBe(true);
      expect(isRetryableError(ERROR_CATEGORIES.STORAGE, 'Storage error')).toBe(true);
      expect(isRetryableError(ERROR_CATEGORIES.VALIDATION, 'Invalid format')).toBe(false);
      expect(isRetryableError(ERROR_CATEGORIES.PROCESSING, 'network error occurred')).toBe(true);
    });
  });

  describe('Batch Summary', () => {
    it('should generate batch summary', () => {
      const batchJob = createBatchJob(mockFiles, mockConfig);
      const summary = getBatchSummary(batchJob);
      
      expect(summary.batchId).toBe(batchJob.batchId);
      expect(summary.totalFiles).toBe(3);
      expect(summary.totalSize).toBe(4500);
      expect(summary.successRate).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const result = validateBatchConfig(mockConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        columnMapping: null,
        urlPattern: 'invalid-url',
        environment: '',
        maxConcurrentFiles: 15
      };
      
      const result = validateBatchConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('File Filtering', () => {
    let batchJob;

    beforeEach(() => {
      batchJob = createBatchJob(mockFiles, mockConfig);
      // Set different statuses for testing
      batchJob.files[0].status = FILE_STATUS.COMPLETED;
      batchJob.files[1].status = FILE_STATUS.PROCESSING;
      batchJob.files[2].status = FILE_STATUS.PENDING;
    });

    it('should filter files by status', () => {
      const completedFiles = getFilesByStatus(batchJob, FILE_STATUS.COMPLETED);
      const processingFiles = getFilesByStatus(batchJob, FILE_STATUS.PROCESSING);
      const pendingFiles = getFilesByStatus(batchJob, FILE_STATUS.PENDING);
      
      expect(completedFiles).toHaveLength(1);
      expect(processingFiles).toHaveLength(1);
      expect(pendingFiles).toHaveLength(1);
    });

    it('should get next files to process', () => {
      const nextFiles = getNextFilesToProcess(batchJob, 2);
      expect(nextFiles).toHaveLength(1); // Only 1 pending file, 1 already processing
    });

    it('should check if batch is complete', () => {
      expect(isBatchComplete(batchJob)).toBe(false);
      
      // Complete all files
      batchJob.files.forEach(file => {
        file.status = FILE_STATUS.COMPLETED;
      });
      batchJob.progress = calculateBatchProgress(batchJob.files);
      
      expect(isBatchComplete(batchJob)).toBe(true);
    });
  });
});