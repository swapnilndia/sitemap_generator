import { NextResponse } from 'next/server';
import { generateBatchSitemaps, getSitemapJobStatus } from '../../../lib/batchSitemap.js';
import { isValidBatchId } from '../../../lib/batchProcessing.js';

export async function POST(request) {
  try {
    const { batchId, sitemapConfig, fileIds } = await request.json();
    
    if (!batchId || !isValidBatchId(batchId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batch ID' },
        { status: 400 }
      );
    }
    
    // Validate sitemap configuration
    const config = {
      maxPerFile: 50000,
      grouping: 'group', // Use 'group' to group by the group property
      changefreq: 'weekly',
      priority: '0.8',
      includeLastmod: false,
      ...sitemapConfig
    };
    
    // Validate configuration values
    if (config.maxPerFile < 1 || config.maxPerFile > 50000) {
      return NextResponse.json(
        { success: false, error: 'maxPerFile must be between 1 and 50000' },
        { status: 400 }
      );
    }
    
    const validChangefreq = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
    if (config.changefreq && !validChangefreq.includes(config.changefreq)) {
      return NextResponse.json(
        { success: false, error: 'Invalid changefreq value' },
        { status: 400 }
      );
    }
    
    const priority = parseFloat(config.priority);
    if (isNaN(priority) || priority < 0 || priority > 1) {
      return NextResponse.json(
        { success: false, error: 'Priority must be a number between 0 and 1' },
        { status: 400 }
      );
    }
    
    // Generate sitemaps
    const result = await generateBatchSitemaps(batchId, config, fileIds);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      sitemapCount: result.sitemapCount,
      errorCount: result.errorCount,
      message: 'Sitemap generation completed',
      results: result.results,
      errors: result.errors
    });
    
  } catch (error) {
    console.error('Batch sitemap generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Sitemap generation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
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
    
    return NextResponse.json({
      success: true,
      jobStatus
    });
    
  } catch (error) {
    console.error('Get sitemap job status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}