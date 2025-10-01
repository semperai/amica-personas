'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatEther } from 'viem';

interface Persona {
  id: string;
  name: string;
  symbol: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  totalDeposited?: string;
  isGraduated: boolean;
  hasAgentToken: boolean;
  canGraduate?: boolean;
  agentTokenProgress?: number;
  chain: {
    id: string;
    name: string;
  };
  growthMultiplier?: number;
  createdAt?: string;
}

interface PersonaCardProps {
  persona: Persona;
}

// Generate a unique gradient background for each persona based on its ID
const getPersonaGradient = (id: string, hasAgentToken: boolean = false) => {
  const baseGradients = [
    'from-brand-blue to-brand-cyan',
    'from-blue-600 to-cyan-500',
    'from-indigo-600 to-blue-600',
    'from-cyan-500 to-blue-600',
    'from-blue-500 to-brand-cyan',
    'from-brand-blue to-blue-500',
    'from-cyan-600 to-brand-blue',
    'from-blue-500 to-indigo-600',
  ];

  const agentGradients = [
    'from-brand-blue via-blue-500 to-brand-cyan',
    'from-blue-600 via-brand-cyan to-cyan-400',
    'from-indigo-600 via-blue-500 to-brand-cyan',
    'from-brand-cyan via-blue-500 to-brand-blue',
  ];

  const gradients = hasAgentToken ? agentGradients : baseGradients;
  const index = parseInt(id.split('-')[1] || '0') % gradients.length;
  return gradients[index];
};

// Generate placeholder persona images/videos
const getPersonaMedia = (id: string) => {
  const index = parseInt(id.split('-')[1] || '0');
  const images = [
    'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1635236066330-53dbf96c7208?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1634926878768-2a5b3c42f139?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1617791160505-6f00504e3519?w=400&h=500&fit=crop',
  ];

  return {
    image: images[index % images.length],
    video: null // Replace with actual video URLs when available
  };
};

export default function PersonaCard({ persona }: PersonaCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const media = getPersonaMedia(persona.id);

  return (
    <Link
      href={`/persona/${persona.chain.id}/${persona.id}`}
      className="group relative aspect-[3/4] rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl border border-border bg-card hover:border-brand-blue/50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Gradient (shown while image loads) */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getPersonaGradient(persona.id, persona.hasAgentToken)} opacity-20`} />

      {/* Background Image/Video */}
      <div className="absolute inset-0">
        {isHovered && media.video ? (
          <video
            className="w-full h-full object-cover opacity-30"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={media.video} type="video/mp4" />
          </video>
        ) : (
          <img
            src={media.image}
            alt={persona.name}
            className={`w-full h-full object-cover transition-all duration-700 opacity-30 ${
              imageLoaded ? 'opacity-30' : 'opacity-0'
            } ${isHovered ? 'scale-105' : 'scale-100'}`}
            onLoad={() => setImageLoaded(true)}
          />
        )}
      </div>

      {/* Gradient overlay for better text contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

      {/* Content */}
      <div className="relative h-full p-5 flex flex-col justify-between">
        {/* Top Section */}
        <div className="flex justify-between items-start">
          <div className="flex flex-wrap gap-1">
            {persona.isGraduated && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-500/20 text-green-400 backdrop-blur-sm text-xs font-medium">
                Graduated
              </span>
            )}
            {persona.hasAgentToken && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-brand-cyan/20 text-brand-cyan backdrop-blur-sm text-xs font-medium">
                Agent
              </span>
            )}
            {persona.canGraduate && !persona.isGraduated && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 backdrop-blur-sm text-xs font-medium animate-glow">
                Ready!
              </span>
            )}
          </div>

          {/* Growth indicator */}
          {persona.growthMultiplier && persona.growthMultiplier > 1.5 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 rounded-full backdrop-blur-sm">
              <span className="text-orange-400 text-xs">🔥</span>
              <span className="text-orange-400 text-xs font-medium">{persona.growthMultiplier.toFixed(1)}x</span>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1 line-clamp-1">
              {persona.name}
            </h3>
            <p className="text-sm text-muted-foreground">${persona.symbol}</p>
          </div>

          <div className="space-y-2 bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">24h Vol</span>
              <span className="text-sm font-semibold text-foreground">
                {parseFloat(formatEther(BigInt(persona.totalVolume24h))).toFixed(2)} Ξ
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">TVL</span>
              <span className="text-sm font-semibold text-foreground">
                {parseFloat(formatEther(BigInt(persona.totalDeposited || '0'))).toFixed(2)} Ξ
              </span>
            </div>
            {persona.hasAgentToken && persona.agentTokenProgress !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Agent Progress</span>
                <span className="text-sm font-semibold text-brand-cyan">
                  {persona.agentTokenProgress.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Chain indicator */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-brand-blue" />
            <span className="text-xs text-muted-foreground capitalize">{persona.chain.name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
