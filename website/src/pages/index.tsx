import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { fetchPersonas } from '@/lib/api-graphql'; // Updated import
import { formatEther } from 'viem';
import Link from 'next/link';

// Add CSS for animations
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
`;

interface Persona {
  id: string;
  name: string;
  symbol: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  totalDeposited?: string;
  isGraduated: boolean;
  chain: {
    id: string;
    name: string;
  };
}

// Generate a unique gradient background for each persona based on its ID
const getPersonaGradient = (id: string) => {
  const gradients = [
    'from-purple-600 to-pink-600',
    'from-blue-600 to-cyan-500',
    'from-indigo-600 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-blue-600',
    'from-violet-600 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-blue-500 to-indigo-600',
  ];

  const index = parseInt(id.split('-')[1] || '0') % gradients.length;
  return gradients[index];
};

// Generate placeholder persona images/videos
const getPersonaMedia = (id: string) => {
  const index = parseInt(id.split('-')[1] || '0');
  // Using placeholder images/videos - replace with actual URLs
  const images = [
    'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1635236066330-53dbf96c7208?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1634926878768-2a5b3c42f139?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1617791160505-6f00504e3519?w=400&h=500&fit=crop',
  ];

  // For demo, using the same image as video poster
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
      href={`/persona/8453/${persona.id}`}
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Gradient (shown while image loads) */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getPersonaGradient(persona.id)} opacity-80`} />

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
        <div>
          {persona.isGraduated && (
            <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm mb-3">
              <span className="text-xs font-medium text-white">Graduated</span>
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

export default function HomePage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('volume');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPersonas = async () => {
      try {
        setError(null);
        const sortMap: Record<string, string> = {
          volume: 'totalVolume24h_DESC',
          tvl: 'totalDeposited_DESC',
          new: 'createdAt_DESC'
        };

        const data = await fetchPersonas({
          sort: sortMap[sortBy],
          limit: 50
        });

        setPersonas(data.personas);
      } catch (error) {
        console.error('Error loading personas:', error);
        setError('Failed to load personas. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadPersonas();
  }, [sortBy]);

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
            <p className="text-xl md:text-2xl text-white/80 mb-8 font-light animate-fade-in-delay">
              Launch, trade, and monetize autonomous AI agents on the blockchain
            </p>

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

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-3xl font-light text-white">250+</p>
                <p className="text-sm text-white/60">Active Personas</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-3xl font-light text-white">$12M+</p>
                <p className="text-sm text-white/60">Total Volume</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-3xl font-light text-white">5.2K</p>
                <p className="text-sm text-white/60">Active Traders</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-3xl font-light text-white">3</p>
                <p className="text-sm text-white/60">Chains Supported</p>
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
        {/* Sort Dropdown - positioned at the top right */}
        <div className="flex justify-end mb-8">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white/10 backdrop-blur-sm text-white px-6 py-2 pr-10 rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
            >
              <option value="volume" className="bg-slate-800">Volume</option>
              <option value="tvl" className="bg-slate-800">TVL</option>
              <option value="new" className="bg-slate-800">New</option>
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
          <div className="flex items-center justify-center h-64">
            <p className="text-white/60 text-lg">No personas found</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
