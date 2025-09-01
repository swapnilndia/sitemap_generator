import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null)
  })
}));

// Mock fetch
global.fetch = vi.fn();

// Mock window.location
delete window.location;
window.location = { href: '', search: '' };

describe('End-to-End User Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = '';
    window.location.search = '';
  });

  it('should complete file upload to sitemap generation workflow', async () => {
    const user = userEvent.setup();

    // Mock API responses
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          fileId: 'test_file_123',
          fileName: 'test.csv',
          fileSize: 1024,
          rowCount: 100,
          columns: ['Name', 'URL', 'Category']
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          preview: {
            sampleData: [
              { Name: 'Product 1', URL: '/product1', Category: 'Electronics' },
              { Name: 'Product 2', URL: '/product2', Category: 'Books' }
            ],
            totalRows: 100,
            urlPreview: [
              'https://example.com/product1',
              'https://example.com/product2'
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          conversionId: 'conversion_123',
          statistics: {
            totalUrls: 100,
            validUrls: 95,
            duplicateUrls: 3,
            excludedUrls: 2
          },
          metadata: {
            processedAt: new Date().toISOString()
          }
        })
      });

    // Import and render the main page component
    const HomePage = (await import('../../app/page.js')).default;
    render(<HomePage />);

    // Step 1: File Upload
    expect(screen.getByText('Upload File')).toBeInTheDocument();
    
    const fileInput = screen.getByLabelText(/choose file/i);
    const csvContent = 'Name,URL,Category\nProduct 1,/product1,Electronics\nProduct 2,/product2,Books';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    
    await user.upload(fileInput, file);

    // Wait for upload to complete and move to next step
    await waitFor(() => {
      expect(screen.getByText('Configure Mapping')).toBeInTheDocument();
    });

    // Step 2: Column Mapping
    const nameSelect = screen.getByLabelText(/name/i);
    const urlSelect = screen.getByLabelText(/url/i);
    
    await user.selectOptions(nameSelect, 'Name');
    await user.selectOptions(urlSelect, 'URL');

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    // Step 3: URL Pattern
    await waitFor(() => {
      expect(screen.getByText('URL Pattern')).toBeInTheDocument();
    });

    const urlPatternInput = screen.getByLabelText(/url pattern/i);
    await user.type(urlPatternInput, 'https://example.com{URL}');

    const nextButton2 = screen.getByText('Next');
    await user.click(nextButton2);

    // Step 4: Preview
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    const convertButton = screen.getByText('Convert to JSON');
    await user.click(convertButton);

    // Step 5: Conversion Results
    await waitFor(() => {
      expect(screen.getByText('Conversion Complete!')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument(); // Valid URLs count
    });

    // Verify API calls were made correctly
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/upload', expect.any(Object));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/preview', expect.any(Object));
    expect(global.fetch).toHaveBeenNthCalledWith(3, '/api/convert', expect.any(Object));
  });

  it('should handle conversion to sitemap workflow', async () => {
    const user = userEvent.setup();

    // Mock conversion data in sessionStorage
    const conversionData = {
      conversionId: 'conversion_123',
      fileName: 'sitemap_conversion_123',
      statistics: { validUrls: 50 }
    };
    
    // Mock sessionStorage
    const mockSessionStorage = {
      getItem: vi.fn(() => JSON.stringify(conversionData)),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

    // Mock URL search params to simulate coming from conversion
    window.location.search = '?from=conversion';

    // Mock API responses for sitemap workflow
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          jsonData: {
            urls: Array(50).fill(null).map((_, i) => ({
              loc: `https://example.com/page${i}`,
              group: 'default'
            })),
            statistics: { validUrls: 50 }
          },
          totalValidUrls: 50,
          hasGrouping: false,
          groups: { default: 50 }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          preview: {
            totalFiles: 1,
            needsIndex: false,
            files: [{ filename: 'sitemap.xml', urlCount: 50 }],
            groups: ['default'],
            statistics: { validUrls: 50 },
            sampleUrls: [
              { url: 'https://example.com/page0', group: 'default' },
              { url: 'https://example.com/page1', group: 'default' }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          generationId: 'sitemap_123',
          totalFiles: 1,
          hasIndex: false,
          statistics: {
            totalUrls: 50,
            filesGenerated: 1,
            hasIndex: false
          }
        })
      });

    // Import and render the JSON to sitemap page
    const JsonToSitemapPage = (await import('../../app/json-to-sitemap/page.js')).default;
    render(<JsonToSitemapPage />);

    // Should automatically load conversion data and skip to configuration
    await waitFor(() => {
      expect(screen.getByText('Configure')).toBeInTheDocument();
    });

    // Configure sitemap settings
    const maxPerFileInput = screen.getByLabelText(/max urls per file/i);
    await user.clear(maxPerFileInput);
    await user.type(maxPerFileInput, '50000');

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    // Preview step
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('sitemap.xml')).toBeInTheDocument();
      expect(screen.getByText('50 URLs')).toBeInTheDocument();
    });

    const generateButton = screen.getByText('Generate Sitemaps');
    await user.click(generateButton);

    // Generation complete
    await waitFor(() => {
      expect(screen.getByText('Sitemap Generation Complete!')).toBeInTheDocument();
      expect(screen.getByText('Download ZIP')).toBeInTheDocument();
    });

    // Verify API calls
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('conversionData');
  });

  it('should handle errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock failed API response
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const HomePage = (await import('../../app/page.js')).default;
    render(<HomePage />);

    // Try to upload a file
    const fileInput = screen.getByLabelText(/choose file/i);
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    
    await user.upload(fileInput, file);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should allow user to go home and clear data', async () => {
    const user = userEvent.setup();

    // Mock clear files API
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        filesCleared: 2
      })
    });

    // Render a component with HomeButton
    const HomeButton = (await import('../../components/HomeButton.js')).default;
    render(<HomeButton showConfirm={true} />);

    const homeButton = screen.getByText('Home');
    await user.click(homeButton);

    // Should show confirmation dialog
    expect(screen.getByText('Clear All Data?')).toBeInTheDocument();

    const confirmButton = screen.getByText('Yes, Clear & Go Home');
    await user.click(confirmButton);

    // Should call clear API and navigate home
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/clear-files', {
        method: 'POST'
      });
      expect(window.location.href).toBe('/');
    });
  });
});