import { vi } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock fetch for API tests
global.fetch = vi.fn();

// Mock FormData for file upload tests
global.FormData = class FormData {
  constructor() {
    this.data = new Map();
  }
  
  append(key, value) {
    if (!this.data.has(key)) {
      this.data.set(key, []);
    }
    this.data.get(key).push(value);
  }
  
  get(key) {
    const values = this.data.get(key);
    return values ? values[0] : null;
  }
  
  getAll(key) {
    return this.data.get(key) || [];
  }
  
  has(key) {
    return this.data.has(key);
  }
  
  entries() {
    const entries = [];
    for (const [key, values] of this.data) {
      for (const value of values) {
        entries.push([key, value]);
      }
    }
    return entries[Symbol.iterator]();
  }
};

// Mock File for file upload tests
global.File = class File {
  constructor(content, name, options = {}) {
    this.content = content;
    this.name = name;
    this.size = content.length || content.byteLength || 0;
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
  
  arrayBuffer() {
    return Promise.resolve(
      this.content instanceof ArrayBuffer 
        ? this.content 
        : new TextEncoder().encode(this.content).buffer
    );
  }
  
  text() {
    return Promise.resolve(
      typeof this.content === 'string' 
        ? this.content 
        : new TextDecoder().decode(this.content)
    );
  }
};

// Mock Blob for download tests
global.Blob = class Blob {
  constructor(content = [], options = {}) {
    this.content = content;
    this.size = content.reduce((size, chunk) => {
      if (typeof chunk === 'string') return size + chunk.length;
      if (chunk instanceof ArrayBuffer) return size + chunk.byteLength;
      return size + (chunk.length || 0);
    }, 0);
    this.type = options.type || '';
  }
  
  arrayBuffer() {
    const buffer = new ArrayBuffer(this.size);
    const view = new Uint8Array(buffer);
    let offset = 0;
    
    for (const chunk of this.content) {
      if (typeof chunk === 'string') {
        const encoded = new TextEncoder().encode(chunk);
        view.set(encoded, offset);
        offset += encoded.length;
      } else if (chunk instanceof ArrayBuffer) {
        view.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
    }
    
    return Promise.resolve(buffer);
  }
  
  text() {
    return this.arrayBuffer().then(buffer => new TextDecoder().decode(buffer));
  }
};

// Mock URL.createObjectURL for download tests
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn()
};

// Mock performance for performance tests
if (!global.performance) {
  global.performance = {
    now: () => Date.now()
  };
}

// Setup console mocking for cleaner test output
const originalConsole = { ...console };

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Restore console for test output
  Object.assign(console, originalConsole);
});

afterEach(() => {
  // Clean up any test artifacts
  vi.restoreAllMocks();
});

// Global test utilities
global.createMockFile = (name, content = 'mock content', type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') => {
  return new File([content], name, { type });
};

global.createMockBatch = (fileCount = 3, config = {}) => {
  const files = Array.from({ length: fileCount }, (_, i) => 
    createMockFile(`test${i + 1}.xlsx`, `content ${i + 1}`)
  );
  
  const defaultConfig = {
    columnMapping: { link: 'url', title: 'name' },
    urlPattern: 'https://example.com/{link}',
    environment: 'dev',
    maxConcurrentFiles: 2,
    retryAttempts: 1
  };
  
  return {
    files,
    config: { ...defaultConfig, ...config }
  };
};

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.BATCH_STORAGE_PATH = './test-storage';
process.env.MAX_BATCH_SIZE = '50';
process.env.MAX_FILE_SIZE = '10485760'; // 10MB
process.env.BATCH_EXPIRY_HOURS = '24';