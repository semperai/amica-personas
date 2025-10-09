import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../../__tests__/utils/test-utils';
import { FeeInfoDisplay } from '@/components/trading/FeeInfoDisplay';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useWriteContract: vi.fn(() => ({
    writeContract: vi.fn(),
  })),
}));

// Mock contracts
vi.mock('@/lib/contracts', () => ({
  FACTORY_ABI: [],
}));

describe('FeeInfoDisplay', () => {
  const mockOnUpdateSnapshot = vi.fn();

  const defaultFeeInfo: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] = [
    BigInt("5000000000000000000000"), // currentBalance: 5000 AMICA
    BigInt("5000000000000000000000"), // snapshotBalance
    BigInt("5000000000000000000000"), // effectiveBalance
    BigInt("12345"), // snapshotBlock
    true, // isEligible
    BigInt("0"), // blocksUntilEligible
    BigInt("500"), // baseFeePercentage (5%)
    BigInt("450"), // effectiveFeePercentage (4.5%)
    BigInt("50"), // discountPercentage (0.5%)
  ];

  beforeEach(() => {
    mockOnUpdateSnapshot.mockClear();
  });

  describe('rendering', () => {
    it('should render fee tier toggle button', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);
      expect(screen.getByText('Your Fee Tier')).toBeInTheDocument();
    });

    it('should not render when feeInfo is undefined', () => {
      const { container } = render(<FeeInfoDisplay feeInfo={undefined} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('fee information display', () => {
    it('should show fee details when toggle is clicked', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      expect(screen.getByText('AMICA Balance:')).toBeInTheDocument();
      expect(screen.getByText('Your Fee Rate:')).toBeInTheDocument();
    });

    it('should hide fee details when toggle is clicked twice', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);

      expect(screen.queryByText('AMICA Balance:')).not.toBeInTheDocument();
    });

    it('should display AMICA balance correctly', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      // Balance should be displayed (formatted by formatEther)
      expect(screen.getByText(/5000/)).toBeInTheDocument();
    });

    it('should display fee rate correctly', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      expect(screen.getByText('4.50%')).toBeInTheDocument();
    });

    it('should display discount when present', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      expect(screen.getByText(/0.50% discount/)).toBeInTheDocument();
    });

    it('should not display discount text when discount is zero', () => {
      const feeInfoNoDiscount: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] = [
        ...defaultFeeInfo.slice(0, 8),
        BigInt("0"),
      ] as readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint];

      render(<FeeInfoDisplay feeInfo={feeInfoNoDiscount} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      // The discount span should not be in the document when discount is 0
      expect(screen.queryByText(/0.00% discount/)).not.toBeInTheDocument();
    });
  });

  describe('snapshot creation', () => {
    it('should show snapshot button when balance is high and no snapshot exists', () => {
      const feeInfoNeedsSnapshot: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] = [
        BigInt("2000000000000000000000"), // 2000 AMICA
        BigInt("0"), // no snapshot
        ...defaultFeeInfo.slice(2),
      ] as readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint];

      render(<FeeInfoDisplay feeInfo={feeInfoNeedsSnapshot} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      expect(screen.getByText('Create Snapshot for Fee Reduction')).toBeInTheDocument();
    });

    it('should not show snapshot button when snapshot already exists', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      expect(screen.queryByText('Create Snapshot for Fee Reduction')).not.toBeInTheDocument();
    });

    it('should not show snapshot button when balance is too low', () => {
      const feeInfoLowBalance: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] = [
        BigInt("500000000000000000000"), // 500 AMICA (less than 1000)
        BigInt("0"), // no snapshot
        ...defaultFeeInfo.slice(2),
      ] as readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint];

      render(<FeeInfoDisplay feeInfo={feeInfoLowBalance} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      expect(screen.queryByText('Create Snapshot for Fee Reduction')).not.toBeInTheDocument();
    });
  });

  describe('mock mode', () => {
    it('should show alert in mock mode when clicking snapshot button', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const feeInfoNeedsSnapshot: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] = [
        BigInt("2000000000000000000000"),
        BigInt("0"),
        ...defaultFeeInfo.slice(2),
      ] as readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint];

      render(<FeeInfoDisplay feeInfo={feeInfoNeedsSnapshot} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={true} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      const snapshotButton = screen.getByText('Create Snapshot for Fee Reduction');
      fireEvent.click(snapshotButton);

      expect(alertSpy).toHaveBeenCalledWith('Mock Mode: Would update AMICA snapshot for fee reduction');
      alertSpy.mockRestore();
    });
  });

  describe('fee tier information', () => {
    it('should display fee discount tiers', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      fireEvent.click(toggleButton);

      expect(screen.getByText('Hold AMICA to reduce trading fees:')).toBeInTheDocument();
      expect(screen.getByText('• 1,000 AMICA = 10% discount')).toBeInTheDocument();
      expect(screen.getByText('• 10,000 AMICA = 30% discount')).toBeInTheDocument();
      expect(screen.getByText('• 100,000 AMICA = 60% discount')).toBeInTheDocument();
      expect(screen.getByText('• 1,000,000+ AMICA = 100% discount')).toBeInTheDocument();
    });
  });

  describe('toggle icon rotation', () => {
    it('should rotate icon when expanded', () => {
      render(<FeeInfoDisplay feeInfo={defaultFeeInfo} factoryAddress="0x123" onUpdateSnapshot={mockOnUpdateSnapshot} isMockMode={false} />);

      const toggleButton = screen.getByText('Your Fee Tier');
      const svg = toggleButton.querySelector('svg');

      expect(svg).not.toHaveClass('rotate-90');

      fireEvent.click(toggleButton);

      expect(svg).toHaveClass('rotate-90');
    });
  });
});
