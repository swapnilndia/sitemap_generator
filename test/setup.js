import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Next.js environment
global.process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Mock window.location
delete window.location;
window.location = {
  href: '',
  search: '',
  pathname: '/',
  origin: 'http://localhost:3000'
};

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  window.location.href = '';
  window.location.search = '';
  mockSessionStorage.getItem.mockReturnValue(null);
  mockLocalStorage.getItem.mockReturnValue(null);
});