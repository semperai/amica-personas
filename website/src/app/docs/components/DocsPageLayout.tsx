import { ReactNode } from 'react'
import { DocsNavigation, DocsMobileMenu } from './DocsNavigation'

interface DocsPageLayoutProps {
  children: ReactNode
}

export function DocsPageLayout({ children }: DocsPageLayoutProps) {
  return (
    <>
      {/* Mobile Menu Button */}
      <DocsMobileMenu />

      {/* Main Content with Sidebar */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="md:grid md:grid-cols-4 md:gap-12">
          {/* Desktop/Tablet Sidebar */}
          <aside className="hidden md:block col-span-1">
            <DocsNavigation />
          </aside>

          {/* Main Content */}
          <main className="col-span-1 md:col-span-3">
            <article className="docs-content">
              {children}
            </article>
          </main>
        </div>
      </div>

      <style jsx global>{`
        .docs-content {
          color: var(--foreground);
        }

        .docs-content h1 {
          font-size: 2.25rem;
          font-weight: 700;
          line-height: 2.5rem;
          margin-bottom: 1.5rem;
          margin-top: 0;
          color: var(--foreground);
        }

        .docs-content h2 {
          font-size: 1.875rem;
          font-weight: 600;
          line-height: 2.25rem;
          margin-top: 3rem;
          margin-bottom: 1.25rem;
          color: var(--foreground);
          border-bottom: 1px solid var(--border);
          padding-bottom: 0.5rem;
        }

        .docs-content h3 {
          font-size: 1.5rem;
          font-weight: 600;
          line-height: 2rem;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: var(--foreground);
        }

        .docs-content h4 {
          font-size: 1.25rem;
          font-weight: 600;
          line-height: 1.75rem;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: var(--foreground);
        }

        .docs-content p {
          font-size: 1rem;
          line-height: 1.75rem;
          margin-bottom: 1.25rem;
          color: var(--foreground);
        }

        .docs-content .lead {
          font-size: 1.25rem;
          line-height: 1.875rem;
          margin-bottom: 2rem;
          color: var(--muted-foreground);
          font-weight: 400;
        }

        .docs-content ul,
        .docs-content ol {
          margin-top: 1rem;
          margin-bottom: 1.25rem;
          padding-left: 1.5rem;
        }

        .docs-content ul {
          list-style-type: disc;
        }

        .docs-content ol {
          list-style-type: decimal;
        }

        .docs-content li {
          margin-top: 0.5rem;
          line-height: 1.75rem;
          color: var(--foreground);
        }

        .docs-content li > ul,
        .docs-content li > ol {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .docs-content a {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
        }

        .docs-content a:hover {
          color: #06b6d4;
          text-decoration: underline;
        }

        .docs-content code {
          background-color: var(--muted);
          padding: 0.25rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          color: #3b82f6;
        }

        .docs-content pre {
          background-color: var(--muted);
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin-top: 1rem;
          margin-bottom: 1.25rem;
        }

        .docs-content pre code {
          background-color: transparent;
          padding: 0;
          color: var(--foreground);
          font-size: 0.875rem;
        }

        .docs-content table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
          margin-bottom: 1.25rem;
        }

        .docs-content th,
        .docs-content td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }

        .docs-content th {
          font-weight: 600;
          color: var(--foreground);
        }

        .docs-content td {
          color: var(--foreground);
        }

        .docs-content strong {
          font-weight: 600;
          color: var(--foreground);
        }

        .docs-content blockquote {
          border-left: 4px solid var(--border);
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: var(--muted-foreground);
        }

        .docs-content hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 2rem 0;
        }

        /* Utility classes for styled boxes */
        .docs-content .not-prose {
          all: revert;
        }
      `}</style>
    </>
  )
}
