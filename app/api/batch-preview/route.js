import { NextResponse } from 'next/server';
import { processBatchPreview } from '../../../lib/batchProcessing.js';

export async function POST(request) {
  try {
    const { batchId, config } = await request.json();

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    if (!config || !config.urlPattern || !config.columnMapping?.link) {
      return NextResponse.json(
        { success: false, error: 'Configuration is incomplete' },
        { status: 400 }
      );
    }

    // Generate preview for the batch
    const previewResult = await processBatchPreview(batchId, config);

    if (!previewResult.success) {
      return NextResponse.json(
        { success: false, error: previewResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preview: previewResult.preview
    });

  } catch (error) {
    console.error('Batch preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Preview generation failed' },
      { status: 500 }
    );
  }
}

