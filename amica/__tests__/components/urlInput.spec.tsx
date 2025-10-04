import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UrlInput } from '../../src/components/urlInput';

describe('UrlInput', () => {
  it('should render without crashing', () => {
    render(<UrlInput />);
    expect(screen.getByPlaceholderText('www.example.com')).toBeInTheDocument();
  });

  it('should have type="url"', () => {
    render(<UrlInput />);
    const input = screen.getByPlaceholderText('www.example.com');
    expect(input).toHaveAttribute('type', 'url');
  });

  it('should be required by default', () => {
    render(<UrlInput />);
    const input = screen.getByPlaceholderText('www.example.com');
    expect(input).toBeRequired();
  });

  it('should have correct placeholder', () => {
    render(<UrlInput />);
    expect(screen.getByPlaceholderText('www.example.com')).toBeInTheDocument();
  });

  it('should accept value prop', () => {
    render(<UrlInput value="https://example.com" onChange={() => {}} />);
    const input = screen.getByPlaceholderText('www.example.com') as HTMLInputElement;
    expect(input.value).toBe('https://example.com');
  });

  it('should call onChange when value changes', () => {
    const handleChange = vi.fn();
    render(<UrlInput onChange={handleChange} />);

    const input = screen.getByPlaceholderText('www.example.com');
    fireEvent.change(input, { target: { value: 'https://test.com' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should accept additional HTML input props', () => {
    render(<UrlInput disabled={true} />);
    const input = screen.getByPlaceholderText('www.example.com');
    expect(input).toBeDisabled();
  });

  it('should accept name prop', () => {
    render(<UrlInput name="website" />);
    const input = screen.getByPlaceholderText('www.example.com');
    expect(input).toHaveAttribute('name', 'website');
  });

  it('should accept id prop', () => {
    render(<UrlInput id="url-input" />);
    const input = screen.getByPlaceholderText('www.example.com');
    expect(input).toHaveAttribute('id', 'url-input');
  });

  it('should accept aria-label prop', () => {
    render(<UrlInput aria-label="Website URL" />);
    const input = screen.getByLabelText('Website URL');
    expect(input).toBeInTheDocument();
  });

  it('should apply correct CSS classes', () => {
    render(<UrlInput />);
    const input = screen.getByPlaceholderText('www.example.com');
    expect(input).toHaveClass('bg-gray-50', 'border', 'border-gray-300', 'text-gray-900');
  });

  it('should be wrapped in a div', () => {
    const { container } = render(<UrlInput />);
    const div = container.querySelector('div');
    expect(div).toBeInTheDocument();
    expect(div?.querySelector('input')).toBeInTheDocument();
  });

  it('should handle onBlur event', () => {
    const handleBlur = vi.fn();
    render(<UrlInput onBlur={handleBlur} />);

    const input = screen.getByPlaceholderText('www.example.com');
    fireEvent.blur(input);

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('should handle onFocus event', () => {
    const handleFocus = vi.fn();
    render(<UrlInput onFocus={handleFocus} />);

    const input = screen.getByPlaceholderText('www.example.com');
    fireEvent.focus(input);

    expect(handleFocus).toHaveBeenCalledTimes(1);
  });

  it('should accept defaultValue prop', () => {
    render(<UrlInput defaultValue="https://default.com" />);
    const input = screen.getByPlaceholderText('www.example.com') as HTMLInputElement;
    expect(input.value).toBe('https://default.com');
  });

  it('should accept readOnly prop', () => {
    render(<UrlInput readOnly={true} value="https://readonly.com" />);
    const input = screen.getByPlaceholderText('www.example.com') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it('should handle empty value', () => {
    render(<UrlInput value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText('www.example.com') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('should handle long URLs', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(1000);
    render(<UrlInput value={longUrl} onChange={() => {}} />);
    const input = screen.getByPlaceholderText('www.example.com') as HTMLInputElement;
    expect(input.value).toBe(longUrl);
  });

  it('should handle URLs with special characters', () => {
    const specialUrl = 'https://example.com?query=test&foo=bar#section';
    render(<UrlInput value={specialUrl} onChange={() => {}} />);
    const input = screen.getByPlaceholderText('www.example.com') as HTMLInputElement;
    expect(input.value).toBe(specialUrl);
  });
});
