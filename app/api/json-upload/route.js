import { NextResponse } from 'next/server';
import { validateJsonForSitemap } from '../../../lib/jsonToSitemap.js';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      return NextResponse.json(
        { success: false, error: 'Please upload a JSON file' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit for JSON)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File size exceeds 50MB limit. Current size: ${Math.round(file.size / (1024 * 1024))}MB` },
        { status: 400 }
      );
    }

    // Parse JSON
    const buffer = Buffer.from(await file.arrayBuffer());
    let jsonData;
    
    try {
      jsonData = JSON.parse(buffer.toString('utf8'));
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON format. Please check your file.' },
        { status: 400 }
      );
    }

    // Validate JSON structure for sitemap generation
    const validation = validateJsonForSitemap(jsonData);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Store JSON data temporarily
    const fileId = `json_${Date.now()}`;
    global.jsonStorage = global.jsonStorage || new Map();
    global.jsonStorage.set(fileId, {
      data: jsonData,
      fileName: file.name,
      uploadedAt: new Date(),
      validUrlCount: validation.validUrlCount
    });

    // Extract metadata for preview
    const metadata = jsonData.metadata || {};
    const statistics = jsonData.statistics || {};
    
    // Analyze grouping structure
    const groups = new Map();
    let totalValidUrls = 0;
    
    if (jsonData.data && Array.isArray(jsonData.data)) {
      for (const entry of jsonData.data) {
        if (!entry.processed?.excluded && !entry.processed?.isDuplicate && entry.processed?.url) {
          const groupName = entry.processed.group || 'default';
          if (!groups.has(groupName)) {
            groups.set(groupName, 0);
          }
          groups.set(groupName, groups.get(groupName) + 1);
          totalValidUrls++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      fileId,
      fileName: file.name,
      metadata,
      statistics,
      groups: Object.fromEntries(groups),
      totalValidUrls,
      hasGrouping: groups.size > 1
    });

  } catch (error) {
    console.error('JSON upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process JSON file' },
      { status: 500 }
    );
  }
}