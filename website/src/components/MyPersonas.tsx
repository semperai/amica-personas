// src/components/MyPersonas.tsx
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'urql';
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

// GraphQL query result type
interface UserPortfolioQueryResult {
  createdPersonas?: CreatedPersona[];
}

// Generate gradient for persona cards
const getPersonaGradient = (id: string) => {
  const gradients = [
    'from-brand-blue to-brand-cyan',
    'from-blue-600 to-cyan-500',
    'from-indigo-600 to-blue-600',
    'from-cyan-500 to-blue-600',
    'from-blue-500 to-brand-cyan',
    'from-brand-blue to-blue-500',
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
      className="group relative aspect-[3/4] rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl border border-border bg-card hover:border-brand-blue/50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Gradient (shown while image loads) */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getPersonaGradient(persona.id)} opacity-20`} />

      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={getPersonaImage(persona.id)}
          alt={persona.name}
          fill
          className={`object-cover transition-all duration-700 opacity-30 ${
            imageLoaded ? 'opacity-30' : 'opacity-0'
          } ${isHovered ? 'scale-105' : 'scale-100'}`}
          onLoad={() => setImageLoaded(true)}
          sizes="(max-width: 768px) 50vw, 33vw"
          priority={false}
        />
      </div>

      {/* Gradient overlay for better text contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

      {/* Content */}
      <div className="relative h-full p-5 flex flex-col justify-between">
        {/* Top Section */}
        <div className="flex justify-between items-start">
          <div className="flex flex-wrap gap-1">
            {persona.pairCreated && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-500/20 text-green-400 backdrop-blur-sm text-xs font-medium">
                Graduated
              </span>
            )}
          </div>
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
              <span className="text-xs text-muted-foreground">TVL</span>
              <span className="text-sm font-semibold text-foreground">
                {parseFloat(formatEther(BigInt(persona.totalDeposited || '0'))).toFixed(2)} Ξ
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Created</span>
              <span className="text-sm font-semibold text-foreground">
                {new Date(persona.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Chain indicator */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-brand-blue" />
            <span className="text-xs text-muted-foreground capitalize">{chain.name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MyPersonas({ address }: MyPersonasProps) {
  const [{ data, fetching, error }] = useQuery<UserPortfolioQueryResult>({
    query: GET_USER_PORTFOLIO,
    variables: { creator: address.toLowerCase() },
    pause: !address,
  });

  if (fetching) {
    return (
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-6">My Created Personas</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-6">My Created Personas</h2>
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
        <h2 className="text-2xl font-semibold text-foreground mb-6">My Created Personas</h2>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-6">You haven&apos;t created any personas yet.</p>
          <Link
            href="/create"
            className="inline-block bg-muted backdrop-blur-md text-foreground px-8 py-3 rounded-full hover:bg-muted/80 transition-all duration-300"
          >
            Create Your First Persona
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-foreground mb-6">My Created Personas ({personas.length})</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {personas.map((persona: CreatedPersona) => (
          <PersonaCard key={persona.id} persona={persona} />
        ))}
      </div>
    </div>
  );
}
