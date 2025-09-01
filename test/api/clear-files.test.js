import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../../app/api/clear-files/route.js';
import { saveJsonFile, fileExists } from '../../lib/fileStorage.js';

// Mock global storage
global.fileStorage = new Map();
global.conversionStorage = new Map();
global.jsonStorage = new Map();
global.sitemapStorage = new Map();

describe('Clear Files API', () => {
  beforeEach(() => {
    // Reset global storage
    global.fileStorage.clear();
    global.conversionStorage.clear();
    global.jsonStorage.clear();
    global.sitemapStorage.clear();
  });

  it('should clear all files and storage successfully', async () => {
    // Create some test files
    await saveJsonFile('test1', { urls: [] });
    await saveJsonFile('test2', { urls: [] });
    
    // Add some data to global storage
    global.fileStorage.set('file1', { data: 'test' });
    global.conversionStorage.set('conv1', { data: 'test' });
    global.jsonStorage.set('json1', { data: 'test' });
    global.sitemapStorage.set('sitemap1', { data: 'test' });

    const request = new Request('http://localhost/api/clear-files', {
      method: 'POST'
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.filesCleared).toBe(2);
    
    // Verify files are deleted
    expect(await fileExists('test1')).toBe(false);
    expect(await fileExists('test2')).toBe(false);
    
    // Verify global storage is cleared
    expect(global.fileStorage.size).toBe(0);
    expect(global.conversionStorage.size).toBe(0);
    expect(global.jsonStorage.size).toBe(0);
    expect(global.sitemapStorage.size).toBe(0);
  });

  it('should handle empty directory gracefully', async () => {
    const request = new Request('http://localhost/api/clear-files', {
      method: 'POST'
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.filesCleared).toBe(0);
  });

  it('should clear global storage even if file clearing fails', async () => {
    // Add data to global storage
    global.fileStorage.set('file1', { data: 'test' });
    
    const request = new Request('http://localhost/api/clear-files', {
      method: 'POST'
    });

    const response = await POST(request);
    const result = await response.json();

    // Should still clear global storage
    expect(global.fileStorage.size).toBe(0);
  });
});