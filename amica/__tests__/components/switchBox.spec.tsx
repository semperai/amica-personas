import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwitchBox, VerticalSwitchBox } from '../../src/components/switchBox';

describe('SwitchBox', () => {
  it('should render without crashing', () => {
    render(<SwitchBox value={false} label="Test Switch" onChange={() => {}} />);
    expect(screen.getByText('Test Switch')).toBeInTheDocument();
  });

  it('should display the label', () => {
    render(<SwitchBox value={false} label="My Switch" onChange={() => {}} />);
    expect(screen.getByText('My Switch')).toBeInTheDocument();
  });

  it('should be checked when value is true', () => {
    render(<SwitchBox value={true} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  it('should not be checked when value is false', () => {
    render(<SwitchBox value={false} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
  });

  it('should call onChange when clicked', () => {
    const handleChange = vi.fn();
    render(<SwitchBox value={false} label="Test" onChange={handleChange} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('should toggle from true to false', () => {
    const handleChange = vi.fn();
    render(<SwitchBox value={true} label="Test" onChange={handleChange} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);

    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('should update when value prop changes', () => {
    const { rerender } = render(<SwitchBox value={false} label="Test" onChange={() => {}} />);
    let switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');

    rerender(<SwitchBox value={true} label="Test" onChange={() => {}} />);
    switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  it('should not call onChange when disabled', () => {
    const handleChange = vi.fn();
    render(<SwitchBox value={false} label="Test" onChange={handleChange} disabled={true} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<SwitchBox value={false} label="Test" onChange={() => {}} disabled={true} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeDisabled();
  });

  it('should apply disabled styles when disabled', () => {
    render(<SwitchBox value={false} label="Test" onChange={() => {}} disabled={true} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveClass('bg-gray-300', 'cursor-not-allowed');
  });

  it('should not be disabled by default', () => {
    render(<SwitchBox value={false} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).not.toBeDisabled();
  });

  it('should apply correct color when enabled and on', () => {
    render(<SwitchBox value={true} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveClass('bg-indigo-600');
  });

  it('should apply correct color when enabled and off', () => {
    render(<SwitchBox value={false} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveClass('bg-gray-200');
  });

  it('should accept additional props', () => {
    render(<SwitchBox value={false} label="Test" onChange={() => {}} data-testid="custom-switch" />);
    expect(screen.getByTestId('custom-switch')).toBeInTheDocument();
  });

  it('should have sr-only text', () => {
    render(<SwitchBox value={false} label="Test" onChange={() => {}} />);
    expect(screen.getByText('Use setting')).toHaveClass('sr-only');
  });
});

describe('VerticalSwitchBox', () => {
  it('should render without crashing', () => {
    render(<VerticalSwitchBox value={false} label="Vertical Test" onChange={() => {}} />);
    expect(screen.getAllByText('Vertical Test').length).toBeGreaterThan(0);
  });

  it('should display the label', () => {
    render(<VerticalSwitchBox value={false} label="My Vertical Switch" onChange={() => {}} />);
    expect(screen.getAllByText('My Vertical Switch').length).toBeGreaterThan(0);
  });

  it('should be checked when value is true', () => {
    render(<VerticalSwitchBox value={true} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  it('should not be checked when value is false', () => {
    render(<VerticalSwitchBox value={false} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
  });

  it('should call onChange when clicked', () => {
    const handleChange = vi.fn();
    render(<VerticalSwitchBox value={false} label="Test" onChange={handleChange} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('should toggle from true to false', () => {
    const handleChange = vi.fn();
    render(<VerticalSwitchBox value={true} label="Test" onChange={handleChange} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);

    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('should update when value prop changes', () => {
    const { rerender } = render(<VerticalSwitchBox value={false} label="Test" onChange={() => {}} />);
    let switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');

    rerender(<VerticalSwitchBox value={true} label="Test" onChange={() => {}} />);
    switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  it('should apply correct color when on', () => {
    render(<VerticalSwitchBox value={true} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveClass('bg-gray-400');
  });

  it('should apply correct color when off', () => {
    render(<VerticalSwitchBox value={false} label="Test" onChange={() => {}} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveClass('bg-gray-200');
  });

  it('should accept additional props', () => {
    render(<VerticalSwitchBox value={false} label="Test" onChange={() => {}} data-testid="vertical-switch" />);
    expect(screen.getByTestId('vertical-switch')).toBeInTheDocument();
  });

  it('should have sr-only label', () => {
    render(<VerticalSwitchBox value={false} label="Test Label" onChange={() => {}} />);
    // The label is used in sr-only text and also displayed visibly
    const labels = screen.getAllByText('Test Label');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('should use vertical layout', () => {
    const { container } = render(<VerticalSwitchBox value={false} label="Test" onChange={() => {}} />);
    const group = container.querySelector('.flex-col');
    expect(group).toBeInTheDocument();
  });

  it('should handle rapid toggling', () => {
    const handleChange = vi.fn();
    render(<VerticalSwitchBox value={false} label="Test" onChange={handleChange} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);
    fireEvent.click(switchElement);
    fireEvent.click(switchElement);

    expect(handleChange).toHaveBeenCalledTimes(3);
  });
});
