import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Button', () => {
  describe('internal links', () => {
    it('should render as Link for internal navigation', () => {
      render(<Button href="/test">Click me</Button>);
      const link = screen.getByText('Click me');
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe('A');
    });

    it('should render children correctly', () => {
      render(<Button href="/test">Test Button</Button>);
      expect(screen.getByText('Test Button')).toBeInTheDocument();
    });

    it('should apply primary variant classes by default', () => {
      render(<Button href="/test">Primary</Button>);
      const button = screen.getByText('Primary');
      expect(button.className).toContain('bg-brand-blue');
    });

    it('should apply secondary variant classes', () => {
      render(<Button href="/test" variant="secondary">Secondary</Button>);
      const button = screen.getByText('Secondary');
      expect(button.className).toContain('bg-muted');
    });

    it('should apply custom className', () => {
      render(<Button href="/test" className="custom-class">Custom</Button>);
      const button = screen.getByText('Custom');
      expect(button.className).toContain('custom-class');
    });

    it('should include base classes', () => {
      render(<Button href="/test">Base</Button>);
      const button = screen.getByText('Base');
      expect(button.className).toContain('inline-flex');
      expect(button.className).toContain('items-center');
      expect(button.className).toContain('gap-2');
      expect(button.className).toContain('px-4');
      expect(button.className).toContain('py-2');
      expect(button.className).toContain('rounded-md');
    });
  });

  describe('external links', () => {
    it('should render as anchor tag with target="_blank" for external links', () => {
      render(<Button href="https://example.com" external>External</Button>);
      const link = screen.getByText('External');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('should have rel="noopener noreferrer" for security', () => {
      render(<Button href="https://example.com" external>External</Button>);
      const link = screen.getByText('External');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should apply primary variant to external links', () => {
      render(<Button href="https://example.com" external variant="primary">External Primary</Button>);
      const button = screen.getByText('External Primary');
      expect(button.className).toContain('bg-brand-blue');
    });

    it('should apply secondary variant to external links', () => {
      render(<Button href="https://example.com" external variant="secondary">External Secondary</Button>);
      const button = screen.getByText('External Secondary');
      expect(button.className).toContain('bg-muted');
    });

    it('should have correct href attribute', () => {
      const url = 'https://example.com/test';
      render(<Button href={url} external>External Link</Button>);
      const link = screen.getByText('External Link');
      expect(link).toHaveAttribute('href', url);
    });
  });

  describe('styling', () => {
    it('should apply white text color to primary variant', () => {
      render(<Button href="/test" variant="primary">Primary</Button>);
      const button = screen.getByText('Primary');
      expect(button).toHaveStyle({ color: '#ffffff' });
    });

    it('should apply text decoration none', () => {
      render(<Button href="/test">No Underline</Button>);
      const button = screen.getByText('No Underline');
      expect(button).toHaveStyle({ textDecoration: 'none' });
    });

    it('should include no-underline classes', () => {
      render(<Button href="/test">Link</Button>);
      const button = screen.getByText('Link');
      expect(button.className).toContain('!no-underline');
      expect(button.className).toContain('hover:!no-underline');
    });
  });

  describe('complex children', () => {
    it('should render children with icons', () => {
      render(
        <Button href="/test">
          <span>Icon</span>
          <span>Text</span>
        </Button>
      );
      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
    });

    it('should handle empty children gracefully', () => {
      render(<Button href="/test"></Button>);
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });
  });
});
