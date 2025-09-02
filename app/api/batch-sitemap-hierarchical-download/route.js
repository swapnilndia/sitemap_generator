import { NextResponse } from 'next/server';
import { getHierarchicalSitemapJobStatus, getHierarchicalSitemapFiles } from '../../../lib/batchSitemap.js';

import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';

export async function POST(request) {
  try {
    const { jobId, downloadType = 'zip' } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Missing jobId' },
        { status: 400 }
      );
    }

    console.log(`Preparing hierarchical sitemap download for job ${jobId}...`);

    // Get job status
    const jobStatus = getHierarchicalSitemapJobStatus(jobId);
    if (!jobStatus) {
      console.log(`Hierarchical sitemap job ${jobId} not found in memory, checking for files on disk...`);
    }

    if (jobStatus && jobStatus.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Sitemap generation not completed' },
        { status: 400 }
      );
    }

    // Get sitemap files
    const filesResult = await getHierarchicalSitemapFiles(jobId);
    if (!filesResult.success) {
      return NextResponse.json(
        { success: false, error: filesResult.error },
        { status: 404 }
      );
    }

    const { files, totalFiles, hasIndex, groups, totalGroups, totalUrls } = filesResult;

    if (downloadType === 'zip') {
      // Generate download token for ZIP
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 11);
      const downloadToken = `hierarchical_sitemap_${jobId}_${timestamp}_${randomId}`;
      
      return NextResponse.json({
        success: true,
        downloadUrl: `/api/batch-sitemap-hierarchical-download?token=${downloadToken}`,
        downloadToken,
        totalFiles,
        hasIndex,
        totalGroups,
        totalUrls,
        groups: Object.keys(groups || {})
      });
    } else {
      // Return file list for individual downloads
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 11);
      const downloadToken = `hierarchical_sitemap_${jobId}_${timestamp}_${randomId}`;
      
      return NextResponse.json({
        success: true,
        files: files.map(file => ({
          fileName: file.fileName,
          downloadUrl: `/api/batch-sitemap-hierarchical-download?token=${downloadToken}&filename=${file.fileName}`,
          isIndex: file.isIndex,
          groupName: file.groupName,
          urlCount: file.urlCount
        })),
        totalFiles,
        hasIndex,
        totalGroups,
        totalUrls,
        groups: Object.keys(groups || {})
      });
    }

  } catch (error) {
    console.error('Hierarchical sitemap download API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to prepare download' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const filename = searchParams.get('filename');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing download token' },
        { status: 400 }
      );
    }

    // Extract jobId from token (format: hierarchical_sitemap_<jobId>_<timestamp>_<random>)
    const tokenParts = token.split('_');
    if (tokenParts.length < 4 || tokenParts[0] !== 'hierarchical' || tokenParts[1] !== 'sitemap') {
      return NextResponse.json(
        { success: false, error: 'Invalid download token format' },
        { status: 400 }
      );
    }
    
    const jobId = tokenParts.slice(2, -2).join('_'); // Remove timestamp and random parts
    
    // Get hierarchical sitemap files directly
    const filesResult = await getHierarchicalSitemapFiles(jobId);

    if (!filesResult.success) {
      return NextResponse.json(
        { success: false, error: filesResult.error },
        { status: 404 }
      );
    }

    if (filename) {
      // Single file download
      const file = filesResult.files.find(f => f.fileName === filename);
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'File not found' },
          { status: 404 }
        );
      }
      
      const fileContent = await fs.readFile(file.filePath, 'utf8');
      
      return new NextResponse(fileContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': Buffer.byteLength(fileContent, 'utf8').toString()
        }
      });
    } else {
      // ZIP download - create ZIP on the fly
      const { Readable } = await import('stream');
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks = [];
      
      // Set up event handlers BEFORE finalizing
      const archivePromise = new Promise((resolve, reject) => {
        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => resolve());
        archive.on('error', (err) => reject(err));
      });
      
      // Add all files to ZIP
      for (const file of filesResult.files) {
        const fileContent = await fs.readFile(file.filePath, 'utf8');
        archive.append(fileContent, { name: file.fileName });
      }
      
      // Finalize and wait for completion
      await archive.finalize();
      await archivePromise;
      
      const zipBuffer = Buffer.concat(chunks);
      
      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="hierarchical-sitemaps-${jobId}.zip"`,
          'Content-Length': zipBuffer.length.toString()
        }
      });
    }

  } catch (error) {
    console.error('Hierarchical sitemap download error:', error);
    return NextResponse.json(
      { success: false, error: 'Download failed' },
      { status: 500 }
    );
  }
}


