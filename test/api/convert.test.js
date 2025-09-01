import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../../app/api/convert/route.js';
import { clearAllFiles } from '../../lib/fileStorage.js';

// Mock global storage
global.fileStorage = new Map();
global.conversionStorage = new Map();

describe('Convert API', () => {
  beforeEach(async () => {
    // Clear storage before each test
    global.fileStorage.clear();
    global.conversionStorage.clear();
    await clearAllFiles();
  });

  afterEach(async () => {
    // Clean up after each test
    await clearAllFiles();
  });

  it('should convert uploaded file to JSON successfully', async () => {
    // Mock uploaded file data
    const fileId = 'test_file_123';
    const csvContent = 'Name,URL\nProduct 1,/product1\nProduct 2,/product2';
    global.fileStorage.set(fileId, {
      buffer: Buffer.from(csvContent),
      fileType: 'text/csv',
      uploadedAt: new Date()
    });

    const config = {
      columnMapping: { 'Name': 'name', 'URL': 'url' },
      urlPattern: 'https://example.com{URL}'
    };

    const request = new Request('http://localhost/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, config })
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.conversionId).toBeDefined();
    expect(result.statistics.validUrls).toBe(2);
    expect(global.conversionStorage.has(result.conversionId)).toBe(true);
  });

  it('should return error for missing fileId', async () => {
    const request = new Request('http://localhost/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} })
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing fileId or config');
  });

  it('should return error for non-existent file', async () => {
    const request = new Request('http://localhost/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fileId: 'non_existent_file',
        config: { columnMapping: {}, urlPattern: '' }
      })
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found or expired');
  });

  it('should handle conversion errors gracefully', async () => {
    const fileId = 'invalid_file_123';
    global.fileStorage.set(fileId, {
      buffer: Buffer.from('invalid data'),
      fileType: 'invalid/type',
      uploadedAt: new Date()
    });

    const config = {
      columnMapping: {},
      urlPattern: ''
    };

    const request = new Request('http://localhost/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, config })
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});