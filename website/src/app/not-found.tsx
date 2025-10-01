'use client'

import Layout from '@/components/Layout'
import Link from 'next/link'
import { Home, Search, FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* 404 Icon */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-blue/20 blur-3xl rounded-full" />
              <FileQuestion className="w-24 h-24 text-brand-blue relative" strokeWidth={1.5} />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-6xl md:text-7xl font-bold text-foreground mb-4">
            404
          </h1>
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-4">
            Page Not Found
          </h2>

          {/* Description */}
          <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
            Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-blue text-white rounded-lg hover:bg-brand-cyan transition-colors font-medium"
            >
              <Home className="w-5 h-5" />
              Go Home
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
            >
              <Search className="w-5 h-5" />
              Explore Personas
            </Link>
          </div>

          {/* Helpful Links */}
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">
              You might be looking for:
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/create"
                className="text-sm text-brand-blue hover:text-brand-cyan transition-colors"
              >
                Create Persona
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link
                href="/portfolio"
                className="text-sm text-brand-blue hover:text-brand-cyan transition-colors"
              >
                Portfolio
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link
                href="/docs"
                className="text-sm text-brand-blue hover:text-brand-cyan transition-colors"
              >
                Documentation
              </Link>
              <span className="text-muted-foreground">•</span>
              <a
                href="https://t.me/arbius_ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-blue hover:text-brand-cyan transition-colors"
              >
                Get Help
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
