import { NextResponse } from 'next/server';
import { convertFileToJson } from '../../../lib/jsonConverter.js';
import { saveJsonFile, cleanupOldFiles } from '../../../lib/fileStorage.js';

export async function POST(request) {
  try {
    const { fileId, config } = await request.json();

    if (!fileId || !config) {
      return NextResponse.json(
        { success: false, error: 'Missing fileId or config' },
        { status: 400 }
      );
    }

    // Retrieve file data
    global.fileStorage = global.fileStorage || new Map();
    let fileData = global.fileStorage.get(fileId);

    // If not found in memory, try persistent storage
    if (!fileData) {
      try {
        const { loadJsonFile } = await import('../../../lib/fileStorage.js');
        const persistentResult = await loadJsonFile(`upload_${fileId}`);
        
        if (persistentResult.success) {
          fileData = persistentResult.data;
        }
      } catch (error) {
        console.warn('Failed to load file from persistent storage:', error.message);
      }
    }

    if (!fileData) {
      return NextResponse.json(
        { success: false, error: 'File not found or expired' },
        { status: 404 }
      );
    }

    const { buffer, fileType } = fileData;

    // Convert file to JSON
    const conversionResult = await convertFileToJson(buffer, fileType, config);

    if (!conversionResult.success) {
      return NextResponse.json(
        { success: false, error: conversionResult.error },
        { status: 400 }
      );
    }

    // Clean up old files before saving new one
    await cleanupOldFiles();
    
    // Save optimized JSON to file
    const conversionId = `conversion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Saving conversion with ID:', conversionId);
    const saveResult = await saveJsonFile(conversionId, conversionResult.json, config);
    console.log('Save result:', saveResult);
    
    if (!saveResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save conversion result' },
        { status: 500 }
      );
    }

    // Store minimal metadata in memory for quick access
    global.conversionStorage = global.conversionStorage || new Map();
    global.conversionStorage.set(conversionId, {
      fileId: conversionId,
      config,
      createdAt: new Date(),
      statistics: saveResult.statistics,
      filePath: saveResult.filePath
    });

    return NextResponse.json({
      success: true,
      conversionId,
      statistics: saveResult.statistics,
      metadata: {
        createdAt: new Date().toISOString(),
        fileId: conversionId,
        config
      }
    });

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { success: false, error: 'Conversion failed' },
      { status: 500 }
    );
  }
}