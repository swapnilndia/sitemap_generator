import { NextResponse } from 'next/server';
import archiver from 'archiver';
import { Readable } from 'stream';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'zip'; // 'zip' or 'single'
    const filename = searchParams.get('filename');

    // Retrieve sitemap data
    global.sitemapStorage = global.sitemapStorage || new Map();
    let sitemapData = global.sitemapStorage.get(id);
    
    // If not found in memory, try persistent storage
    if (!sitemapData) {
      try {
        const { loadJsonFile } = await import('../../../lib/fileStorage.js');
        const persistentResult = await loadJsonFile(`sitemap_${id}`);
        
        if (persistentResult.success) {
          sitemapData = persistentResult.data;
        }
      } catch (error) {
        console.warn('Failed to load sitemap from persistent storage:', error.message);
      }
    }
    
    if (!sitemapData) {
      return NextResponse.json(
        { success: false, error: 'Sitemap files not found or expired' },
        { status: 404 }
      );
    }

    const { files, index } = sitemapData;

    // Single file download
    if (type === 'single' && filename) {
      let fileContent = '';
      let contentType = 'application/xml';
      
      if (filename === 'sitemap_index.xml' && index) {
        fileContent = index.content;
      } else {
        const file = files.find(f => f.filename === filename);
        if (!file) {
          return NextResponse.json(
            { success: false, error: 'File not found' },
            { status: 404 }
          );
        }
        fileContent = file.content;
      }

      return new NextResponse(fileContent, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': Buffer.byteLength(fileContent, 'utf8').toString()
        }
      });
    }

    // ZIP download (default)
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Add sitemap files to archive
    for (const file of files) {
      archive.append(file.content, { name: file.filename });
    }
    
    // Add sitemap index if exists
    if (index) {
      archive.append(index.content, { name: index.filename });
    }
    
    // Finalize archive
    archive.finalize();

    // Convert archive stream to buffer
    const chunks = [];
    for await (const chunk of archive) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Generate consistent filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const zipFilename = `sitemaps_${timestamp}.zip`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': buffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Sitemap download error:', error);
    return NextResponse.json(
      { success: false, error: 'Download failed' },
      { status: 500 }
    );
  }
}