import { NextResponse } from 'next/server';
import { getHierarchicalSitemapJobStatus } from '../../../../lib/batchSitemap.js';

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Missing jobId' },
        { status: 400 }
      );
    }

    console.log(`Getting hierarchical sitemap status for job ${jobId}...`);

    // Get job status
    const jobStatus = getHierarchicalSitemapJobStatus(jobId);

    if (!jobStatus) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    console.log(`Job status: ${jobStatus.status}, Progress: ${jobStatus.progress}%`);

    return NextResponse.json({
      success: true,
      jobId: jobStatus.jobId,
      batchId: jobStatus.batchId,
      status: jobStatus.status,
      progress: jobStatus.progress,
      currentStep: jobStatus.currentStep,
      totalSteps: jobStatus.totalSteps,
      currentMessage: jobStatus.currentMessage,
      sitemapConfig: jobStatus.sitemapConfig,
      groupingConfig: jobStatus.groupingConfig,
      groups: jobStatus.groups,
      sitemapIndex: jobStatus.sitemapIndex,
      groupSitemaps: jobStatus.groupSitemaps,
      totalGroups: jobStatus.totalGroups,
      totalUrls: jobStatus.totalUrls,
      errorCount: jobStatus.errorCount,
      createdAt: jobStatus.createdAt,
      completedAt: jobStatus.completedAt,
      errors: jobStatus.errors
    });

  } catch (error) {
    console.error('Hierarchical sitemap status API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
