import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MetadataForm from '@/app/create/components/MetadataForm';

describe('MetadataForm', () => {
  const mockOnAddMetadata = vi.fn();
  const mockOnRemoveMetadata = vi.fn();

  beforeEach(() => {
    mockOnAddMetadata.mockClear();
    mockOnRemoveMetadata.mockClear();
  });

  describe('rendering', () => {
    it('should render metadata label', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );
      expect(screen.getByText('Metadata (optional)')).toBeInTheDocument();
    });

    it('should render key input', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );
      expect(screen.getByPlaceholderText(/Key/)).toBeInTheDocument();
    });

    it('should render value input', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );
      expect(screen.getByPlaceholderText(/Value/)).toBeInTheDocument();
    });

    it('should render Add button', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );
      expect(screen.getByText('Add')).toBeInTheDocument();
    });
  });

  describe('adding metadata', () => {
    it('should call onAddMetadata when both fields are filled and Add is clicked', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const keyInput = screen.getByPlaceholderText(/Key/);
      const valueInput = screen.getByPlaceholderText(/Value/);
      const addButton = screen.getByText('Add');

      fireEvent.change(keyInput, { target: { value: 'website' } });
      fireEvent.change(valueInput, { target: { value: 'https://example.com' } });
      fireEvent.click(addButton);

      expect(mockOnAddMetadata).toHaveBeenCalledWith('website', 'https://example.com');
    });

    it('should not call onAddMetadata when key is empty', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const valueInput = screen.getByPlaceholderText(/Value/);
      const addButton = screen.getByText('Add');

      fireEvent.change(valueInput, { target: { value: 'https://example.com' } });
      fireEvent.click(addButton);

      expect(mockOnAddMetadata).not.toHaveBeenCalled();
    });

    it('should not call onAddMetadata when value is empty', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const keyInput = screen.getByPlaceholderText(/Key/);
      const addButton = screen.getByText('Add');

      fireEvent.change(keyInput, { target: { value: 'website' } });
      fireEvent.click(addButton);

      expect(mockOnAddMetadata).not.toHaveBeenCalled();
    });

    it('should not call onAddMetadata when both fields are empty', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);

      expect(mockOnAddMetadata).not.toHaveBeenCalled();
    });

    it('should clear inputs after successful add', () => {
      const { rerender } = render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const keyInput = screen.getByPlaceholderText(/Key/) as HTMLInputElement;
      const valueInput = screen.getByPlaceholderText(/Value/) as HTMLInputElement;
      const addButton = screen.getByText('Add');

      fireEvent.change(keyInput, { target: { value: 'website' } });
      fireEvent.change(valueInput, { target: { value: 'https://example.com' } });
      fireEvent.click(addButton);

      // Inputs should be cleared after clicking add
      expect(keyInput.value).toBe('');
      expect(valueInput.value).toBe('');
    });
  });

  describe('displaying metadata', () => {
    it('should not show metadata list when empty', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );
      expect(screen.queryByText('Remove')).not.toBeInTheDocument();
    });

    it('should display single metadata item', () => {
      render(
        <MetadataForm
          metadataKeys={['website']}
          metadataValues={['https://example.com']}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );
      expect(screen.getByText('website:')).toBeInTheDocument();
      expect(screen.getByText('https://example.com')).toBeInTheDocument();
    });

    it('should display multiple metadata items', () => {
      render(
        <MetadataForm
          metadataKeys={['website', 'twitter', 'discord']}
          metadataValues={['https://example.com', '@example', 'discord.gg/example']}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );
      expect(screen.getByText('website:')).toBeInTheDocument();
      expect(screen.getByText('twitter:')).toBeInTheDocument();
      expect(screen.getByText('discord:')).toBeInTheDocument();
    });

    it('should render Remove button for each metadata item', () => {
      render(
        <MetadataForm
          metadataKeys={['website', 'twitter']}
          metadataValues={['https://example.com', '@example']}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );
      const removeButtons = screen.getAllByText('Remove');
      expect(removeButtons).toHaveLength(2);
    });
  });

  describe('removing metadata', () => {
    it('should call onRemoveMetadata with correct index when Remove is clicked', () => {
      render(
        <MetadataForm
          metadataKeys={['website', 'twitter']}
          metadataValues={['https://example.com', '@example']}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const removeButtons = screen.getAllByText('Remove');
      fireEvent.click(removeButtons[0]);

      expect(mockOnRemoveMetadata).toHaveBeenCalledWith(0);
    });

    it('should call onRemoveMetadata for second item', () => {
      render(
        <MetadataForm
          metadataKeys={['website', 'twitter']}
          metadataValues={['https://example.com', '@example']}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const removeButtons = screen.getAllByText('Remove');
      fireEvent.click(removeButtons[1]);

      expect(mockOnRemoveMetadata).toHaveBeenCalledWith(1);
    });
  });

  describe('input updates', () => {
    it('should update key input value', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const keyInput = screen.getByPlaceholderText(/Key/) as HTMLInputElement;
      fireEvent.change(keyInput, { target: { value: 'test' } });

      expect(keyInput.value).toBe('test');
    });

    it('should update value input value', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const valueInput = screen.getByPlaceholderText(/Value/) as HTMLInputElement;
      fireEvent.change(valueInput, { target: { value: 'test value' } });

      expect(valueInput.value).toBe('test value');
    });
  });

  describe('styling', () => {
    it('should apply correct classes to inputs', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const keyInput = screen.getByPlaceholderText(/Key/);
      expect(keyInput).toHaveClass('flex-1', 'p-4', 'rounded-xl');
    });

    it('should apply correct classes to Add button', () => {
      render(
        <MetadataForm
          metadataKeys={[]}
          metadataValues={[]}
          onAddMetadata={mockOnAddMetadata}
          onRemoveMetadata={mockOnRemoveMetadata}
        />
      );

      const addButton = screen.getByText('Add');
      expect(addButton).toHaveClass('px-6', 'py-4', 'rounded-xl');
    });
  });
});
