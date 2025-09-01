import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import HomeButton from '../../components/HomeButton.js';

// Mock fetch
global.fetch = vi.fn();

// Mock window.location
delete window.location;
window.location = { href: '' };

describe('HomeButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = '';
  });

  it('should render home button with correct text and icon', () => {
    render(<HomeButton showConfirm={false} />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('🏠')).toBeInTheDocument();
  });

  it('should navigate to home without confirmation when showConfirm is false', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, filesCleared: 2 })
    });

    render(<HomeButton showConfirm={false} />);
    
    const homeButton = screen.getByText('Home');
    await user.click(homeButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/clear-files', {
        method: 'POST'
      });
      expect(window.location.href).toBe('/');
    });
  });

  it('should show confirmation dialog when showConfirm is true', async () => {
    const user = userEvent.setup();
    render(<HomeButton showConfirm={true} />);
    
    const homeButton = screen.getByText('Home');
    await user.click(homeButton);

    expect(screen.getByText('Clear All Data?')).toBeInTheDocument();
    expect(screen.getByText('This will clear all uploaded files and conversion data. Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Yes, Clear & Go Home')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should cancel confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<HomeButton showConfirm={true} />);
    
    // Open confirmation dialog
    const homeButton = screen.getByText('Home');
    await user.click(homeButton);

    // Cancel
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(screen.queryByText('Clear All Data?')).not.toBeInTheDocument();
  });

  it('should proceed with clearing after confirmation', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, filesCleared: 3 })
    });

    render(<HomeButton showConfirm={true} />);
    
    // Open confirmation dialog
    const homeButton = screen.getByText('Home');
    await user.click(homeButton);

    // Confirm
    const confirmButton = screen.getByText('Yes, Clear & Go Home');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/clear-files', {
        method: 'POST'
      });
      expect(window.location.href).toBe('/');
    });
  });

  it('should show loading state during clearing', async () => {
    const user = userEvent.setup();
    global.fetch.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({
        json: () => Promise.resolve({ success: true, filesCleared: 1 })
      }), 100);
    }));

    render(<HomeButton showConfirm={false} />);
    
    const homeButton = screen.getByText('Home');
    await user.click(homeButton);

    expect(screen.getByText('Clearing...')).toBeInTheDocument();
    expect(homeButton).toBeDisabled();
  });

  it('should navigate to home even if clearing fails', async () => {
    const user = userEvent.setup();
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<HomeButton showConfirm={false} />);
    
    const homeButton = screen.getByText('Home');
    await user.click(homeButton);

    await waitFor(() => {
      expect(window.location.href).toBe('/');
    });
  });

  it('should apply custom className', () => {
    render(<HomeButton className="custom-class" showConfirm={false} />);
    
    const homeButton = screen.getByText('Home');
    expect(homeButton).toHaveClass('custom-class');
  });
});