import { NextResponse } from 'next/server';
import { queueBatch, getBatchStatus } from '../../../lib/batchQueue.js';
import { createBatchJob, validateBatchConfig, isValidBatchId } from '../../../lib/batchProcessing.js';
import { convertFileToJson } from '../../../lib/jsonConverter.js';

export async function POST(request) {
  try {
    const { batchId, config } = await request.json();
    
    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      );
    }
    
    if (!isValidBatchId(batchId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batch ID format' },
        { status: 400 }
      );
    }
    
    // Validate configuration
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Configuration is required' },
        { status: 400 }
      );
    }
    
    const configValidation = validateBatchConfig(config);
    if (!configValidation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid configuration', details: configValidation.errors },
        { status: 400 }
      );
    }
    
    // Get files from global storage
    global.fileStorage = global.fileStorage || new Map();
    
    // Find all files for this batch
    const batchFiles = [];
    
    // Find all files for this batch directly from storage
    for (const [fileId, fileData] of global.fileStorage.entries()) {
      if (fileData.batchId === batchId) {
        batchFiles.push({
          fileId,
          originalName: fileData.originalName,
          ...fileData
        });
      }
    }
    
    if (batchFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files found for batch' },
        { status: 404 }
      );
    }
    
    console.log(`Converting ${batchFiles.length} files for batch ${batchId}...`);
    
    // Convert each file to JSON
    const conversionResults = [];
    const errors = [];
    let totalUrls = 0;
    let validUrls = 0;
    let excludedUrls = 0;
    let duplicateUrls = 0;
    
    for (const file of batchFiles) {
      try {
        console.log(`Converting file ${file.originalName} (${file.fileType})...`);
        
        // Convert file to JSON using the same logic as single file mode
        const conversionResult = await convertFileToJson(
          file.buffer,
          file.fileType,
          config
        );
        
        if (conversionResult.success) {
          // Store converted JSON
          const jsonFileId = `${file.fileId}_json`;
          global.fileStorage.set(jsonFileId, {
            jsonData: conversionResult.json,
            originalFileId: file.fileId,
            originalName: file.originalName,
            convertedAt: new Date(),
            config: config,
            stats: conversionResult.json.statistics,
            batchId: batchId  // Add batch ID to JSON file
          });
          
          // Accumulate statistics
          totalUrls += conversionResult.json.statistics?.totalRows || 0;
          validUrls += conversionResult.json.statistics?.validUrls || 0;
          excludedUrls += conversionResult.json.statistics?.excludedRows || 0;
          duplicateUrls += conversionResult.json.statistics?.duplicateUrls || 0;
          
          conversionResults.push({
            fileId: file.fileId,
            jsonFileId: jsonFileId,
            originalName: file.originalName,
            success: true,
            stats: conversionResult.json.statistics,
            previewData: conversionResult.json.data.slice(0, 3) // First 3 rows for preview
          });
        } else {
          errors.push({
            fileId: file.fileId,
            originalName: file.originalName,
            error: conversionResult.error
          });
        }
        
      } catch (error) {
        console.error(`Error converting file ${file.originalName}:`, error);
        errors.push({
          fileId: file.fileId,
          originalName: file.originalName,
          error: error.message
        });
      }
    }
    
    const successCount = conversionResults.length;
    const errorCount = errors.length;
    const totalFiles = batchFiles.length;
    
    return NextResponse.json({
      success: successCount > 0,
      batchId,
      status: errorCount === 0 ? 'completed' : 'partial_success',
      totalFiles,
      successCount,
      errorCount,
      conversionResults,
      errors,
      statistics: {
        totalFiles,
        totalUrls,
        validUrls,
        excludedUrls,
        duplicateUrls
      },
      metadata: {
        processedAt: new Date().toISOString(),
        urlPattern: config.urlPattern,
        grouping: config.grouping || 'none',
        includeLastmod: config.includeLastmod || false,
        changefreq: config.changefreq,
        priority: config.priority
      },
      message: `Converted ${successCount}/${totalFiles} files successfully`
    });
    
  } catch (error) {
    console.error('Batch convert error:', error);
    return NextResponse.json(
      { success: false, error: 'Conversion failed' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    
    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      );
    }
    
    if (!isValidBatchId(batchId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batch ID format' },
        { status: 400 }
      );
    }
    
    const batchStatus = getBatchStatus(batchId);
    
    if (!batchStatus) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      batchStatus
    });
    
  } catch (error) {
    console.error('Get batch convert status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get batch status' },
      { status: 500 }
    );
  }
}