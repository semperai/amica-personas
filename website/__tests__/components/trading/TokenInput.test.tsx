import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenInput } from '@/components/trading/TokenInput';

describe('TokenInput', () => {
  const defaultProps = {
    label: 'From',
    value: '100',
    balance: '1000',
    tokenSymbol: 'ETH',
  };

  describe('rendering', () => {
    it('should render label and balance', () => {
      render(<TokenInput {...defaultProps} />);
      expect(screen.getByText('From')).toBeInTheDocument();
      expect(screen.getByText('Balance: 1000')).toBeInTheDocument();
    });

    it('should render token symbol', () => {
      render(<TokenInput {...defaultProps} />);
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });

    it('should display the value in input', () => {
      render(<TokenInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
      expect(input.value).toBe('100');
    });

    it('should use custom placeholder when provided', () => {
      render(<TokenInput {...defaultProps} placeholder="Enter amount" />);
      expect(screen.getByPlaceholderText('Enter amount')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onChange when input value changes', () => {
      const onChange = vi.fn();
      render(<TokenInput {...defaultProps} onChange={onChange} />);

      const input = screen.getByPlaceholderText('0.0');
      fireEvent.change(input, { target: { value: '200' } });

      expect(onChange).toHaveBeenCalledWith('200');
    });

    it('should not allow editing when readOnly', () => {
      const onChange = vi.fn();
      render(<TokenInput {...defaultProps} onChange={onChange} readOnly />);

      const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;

      // Verify input is readonly
      expect(input.readOnly).toBe(true);
    });

    it('should render MAX button when onMaxClick is provided', () => {
      const onMaxClick = vi.fn();
      render(<TokenInput {...defaultProps} onMaxClick={onMaxClick} />);

      expect(screen.getByText('MAX')).toBeInTheDocument();
    });

    it('should call onMaxClick when MAX button is clicked', () => {
      const onMaxClick = vi.fn();
      render(<TokenInput {...defaultProps} onMaxClick={onMaxClick} />);

      const maxButton = screen.getByText('MAX');
      fireEvent.click(maxButton);

      expect(onMaxClick).toHaveBeenCalledTimes(1);
    });

    it('should not render MAX button when readOnly', () => {
      const onMaxClick = vi.fn();
      render(<TokenInput {...defaultProps} onMaxClick={onMaxClick} readOnly />);

      expect(screen.queryByText('MAX')).not.toBeInTheDocument();
    });

    it('should not render MAX button when onMaxClick is not provided', () => {
      render(<TokenInput {...defaultProps} />);
      expect(screen.queryByText('MAX')).not.toBeInTheDocument();
    });
  });

  describe('readonly mode', () => {
    it('should make input readonly when readOnly is true', () => {
      render(<TokenInput {...defaultProps} readOnly />);
      const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });

    it('should allow input when readOnly is false', () => {
      render(<TokenInput {...defaultProps} readOnly={false} />);
      const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
      expect(input.readOnly).toBe(false);
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      const { container } = render(<TokenInput {...defaultProps} className="custom-class" />);
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('should have default styles', () => {
      const { container } = render(<TokenInput {...defaultProps} />);
      const wrapper = container.querySelector('.p-4');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('bg-muted', 'rounded-xl', 'border', 'border-border');
    });
  });

  describe('input type', () => {
    it('should render input as number type', () => {
      render(<TokenInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
      expect(input.type).toBe('number');
    });
  });

  describe('different token symbols', () => {
    it('should render USDC symbol', () => {
      render(<TokenInput {...defaultProps} tokenSymbol="USDC" />);
      expect(screen.getByText('USDC')).toBeInTheDocument();
    });

    it('should render DAI symbol', () => {
      render(<TokenInput {...defaultProps} tokenSymbol="DAI" />);
      expect(screen.getByText('DAI')).toBeInTheDocument();
    });
  });
});
