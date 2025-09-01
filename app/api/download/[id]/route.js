import { NextResponse } from 'next/server';
import { formatJsonForOutput } from '../../../../lib/jsonConverter.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // First try to get from memory storage
    global.conversionStorage = global.conversionStorage || new Map();
    const conversionData = global.conversionStorage.get(id);
    
    if (!conversionData) {
      return NextResponse.json(
        { success: false, error: 'Conversion not found or expired' },
        { status: 404 }
      );
    }

    // Load the actual JSON data from file
    const { loadJsonFile } = await import('../../../../lib/fileStorage.js');
    const fileResult = await loadJsonFile(id);
    
    if (!fileResult.success) {
      return NextResponse.json(
        { success: false, error: 'JSON file not found or expired' },
        { status: 404 }
      );
    }

    const jsonString = formatJsonForOutput(fileResult.data, true);

    // Generate consistent filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `converted_data_${timestamp}.json`;

    // Create response with proper headers for download
    const response = new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(jsonString, 'utf8').toString()
      }
    });

    return response;

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { success: false, error: 'Download failed' },
      { status: 500 }
    );
  }
}