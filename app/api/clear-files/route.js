import { NextResponse } from 'next/server';
import { clearAllFiles } from '../../../lib/fileStorage.js';

export async function POST(request) {
  try {
    // Clear all temporary files
    const result = await clearAllFiles();
    
    // Clear all in-memory storage as well
    global.fileStorage = new Map();
    global.conversionStorage = new Map();
    global.jsonStorage = new Map();
    global.sitemapStorage = new Map();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Cleared ${result.filesCleared} files and reset all storage`,
        filesCleared: result.filesCleared
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error clearing files:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to clear files'
    }, { status: 500 });
  }
}