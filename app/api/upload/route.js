import { NextRequest, NextResponse } from 'next/server';
import { validateFile } from '../../../lib/validate.js';
import { extractCsvHeaders, validateCsvStructure } from '../../../lib/csv.js';
import { extractExcelHeaders, validateExcelStructure } from '../../../lib/excel.js';

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

    // Validate file
    const validation = validateFile(file);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Determine file type from both filename and MIME type
    const fileName = file.name.toLowerCase();
    const mimeType = file.type;
    
    let fileType;
    if (fileName.endsWith('.csv') || mimeType === 'text/csv') {
      fileType = 'csv';
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || 
               mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
               mimeType === 'application/vnd.ms-excel') {
      fileType = 'xlsx';
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type. Please upload CSV or Excel files.' },
        { status: 400 }
      );
    }
    
    let headers, rowCount, sheetNames;
    
    if (fileType === 'csv') {
      const csvValidation = await validateCsvStructure(buffer);
      if (!csvValidation.success) {
        return NextResponse.json(
          { success: false, error: csvValidation.error },
          { status: 400 }
        );
      }
      headers = csvValidation.headers;
      rowCount = csvValidation.rowCount;
    } else {
      const excelValidation = await validateExcelStructure(buffer);
      if (!excelValidation.success) {
        return NextResponse.json(
          { success: false, error: excelValidation.error },
          { status: 400 }
        );
      }
      headers = excelValidation.headers;
      rowCount = excelValidation.rowCount;
      sheetNames = excelValidation.sheetNames;
    }

    // Store file buffer in both memory and persistent storage
    const fileId = Date.now().toString();
    global.fileStorage = global.fileStorage || new Map();
    
    const fileData = {
      buffer,
      fileType,
      fileName: file.name,
      headers,
      rowCount,
      sheetNames,
      uploadedAt: new Date()
    };
    
    // Store in memory for immediate access
    global.fileStorage.set(fileId, fileData);
    
    // Also store persistently for deployed environments
    try {
      const { saveJsonFile } = await import('../../../lib/fileStorage.js');
      const saveResult = await saveJsonFile(`upload_${fileId}`, fileData, {
        fileName: file.name,
        fileType: fileType
      });
      
      if (!saveResult.success) {
        console.warn(`Failed to save file ${fileId} persistently:`, saveResult.error);
      }
    } catch (error) {
      console.warn(`Failed to save file ${fileId} persistently:`, error.message);
    }

    return NextResponse.json({
      success: true,
      fileId,
      fileName: file.name,
      fileType,
      headers,
      rowCount,
      sheetNames: sheetNames || null
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'File upload failed' },
      { status: 500 }
    );
  }
}