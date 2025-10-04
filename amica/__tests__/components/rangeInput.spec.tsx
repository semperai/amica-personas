import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RangeInput } from '../../src/components/rangeInput';

describe('RangeInput', () => {
  it('should render without crashing', () => {
    render(<RangeInput min={0} max={100} />);
    expect(screen.getByPlaceholderText('Min')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Max')).toBeInTheDocument();
  });

  it('should display min value', () => {
    render(<RangeInput min={10} max={100} />);
    const minInput = screen.getByPlaceholderText('Min') as HTMLInputElement;
    expect(minInput.value).toBe('10');
  });

  it('should display max value', () => {
    render(<RangeInput min={0} max={90} />);
    const maxInput = screen.getByPlaceholderText('Max') as HTMLInputElement;
    expect(maxInput.value).toBe('90');
  });

  it('should call minChange when min input changes', () => {
    const handleMinChange = vi.fn();
    render(<RangeInput min={0} max={100} minChange={handleMinChange} />);

    const minInput = screen.getByPlaceholderText('Min');
    fireEvent.change(minInput, { target: { value: '25' } });

    expect(handleMinChange).toHaveBeenCalledTimes(1);
    expect(handleMinChange).toHaveBeenCalledWith(expect.any(Object), 'min');
  });

  it('should call maxChange when max input changes', () => {
    const handleMaxChange = vi.fn();
    render(<RangeInput min={0} max={100} maxChange={handleMaxChange} />);

    const maxInput = screen.getByPlaceholderText('Max');
    fireEvent.change(maxInput, { target: { value: '75' } });

    expect(handleMaxChange).toHaveBeenCalledTimes(1);
    expect(handleMaxChange).toHaveBeenCalledWith(expect.any(Object), 'max');
  });

  it('should not error when minChange is not provided', () => {
    render(<RangeInput min={0} max={100} />);

    const minInput = screen.getByPlaceholderText('Min');
    expect(() => {
      fireEvent.change(minInput, { target: { value: '25' } });
    }).not.toThrow();
  });

  it('should not error when maxChange is not provided', () => {
    render(<RangeInput min={0} max={100} />);

    const maxInput = screen.getByPlaceholderText('Max');
    expect(() => {
      fireEvent.change(maxInput, { target: { value: '75' } });
    }).not.toThrow();
  });

  it('should have correct min/max constraints for min input', () => {
    render(<RangeInput min={10} max={100} />);
    const minInput = screen.getByPlaceholderText('Min');

    expect(minInput).toHaveAttribute('min', '0');
    expect(minInput).toHaveAttribute('max', '99'); // max - 1
  });

  it('should have correct min/max constraints for max input', () => {
    render(<RangeInput min={10} max={100} />);
    const maxInput = screen.getByPlaceholderText('Max');

    expect(maxInput).toHaveAttribute('min', '11'); // min + 1
    expect(maxInput).toHaveAttribute('max', '3600');
  });

  it('should render labels', () => {
    render(<RangeInput min={0} max={100} />);
    expect(screen.getByText('Min')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
  });

  it('should have number input type', () => {
    render(<RangeInput min={0} max={100} />);
    const minInput = screen.getByPlaceholderText('Min');
    const maxInput = screen.getByPlaceholderText('Max');

    expect(minInput).toHaveAttribute('type', 'number');
    expect(maxInput).toHaveAttribute('type', 'number');
  });

  it('should apply correct CSS classes to container', () => {
    const { container } = render(<RangeInput min={0} max={100} />);
    const div = container.querySelector('.flex.space-x-2');
    expect(div).toBeInTheDocument();
  });

  it('should handle boundary values', () => {
    render(<RangeInput min={0} max={3600} />);
    const minInput = screen.getByPlaceholderText('Min') as HTMLInputElement;
    const maxInput = screen.getByPlaceholderText('Max') as HTMLInputElement;

    expect(minInput.value).toBe('0');
    expect(maxInput.value).toBe('3600');
  });

  it('should handle negative min values', () => {
    render(<RangeInput min={-10} max={100} />);
    const minInput = screen.getByPlaceholderText('Min') as HTMLInputElement;
    expect(minInput.value).toBe('-10');
  });

  it('should call both handlers when provided', () => {
    const handleMinChange = vi.fn();
    const handleMaxChange = vi.fn();
    render(<RangeInput min={0} max={100} minChange={handleMinChange} maxChange={handleMaxChange} />);

    fireEvent.change(screen.getByPlaceholderText('Min'), { target: { value: '25' } });
    fireEvent.change(screen.getByPlaceholderText('Max'), { target: { value: '75' } });

    expect(handleMinChange).toHaveBeenCalledTimes(1);
    expect(handleMaxChange).toHaveBeenCalledTimes(1);
  });

  it('should pass correct type parameter to callbacks', () => {
    const handleMinChange = vi.fn();
    const handleMaxChange = vi.fn();
    render(<RangeInput min={0} max={100} minChange={handleMinChange} maxChange={handleMaxChange} />);

    fireEvent.change(screen.getByPlaceholderText('Min'), { target: { value: '25' } });
    fireEvent.change(screen.getByPlaceholderText('Max'), { target: { value: '75' } });

    expect(handleMinChange.mock.calls[0][1]).toBe('min');
    expect(handleMaxChange.mock.calls[0][1]).toBe('max');
  });
});
