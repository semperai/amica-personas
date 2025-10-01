import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative border-b border-border">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/5 via-background to-background" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Hero Content */}
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-24 md:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
            Launch & Trade
            <span className="block text-brand-blue">AI Personas</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Token launcher platform for AI personas with bonding curves, automated graduation, and cross-chain support
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/create"
              className="px-8 py-3 bg-brand-blue text-white rounded-lg hover:bg-blue-500 transition-all font-semibold shadow-lg hover:shadow-xl"
            >
              Create Persona
            </Link>
            <Link
              href="#explore"
              className="px-8 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-all font-semibold border border-border"
            >
              Explore Personas
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
