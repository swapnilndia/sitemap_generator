import { convertFileToJson } from './lib/jsonConverter.js';
import { saveJsonFile, loadJsonFile } from './lib/fileStorage.js';
import fs from 'fs';

async function debugExcelConversion() {
  try {
    // Create a simple test Excel file content (this is just for testing the flow)
    console.log('Testing Excel conversion flow...');
    
    // Simulate Excel buffer (in real scenario this would be actual Excel data)
    const mockExcelBuffer = Buffer.from('mock excel data');
    const config = {
      columnMapping: {
        'Name': 'Name',
        'URL': 'URL'
      },
      urlPattern: 'https://example.com{URL}',
      grouping: 'none'
    };

    console.log('1. Converting Excel to JSON...');
    const result = await convertFileToJson(mockExcelBuffer, 'xlsx', config);
    console.log('Conversion result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('2. Saving JSON file...');
      const conversionId = `test_conversion_${Date.now()}`;
      const saveResult = await saveJsonFile(conversionId, result.json, config);
      console.log('Save result:', JSON.stringify(saveResult, null, 2));

      if (saveResult.success) {
        console.log('3. Loading JSON file...');
        const loadResult = await loadJsonFile(conversionId);
        console.log('Load result:', JSON.stringify(loadResult, null, 2));
      }
    }
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugExcelConversion();