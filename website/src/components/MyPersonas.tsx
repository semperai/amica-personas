// src/components/MyPersonas.tsx
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { formatEther } from 'viem';
import { GET_USER_PORTFOLIO } from '@/lib/graphql/client';
import Image from 'next/image';

interface MyPersonasProps {
  address: string;
}

interface CreatedPersona {
  id: string;
  tokenId: string;
  chainId: string;
  name: string;
  symbol: string;
  totalDeposited: string;
  pairCreated: boolean;
  createdAt: string;
}

// Generate gradient for persona cards
const getPersonaGradient = (id: string) => {
  const gradients = [
    'from-purple-600 to-pink-600',
    'from-blue-600 to-cyan-500',
    'from-indigo-600 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-blue-600',
  ];

  const index = parseInt(id.split('-')[1] || '0') % gradients.length;
  return gradients[index];
};

// Generate placeholder persona images
const getPersonaImage = (id: string) => {
  const index = parseInt(id.split('-')[1] || '0');
  const images = [
    'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1635236066330-53dbf96c7208?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1634926878768-2a5b3c42f139?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=400&h=500&fit=crop',
    'https://images.unsplash.com/photo-1617791160505-6f00504e3519?w=400&h=500&fit=crop',
  ];
  
  return images[index % images.length];
};

// Extract chain info from persona ID
const extractChainFromId = (chainId: string) => {
  const chainNames: Record<string, string> = {
    '1': 'ethereum',
    '8453': 'base',
    '42161': 'arbitrum'
  };
  return {
    id: chainId,
    name: chainNames[chainId] || 'unknown'
  };
};

interface PersonaCardProps {
  persona: CreatedPersona;
}

function PersonaCard({ persona }: PersonaCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const chain = extractChainFromId(persona.chainId);

  return (
    <Link
      href={`/persona/${chain.id}/${persona.id}`}
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Gradient (shown while image loads) */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getPersonaGradient(persona.id)} opacity-80`} />

      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={getPersonaImage(persona.id)}
          alt={persona.name}
          fill
          className={`object-cover transition-all duration-700 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } ${isHovered ? 'scale-110' : 'scale-100'}`}
          onLoad={() => setImageLoaded(true)}
          sizes="(max-width: 768px) 50vw, 33vw"
          priority={false}
        />
      </div>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />

      {/* Content */}
      <div className="relative h-full p-5 flex flex-col justify-between">
        {/* Top Section */}
        <div>
          {persona.pairCreated && (
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
              <span className="text-xs text-white/60">TVL</span>
              <span className="text-sm font-medium text-white">
                {parseFloat(formatEther(BigInt(persona.totalDeposited || '0'))).toFixed(2)} Ξ
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">Created</span>
              <span className="text-sm font-medium text-white">
                {new Date(persona.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Chain indicator */}
          <div className="pt-2 border-t border-white/20">
            <span className="text-xs text-white/60 capitalize">{chain.name}</span>
          </div>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
    </Link>
  );
}

export function MyPersonas({ address }: MyPersonasProps) {
  const { data, loading, error } = useQuery(GET_USER_PORTFOLIO, {
    variables: { creator: address.toLowerCase() },
    skip: !address,
    fetchPolicy: 'network-only', // Always fetch fresh data
  });

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">My Created Personas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">My Created Personas</h2>
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">Error loading personas</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const personas = data?.createdPersonas || [];

  if (personas.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">My Created Personas</h2>
        <div className="text-center py-12">
          <p className="text-white/60 mb-6">You haven&apos;t created any personas yet.</p>
          <Link
            href="/create"
            className="inline-block bg-white/10 backdrop-blur-md text-white px-8 py-3 rounded-full hover:bg-white/20 transition-all duration-300"
          >
            Create Your First Persona
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-light text-white mb-6">My Created Personas ({personas.length})</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {personas.map((persona: CreatedPersona) => (
          <PersonaCard key={persona.id} persona={persona} />
        ))}
      </div>
    </div>
  );
}
