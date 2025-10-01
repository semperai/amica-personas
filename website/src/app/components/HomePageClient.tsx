'use client';

// src/app/page.tsx - Enhanced with new contract features and improved UX
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { fetchPersonas, fetchGlobalStats, GlobalStats, fetchTrending } from '@/lib/api-graphql';
import { formatEther } from 'viem';
import Link from 'next/link';

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

// Generate a unique gradient background for each persona based on its ID
const getPersonaGradient = (id: string, hasAgentToken: boolean = false) => {
  const baseGradients = [
    'from-purple-600 to-pink-600',
    'from-blue-600 to-cyan-500',
    'from-indigo-600 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-blue-600',
    'from-violet-600 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-blue-500 to-indigo-600',
  ];

  const agentGradients = [
    'from-purple-600 via-pink-500 to-cyan-400',
    'from-blue-600 via-purple-500 to-pink-400',
    'from-indigo-600 via-blue-500 to-cyan-400',
    'from-pink-500 via-purple-500 to-blue-400',
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

interface PersonaCardProps {
  persona: Persona;
}

function PersonaCard({ persona }: PersonaCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const media = getPersonaMedia(persona.id);

  return (
    <Link
      href={`/persona/${persona.chain.id}/${persona.id}`}
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Gradient (shown while image loads) */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getPersonaGradient(persona.id, persona.hasAgentToken)} opacity-80`} />

      {/* Background Image/Video */}
      <div className="absolute inset-0">
        {isHovered && media.video ? (
          <video
            className="w-full h-full object-cover"
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
            className={`w-full h-full object-cover transition-all duration-700 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            } ${isHovered ? 'scale-110' : 'scale-100'}`}
            onLoad={() => setImageLoaded(true)}
          />
        )}
      </div>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />

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
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 backdrop-blur-sm text-xs font-medium">
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
            <h3 className="text-xl font-semibold text-white mb-1 line-clamp-1">
              {persona.name}
            </h3>
            <p className="text-sm text-white/70">${persona.symbol}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">24h Vol</span>
              <span className="text-sm font-medium text-white">
                {parseFloat(formatEther(BigInt(persona.totalVolume24h))).toFixed(2)} Ξ
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">TVL</span>
              <span className="text-sm font-medium text-white">
                {parseFloat(formatEther(BigInt(persona.totalDeposited || '0'))).toFixed(2)} Ξ
              </span>
            </div>
            {persona.hasAgentToken && persona.agentTokenProgress !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Agent Progress</span>
                <span className="text-sm font-medium text-purple-400">
                  {persona.agentTokenProgress.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Chain indicator */}
          <div className="pt-2 border-t border-white/20">
            <span className="text-xs text-white/60 capitalize">{persona.chain.name}</span>
          </div>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
    </Link>
  );
}

// Enhanced animated text component
function AnimatedHeroText() {
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

export default function HomePage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('trending');
  const [filterBy, setFilterBy] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        setLoading(true);
        const sortMap: Record<string, string> = {
          trending: 'totalDeposited_DESC',  // Changed from totalVolume24h_DESC
          volume: 'totalDeposited_DESC',    // Changed from totalVolume24h_DESC
          tvl: 'totalDeposited_DESC',
          new: 'createdAt_DESC',
          graduated: 'totalDeposited_DESC'  // Changed from totalVolumeAllTime_DESC
        };


        try {
          const data = await fetchPersonas({
            sort: sortMap[sortBy],
            limit: 50,
          });

          setPersonas(data.personas);
        } catch (personasError) {
          console.error('Failed to load personas:', personasError);
          setError('Unable to load personas. Please try again later.');
          setPersonas([]);
        }
      } catch (error) {
        console.error('Unexpected error loading data:', error);
        setError('An unexpected error occurred. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sortBy, filterBy]);

  return (
    <Layout>
      <style jsx>{animationStyles}</style>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/hero-background.jpg"
            alt="Hero Background"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-blue-900/70 to-slate-900" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-light text-white mb-6 animate-fade-in">
              Create Your AI Persona
            </h1>
            <AnimatedHeroText />

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in-delay-2">
              <Link
                href="/create"
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-300 font-light text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Create Persona
              </Link>
              <Link
                href="#explore"
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-full hover:bg-white/20 transition-all duration-300 font-light text-lg border border-white/20"
              >
                Explore Personas
              </Link>
            </div>

            {/* Enhanced Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-3xl font-light text-white">{'250+'}
                  <span className="text-sm text-green-400 ml-1">
                    100
                  </span>
                </p>
                <p className="text-sm text-white/60">Active Personas</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-3xl font-light text-white">
                  12M
                  <span className="text-sm text-green-400 ml-1">+</span>
                </p>
                <p className="text-sm text-white/60">Total Volume</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-3xl font-light text-white">777K
                  <span className="text-sm text-green-400 ml-1">+</span>
                </p>
                <p className="text-sm text-white/60">Total Trades</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-3xl font-light text-white">25%
                  <span className="text-sm text-white/60">100%</span>
                </p>
                <p className="text-sm text-white/60">Buy/Sell Ratio</p>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
            <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div id="explore" className="max-w-7xl mx-auto px-6 py-8">
        {/* Enhanced Filters */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white/10 backdrop-blur-sm text-white px-6 py-2 pr-10 rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
            >
              <option value="trending" className="bg-slate-800">Trending</option>
              <option value="volume" className="bg-slate-800">24h Volume</option>
              <option value="tvl" className="bg-slate-800">TVL</option>
              <option value="new" className="bg-slate-800">Newest</option>
              <option value="graduated" className="bg-slate-800">All Time Volume</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-lg p-6 mb-8">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Personas Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-white/5 backdrop-blur-sm rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {personas.map((persona) => (
              <PersonaCard key={persona.id} persona={persona} />
            ))}
          </div>
        )}

        {!loading && personas.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-white/60 text-lg mb-4">No personas found for the selected filter</p>
            <button
              onClick={() => {
                setFilterBy('all');
                setSortBy('trending');
              }}
              className="px-6 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              Show All Personas
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
