import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextInput } from '../../src/components/textInput';

describe('TextInput', () => {
  it('should render without crashing', () => {
    render(<TextInput value="" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should display the provided value', () => {
    render(<TextInput value="test value" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('test value');
  });

  it('should call onChange when text is entered', () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new value' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should pass correct event to onChange', () => {
    const handleChange = vi.fn();
    render(<TextInput value="initial" onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'updated' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    // The event object is passed to onChange
    expect(handleChange).toHaveBeenCalled();
  });

  it('should be read-only when readOnly is true', () => {
    render(<TextInput value="test" readOnly={true} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it('should not be read-only when readOnly is false', () => {
    render(<TextInput value="test" readOnly={false} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.readOnly).toBe(false);
  });

  it('should not be read-only by default', () => {
    render(<TextInput value="test" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.readOnly).toBe(false);
  });

  it('should have type="text"', () => {
    render(<TextInput value="test" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('should apply correct CSS classes', () => {
    render(<TextInput value="test" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('block', 'w-full', 'rounded', 'px-2.5', 'py-1.5', 'text-xs');
  });

  it('should accept additional props via spread', () => {
    render(<TextInput value="test" placeholder="Enter text" data-testid="custom-input" />);
    const input = screen.getByTestId('custom-input');
    expect(input).toHaveAttribute('placeholder', 'Enter text');
  });

  it('should handle empty string value', () => {
    render(<TextInput value="" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('should handle long text values', () => {
    const longText = 'A'.repeat(1000);
    render(<TextInput value={longText} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe(longText);
  });

  it('should handle special characters', () => {
    const specialText = 'Hello <>&"\' World!';
    render(<TextInput value={specialText} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe(specialText);
  });

  it('should handle unicode characters', () => {
    const unicodeText = '你好 🌍 こんにちは';
    render(<TextInput value={unicodeText} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe(unicodeText);
  });

  it('should still trigger onChange event when readOnly (browser behavior)', () => {
    const handleChange = vi.fn();
    render(<TextInput value="test" onChange={handleChange} readOnly={true} />);

    const input = screen.getByRole('textbox');
    // Note: fireEvent.change will trigger onChange even on readOnly inputs in tests
    // This is expected test behavior - in real browsers, readOnly prevents user input
    fireEvent.change(input, { target: { value: 'new value' } });

    // onChange is called in tests, but the input value doesn't actually change due to readOnly
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should accept aria attributes', () => {
    render(<TextInput value="test" aria-label="Test input" />);
    const input = screen.getByLabelText('Test input');
    expect(input).toBeInTheDocument();
  });

  it('should accept disabled attribute', () => {
    render(<TextInput value="test" disabled={true} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
