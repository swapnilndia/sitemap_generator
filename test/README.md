# Batch Processing Test Suite

This directory contains comprehensive tests for the multi-file batch processing feature.

## Test Structure

### Unit Tests (`/lib/`)
- **`batchProcessing.test.js`** - Core batch processing utilities
- **`batchQueue.test.js`** - Batch queue management and processing
- **`fileStorage.test.js`** - File storage operations and batch file management

### API Tests (`/api/`)
- **`batch-operations.test.js`** - All batch-related API endpoints

### Integration Tests (`/integration/`)
- **`batch-workflow.test.js`** - End-to-end batch processing workflows

### Performance Tests (`/performance/`)
- **`batch-performance.test.js`** - Performance and load testing for batch operations

## Running Tests

### All Tests
```bash
npm test
```

### Batch-Specific Tests
```bash
npm run test:batch
```

### Performance Tests
```bash
npm run test:performance
```

### API Tests
```bash
npm run test:api
```

### Integration Tests
```bash
npm run test:integration
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Coverage

The test suite covers:

### Core Functionality
- ✅ Batch job creation and management
- ✅ File ID generation and validation
- ✅ Status tracking and updates
- ✅ Progress calculation
- ✅ Error handling and categorization
- ✅ Retry mechanisms
- ✅ Configuration validation

### Queue Management
- ✅ Batch queue operations
- ✅ Concurrent processing
- ✅ Progress tracking
- ✅ Error recovery
- ✅ Pause/resume functionality
- ✅ Cancellation handling

### File Storage
- ✅ Single file operations
- ✅ Batch file operations
- ✅ Metadata management
- ✅ Cleanup and maintenance
- ✅ Storage validation
- ✅ Error handling

### API Endpoints
- ✅ Batch upload validation
- ✅ Batch conversion processing
- ✅ Status monitoring
- ✅ Download generation
- ✅ Sitemap generation
- ✅ Error responses
- ✅ Security validation

### Integration Workflows
- ✅ Complete batch processing pipeline
- ✅ Partial failure handling
- ✅ Retry logic validation
- ✅ Sitemap generation integration
- ✅ Download creation

### Performance Characteristics
- ✅ Large batch processing (50+ files)
- ✅ Concurrency scaling
- ✅ Memory usage optimization
- ✅ Progress calculation efficiency
- ✅ Error handling performance

## Test Data

Tests use mock data that simulates:
- Excel files (.xlsx) with varying sizes
- Different batch configurations
- Various error scenarios
- Network timeouts and failures
- Storage limitations

## Mock Strategy

The test suite uses comprehensive mocking for:
- File system operations (`fs/promises`)
- Network requests (`fetch`)
- External libraries (`archiver`, `xlsx`)
- Time-dependent operations
- Random ID generation

## Performance Benchmarks

The performance tests establish benchmarks for:
- **Throughput**: Minimum 3 files/second for standard batches
- **Concurrency**: Proper scaling with increased concurrent processing
- **Memory**: Maximum 100MB additional memory for 100-file batches
- **Latency**: Progress calculation under 10ms for 1000-file batches

## Error Scenarios Tested

- File upload failures
- Processing timeouts
- Storage unavailability
- Invalid file formats
- Network interruptions
- Queue overflow
- Memory limitations
- Concurrent access conflicts

## Test Environment Setup

Tests run in a controlled environment with:
- Mocked file system operations
- Isolated test storage
- Controlled timing for async operations
- Deterministic random values
- Clean state between tests

## Continuous Integration

The test suite is designed for CI/CD environments:
- Fast execution (most tests under 30 seconds)
- Reliable mocking (no external dependencies)
- Clear failure reporting
- Coverage thresholds (70% minimum)
- Parallel test execution

## Adding New Tests

When adding new batch processing features:

1. **Unit Tests**: Add tests in the appropriate `/lib/` file
2. **API Tests**: Update `/api/batch-operations.test.js`
3. **Integration**: Add workflow tests to `/integration/batch-workflow.test.js`
4. **Performance**: Add benchmarks to `/performance/batch-performance.test.js`

### Test Naming Convention
- Use descriptive test names: `should handle large batch efficiently`
- Group related tests in `describe` blocks
- Use `beforeEach` for test setup
- Use `afterEach` for cleanup

### Mock Guidelines
- Mock external dependencies consistently
- Use realistic test data
- Test both success and failure scenarios
- Verify mock interactions when relevant

## Debugging Tests

For debugging failing tests:

1. **Increase Timeout**: Some tests have extended timeouts for performance testing
2. **Verbose Output**: Use `--reporter=verbose` for detailed output
3. **Isolation**: Run individual test files to isolate issues
4. **Console Logs**: Tests include performance logging for benchmarks

## Test Maintenance

Regular maintenance tasks:
- Update mock data to reflect real-world scenarios
- Adjust performance benchmarks as system improves
- Add tests for new error conditions
- Review and update test timeouts
- Maintain test documentation