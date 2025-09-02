import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  saveFile,
  getFile,
  deleteFile,
  listFiles,
  saveBatchFiles,
  getBatchFiles,
  deleteBatchFiles,
  cleanupExpiredBatches,
  getBatchMetadata,
  updateBatchMetadata,
  validateBatchStorage,
  getBatchStorageStats
} from '../../lib/fileStorage.js';

// Mock fs operations
vi.mock('fs/promises');

describe('File Storage', () => {
  const mockBatchId = 'batch_123_abc';
  const mockFileId = 'file_123_test';
  const mockFileData = Buffer.from('test file content');
  const mockMetadata = {
    originalName: 'test.xlsx',
    size: 1000,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Single File Operations', () => {
    it('should save a file successfully', async () => {
      fs.writeFile.mockResolvedValue();
      fs.mkdir.mockResolvedValue();
      
      const result = await saveFile(mockFileId, mockFileData, mockMetadata);
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      fs.writeFile.mockRejectedValue(new Error('Disk full'));
      fs.mkdir.mockResolvedValue();
      
      const result = await saveFile(mockFileId, mockFileData, mockMetadata);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');
    });

    it('should retrieve a file successfully', async () => {
      fs.readFile.mockResolvedValue(mockFileData);
      fs.stat.mockResolvedValue({ size: 1000, mtime: new Date() });
      
      const result = await getFile(mockFileId);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockFileData);
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should handle missing files', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const result = await getFile('nonexistent_file');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should delete a file successfully', async () => {
      fs.unlink.mockResolvedValue();
      
      const result = await deleteFile(mockFileId);
      
      expect(result.success).toBe(true);
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('Batch File Operations', () => {
    const mockFiles = [
      { fileId: 'file1', data: Buffer.from('content1'), metadata: { ...mockMetadata, originalName: 'file1.xlsx' } },
      { fileId: 'file2', data: Buffer.from('content2'), metadata: { ...mockMetadata, originalName: 'file2.xlsx' } }
    ];

    it('should save multiple files in a batch', async () => {
      fs.writeFile.mockResolvedValue();
      fs.mkdir.mockResolvedValue();
      
      const result = await saveBatchFiles(mockBatchId, mockFiles);
      
      expect(result.success).toBe(true);
      expect(result.savedFiles).toHaveLength(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle partial batch save failures', async () => {
      fs.writeFile
        .mockResolvedValueOnce() // First file succeeds
        .mockRejectedValueOnce(new Error('Write failed')); // Second file fails
      fs.mkdir.mockResolvedValue();
      
      const result = await saveBatchFiles(mockBatchId, mockFiles);
      
      expect(result.success).toBe(false);
      expect(result.savedFiles).toHaveLength(1);
      expect(result.failedFiles).toHaveLength(1);
    });

    it('should retrieve all files in a batch', async () => {
      fs.readdir.mockResolvedValue(['file1_test.xlsx', 'file2_test.xlsx']);
      fs.readFile.mockResolvedValue(mockFileData);
      fs.stat.mockResolvedValue({ size: 1000, mtime: new Date() });
      
      const result = await getBatchFiles(mockBatchId);
      
      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
    });

    it('should delete all files in a batch', async () => {
      fs.readdir.mockResolvedValue(['file1_test.xlsx', 'file2_test.xlsx']);
      fs.unlink.mockResolvedValue();
      fs.rmdir.mockResolvedValue();
      
      const result = await deleteBatchFiles(mockBatchId);
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('Batch Metadata Management', () => {
    const mockBatchMetadata = {
      batchId: mockBatchId,
      totalFiles: 2,
      totalSize: 2000,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };

    it('should save and retrieve batch metadata', async () => {
      fs.writeFile.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(mockBatchMetadata));
      fs.mkdir.mockResolvedValue();
      
      const saveResult = await updateBatchMetadata(mockBatchId, mockBatchMetadata);
      expect(saveResult.success).toBe(true);
      
      const getResult = await getBatchMetadata(mockBatchId);
      expect(getResult.success).toBe(true);
      expect(getResult.metadata.batchId).toBe(mockBatchId);
    });

    it('should handle missing metadata gracefully', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const result = await getBatchMetadata('nonexistent_batch');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should clean up expired batches', async () => {
      const expiredBatch = {
        batchId: 'expired_batch',
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };
      
      const activeBatch = {
        batchId: 'active_batch',
        expiresAt: new Date(Date.now() + 1000) // Expires in 1 second
      };
      
      fs.readdir.mockResolvedValue(['expired_batch', 'active_batch']);
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(expiredBatch))
        .mockResolvedValueOnce(JSON.stringify(activeBatch));
      fs.unlink.mockResolvedValue();
      fs.rmdir.mockResolvedValue();
      
      const result = await cleanupExpiredBatches();
      
      expect(result.success).toBe(true);
      expect(result.cleanedBatches).toContain('expired_batch');
      expect(result.cleanedBatches).not.toContain('active_batch');
    });

    it('should validate batch storage integrity', async () => {
      fs.readdir.mockResolvedValue(['batch1', 'batch2']);
      fs.readFile.mockResolvedValue(JSON.stringify({ batchId: 'batch1' }));
      fs.stat.mockResolvedValue({ size: 1000 });
      
      const result = await validateBatchStorage();
      
      expect(result.success).toBe(true);
      expect(result.validBatches).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('should provide storage statistics', async () => {
      fs.readdir.mockResolvedValue(['batch1', 'batch2']);
      fs.readFile.mockResolvedValue(JSON.stringify({ 
        totalFiles: 5, 
        totalSize: 10000,
        createdAt: new Date()
      }));
      
      const result = await getBatchStorageStats();
      
      expect(result.success).toBe(true);
      expect(result.stats.totalBatches).toBe(2);
      expect(result.stats.totalFiles).toBeDefined();
      expect(result.stats.totalSize).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle filesystem errors gracefully', async () => {
      fs.writeFile.mockRejectedValue(new Error('Permission denied'));
      
      const result = await saveFile(mockFileId, mockFileData, mockMetadata);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle invalid file paths', async () => {
      const result = await saveFile('', mockFileData, mockMetadata);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should handle corrupted metadata files', async () => {
      fs.readFile.mockResolvedValue('invalid json');
      
      const result = await getBatchMetadata(mockBatchId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('parse');
    });
  });
});