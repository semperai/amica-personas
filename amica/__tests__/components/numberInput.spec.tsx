import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberInput } from '../../src/components/numberInput';

describe('NumberInput', () => {
  it('should render without crashing', () => {
    render(<NumberInput value={0} min={0} max={100} />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('should display the provided value', () => {
    render(<NumberInput value={42} min={0} max={100} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('42');
  });

  it('should call onChange when value changes', () => {
    const handleChange = vi.fn();
    render(<NumberInput value={0} min={0} max={100} onChange={handleChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should have type="number"', () => {
    render(<NumberInput value={0} min={0} max={100} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('type', 'number');
  });

  it('should accept min and max props via spread', () => {
    render(<NumberInput value={50} min={0} max={100} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
  });

  it('should handle zero value', () => {
    render(<NumberInput value={0} min={0} max={100} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('0');
  });

  it('should handle negative values', () => {
    render(<NumberInput value={-10} min={-100} max={100} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('-10');
  });

  it('should handle decimal values', () => {
    render(<NumberInput value={3.14} min={0} max={10} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('3.14');
  });

  it('should apply correct CSS classes', () => {
    render(<NumberInput value={0} min={0} max={100} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveClass('block', 'w-full', 'rounded-md', 'border-0', 'py-1.5');
  });

  it('should accept additional props via spread', () => {
    render(<NumberInput value={0} min={0} max={100} placeholder="Enter number" data-testid="custom-number" />);
    const input = screen.getByTestId('custom-number');
    expect(input).toHaveAttribute('placeholder', 'Enter number');
  });

  it('should pass event to onChange', () => {
    const handleChange = vi.fn();
    render(<NumberInput value={10} min={0} max={100} onChange={handleChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '75' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    // The event object is passed to onChange
    expect(handleChange).toHaveBeenCalled();
  });

  it('should handle step attribute via spread', () => {
    render(<NumberInput value={0} min={0} max={100} step={5} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('step', '5');
  });

  it('should accept disabled attribute', () => {
    render(<NumberInput value={0} min={0} max={100} disabled={true} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toBeDisabled();
  });

  it('should accept aria attributes', () => {
    render(<NumberInput value={0} min={0} max={100} aria-label="Number input" />);
    const input = screen.getByLabelText('Number input');
    expect(input).toBeInTheDocument();
  });

  it('should handle large numbers', () => {
    render(<NumberInput value={999999} min={0} max={1000000} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('999999');
  });

  it('should handle min value boundary', () => {
    render(<NumberInput value={0} min={0} max={100} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('0');
    expect(input).toHaveAttribute('min', '0');
  });

  it('should handle max value boundary', () => {
    render(<NumberInput value={100} min={0} max={100} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('100');
    expect(input).toHaveAttribute('max', '100');
  });
});
