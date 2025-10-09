import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwapSettings } from '@/components/trading/SwapSettings';

describe('SwapSettings', () => {
  const mockOnSlippageChange = vi.fn();

  beforeEach(() => {
    mockOnSlippageChange.mockClear();
  });

  describe('rendering', () => {
    it('should render settings button', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should render settings icon', () => {
      const { container } = render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should not show settings panel initially', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      expect(screen.queryByText('Transaction Settings')).not.toBeInTheDocument();
    });
  });

  describe('settings panel toggle', () => {
    it('should show settings panel when button is clicked', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByText('Transaction Settings')).toBeInTheDocument();
    });

    it('should hide settings panel when button is clicked twice', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);

      expect(screen.queryByText('Transaction Settings')).not.toBeInTheDocument();
    });

    it('should toggle settings panel multiple times', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);

      const button = screen.getByRole('button');

      fireEvent.click(button);
      expect(screen.getByText('Transaction Settings')).toBeInTheDocument();

      fireEvent.click(button);
      expect(screen.queryByText('Transaction Settings')).not.toBeInTheDocument();

      fireEvent.click(button);
      expect(screen.getByText('Transaction Settings')).toBeInTheDocument();
    });
  });

  describe('settings panel content', () => {
    it('should display slippage tolerance label', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('Slippage Tolerance')).toBeInTheDocument();
    });

    it('should display preset slippage buttons', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('0.1%')).toBeInTheDocument();
      expect(screen.getByText('0.5%')).toBeInTheDocument();
      expect(screen.getByText('1.0%')).toBeInTheDocument();
    });

    it('should display custom input field', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const input = screen.getByPlaceholderText('Custom');
      expect(input).toBeInTheDocument();
    });

    it('should display help text', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText(/Your transaction will revert if the price changes unfavorably/)).toBeInTheDocument();
    });
  });

  describe('slippage selection', () => {
    it('should highlight selected slippage value', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const selectedButton = screen.getByText('0.5%');
      expect(selectedButton).toHaveClass('bg-purple-500/20');
    });

    it('should call onSlippageChange when preset is clicked', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const button = screen.getByText('1.0%');
      fireEvent.click(button);

      expect(mockOnSlippageChange).toHaveBeenCalledWith('1.0');
    });

    it('should call onSlippageChange for each preset value', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      fireEvent.click(screen.getByText('0.1%'));
      expect(mockOnSlippageChange).toHaveBeenCalledWith('0.1');

      fireEvent.click(screen.getByText('0.5%'));
      expect(mockOnSlippageChange).toHaveBeenCalledWith('0.5');

      fireEvent.click(screen.getByText('1.0%'));
      expect(mockOnSlippageChange).toHaveBeenCalledWith('1.0');
    });
  });

  describe('custom slippage input', () => {
    it('should display current slippage value in input', () => {
      render(<SwapSettings slippage="2.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const input = screen.getByPlaceholderText('Custom') as HTMLInputElement;
      expect(input.value).toBe('2.5');
    });

    it('should call onSlippageChange when custom value is entered', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const input = screen.getByPlaceholderText('Custom');
      fireEvent.change(input, { target: { value: '3.0' } });

      expect(mockOnSlippageChange).toHaveBeenCalledWith('3.0');
    });

    it('should have correct input attributes', () => {
      render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const input = screen.getByPlaceholderText('Custom') as HTMLInputElement;
      expect(input.type).toBe('number');
      expect(input.step).toBe('0.1');
      expect(input.min).toBe('0.1');
      expect(input.max).toBe('50');
    });
  });

  describe('different slippage values', () => {
    it('should render with 0.1 slippage', () => {
      render(<SwapSettings slippage="0.1" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const button = screen.getByText('0.1%');
      expect(button).toHaveClass('bg-purple-500/20');
    });

    it('should render with 1.0 slippage', () => {
      render(<SwapSettings slippage="1.0" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const button = screen.getByText('1.0%');
      expect(button).toHaveClass('bg-purple-500/20');
    });

    it('should render with custom slippage', () => {
      render(<SwapSettings slippage="5.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const input = screen.getByPlaceholderText('Custom') as HTMLInputElement;
      expect(input.value).toBe('5.5');
    });
  });

  describe('styling', () => {
    it('should apply correct classes to unselected buttons', () => {
      render(<SwapSettings slippage="0.1" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const button = screen.getByText('0.5%');
      expect(button).toHaveClass('bg-muted');
      expect(button).not.toHaveClass('bg-purple-500/20');
    });

    it('should have correct panel positioning classes', () => {
      const { container } = render(<SwapSettings slippage="0.5" onSlippageChange={mockOnSlippageChange} />);
      fireEvent.click(screen.getByRole('button'));

      const panel = container.querySelector('.absolute');
      expect(panel).toHaveClass('right-0', 'mt-2', 'z-20');
    });
  });
});
