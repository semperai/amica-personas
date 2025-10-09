import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraduationProgress } from '@/components/trading/GraduationProgress';

describe('GraduationProgress', () => {
  describe('rendering', () => {
    it('should not render when already graduated', () => {
      const { container } = render(
        <GraduationProgress isGraduated={true} progress={100} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when not graduated', () => {
      render(<GraduationProgress isGraduated={false} progress={50} />);
      expect(screen.getByText('TVL Progress')).toBeInTheDocument();
    });

    it('should display TVL progress label', () => {
      render(<GraduationProgress isGraduated={false} progress={50} />);
      expect(screen.getByText('TVL Progress')).toBeInTheDocument();
    });

    it('should display TVL progress percentage', () => {
      render(<GraduationProgress isGraduated={false} progress={75.5} />);
      expect(screen.getByText('75.5%')).toBeInTheDocument();
    });
  });

  describe('TVL progress bar', () => {
    it('should display progress at 0%', () => {
      render(<GraduationProgress isGraduated={false} progress={0} />);
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('should display progress at 50%', () => {
      render(<GraduationProgress isGraduated={false} progress={50} />);
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('should display progress at 100%', () => {
      render(<GraduationProgress isGraduated={false} progress={100} />);
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('should show checkmark when TVL is complete', () => {
      render(<GraduationProgress isGraduated={false} progress={100} />);
      const checkmark = screen.getAllByText('✓')[0];
      expect(checkmark).toBeInTheDocument();
    });

    it('should not show checkmark when TVL is incomplete', () => {
      render(<GraduationProgress isGraduated={false} progress={50} />);
      expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });
  });

  describe('agent token progress', () => {
    it('should not show agent token progress by default', () => {
      render(<GraduationProgress isGraduated={false} progress={50} />);
      expect(screen.queryByText('Agent Token Progress')).not.toBeInTheDocument();
    });

    it('should show agent token progress when hasAgentToken is true', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={50}
          hasAgentToken={true}
          agentTokenProgress={75}
        />
      );
      expect(screen.getByText('Agent Token Progress')).toBeInTheDocument();
    });

    it('should display agent token progress percentage', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={50}
          hasAgentToken={true}
          agentTokenProgress={85.5}
        />
      );
      expect(screen.getByText('85.5%')).toBeInTheDocument();
    });

    it('should show checkmark when agent tokens are complete', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={50}
          hasAgentToken={true}
          agentTokenProgress={100}
        />
      );
      const checkmarks = screen.getAllByText('✓');
      expect(checkmarks.length).toBeGreaterThan(0);
    });

    it('should show optional badge when agent tokens required is 0', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={50}
          hasAgentToken={true}
          agentTokenProgress={0}
          agentTokensRequired="0"
        />
      );
      expect(screen.getByText('Optional')).toBeInTheDocument();
    });

    it('should display agent token deposit information', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={50}
          hasAgentToken={true}
          agentTokenProgress={50}
          agentTokensDeposited="500"
          agentTokensRequired="1000"
          agentTokenSymbol="AGENT"
        />
      );
      expect(screen.getByText(/500 \/ 1000 AGENT deposited/)).toBeInTheDocument();
    });
  });

  describe('graduation status', () => {
    it('should show ready to graduate when both requirements are met', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={100}
          hasAgentToken={true}
          agentTokenProgress={100}
        />
      );
      expect(screen.getByText(/🎉 Ready to Graduate!/)).toBeInTheDocument();
    });

    it('should show next trade message when ready to graduate', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={100}
          hasAgentToken={true}
          agentTokenProgress={100}
        />
      );
      expect(screen.getByText(/next trade will trigger graduation/)).toBeInTheDocument();
    });

    it('should show TVL needed when only TVL is incomplete', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={75}
          hasAgentToken={true}
          agentTokenProgress={100}
        />
      );
      expect(screen.getByText(/Need 25.0% more TVL to graduate/)).toBeInTheDocument();
    });

    it('should show agent tokens needed when only agent tokens are incomplete', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={100}
          hasAgentToken={true}
          agentTokenProgress={60}
        />
      );
      expect(screen.getByText(/Need 40.0% more agent tokens to graduate/)).toBeInTheDocument();
    });

    it('should show both requirements needed when both are incomplete', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={70}
          hasAgentToken={true}
          agentTokenProgress={50}
        />
      );
      expect(screen.getByText(/Need 30.0% more TVL and 50.0% more agent tokens/)).toBeInTheDocument();
    });
  });

  describe('without agent token requirements', () => {
    it('should show ready to graduate with only TVL complete', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={100}
          hasAgentToken={false}
        />
      );
      // Without agent token, 100% TVL should show ready to graduate
      expect(screen.getByText(/🎉 Ready to Graduate!/)).toBeInTheDocument();
    });

    it('should show TVL needed when TVL is incomplete', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={80}
          hasAgentToken={false}
        />
      );
      expect(screen.getByText(/Need 20.0% more TVL to graduate/)).toBeInTheDocument();
    });
  });

  describe('progress bar styling', () => {
    it('should use blue color for incomplete TVL', () => {
      const { container } = render(
        <GraduationProgress isGraduated={false} progress={50} />
      );
      const progressBar = container.querySelector('.bg-brand-blue');
      expect(progressBar).toBeInTheDocument();
    });

    it('should use green color for complete TVL', () => {
      const { container } = render(
        <GraduationProgress isGraduated={false} progress={100} />
      );
      const progressBar = container.querySelector('.bg-emerald-500');
      expect(progressBar).toBeInTheDocument();
    });

    it('should use orange color for incomplete agent tokens', () => {
      const { container } = render(
        <GraduationProgress
          isGraduated={false}
          progress={50}
          hasAgentToken={true}
          agentTokenProgress={50}
        />
      );
      const progressBar = container.querySelector('.bg-orange-500');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle progress over 100%', () => {
      render(<GraduationProgress isGraduated={false} progress={150} />);
      expect(screen.getByText('150.0%')).toBeInTheDocument();
    });

    it('should handle negative progress', () => {
      render(<GraduationProgress isGraduated={false} progress={-10} />);
      expect(screen.getByText('-10.0%')).toBeInTheDocument();
    });

    it('should handle zero progress', () => {
      render(<GraduationProgress isGraduated={false} progress={0} />);
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('should use default agentTokenProgress of 100', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={100}
          hasAgentToken={true}
        />
      );
      // Default agentTokenProgress is 100, so should be ready to graduate
      expect(screen.getByText(/🎉 Ready to Graduate!/)).toBeInTheDocument();
    });

    it('should use default agentTokenSymbol', () => {
      render(
        <GraduationProgress
          isGraduated={false}
          progress={50}
          hasAgentToken={true}
          agentTokenProgress={50}
          agentTokensDeposited="100"
          agentTokensRequired="200"
        />
      );
      expect(screen.getByText(/100 \/ 200 tokens deposited/)).toBeInTheDocument();
    });
  });
});
