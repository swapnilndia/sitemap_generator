import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  ensureTempDir,
  cleanupOldFiles,
  clearAllFiles,
  saveJsonFile,
  loadJsonFile,
  fileExists,
  getFileInfo
} from '../../lib/fileStorage.js';

const TEMP_DIR = path.join(process.cwd(), 'temp');

describe('File Storage', () => {
  beforeEach(async () => {
    // Ensure clean state
    await clearAllFiles();
  });

  afterEach(async () => {
    // Clean up after tests
    await clearAllFiles();
  });

  describe('ensureTempDir', () => {
    it('should create temp directory if it does not exist', async () => {
      // Remove temp dir if it exists
      try {
        await fs.rmdir(TEMP_DIR, { recursive: true });
      } catch {}

      await ensureTempDir();
      
      const stats = await fs.stat(TEMP_DIR);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if temp directory already exists', async () => {
      await ensureTempDir();
      await ensureTempDir(); // Should not throw
      
      const stats = await fs.stat(TEMP_DIR);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('saveJsonFile and loadJsonFile', () => {
    it('should save and load optimized JSON data correctly', async () => {
      const fileId = 'test_conversion_123';
      const mockJsonData = {
        data: [
          {
            processed: {
              url: 'https://example.com/page1',
              lastmod: '2024-01-01',
              changefreq: 'weekly',
              priority: '0.8',
              group: 'products',
              excluded: false,
              isDuplicate: false
            }
          },
          {
            processed: {
              url: 'https://example.com/page2',
              group: 'blog',
              excluded: false,
              isDuplicate: false
            }
          },
          {
            processed: {
              excluded: true
            }
          }
        ]
      };

      const config = { maxPerFile: 50000 };
      
      // Save file
      const saveResult = await saveJsonFile(fileId, mockJsonData, config);
      expect(saveResult.success).toBe(true);
      expect(saveResult.statistics.validUrls).toBe(2);
      expect(saveResult.statistics.excludedUrls).toBe(1);

      // Load file
      const loadResult = await loadJsonFile(fileId);
      expect(loadResult.success).toBe(true);
      expect(loadResult.data.urls).toHaveLength(2);
      expect(loadResult.data.urls[0].loc).toBe('https://example.com/page1');
      expect(loadResult.data.urls[0].lastmod).toBe('2024-01-01');
      expect(loadResult.data.urls[0].group).toBe('products');
      expect(loadResult.data.metadata.fileId).toBe(fileId);
    });

    it('should handle empty data gracefully', async () => {
      const fileId = 'test_empty_123';
      const mockJsonData = { data: [] };
      
      const saveResult = await saveJsonFile(fileId, mockJsonData);
      expect(saveResult.success).toBe(true);
      expect(saveResult.statistics.validUrls).toBe(0);

      const loadResult = await loadJsonFile(fileId);
      expect(loadResult.success).toBe(true);
      expect(loadResult.data.urls).toHaveLength(0);
    });

    it('should return error for non-existent file', async () => {
      const loadResult = await loadJsonFile('non_existent_file');
      expect(loadResult.success).toBe(false);
      expect(loadResult.error).toBeDefined();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const fileId = 'test_exists_123';
      const mockJsonData = { data: [] };
      
      await saveJsonFile(fileId, mockJsonData);
      const exists = await fileExists(fileId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await fileExists('non_existent_file');
      expect(exists).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    it('should return file information for existing file', async () => {
      const fileId = 'test_info_123';
      const mockJsonData = { data: [] };
      
      await saveJsonFile(fileId, mockJsonData);
      const info = await getFileInfo(fileId);
      
      expect(info.success).toBe(true);
      expect(info.size).toBeGreaterThan(0);
      expect(info.created).toBeInstanceOf(Date);
      expect(info.modified).toBeInstanceOf(Date);
    });

    it('should return error for non-existent file', async () => {
      const info = await getFileInfo('non_existent_file');
      expect(info.success).toBe(false);
      expect(info.error).toBeDefined();
    });
  });

  describe('clearAllFiles', () => {
    it('should clear all files in temp directory', async () => {
      // Create multiple files
      await saveJsonFile('file1', { data: [] });
      await saveJsonFile('file2', { data: [] });
      await saveJsonFile('file3', { data: [] });

      const clearResult = await clearAllFiles();
      expect(clearResult.success).toBe(true);
      expect(clearResult.filesCleared).toBe(3);

      // Verify files are gone
      expect(await fileExists('file1')).toBe(false);
      expect(await fileExists('file2')).toBe(false);
      expect(await fileExists('file3')).toBe(false);
    });
  });

  describe('cleanupOldFiles', () => {
    it('should not remove recent files', async () => {
      const fileId = 'recent_file';
      await saveJsonFile(fileId, { data: [] });
      
      await cleanupOldFiles();
      
      expect(await fileExists(fileId)).toBe(true);
    });
  });
});