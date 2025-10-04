import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GitHubLink } from '../../src/components/githubLink';

// Mock the buildUrl utility
vi.mock('@/utils/resolveAssetUrl', () => ({
  buildUrl: (path: string) => `/mocked${path}`
}));

describe('GitHubLink', () => {
  it('should render without crashing', () => {
    render(<GitHubLink />);
    expect(screen.getByText('Open Source')).toBeInTheDocument();
  });

  it('should render link with correct href', () => {
    render(<GitHubLink />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://github.com/semperai/amica');
  });

  it('should open link in new tab', () => {
    render(<GitHubLink />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render GitHub logo image', () => {
    render(<GitHubLink />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/mocked/github-mark-white.svg');
    expect(img).toHaveAttribute('alt', 'https://github.com/semperai/amica');
  });

  it('should have correct image dimensions', () => {
    render(<GitHubLink />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '24');
    expect(img).toHaveAttribute('height', '24');
  });

  it('should not be draggable', () => {
    render(<GitHubLink />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('draggable', 'false');
  });

  it('should render "Open Source" text', () => {
    render(<GitHubLink />);
    expect(screen.getByText('Open Source')).toBeInTheDocument();
  });

  it('should apply correct CSS classes', () => {
    render(<GitHubLink />);
    const container = screen.getByText('Open Source').parentElement;
    expect(container).toHaveClass('py-2', 'px-2', 'rounded-lg');
  });
});
