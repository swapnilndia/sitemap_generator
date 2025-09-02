import { NextResponse } from 'next/server';
import { createSitemapZip, getSitemapFiles, getSitemapJobStatus } from '../../../lib/batchSitemap.js';
import { generateDownloadUrl, validateDownloadToken } from '../../../lib/batchDownload.js';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const { jobId, fileName } = await request.json();
    
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    // Check if job exists in memory, but don't fail if it's not found
    // The job might have been lost due to server restart, but files might still exist
    const jobStatus = getSitemapJobStatus(jobId);
    if (!jobStatus) {
      console.log(`Sitemap job ${jobId} not found in memory, checking for files on disk...`);
    }
    
    if (fileName) {
      // Download single sitemap file
      const filesResult = await getSitemapFiles(jobId);
      if (!filesResult.success) {
        return NextResponse.json(
          { success: false, error: 'Failed to get sitemap files' },
          { status: 500 }
        );
      }
      
      const file = filesResult.files.find(f => f.fileName === fileName);
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Sitemap file not found' },
          { status: 404 }
        );
      }
      
      // Generate download token for single file
      const downloadToken = generateDownloadUrl('sitemap_file', `${jobId}/${fileName}`);
      
      return NextResponse.json({
        success: true,
        downloadToken,
        fileName: file.fileName,
        fileSize: file.fileSize,
        type: 'single'
      });
      
    } else {
      // Download all sitemaps as ZIP
      const zipResult = await createSitemapZip(jobId);
      
      if (!zipResult.success) {
        return NextResponse.json(
          { success: false, error: zipResult.error },
          { status: 400 }
        );
      }
      
      // Generate download token for ZIP
      const downloadToken = generateDownloadUrl('sitemap_zip', jobId);
      
      return NextResponse.json({
        success: true,
        downloadToken,
        fileName: zipResult.zipFileName,
        fileSize: zipResult.fileSize,
        type: 'zip'
      });
    }
    
  } catch (error) {
    console.error('Sitemap download preparation error:', error);
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
    
    if (downloadInfo.type === 'sitemap_file') {
      // Download single sitemap file
      const [jobId, fileName] = downloadInfo.id.split('/');
      // Use /tmp in deployment environments, fallback to local temp for development
      const TEMP_DIR = process.env.NODE_ENV === 'production' 
        ? '/tmp' 
        : path.join(process.cwd(), 'temp');
      const SITEMAP_DIR = path.join(TEMP_DIR, 'sitemaps');
      const filePath = path.join(SITEMAP_DIR, jobId, fileName);
      
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        return new NextResponse(fileContent, {
          headers: {
            'Content-Type': 'application/xml',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': Buffer.byteLength(fileContent, 'utf8').toString()
          }
        });
        
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Sitemap file not found' },
          { status: 404 }
        );
      }
      
    } else if (downloadInfo.type === 'sitemap_zip') {
      // Download ZIP file
      const jobId = downloadInfo.id;
      // Use /tmp in deployment environments, fallback to local temp for development
      const TEMP_DIR = process.env.NODE_ENV === 'production' 
        ? '/tmp' 
        : path.join(process.cwd(), 'temp');
      const SITEMAP_DIR = path.join(TEMP_DIR, 'sitemaps');
      
      // Find the ZIP file (it might have a timestamp in the name)
      try {
        const files = await fs.readdir(SITEMAP_DIR);
        const zipFile = files.find(f => 
          f.startsWith(`sitemaps_${jobId}_`) && f.endsWith('.zip')
        );
        
        if (!zipFile) {
          // Create ZIP if it doesn't exist
          const zipResult = await createSitemapZip(jobId);
          if (!zipResult.success) {
            throw new Error('Failed to create ZIP file');
          }
          
          const fileBuffer = await fs.readFile(zipResult.zipPath);
          
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${zipResult.zipFileName}"`,
              'Content-Length': zipResult.fileSize.toString()
            }
          });
        } else {
          const zipPath = path.join(SITEMAP_DIR, zipFile);
          const fileBuffer = await fs.readFile(zipPath);
          const stats = await fs.stat(zipPath);
          
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${zipFile}"`,
              'Content-Length': stats.size.toString()
            }
          });
        }
        
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'ZIP file not found or could not be created' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: 'Unknown download type' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Sitemap download error:', error);
    return NextResponse.json(
      { success: false, error: 'Download failed' },
      { status: 500 }
    );
  }
}