import { NextResponse } from 'next/server';
import { getSitemapJobStatus, getSitemapFiles } from '../../../../lib/batchSitemap.js';

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;
    
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    const jobStatus = getSitemapJobStatus(jobId);
    
    if (!jobStatus) {
      return NextResponse.json(
        { success: false, error: 'Sitemap job not found' },
        { status: 404 }
      );
    }
    
    // Get sitemap files
    const filesResult = await getSitemapFiles(jobId);
    
    return NextResponse.json({
      success: true,
      jobStatus: {
        ...jobStatus,
        files: filesResult.success ? filesResult.files : []
      }
    });
    
  } catch (error) {
    console.error('Get sitemap job status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}