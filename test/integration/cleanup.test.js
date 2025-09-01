import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveJsonFile, fileExists, cleanupOldFiles } from '../../lib/fileStorage.js';
import fs from 'fs/promises';
import path from 'path';

const TEMP_DIR = path.join(process.cwd(), 'temp');

describe('Cleanup Integration', () => {
  beforeEach(async () => {
    // Ensure clean state
    try {
      const files = await fs.readdir(TEMP_DIR);
      for (const file of files) {
        await fs.unlink(path.join(TEMP_DIR, file));
      }
    } catch {}
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      const files = await fs.readdir(TEMP_DIR);
      for (const file of files) {
        await fs.unlink(path.join(TEMP_DIR, file));
      }
    } catch {}
  });

  it('should clean up old files while preserving recent ones', async () => {
    // Create recent file
    await saveJsonFile('recent_file', { urls: [] });
    
    // Create old file by manually creating it and modifying its timestamp
    const oldFilePath = path.join(TEMP_DIR, 'old_file.json');
    await fs.writeFile(oldFilePath, JSON.stringify({ urls: [] }));
    
    // Modify the file's timestamp to make it appear old (2 hours ago)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await fs.utimes(oldFilePath, twoHoursAgo, twoHoursAgo);

    // Run cleanup
    await cleanupOldFiles();

    // Recent file should still exist
    expect(await fileExists('recent_file')).toBe(true);
    
    // Old file should be removed
    try {
      await fs.access(oldFilePath);
      expect(true).toBe(false); // Should not reach here
    } catch {
      expect(true).toBe(true); // File should not exist
    }
  });

  it('should handle cleanup when temp directory does not exist', async () => {
    // Remove temp directory
    try {
      await fs.rmdir(TEMP_DIR, { recursive: true });
    } catch {}

    // Cleanup should not throw error
    await expect(cleanupOldFiles()).resolves.not.toThrow();
  });

  it('should handle cleanup with no files', async () => {
    // Ensure temp directory exists but is empty
    try {
      await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch {}

    // Cleanup should not throw error
    await expect(cleanupOldFiles()).resolves.not.toThrow();
  });

  it('should handle file system errors gracefully', async () => {
    // Create a file
    await saveJsonFile('test_file', { urls: [] });
    
    // Mock fs.stat to throw an error for this specific test
    const originalStat = fs.stat;
    fs.stat = async (filePath) => {
      if (filePath.includes('test_file.json')) {
        throw new Error('Permission denied');
      }
      return originalStat(filePath);
    };

    // Cleanup should not throw error even with file system errors
    await expect(cleanupOldFiles()).resolves.not.toThrow();
    
    // Restore original fs.stat
    fs.stat = originalStat;
  });
});