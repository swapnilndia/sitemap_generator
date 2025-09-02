import { NextResponse } from 'next/server';
import { downloadSingleFile, downloadBatch, getDownloadFileInfo, validateDownloadToken } from '../../../lib/batchDownload.js';
import { isValidBatchId } from '../../../lib/batchProcessing.js';
import fs from 'fs/promises';

export async function POST(request) {
  try {
    const { batchId, fileId, fileIds } = await request.json();
    
    if (!batchId || !isValidBatchId(batchId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batch ID' },
        { status: 400 }
      );
    }
    
    let result;
    
    if (fileId) {
      // Download single file
      result = await downloadSingleFile(batchId, fileId);
    } else {
      // Download batch (all files or specific files)
      result = await downloadBatch(batchId, fileIds);
    }
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      downloadToken: result.downloadToken,
      fileName: result.fileName,
      fileSize: result.fileSize,
      fileCount: result.fileCount || 1
    });
    
  } catch (error) {
    console.error('Batch download error:', error);
    return NextResponse.json(
      { success: false, error: 'Download preparation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Download token is required' },
        { status: 400 }
      );
    }
    
    const downloadInfo = validateDownloadToken(token);
    
    if (!downloadInfo) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired download token' },
        { status: 401 }
      );
    }
    
    const fileInfo = await getDownloadFileInfo(token);
    
    if (!fileInfo.success) {
      return NextResponse.json(
        { success: false, error: fileInfo.error },
        { status: 404 }
      );
    }
    
    if (fileInfo.type === 'file') {
      // Return JSON file content
      return new NextResponse(JSON.stringify(fileInfo.data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${fileInfo.fileName}"`,
          'Content-Length': fileInfo.fileSize.toString()
        }
      });
    } else if (fileInfo.type === 'batch') {
      // Return ZIP file
      const fileBuffer = await fs.readFile(fileInfo.filePath);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fileInfo.fileName}"`,
          'Content-Length': fileInfo.fileSize.toString()
        }
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Unknown file type' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Download file error:', error);
    return NextResponse.json(
      { success: false, error: 'Download failed' },
      { status: 500 }
    );
  }
}