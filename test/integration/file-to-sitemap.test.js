import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as uploadPost } from '../../app/api/upload/route.js';
import { POST as convertPost } from '../../app/api/convert/route.js';
import { POST as sitemapPreviewPost } from '../../app/api/sitemap-preview/route.js';
import { POST as generateSitemapPost } from '../../app/api/generate-sitemap/route.js';
import { clearAllFiles } from '../../lib/fileStorage.js';

// Mock global storage
global.fileStorage = new Map();
global.conversionStorage = new Map();
global.jsonStorage = new Map();
global.sitemapStorage = new Map();

describe('File to Sitemap Integration', () => {
  beforeEach(async () => {
    // Clear all storage
    global.fileStorage.clear();
    global.conversionStorage.clear();
    global.jsonStorage.clear();
    global.sitemapStorage.clear();
    await clearAllFiles();
  });

  afterEach(async () => {
    await clearAllFiles();
  });

  it('should complete full workflow from CSV upload to sitemap generation', async () => {
    // Step 1: Upload CSV file
    const csvContent = 'Name,URL,Category,Priority\nProduct 1,/product1,Electronics,0.8\nProduct 2,/product2,Books,0.6\nProduct 3,/product3,Electronics,0.7';
    const formData = new FormData();
    const file = new File([csvContent], 'products.csv', { type: 'text/csv' });
    formData.append('file', file);

    const uploadRequest = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const uploadResponse = await uploadPost(uploadRequest);
    const uploadResult = await uploadResponse.json();

    expect(uploadResult.success).toBe(true);
    const fileId = uploadResult.fileId;

    // Step 2: Convert to JSON
    const config = {
      columnMapping: {
        'Name': 'name',
        'URL': 'url',
        'Category': 'category',
        'Priority': 'priority'
      },
      urlPattern: 'https://example.com{URL}',
      grouping: 'category',
      includeLastmod: false,
      changefreq: 'weekly',
      priority: 'priority'
    };

    const convertRequest = new Request('http://localhost/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, config })
    });

    const convertResponse = await convertPost(convertRequest);
    const convertResult = await convertResponse.json();

    expect(convertResult.success).toBe(true);
    expect(convertResult.statistics.validUrls).toBe(3);
    const conversionId = convertResult.conversionId;

    // Step 3: Preview sitemap
    const previewRequest = new Request('http://localhost/api/sitemap-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: conversionId,
        config: { maxPerFile: 50000 }
      })
    });

    const previewResponse = await sitemapPreviewPost(previewRequest);
    const previewResult = await previewResponse.json();

    expect(previewResult.success).toBe(true);
    expect(previewResult.preview.totalFiles).toBe(1);
    expect(previewResult.preview.needsIndex).toBe(false);
    expect(previewResult.preview.files[0].filename).toBe('sitemap.xml');
    expect(previewResult.preview.groups).toContain('Electronics');
    expect(previewResult.preview.groups).toContain('Books');

    // Step 4: Generate sitemap
    const generateRequest = new Request('http://localhost/api/generate-sitemap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: conversionId,
        config: { maxPerFile: 50000 }
      })
    });

    const generateResponse = await generateSitemapPost(generateRequest);
    const generateResult = await generateResponse.json();

    expect(generateResult.success).toBe(true);
    expect(generateResult.totalFiles).toBe(1);
    expect(generateResult.hasIndex).toBe(false);
    expect(generateResult.statistics.totalUrls).toBe(3);
    expect(generateResult.generationId).toBeDefined();
  });

  it('should handle large dataset requiring multiple sitemap files', async () => {
    // Create large CSV content
    const headers = 'ID,URL\n';
    const rows = Array(75000).fill(null).map((_, i) => `${i + 1},/page${i + 1}`).join('\n');
    const largeCsvContent = headers + rows;

    // Step 1: Upload
    const formData = new FormData();
    const file = new File([largeCsvContent], 'large.csv', { type: 'text/csv' });
    formData.append('file', file);

    const uploadRequest = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const uploadResponse = await uploadPost(uploadRequest);
    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.fileId;

    // Step 2: Convert
    const config = {
      columnMapping: { 'ID': 'id', 'URL': 'url' },
      urlPattern: 'https://example.com{URL}'
    };

    const convertRequest = new Request('http://localhost/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, config })
    });

    const convertResponse = await convertPost(convertRequest);
    const convertResult = await convertResponse.json();
    const conversionId = convertResult.conversionId;

    // Step 3: Preview (should show multiple files)
    const previewRequest = new Request('http://localhost/api/sitemap-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: conversionId,
        config: { maxPerFile: 50000 }
      })
    });

    const previewResponse = await sitemapPreviewPost(previewRequest);
    const previewResult = await previewResponse.json();

    expect(previewResult.success).toBe(true);
    expect(previewResult.preview.totalFiles).toBe(2); // 75k / 50k = 2 files
    expect(previewResult.preview.needsIndex).toBe(true);
    expect(previewResult.preview.files[0].filename).toBe('sitemap_1.xml');
    expect(previewResult.preview.files[1].filename).toBe('sitemap_2.xml');

    // Step 4: Generate
    const generateRequest = new Request('http://localhost/api/generate-sitemap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: conversionId,
        config: { maxPerFile: 50000 }
      })
    });

    const generateResponse = await generateSitemapPost(generateRequest);
    const generateResult = await generateResponse.json();

    expect(generateResult.success).toBe(true);
    expect(generateResult.totalFiles).toBe(2);
    expect(generateResult.hasIndex).toBe(true);
  });

  it('should handle workflow with data exclusions and duplicates', async () => {
    const csvContent = 'Name,URL,Status\nProduct 1,/product1,active\nProduct 2,/product1,active\nProduct 3,/product3,inactive';
    
    const formData = new FormData();
    const file = new File([csvContent], 'products.csv', { type: 'text/csv' });
    formData.append('file', file);

    const uploadRequest = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    });

    const uploadResponse = await uploadPost(uploadRequest);
    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.fileId;

    const config = {
      columnMapping: { 'Name': 'name', 'URL': 'url', 'Status': 'status' },
      urlPattern: 'https://example.com{URL}',
      exclusionRules: [
        { field: 'status', operator: 'equals', value: 'inactive' }
      ]
    };

    const convertRequest = new Request('http://localhost/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, config })
    });

    const convertResponse = await convertPost(convertRequest);
    const convertResult = await convertResponse.json();

    expect(convertResult.success).toBe(true);
    expect(convertResult.statistics.totalUrls).toBe(3);
    expect(convertResult.statistics.validUrls).toBe(1); // Only one unique, active URL
    expect(convertResult.statistics.duplicateUrls).toBe(1);
    expect(convertResult.statistics.excludedUrls).toBe(1);
  });
});