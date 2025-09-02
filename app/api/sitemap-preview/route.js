import { NextResponse } from 'next/server';
import { previewSitemapsFromJson } from '../../../lib/jsonToSitemap.js';
import { loadJsonFile } from '../../../lib/fileStorage.js';

export async function POST(request) {
  try {
    const { fileId, config } = await request.json();

    if (!fileId || !config) {
      return NextResponse.json(
        { success: false, error: 'Missing fileId or config' },
        { status: 400 }
      );
    }

    // Load JSON data from file
    let fileResult = await loadJsonFile(fileId);
    
    // If not found in persistent storage, try memory storage
    if (!fileResult.success) {
      global.jsonStorage = global.jsonStorage || new Map();
      const memoryData = global.jsonStorage.get(fileId);
      
      if (memoryData) {
        fileResult = {
          success: true,
          data: memoryData.data
        };
      }
    }
    
    if (!fileResult.success) {
      return NextResponse.json(
        { success: false, error: 'JSON file not found or expired' },
        { status: 404 }
      );
    }

    const jsonData = fileResult.data;
    const { maxPerFile = 50000 } = config;

    // Generate sitemap preview
    const preview = previewSitemapsFromJson(jsonData, maxPerFile);

    return NextResponse.json({
      success: true,
      preview: {
        totalFiles: preview.totalFiles,
        needsIndex: preview.needsIndex,
        files: preview.files,
        groups: preview.groups,
        statistics: preview.statistics,
        sampleUrls: preview.files.length > 0 ? 
          await getSampleUrls(jsonData, 5) : []
      }
    });

  } catch (error) {
    console.error('Sitemap preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate sitemap preview' },
      { status: 500 }
    );
  }
}

async function getSampleUrls(jsonData, count = 5) {
  const sampleUrls = [];
  const urls = jsonData.urls || [];

  for (let i = 0; i < Math.min(count, urls.length); i++) {
    const url = urls[i];
    sampleUrls.push({
      url: url.loc,
      group: url.group || 'default',
      lastmod: url.lastmod,
      changefreq: url.changefreq,
      priority: url.priority
    });
  }

  return sampleUrls;
}