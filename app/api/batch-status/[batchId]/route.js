import { NextResponse } from 'next/server';
import { getBatchStatus, cancelBatch, pauseBatch, resumeBatch } from '../../../../lib/batchQueue.js';
import { isValidBatchId } from '../../../../lib/batchProcessing.js';

export async function GET(request, { params }) {
  try {
    const { batchId } = await params;
    
    if (!batchId || !isValidBatchId(batchId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batch ID' },
        { status: 400 }
      );
    }
    
    // Get batch status from file storage instead of batch queue
    global.fileStorage = global.fileStorage || new Map();
    
    // Find all files for this batch
    const batchFiles = [];
    for (const [fileId, fileData] of global.fileStorage.entries()) {
      if (fileData.batchId === batchId) {
        // Check if this is a JSON file (converted file)
        const isJsonFile = fileId.endsWith('_json');
        if (isJsonFile) {
          // This is a converted JSON file, get the original file ID
          const originalFileId = fileData.originalFileId;
          const originalFileData = global.fileStorage.get(originalFileId);
          
          if (originalFileData) {
            batchFiles.push({
              fileId: originalFileId,
              originalName: originalFileData.originalName,
              status: 'completed',
              statistics: fileData.stats || null
            });
          }
        }
      }
    }
    
    // If no files found in memory, try persistent storage
    if (batchFiles.length === 0) {
      try {
        const { getBatchFiles } = await import('../../../../lib/fileStorage.js');
        const persistentResult = await getBatchFiles(batchId);
        
        if (persistentResult.success && persistentResult.files.length > 0) {
          // Add files from persistent storage
          for (const fileInfo of persistentResult.files) {
            batchFiles.push({
              fileId: fileInfo.fileId,
              originalName: fileInfo.fileName.replace('.json', ''),
              status: 'completed',
              statistics: fileInfo.stats || null
            });
          }
        }
      } catch (error) {
        console.warn('Failed to load files from persistent storage:', error.message);
      }
    }
    
    if (batchFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    // Create batch status response
    const batchStatus = {
      batchId,
      status: 'completed',
      progress: 100,
      files: batchFiles,
      activeProcessors: [],
      isProcessing: false,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
    
    return NextResponse.json({
      success: true,
      batchStatus
    });
    
  } catch (error) {
    console.error('Get batch status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get batch status' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { batchId } = await params;
    const { action } = await request.json();
    
    if (!batchId || !isValidBatchId(batchId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batch ID' },
        { status: 400 }
      );
    }
    
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }
    
    let result;
    
    switch (action) {
      case 'cancel':
        result = cancelBatch(batchId);
        break;
      case 'pause':
        result = pauseBatch(batchId);
        break;
      case 'resume':
        result = resumeBatch(batchId);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Supported actions: cancel, pause, resume' },
          { status: 400 }
        );
    }
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: result.message,
      batchStatus: getBatchStatus(batchId)
    });
    
  } catch (error) {
    console.error('Batch action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to perform batch action' },
      { status: 500 }
    );
  }
}