'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Rocket, Code, Zap, Users, Settings, Shield, HelpCircle, Menu, X, Plug, ArrowRightLeft } from 'lucide-react'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'

interface NavSection {
  href: string
  label: string
  icon: LucideIcon
}

interface DividerSection {
  divider: true
  label: string
}

type Section = NavSection | DividerSection

const sections: Section[] = [
  // Main sections
  { href: '/docs', label: 'Introduction', icon: BookOpen },
  { href: '/docs/getting-started', label: 'Getting Started', icon: Rocket },
  { href: '/docs/creating-personas', label: 'Creating Personas', icon: Users },
  { href: '/docs/token-launch', label: 'Token Launch', icon: Zap },
  { href: '/docs/burn-and-claim', label: 'Burn & Claim', icon: ArrowRightLeft },

  // Divider
  { divider: true, label: 'Integrations' },

  // Integration sections
  { href: '/docs/arbius-integration', label: 'Arbius Integration', icon: Plug },
  { href: '/docs/eacc-integration', label: 'E/ACC Integration', icon: Plug },
  { href: '/docs/catgirl-integration', label: 'CATGIRL Integration', icon: Plug },
  { href: '/docs/aius-conversion', label: 'AIUS to AMICA', icon: ArrowRightLeft },

  // Divider
  { divider: true, label: 'Advanced' },

  // Advanced sections
  { href: '/docs/configuration', label: 'Configuration', icon: Settings },
  { href: '/docs/api-reference', label: 'API Reference', icon: Code },
  { href: '/docs/security', label: 'Security', icon: Shield },
  { href: '/docs/faq', label: 'FAQ', icon: HelpCircle },
]

export function DocsNavigation() {
  const pathname = usePathname()

  return (
    <div className="sticky top-20">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Documentation</h2>
      <nav className="space-y-1">
        {sections.map((section, idx) => {
          if ('divider' in section) {
            return (
              <div key={idx} className="pt-4 pb-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </h3>
              </div>
            )
          }

          const navSection = section as NavSection

          return (
            <Link
              key={navSection.href}
              href={navSection.href}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:cursor-pointer flex items-center gap-2 ${
                pathname === navSection.href
                  ? 'bg-brand-blue/20 text-brand-blue font-medium border-l-2 border-brand-blue'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <navSection.icon className="w-4 h-4" />
              {navSection.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function DocsMobileMenu() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="bg-brand-blue hover:bg-blue-500 focus:bg-brand-blue text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-all"
          aria-label="Toggle docs menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex top-16">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar */}
          <div className="relative z-40 w-72 bg-card h-full overflow-y-auto shadow-xl">
            <div className="p-6">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Documentation</h2>
              <nav className="space-y-1">
                {sections.map((section, idx) => {
                  if ('divider' in section) {
                    return (
                      <div key={idx} className="pt-4 pb-2">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {section.label}
                        </h3>
                      </div>
                    )
                  }

                  const navSection = section as NavSection

                  return (
                    <Link
                      key={navSection.href}
                      href={navSection.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-colors hover:cursor-pointer ${
                        pathname === navSection.href
                          ? 'bg-brand-blue/20 text-brand-blue font-medium border-l-2 border-brand-blue'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <navSection.icon className="w-4 h-4" />
                      {navSection.label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
