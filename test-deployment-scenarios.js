#!/usr/bin/env node

/**
 * Comprehensive Deployment Test Script
 * Tests all scenarios for multiple file upload in deployment environment
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_FILES = [
  {
    name: 'test1.csv',
    content: 'url,title,description\nhttps://example.com/page1,Page 1,Description 1\nhttps://example.com/page2,Page 2,Description 2'
  },
  {
    name: 'test2.csv', 
    content: 'url,title,description\nhttps://example.com/page3,Page 3,Description 3\nhttps://example.com/page4,Page 4,Description 4'
  }
];

// Test scenarios
const SCENARIOS = [
  {
    name: 'Batch Upload',
    test: testBatchUpload
  },
  {
    name: 'Batch Preview',
    test: testBatchPreview
  },
  {
    name: 'Batch Conversion',
    test: testBatchConversion
  },
  {
    name: 'Batch Status',
    test: testBatchStatus
  },
  {
    name: 'File Storage',
    test: testFileStorage
  },
  {
    name: 'Temp Directory',
    test: testTempDirectory
  }
];

async function createTestFiles() {
  console.log('📁 Creating test files...');
  const testDir = path.join(__dirname, 'temp', 'test-files');
  await fs.mkdir(testDir, { recursive: true });
  
  for (const file of TEST_FILES) {
    const filePath = path.join(testDir, file.name);
    await fs.writeFile(filePath, file.content);
  }
  
  return testDir;
}

async function testBatchUpload() {
  console.log('🔄 Testing batch upload...');
  
  try {
    // Create FormData for batch upload
    const formData = new FormData();
    
    // Add test files
    for (const file of TEST_FILES) {
      const blob = new Blob([file.content], { type: 'text/csv' });
      formData.append('files', blob, file.name);
    }
    
    // Add configuration
    const config = {
      maxConcurrentFiles: 3,
      retryAttempts: 2
    };
    formData.append('config', JSON.stringify(config));
    
    const response = await fetch(`${BASE_URL}/api/batch-upload`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Batch upload successful');
      console.log(`   Batch ID: ${result.batchId}`);
      console.log(`   Files: ${result.fileCount}`);
      return result.batchId;
    } else {
      console.log('❌ Batch upload failed:', result.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Batch upload error:', error.message);
    return null;
  }
}

async function testBatchPreview(batchId) {
  if (!batchId) {
    console.log('⏭️  Skipping batch preview - no batch ID');
    return false;
  }
  
  console.log('👁️  Testing batch preview...');
  
  try {
    const config = {
      urlPattern: 'https://example.com/{link}',
      columnMapping: {
        link: 'url',
        title: 'title',
        description: 'description'
      },
      environment: 'production'
    };
    
    const response = await fetch(`${BASE_URL}/api/batch-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ batchId, config })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Batch preview successful');
      console.log(`   Preview URLs: ${result.preview.sampleUrls?.length || 0}`);
      return true;
    } else {
      console.log('❌ Batch preview failed:', result.error);
      return false;
    }
  } catch (error) {
    console.log('❌ Batch preview error:', error.message);
    return false;
  }
}

async function testBatchConversion(batchId) {
  if (!batchId) {
    console.log('⏭️  Skipping batch conversion - no batch ID');
    return false;
  }
  
  console.log('🔄 Testing batch conversion...');
  
  try {
    const config = {
      urlPattern: 'https://example.com/{link}',
      columnMapping: {
        link: 'url',
        title: 'title',
        description: 'description'
      },
      environment: 'production',
      includeLastmod: true,
      changefreq: 'weekly',
      priority: 0.8
    };
    
    const response = await fetch(`${BASE_URL}/api/batch-convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ batchId, config })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Batch conversion successful');
      console.log(`   Converted: ${result.successCount}/${result.totalFiles} files`);
      console.log(`   Total URLs: ${result.statistics.totalUrls}`);
      console.log(`   Valid URLs: ${result.statistics.validUrls}`);
      return true;
    } else {
      console.log('❌ Batch conversion failed:', result.error);
      return false;
    }
  } catch (error) {
    console.log('❌ Batch conversion error:', error.message);
    return false;
  }
}

async function testBatchStatus(batchId) {
  if (!batchId) {
    console.log('⏭️  Skipping batch status - no batch ID');
    return false;
  }
  
  console.log('📊 Testing batch status...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/batch-status/${batchId}`);
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Batch status successful');
      console.log(`   Status: ${result.batchStatus.status}`);
      console.log(`   Files: ${result.batchStatus.files?.length || 0}`);
      return true;
    } else {
      console.log('❌ Batch status failed:', result.error);
      return false;
    }
  } catch (error) {
    console.log('❌ Batch status error:', error.message);
    return false;
  }
}

async function testFileStorage() {
  console.log('💾 Testing file storage...');
  
  try {
    // Test temp directory creation
    const tempDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'temp');
    console.log(`   Temp directory: ${tempDir}`);
    
    // Test if we can write to temp directory
    const testFile = path.join(tempDir, 'test-storage.txt');
    await fs.writeFile(testFile, 'test content');
    await fs.unlink(testFile);
    
    console.log('✅ File storage test successful');
    return true;
  } catch (error) {
    console.log('❌ File storage test failed:', error.message);
    return false;
  }
}

async function testTempDirectory() {
  console.log('📂 Testing temp directory...');
  
  try {
    const tempDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'temp');
    const batchDir = path.join(tempDir, 'batches');
    
    console.log(`   Temp dir: ${tempDir}`);
    console.log(`   Batch dir: ${batchDir}`);
    
    // Test directory creation
    await fs.mkdir(batchDir, { recursive: true });
    
    // Test file operations
    const testFile = path.join(batchDir, 'test.json');
    await fs.writeFile(testFile, JSON.stringify({ test: true }));
    const content = await fs.readFile(testFile, 'utf8');
    await fs.unlink(testFile);
    
    if (JSON.parse(content).test) {
      console.log('✅ Temp directory test successful');
      return true;
    } else {
      console.log('❌ Temp directory test failed - file content mismatch');
      return false;
    }
  } catch (error) {
    console.log('❌ Temp directory test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting deployment scenario tests...\n');
  
  const results = {};
  let batchId = null;
  
  // Run tests in sequence
  for (const scenario of SCENARIOS) {
    console.log(`\n--- ${scenario.name} ---`);
    
    try {
      if (scenario.name === 'Batch Upload') {
        batchId = await scenario.test();
        results[scenario.name] = batchId !== null;
      } else if (scenario.name === 'Batch Preview' || scenario.name === 'Batch Conversion' || scenario.name === 'Batch Status') {
        results[scenario.name] = await scenario.test(batchId);
      } else {
        results[scenario.name] = await scenario.test();
      }
    } catch (error) {
      console.log(`❌ ${scenario.name} failed with error:`, error.message);
      results[scenario.name] = false;
    }
  }
  
  // Summary
  console.log('\n📋 Test Results Summary:');
  console.log('========================');
  
  let passed = 0;
  let total = Object.keys(results).length;
  
  for (const [testName, result] of Object.entries(results)) {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
    if (result) passed++;
  }
  
  console.log(`\nOverall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Deployment should work correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the issues above.');
  }
  
  return results;
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, SCENARIOS };

