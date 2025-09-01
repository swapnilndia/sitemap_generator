import { NextResponse } from 'next/server';
import { loadJsonFile } from '../../../../lib/fileStorage.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Load JSON data from file
    const fileResult = await loadJsonFile(id);
    
    if (!fileResult.success) {
      return NextResponse.json(
        { success: false, error: 'Conversion data not found or expired' },
        { status: 404 }
      );
    }

    const jsonData = fileResult.data;
    const config = jsonData.metadata?.config || {};

    // Return the JSON data for sitemap generation
    return NextResponse.json({
      success: true,
      jsonData: jsonData,
      config,
      fileName: `sitemap_${id}`,
      totalValidUrls: jsonData.statistics.validUrls,
      hasGrouping: checkHasGrouping(jsonData),
      groups: extractGroups(jsonData)
    });

  } catch (error) {
    console.error('Conversion data retrieval error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve conversion data' },
      { status: 500 }
    );
  }
}

function checkHasGrouping(jsonData) {
  const groups = new Set();
  
  if (jsonData.urls && Array.isArray(jsonData.urls)) {
    for (const url of jsonData.urls) {
      const groupName = url.group || 'default';
      groups.add(groupName);
      if (groups.size > 1) return true;
    }
  }
  
  return false;
}

function extractGroups(jsonData) {
  const groups = {};
  
  if (jsonData.urls && Array.isArray(jsonData.urls)) {
    for (const url of jsonData.urls) {
      const groupName = url.group || 'default';
      groups[groupName] = (groups[groupName] || 0) + 1;
    }
  }
  
  return groups;
}