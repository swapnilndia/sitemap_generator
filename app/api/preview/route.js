import { NextResponse } from 'next/server';
import { generateUrlPreview } from '../../../lib/buildUrls.js';
import { getCsvPreview } from '../../../lib/csv.js';
import { getExcelPreview } from '../../../lib/excel.js';

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
    const fileData = global.fileStorage.get(fileId);
    
    if (!fileData) {
      return NextResponse.json(
        { success: false, error: 'File not found or expired' },
        { status: 404 }
      );
    }

    const { buffer, fileType, headers } = fileData;
    const { columnMapping, urlPattern } = config;

    // Get preview data
    let previewData;
    if (fileType === 'csv') {
      previewData = await getCsvPreview(buffer, 10); // Get more rows for better preview
    } else {
      previewData = await getExcelPreview(buffer, 10);
    }

    // Generate URL preview
    const urlPreview = generateUrlPreview(
      previewData.previewRows,
      urlPattern,
      columnMapping,
      5
    );

    return NextResponse.json({
      success: true,
      preview: {
        sampleUrls: urlPreview.previewUrls,
        validCount: urlPreview.validCount,
        excludedCount: urlPreview.excludedCount,
        excludedReasons: urlPreview.excludedReasons,
        totalSampled: urlPreview.totalSampled,
        sampleData: previewData.previewRows.slice(0, 3) // Show first 3 rows of raw data
      }
    });

  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Preview generation failed' },
      { status: 500 }
    );
  }
}