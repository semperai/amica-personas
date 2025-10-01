import Link from 'next/link';
import Image from 'next/image';
import ArbiusLogo from '@/assets/ArbiusLogo.webp';
import EffectiveAccelerationLogo from '@/assets/EffectiveAccelerationLogo.webp';
import CatgirlLogo from '@/assets/CatgirlLogo.webp';

export default function EcosystemSection() {
  return (
    <section className="border-t border-border bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Built on a Powerful Ecosystem</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Amica Personas integrates with leading AI and blockchain infrastructure
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Arbius */}
          <a
            href="https://arbius.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-card border border-border rounded-xl p-8 hover:border-brand-blue/50 hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                <Image
                  src={ArbiusLogo}
                  alt="Arbius Logo"
                  width={48}
                  height={48}
                  className="rounded-lg"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground group-hover:text-brand-blue transition-colors">Arbius</h3>
                <p className="text-sm text-muted-foreground">Decentralized AI</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              Decentralized AI computation network powering on-chain machine learning and AI model inference
            </p>
            <div className="flex items-center text-brand-blue text-sm font-medium">
              Learn more
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </a>

          {/* e/acc */}
          <a
            href="https://effectiveacceleration.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-card border border-border rounded-xl p-8 hover:border-brand-blue/50 hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                <Image
                  src={EffectiveAccelerationLogo}
                  alt="e/acc Logo"
                  width={48}
                  height={48}
                  className="rounded-lg"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground group-hover:text-brand-blue transition-colors">e/acc</h3>
                <p className="text-sm text-muted-foreground">Effective Acceleration</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              Peer-to-peer decentralized marketplace enabling direct collaboration between workers and employers without intermediaries
            </p>
            <div className="flex items-center text-brand-blue text-sm font-medium">
              Learn more
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </a>

          {/* CATGIRL Protocol */}
          <a
            href="https://catgirl.boo"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-card border border-border rounded-xl p-8 hover:border-brand-blue/50 hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                <Image
                  src={CatgirlLogo}
                  alt="CATGIRL Logo"
                  width={48}
                  height={48}
                  className="rounded-lg"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground group-hover:text-brand-blue transition-colors">CATGIRL</h3>
                <p className="text-sm text-muted-foreground">P2P Protocol</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">
              Encrypted peer-to-peer messaging and blockchain infrastructure enabling autonomous agent interactions
            </p>
            <div className="flex items-center text-brand-blue text-sm font-medium">
              Learn more
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </a>
        </div>

        {/* Integration Benefits */}
        <div className="mt-12 p-6 bg-gradient-to-r from-brand-blue/5 to-brand-cyan/5 rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">Why This Matters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="text-center">
              <div className="text-2xl mb-2">🤖</div>
              <p className="text-foreground font-medium mb-1">AI-Powered</p>
              <p className="text-muted-foreground">Personas backed by decentralized AI computation</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🔒</div>
              <p className="text-foreground font-medium mb-1">Secure & Private</p>
              <p className="text-muted-foreground">Encrypted P2P communication for agent interactions</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">⚡</div>
              <p className="text-foreground font-medium mb-1">Cross-Chain</p>
              <p className="text-muted-foreground">Deploy on Ethereum, Base, and Arbitrum</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
