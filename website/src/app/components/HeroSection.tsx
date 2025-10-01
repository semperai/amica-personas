import Link from 'next/link';
import AnimatedHeroText from './AnimatedHeroText';

export default function HeroSection() {
  return (
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
  );
}
