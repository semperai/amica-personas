import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuButton } from '../../src/components/menuButton';

// Mock icon component
const MockIcon = ({ className, 'aria-hidden': ariaHidden }: any) => (
  <div className={className} aria-hidden={ariaHidden} data-testid="mock-icon">Icon</div>
);

describe('MenuButton', () => {
  it('should render without crashing', () => {
    render(<MenuButton icon={MockIcon} large={false} label="Test Button" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should render label text (hidden)', () => {
    render(<MenuButton icon={MockIcon} large={false} label="Test Label" />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test Label')).toHaveClass('hidden');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<MenuButton icon={MockIcon} large={false} label="Click Me" onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<MenuButton icon={MockIcon} large={false} label="Disabled" onClick={handleClick} disabled={true} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render large icon when large is true', () => {
    render(<MenuButton icon={MockIcon} large={true} label="Large Icon" />);
    const icon = screen.getByTestId('mock-icon');
    expect(icon).toHaveClass('h-14', 'w-14');
  });

  it('should render small icon when large is false', () => {
    render(<MenuButton icon={MockIcon} large={false} label="Small Icon" />);
    const icon = screen.getByTestId('mock-icon');
    expect(icon).toHaveClass('h-7', 'w-7');
  });

  it('should open URL in new tab when href is provided', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<MenuButton icon={MockIcon} large={false} label="Link" href="https://example.com" target="_blank" />);

    fireEvent.click(screen.getByRole('button'));
    expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com', '_blank');

    windowOpenSpy.mockRestore();
  });

  it('should open URL in same tab when no target specified', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<MenuButton icon={MockIcon} large={false} label="Link" href="https://example.com" />);

    fireEvent.click(screen.getByRole('button'));
    expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com', undefined);

    windowOpenSpy.mockRestore();
  });

  it('should apply disabled styles when disabled', () => {
    render(<MenuButton icon={MockIcon} large={false} label="Disabled" disabled={true} />);

    const button = screen.getByRole('button');
    const icon = screen.getByTestId('mock-icon');

    expect(button).toBeDisabled();
    expect(icon).toHaveClass('opacity-20', 'cursor-not-allowed');
  });

  it('should not apply disabled styles when enabled', () => {
    render(<MenuButton icon={MockIcon} large={false} label="Enabled" disabled={false} />);

    const button = screen.getByRole('button');
    const icon = screen.getByTestId('mock-icon');

    expect(button).not.toBeDisabled();
    expect(icon).toHaveClass('opacity-80');
    expect(icon).not.toHaveClass('opacity-20');
  });

  it('should render icon with aria-hidden', () => {
    render(<MenuButton icon={MockIcon} large={false} label="Test" />);
    const icon = screen.getByTestId('mock-icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('should apply hover styles to button', () => {
    render(<MenuButton icon={MockIcon} large={false} label="Hover Test" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-white/60');
  });

  it('should not apply hover styles when disabled', () => {
    render(<MenuButton icon={MockIcon} large={false} label="No Hover" disabled={true} />);
    const button = screen.getByRole('button');
    expect(button).not.toHaveClass('hover:bg-white/60');
  });

  it('should handle onClick precedence over href', () => {
    const handleClick = vi.fn();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    // When href is provided, it overrides onClick
    render(<MenuButton icon={MockIcon} large={false} label="Test" onClick={handleClick} href="https://example.com" />);

    fireEvent.click(screen.getByRole('button'));

    // onClick gets replaced by href handler, so original onClick won't be called
    expect(handleClick).not.toHaveBeenCalled();
    expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com', undefined);

    windowOpenSpy.mockRestore();
  });
});
