import { NextRequest, NextResponse } from 'next/server';
import { validateFile } from '../../../lib/validate.js';
import { extractCsvHeaders, validateCsvStructure } from '../../../lib/csv.js';
import { extractExcelHeaders, validateExcelStructure } from '../../../lib/excel.js';
import serverlessStorage from '../../../lib/serverlessStorage.js';

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

    // Store file buffer in serverless storage
    const fileId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fileData = {
      buffer: buffer.toString('base64'), // Convert buffer to base64 for JSON storage
      fileType,
      fileName: file.name,
      headers,
      rowCount,
      sheetNames,
      uploadedAt: new Date()
    };
    
    // Store file in serverless storage
    const saveResult = await serverlessStorage.saveFile(fileId, fileData, {
      type: 'single_file',
      fileName: file.name,
      fileType: fileType,
      rowCount: rowCount
    });
    
    if (!saveResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save file' },
        { status: 500 }
      );
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