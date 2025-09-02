# Comprehensive Test Suite Documentation

## Overview

This document provides a complete overview of the test suite for the Sitemap Generator application. The test suite is designed to ensure all functionalities work correctly, from individual components to complete end-to-end workflows.

## Test Structure

```
test/
├── api/                          # API endpoint tests
│   ├── batch-upload.test.js      # Multi-file upload API
│   ├── batch-convert.test.js     # Batch conversion API
│   ├── batch-sitemap-generate.test.js  # Sitemap generation API
│   ├── batch-sitemap-download.test.js  # Sitemap download API
│   └── batch-status.test.js      # Batch status API
├── components/                   # React component tests
│   ├── BatchResultsComponent.test.jsx  # Batch results display
│   └── MultiFileUploadComponent.test.jsx  # File upload interface
├── integration/                  # Integration tests
│   └── complete-workflow.test.js # End-to-end workflow testing
├── lib/                          # Core library tests
│   ├── batchClient.test.js       # Client-side utilities
│   └── batchSitemap.test.js      # Sitemap generation logic
├── performance/                  # Performance tests
│   ├── batch-performance.test.js # Batch processing performance
│   └── large-files.test.js       # Large file handling
├── run-all-tests.js             # Comprehensive test runner
├── setup.js                     # Test setup and mocks
└── TEST_DOCUMENTATION.md        # This file
```

## Test Categories

### 1. API Endpoint Tests (`test/api/`)

Tests all REST API endpoints to ensure proper request/response handling, error cases, and data validation.

#### Key Test Areas:
- **File Upload**: Multi-file upload, file type validation, header extraction
- **Batch Conversion**: JSON conversion, URL pattern application, statistics calculation
- **Sitemap Generation**: XML creation, grouping logic, error handling
- **Download System**: Token-based downloads, file retrieval, ZIP creation
- **Status Tracking**: Progress monitoring, error reporting, completion detection

#### Example Test:
```javascript
it('should handle valid multi-file upload', async () => {
  const formData = new FormData();
  formData.append('file1', new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv'));
  
  const response = await POST(request);
  const data = await response.json();
  
  expect(response.status).toBe(200);
  expect(data.success).toBe(true);
  expect(data.batchId).toBeDefined();
});
```

### 2. Component Tests (`test/components/`)

Tests React components for proper rendering, user interactions, and state management.

#### Key Test Areas:
- **File Upload Component**: Drag & drop, file selection, validation, progress tracking
- **Results Component**: Data display, download buttons, sitemap generation, error handling
- **User Interactions**: Button clicks, form submissions, error displays
- **State Management**: Loading states, progress updates, error states

#### Example Test:
```javascript
it('should handle file selection', async () => {
  render(<MultiFileUploadComponent {...mockProps} />);
  
  const fileInput = screen.getByLabelText(/select files/i);
  const file = new File(['url,title\nhttps://example.com/1,Test 1'], 'test.csv');
  
  fireEvent.change(fileInput, { target: { files: [file] } });
  
  await waitFor(() => {
    expect(screen.getByText('test.csv')).toBeInTheDocument();
  });
});
```

### 3. Integration Tests (`test/integration/`)

Tests complete workflows from start to finish, ensuring all components work together correctly.

#### Key Test Areas:
- **Complete Workflow**: Upload → Preview → Convert → Download → Sitemap
- **Error Recovery**: Handling failures at different stages
- **Concurrent Operations**: Multiple batch processing
- **Performance**: Large file handling, memory usage

#### Example Test:
```javascript
it('should complete full workflow successfully', async () => {
  // Step 1: Upload files
  const uploadResponse = await batchUpload(uploadRequest);
  expect(uploadResponse.status).toBe(200);
  
  // Step 2: Preview batch
  const previewResponse = await batchPreview(previewRequest);
  expect(previewResponse.status).toBe(200);
  
  // Step 3: Convert batch
  const convertResponse = await batchConvert(convertRequest);
  expect(convertResponse.status).toBe(200);
  
  // ... continue through all steps
});
```

### 4. Library Tests (`test/lib/`)

Tests core utility functions and business logic.

#### Key Test Areas:
- **Batch Client**: ID generation, job creation, validation, summary calculation
- **Sitemap Generation**: XML creation, URL grouping, file management
- **Data Processing**: File parsing, URL transformation, statistics calculation

#### Example Test:
```javascript
it('should generate unique batch IDs', () => {
  const id1 = generateBatchId();
  const id2 = generateBatchId();
  
  expect(id1).not.toBe(id2);
  expect(id1).toMatch(/^batch_\d+_[a-z0-9]+$/);
});
```

## Test Configuration

### Setup (`test/setup.js`)

The test setup file provides:
- **Global Mocks**: fetch, FormData, File, Blob, URL
- **Polyfills**: TextEncoder, TextDecoder for Node.js environment
- **Test Utilities**: Mock file creation, batch creation helpers
- **Environment Variables**: Test-specific configuration

### Mocking Strategy

The test suite uses comprehensive mocking to isolate units under test:

```javascript
// Mock API dependencies
vi.mock('../../lib/batchClient.js', () => ({
  generateBatchId: vi.fn(() => 'batch_123_abc'),
  createBatchJob: vi.fn(() => ({ /* mock job */ }))
}));

// Mock file system operations
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  readFile: vi.fn(() => Promise.resolve('mock content'))
}));
```

## Running Tests

### Individual Test Suites

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:api          # API endpoint tests
npm run test:components   # React component tests
npm run test:integration  # Integration tests
npm run test:lib          # Library tests
npm run test:performance  # Performance tests

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Comprehensive Test Runner

```bash
# Run all tests with detailed reporting
npm run test:all

# This will:
# 1. Run all test suites in order
# 2. Generate detailed reports
# 3. Save results to test-report.md
# 4. Exit with appropriate code
```

## Test Coverage

The test suite covers:

### ✅ Core Functionality
- Batch ID generation and validation
- File upload and processing
- JSON conversion and validation
- Sitemap generation and XML creation
- Download token system
- Error handling and recovery

### ✅ API Endpoints
- Batch upload API
- Batch preview API
- Batch conversion API
- Batch status API
- Batch download API
- Sitemap generation API
- Sitemap download API

### ✅ Components
- Multi-file upload component
- Batch results component
- File preview component
- Progress tracking
- Error display

### ✅ Integration
- Complete workflow testing
- Error recovery scenarios
- Performance under load
- Concurrent operations

## Test Data

### Mock Files

The test suite includes various mock file types:
- **CSV Files**: With different column structures
- **Excel Files**: XLSX format with multiple sheets
- **Large Files**: For performance testing
- **Invalid Files**: For error handling tests

### Mock Data

```javascript
const mockBatchStatus = {
  batchId: 'batch_123_abc',
  status: 'completed',
  progress: 100,
  files: [
    {
      fileId: 'file1',
      originalName: 'test1.xlsx',
      status: 'completed',
      statistics: { validUrls: 100, totalRows: 100 }
    }
  ],
  createdAt: '2023-01-01T00:00:00Z',
  completedAt: '2023-01-01T00:01:00Z'
};
```

## Error Scenarios

The test suite includes comprehensive error handling tests:

### Network Errors
- Connection timeouts
- Server errors (500, 502, 503)
- Network unavailability

### File Errors
- Invalid file types
- Corrupted files
- Empty files
- Files too large

### Processing Errors
- Invalid JSON structure
- Missing required fields
- URL validation failures
- XML generation errors

### User Errors
- Missing required parameters
- Invalid batch IDs
- Expired download tokens

## Performance Testing

### Load Testing
- Multiple concurrent uploads
- Large file processing
- Memory usage monitoring
- Response time measurement

### Scalability Testing
- Batch size limits
- File count limits
- URL count limits
- System resource usage

## Continuous Integration

### GitHub Actions (Recommended)

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:all
```

### Pre-commit Hooks

```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run test:all"
```

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests independent and isolated

### Mocking
- Mock external dependencies
- Use realistic mock data
- Reset mocks between tests
- Test both success and error cases

### Assertions
- Use specific assertions
- Test both positive and negative cases
- Verify error messages and status codes
- Check data structure and content

### Performance
- Use fake timers for time-dependent tests
- Clean up resources after tests
- Avoid memory leaks in long-running tests
- Monitor test execution time

## Troubleshooting

### Common Issues

1. **Mock Not Working**
   - Ensure mocks are defined before imports
   - Check mock function names match exactly
   - Verify mock is called in test

2. **Async Test Failures**
   - Use `await` for async operations
   - Use `waitFor` for DOM updates
   - Check promise resolution/rejection

3. **File Upload Tests**
   - Ensure FormData is properly mocked
   - Check file content and type
   - Verify file size limits

4. **Component Tests**
   - Ensure proper rendering
   - Check for required props
   - Verify event handlers

### Debug Tips

```javascript
// Enable verbose logging
process.env.DEBUG = 'test:*';

// Add console.log for debugging
console.log('Debug info:', data);

// Use screen.debug() for DOM inspection
screen.debug();

// Check mock calls
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
```

## Contributing

When adding new tests:

1. **Follow naming conventions**: `*.test.js` or `*.test.jsx`
2. **Add to appropriate category**: api, components, integration, lib
3. **Update documentation**: Add test description to this file
4. **Ensure coverage**: Test both success and error cases
5. **Run full suite**: Use `npm run test:all` before committing

## Conclusion

This comprehensive test suite ensures the Sitemap Generator application is robust, reliable, and ready for production use. The tests cover all major functionality, error scenarios, and performance requirements.

For questions or issues with the test suite, please refer to the troubleshooting section or create an issue in the project repository.
