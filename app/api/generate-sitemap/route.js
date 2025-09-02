import { NextResponse } from 'next/server';
import { convertJsonToUrlGenerator, processJsonForSitemap } from '../../../lib/jsonToSitemap.js';
import { loadJsonFile } from '../../../lib/fileStorage.js';
import { create } from 'xmlbuilder2';
import archiver from 'archiver';
import { Readable } from 'stream';

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

    // Process JSON for sitemap generation
    const processed = processJsonForSitemap(jsonData, maxPerFile);

    // Generate sitemap files
    const sitemapFiles = [];
    
    for (const sitemapFile of processed.sitemapFiles) {
      const xmlContent = generateSitemapXML(sitemapFile.urls);
      sitemapFiles.push({
        filename: sitemapFile.filename,
        content: xmlContent,
        urlCount: sitemapFile.urlCount
      });
    }

    // Generate sitemap index if needed
    let sitemapIndex = null;
    if (processed.sitemapFiles.length > 1) {
      sitemapIndex = {
        filename: 'sitemap_index.xml',
        content: generateSitemapIndex(processed.sitemapFiles)
      };
    }

    // Store generated files in both memory and persistent storage
    const generationId = `sitemap_${Date.now()}`;
    global.sitemapStorage = global.sitemapStorage || new Map();
    
    const sitemapData = {
      files: sitemapFiles,
      index: sitemapIndex,
      statistics: processed.statistics,
      createdAt: new Date()
    };
    
    // Store in memory for immediate access
    global.sitemapStorage.set(generationId, sitemapData);
    
    // Also store persistently for deployed environments
    try {
      const { saveJsonFile } = await import('../../../lib/fileStorage.js');
      const saveResult = await saveJsonFile(`sitemap_${generationId}`, sitemapData, {
        type: 'sitemap',
        generationId: generationId
      });
      
      if (!saveResult.success) {
        console.warn(`Failed to save sitemap ${generationId} persistently:`, saveResult.error);
      }
    } catch (error) {
      console.warn(`Failed to save sitemap ${generationId} persistently:`, error.message);
    }

    return NextResponse.json({
      success: true,
      generationId,
      totalFiles: sitemapFiles.length,
      hasIndex: !!sitemapIndex,
      statistics: {
        totalUrls: processed.totalValidUrls,
        filesGenerated: sitemapFiles.length,
        hasIndex: !!sitemapIndex
      }
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate sitemaps' },
      { status: 500 }
    );
  }
}

function generateSitemapXML(urls) {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('urlset', {
      xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9'
    });

  for (const urlEntry of urls) {
    const urlElement = root.ele('url');
    urlElement.ele('loc').txt(urlEntry.loc);
    
    if (urlEntry.lastmod) {
      urlElement.ele('lastmod').txt(urlEntry.lastmod);
    }
    
    if (urlEntry.changefreq) {
      urlElement.ele('changefreq').txt(urlEntry.changefreq);
    }
    
    if (urlEntry.priority) {
      urlElement.ele('priority').txt(urlEntry.priority.toString());
    }
  }

  return root.end({ prettyPrint: true });
}

function generateSitemapIndex(sitemapFiles) {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('sitemapindex', {
      xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9'
    });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';
  const currentDate = new Date().toISOString().split('T')[0];

  for (const sitemapFile of sitemapFiles) {
    const sitemapElement = root.ele('sitemap');
    sitemapElement.ele('loc').txt(`${baseUrl}/${sitemapFile.filename}`);
    sitemapElement.ele('lastmod').txt(currentDate);
  }

  return root.end({ prettyPrint: true });
}