import { NextResponse } from 'next/server';
import { convertFileToJson } from '../../../lib/jsonConverter.js';
import { cleanupOldFiles } from '../../../lib/fileStorage.js';
import serverlessStorage from '../../../lib/serverlessStorage.js';

export async function POST(request) {
  try {
    const { fileId, config } = await request.json();

    if (!fileId || !config) {
      return NextResponse.json(
        { success: false, error: 'Missing fileId or config' },
        { status: 400 }
      );
    }

    // Retrieve file data from serverless storage
    const fileResult = await serverlessStorage.loadFile(fileId);
    
    if (!fileResult.success) {
      return NextResponse.json(
        { success: false, error: 'File not found or expired' },
        { status: 404 }
      );
    }

    const fileData = fileResult.data;
    const { buffer, fileType } = fileData;
    
    // Convert base64 buffer back to Buffer for processing
    const bufferObj = Buffer.from(buffer, 'base64');

    // Convert file to JSON
    const conversionResult = await convertFileToJson(bufferObj, fileType, config);

    if (!conversionResult.success) {
      return NextResponse.json(
        { success: false, error: conversionResult.error },
        { status: 400 }
      );
    }

    // Clean up old files before saving new one
    await serverlessStorage.cleanupOldFiles();
    
    // Save optimized JSON to serverless storage
    const conversionId = `conversion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Saving conversion with ID:', conversionId);
    
    const saveResult = await serverlessStorage.saveFile(conversionId, conversionResult.json, {
      type: 'conversion',
      originalFileId: fileId,
      config: config,
      statistics: conversionResult.json.statistics
    });
    
    console.log('Save result:', saveResult);
    
    if (!saveResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save conversion result' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversionId,
      statistics: conversionResult.json.statistics,
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