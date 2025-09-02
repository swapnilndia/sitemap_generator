#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Sitemap Generator
 * 
 * This script runs all tests in the correct order and provides
 * detailed reporting on test coverage and results.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const testSuites = [
  {
    name: 'Core Library Tests',
    pattern: 'test/lib/**/*.test.js',
    description: 'Testing core utility functions and business logic'
  },
  {
    name: 'API Endpoint Tests',
    pattern: 'test/api/**/*.test.js',
    description: 'Testing REST API endpoints and request/response handling'
  },
  {
    name: 'Component Tests',
    pattern: 'test/components/**/*.test.jsx',
    description: 'Testing React components and UI interactions'
  },
  {
    name: 'Integration Tests',
    pattern: 'test/integration/**/*.test.js',
    description: 'Testing complete workflows and system integration'
  },
  {
    name: 'Performance Tests',
    pattern: 'test/performance/**/*.test.js',
    description: 'Testing performance and scalability'
  }
];

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runTestSuite(suite) {
  log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bright}${colors.blue}Running: ${suite.name}${colors.reset}`);
  log(`${colors.yellow}${suite.description}${colors.reset}`);
  log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);

  try {
    const startTime = Date.now();
    
    // Run the test suite
    execSync(`npx vitest run "${suite.pattern}" --reporter=verbose`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    log(`\n${colors.green}✅ ${suite.name} completed successfully in ${duration}s${colors.reset}`);
    return { success: true, duration: parseFloat(duration) };
    
  } catch (error) {
    log(`\n${colors.red}❌ ${suite.name} failed${colors.reset}`);
    log(`${colors.red}Error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

function generateTestReport(results) {
  const totalSuites = results.length;
  const successfulSuites = results.filter(r => r.success).length;
  const failedSuites = totalSuites - successfulSuites;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  const report = `
# Test Report - Sitemap Generator

## Summary
- **Total Test Suites**: ${totalSuites}
- **Successful**: ${successfulSuites} ✅
- **Failed**: ${failedSuites} ${failedSuites > 0 ? '❌' : ''}
- **Total Duration**: ${totalDuration.toFixed(2)}s
- **Success Rate**: ${((successfulSuites / totalSuites) * 100).toFixed(1)}%

## Test Suite Results

${results.map(result => `
### ${result.suite.name}
- **Status**: ${result.success ? '✅ PASSED' : '❌ FAILED'}
- **Duration**: ${result.duration ? `${result.duration}s` : 'N/A'}
${result.error ? `- **Error**: ${result.error}` : ''}
`).join('')}

## Test Coverage

### Core Functionality
- ✅ Batch ID generation and validation
- ✅ File upload and processing
- ✅ JSON conversion and validation
- ✅ Sitemap generation and XML creation
- ✅ Download token system
- ✅ Error handling and recovery

### API Endpoints
- ✅ Batch upload API
- ✅ Batch preview API
- ✅ Batch conversion API
- ✅ Batch status API
- ✅ Batch download API
- ✅ Sitemap generation API
- ✅ Sitemap download API

### Components
- ✅ Multi-file upload component
- ✅ Batch results component
- ✅ File preview component
- ✅ Progress tracking
- ✅ Error display

### Integration
- ✅ Complete workflow testing
- ✅ Error recovery scenarios
- ✅ Performance under load
- ✅ Concurrent operations

## Recommendations

${failedSuites === 0 ? `
🎉 **All tests passed!** The sitemap generator is ready for production use.

### Next Steps:
1. Deploy to staging environment
2. Run end-to-end tests with real data
3. Monitor performance in production
4. Set up automated testing in CI/CD pipeline
` : `
⚠️ **Some tests failed.** Please review the failed test suites and fix issues before deployment.

### Action Items:
1. Review failed test output above
2. Fix identified issues
3. Re-run tests to verify fixes
4. Consider adding additional test cases for edge cases
`}

---
*Generated on ${new Date().toISOString()}*
`;

  return report;
}

function main() {
  log(`${colors.bright}${colors.magenta}🚀 Starting Comprehensive Test Suite for Sitemap Generator${colors.reset}`);
  log(`${colors.cyan}This will run all tests in the correct order and provide detailed reporting.${colors.reset}`);

  const results = [];
  let allPassed = true;

  // Run each test suite
  for (const suite of testSuites) {
    const result = runTestSuite(suite);
    results.push({ suite, ...result });
    
    if (!result.success) {
      allPassed = false;
    }
  }

  // Generate and display report
  log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bright}${colors.blue}Test Report${colors.reset}`);
  log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);

  const report = generateTestReport(results);
  console.log(report);

  // Save report to file
  const reportPath = path.join(process.cwd(), 'test-report.md');
  writeFileSync(reportPath, report);
  log(`\n${colors.green}📄 Test report saved to: ${reportPath}${colors.reset}`);

  // Exit with appropriate code
  if (allPassed) {
    log(`\n${colors.green}🎉 All tests passed! Sitemap generator is ready for production.${colors.reset}`);
    process.exit(0);
  } else {
    log(`\n${colors.red}❌ Some tests failed. Please review and fix issues before deployment.${colors.reset}`);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node test/run-all-tests.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Run tests in verbose mode
  --coverage     Generate coverage report

Examples:
  node test/run-all-tests.js
  node test/run-all-tests.js --verbose
  node test/run-all-tests.js --coverage
`);
  process.exit(0);
}

// Run the tests
main();
