import { NextResponse } from 'next/server';
import { generateHierarchicalSitemaps } from '../../../lib/batchSitemap.js';

export async function POST(request) {
  try {
    const { batchId, sitemapConfig = {}, groupingConfig = {} } = await request.json();

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'Missing batchId' },
        { status: 400 }
      );
    }

    console.log(`Starting hierarchical sitemap generation for batch ${batchId}...`);
    console.log('Sitemap config:', sitemapConfig);
    console.log('Grouping config:', groupingConfig);

    // Generate hierarchical sitemaps
    const result = await generateHierarchicalSitemaps(batchId, sitemapConfig, groupingConfig);

    if (result.success) {
      console.log(`Hierarchical sitemap generation completed for batch ${batchId}`);
      console.log(`Job ID: ${result.jobId}`);
      console.log(`Total groups: ${result.totalGroups}`);
      console.log(`Group sitemaps: ${result.groupSitemaps}`);
      console.log(`Sitemap index: ${result.sitemapIndex}`);
      
      if (result.errors && result.errors.length > 0) {
        console.warn('Some groups had errors:', result.errors);
      }

      return NextResponse.json({
        success: true,
        jobId: result.jobId,
        totalGroups: result.totalGroups,
        totalFiles: result.totalFiles,
        groupSitemaps: result.groupSitemaps,
        sitemapIndex: result.sitemapIndex,
        errors: result.errors || []
      });
    } else {
      console.error(`Hierarchical sitemap generation failed for batch ${batchId}:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Hierarchical sitemap generation API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate hierarchical sitemaps' },
      { status: 500 }
    );
  }
}
