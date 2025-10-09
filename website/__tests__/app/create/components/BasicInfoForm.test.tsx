import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BasicInfoForm from '@/app/create/components/BasicInfoForm';

describe('BasicInfoForm', () => {
  const mockOnNameChange = vi.fn();
  const mockOnSymbolChange = vi.fn();

  beforeEach(() => {
    mockOnNameChange.mockClear();
    mockOnSymbolChange.mockClear();
  });

  describe('rendering', () => {
    it('should render name input field', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      expect(screen.getByPlaceholderText('My Awesome Persona')).toBeInTheDocument();
    });

    it('should render symbol input field', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      expect(screen.getByPlaceholderText('AWESOME')).toBeInTheDocument();
    });

    it('should render name label', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('should render symbol label', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      expect(screen.getByText('Symbol')).toBeInTheDocument();
    });

    it('should render name help text', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      expect(screen.getByText('Choose a unique and memorable name')).toBeInTheDocument();
    });

    it('should render symbol help text', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      expect(screen.getByText('3-10 characters, letters only')).toBeInTheDocument();
    });
  });

  describe('name input', () => {
    it('should display current name value', () => {
      render(
        <BasicInfoForm
          name="Test Persona"
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('My Awesome Persona') as HTMLInputElement;
      expect(input.value).toBe('Test Persona');
    });

    it('should call onNameChange when name is typed', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('My Awesome Persona');
      fireEvent.change(input, { target: { value: 'New Name' } });

      expect(mockOnNameChange).toHaveBeenCalledWith('New Name');
    });

    it('should update name on each keystroke', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('My Awesome Persona');

      fireEvent.change(input, { target: { value: 'A' } });
      expect(mockOnNameChange).toHaveBeenCalledWith('A');

      fireEvent.change(input, { target: { value: 'Ab' } });
      expect(mockOnNameChange).toHaveBeenCalledWith('Ab');
    });

    it('should accept empty name', () => {
      render(
        <BasicInfoForm
          name="Test"
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('My Awesome Persona');
      fireEvent.change(input, { target: { value: '' } });

      expect(mockOnNameChange).toHaveBeenCalledWith('');
    });
  });

  describe('symbol input', () => {
    it('should display current symbol value', () => {
      render(
        <BasicInfoForm
          name=""
          symbol="TEST"
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('AWESOME') as HTMLInputElement;
      expect(input.value).toBe('TEST');
    });

    it('should convert symbol to uppercase', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('AWESOME');
      fireEvent.change(input, { target: { value: 'test' } });

      expect(mockOnSymbolChange).toHaveBeenCalledWith('TEST');
    });

    it('should convert mixed case to uppercase', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('AWESOME');
      fireEvent.change(input, { target: { value: 'TeSt' } });

      expect(mockOnSymbolChange).toHaveBeenCalledWith('TEST');
    });

    it('should have maxLength of 10', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('AWESOME') as HTMLInputElement;
      expect(input.maxLength).toBe(10);
    });

    it('should accept empty symbol', () => {
      render(
        <BasicInfoForm
          name=""
          symbol="TEST"
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('AWESOME');
      fireEvent.change(input, { target: { value: '' } });

      expect(mockOnSymbolChange).toHaveBeenCalledWith('');
    });
  });

  describe('input types', () => {
    it('should have text type for name input', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('My Awesome Persona') as HTMLInputElement;
      expect(input.type).toBe('text');
    });

    it('should have text type for symbol input', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('AWESOME') as HTMLInputElement;
      expect(input.type).toBe('text');
    });
  });

  describe('styling', () => {
    it('should apply correct classes to name input', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('My Awesome Persona');
      expect(input).toHaveClass('w-full', 'p-4', 'rounded-xl');
    });

    it('should apply correct classes to symbol input', () => {
      render(
        <BasicInfoForm
          name=""
          symbol=""
          onNameChange={mockOnNameChange}
          onSymbolChange={mockOnSymbolChange}
        />
      );
      const input = screen.getByPlaceholderText('AWESOME');
      expect(input).toHaveClass('w-full', 'p-4', 'rounded-xl');
    });
  });
});
