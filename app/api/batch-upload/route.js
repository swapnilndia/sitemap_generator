import { NextResponse } from 'next/server';
import { createBatchJob } from '../../../lib/batchClient.js';
import { validateBatchUploadConfig } from '../../../lib/batchProcessing.js';
import { queueBatch } from '../../../lib/batchQueue.js';
import { extractExcelHeaders } from '../../../lib/excel.js';
import { extractCsvHeaders } from '../../../lib/csv.js';

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    // Extract files
    const files = formData.getAll('files');
    const fileIds = formData.getAll('fileIds');
    const configStr = formData.get('config');
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }
    
    // Parse configuration
    let config = {};
    if (configStr) {
      try {
        config = JSON.parse(configStr);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Invalid configuration format' },
          { status: 400 }
        );
      }
    }
    
    // Validate configuration (minimal validation for upload)
    if (Object.keys(config).length > 0) {
      const configValidation = validateBatchUploadConfig(config);
      if (!configValidation.isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid configuration', details: configValidation.errors },
          { status: 400 }
        );
      }
    }
    
    // Initialize storage systems
    global.fileStorage = global.fileStorage || new Map();
    
    const uploadedFiles = [];
    let batchHeaders = null;
    
    // Create batch job first to get proper file IDs
    const tempFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      tempFiles.push({
        name: file.name,
        size: file.size,
        type: file.type
      });
    }
    
    // Create batch job to generate proper file IDs
    const batchJob = createBatchJob(tempFiles, config);
    
    // Import file storage functions for persistent storage
    const { saveBatchFile } = await import('../../../lib/fileStorage.js');
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const batchFile = batchJob.files[i];
      const fileId = batchFile.fileId; // Use the proper batch file ID
      
      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Determine file type
      let fileType = 'csv';
      if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        fileType = 'xlsx';
      }
      
      // Extract headers from the first file for batch configuration
      if (i === 0) {
        try {
          if (fileType === 'xlsx') {
            const excelResult = await extractExcelHeaders(buffer);
            batchHeaders = excelResult.headers || excelResult;
          } else {
            const csvResult = await extractCsvHeaders(buffer);
            batchHeaders = csvResult.headers || csvResult;
          }
        } catch (error) {
          console.warn(`Failed to extract headers from ${file.name}:`, error.message);
          // Use default headers if extraction fails
          batchHeaders = ['url', 'title', 'description'];
        }
      }
      
      // Store file data in both memory and persistent storage
      const fileData = {
        buffer,
        fileType,
        originalName: file.name,
        size: file.size,
        uploadedAt: new Date(),
        batchId: batchJob.batchId
      };
      
      // Store in memory for immediate access
      global.fileStorage.set(fileId, fileData);
      
      // Also store persistently for deployed environments
      try {
        const saveResult = await saveBatchFile(batchJob.batchId, fileId, fileData);
        
        if (!saveResult.success) {
          console.warn(`Failed to save file ${fileId} persistently:`, saveResult.error);
        }
      } catch (error) {
        console.warn(`Failed to save file ${fileId} persistently:`, error.message);
      }
      
      uploadedFiles.push({
        fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        headers: i === 0 ? batchHeaders : null // Only include headers for first file
      });
    }
    
    // Store batch job without starting processing
    // Processing will start later when user clicks "Convert"
    const { storeBatchJob } = await import('../../../lib/batchProcessing.js');
    const storeResult = await storeBatchJob(batchJob);
    
    if (!storeResult.success) {
      return NextResponse.json(
        { success: false, error: storeResult.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      batchId: batchJob.batchId,
      fileCount: uploadedFiles.length,
      files: uploadedFiles,
      headers: batchHeaders,
      message: 'Files uploaded and batch queued for processing'
    });
    
  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}