'use client';

import Layout from '@/components/Layout';
import HeroSection from './HeroSection';
import EcosystemSection from './EcosystemSection';
import PersonaGrid from './PersonaGrid';

// Enhanced animation styles
const animationStyles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideDown {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-100%);
    }
  }

  @keyframes glow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
    }
    50% {
      box-shadow: 0 0 30px rgba(168, 85, 247, 0.5);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.8s ease-out forwards;
  }

  .animate-fade-in-delay {
    opacity: 0;
    animation: fadeIn 0.8s ease-out 0.2s forwards;
  }

  .animate-fade-in-delay-2 {
    opacity: 0;
    animation: fadeIn 0.8s ease-out 0.4s forwards;
  }

  .text-transition-enter {
    animation: slideUp 0.5s ease-out forwards;
  }

  .text-transition-exit {
    animation: slideDown 0.5s ease-out forwards;
  }

  .animate-glow {
    animation: glow 2s ease-in-out infinite;
  }
`;

export default function HomePageClient() {
  return (
    <Layout>
      <style jsx>{animationStyles}</style>
      <HeroSection />
      <EcosystemSection />
      <PersonaGrid />
    </Layout>
  );
}
