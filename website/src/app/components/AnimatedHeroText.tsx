'use client';

import { useState, useEffect } from 'react';

const phrases = [
  "autonomous AI agents on the blockchain",
  "augmented reality internet workers",
  "3D personas of your favorite characters",
  "AI companions with real-world capabilities",
  "virtual assistants powered by decentralized compute",
  "intelligent agents that work on your behalf",
  "AR/VR characters with API superpowers",
  "digital workers for the acceleration economy",
  "AI agents with token-gated access controls",
  "decentralized personas with agent token integration"
];

export default function AnimatedHeroText() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % phrases.length);
        setIsAnimating(false);
      }, 500);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <p className="text-xl md:text-2xl text-white/80 mb-8 font-light animate-fade-in-delay">
      Launch, trade, and monetize{' '}<br />
      <span className="relative inline-block overflow-hidden align-bottom" style={{ minHeight: '1.5em' }}>
        <span
          className={`inline-block transition-all duration-500 ${
            isAnimating ? 'text-transition-exit' : 'text-transition-enter'
          }`}
        >
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-normal">
            {phrases[currentIndex]}
          </span>
        </span>
      </span>
    </p>
  );
}
