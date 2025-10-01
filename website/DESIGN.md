# Amica Personas - Design System

A modern, clean interface for AI persona creation and trading, inspired by the technical elegance of CATGIRL Protocol.

## Project Context

**Amica Personas** is a token launcher platform for AI personas. It integrates with:
- **Amica**: 3D rendering engine for persona visualization and interaction
- **CATGIRL Protocol**: P2P encrypted messaging and blockchain infrastructure for agent functionality

While these projects work together, Amica Personas has its own distinct brand identity as a token launcher and trading platform.

## Design Philosophy

1. **Clean & Professional**: Trading platform first, clear information hierarchy
2. **Dual Theme Ready**: Optimized for both light and dark modes with careful contrast
3. **Minimal but Meaningful**: Subtle animations and transitions, never overwhelming
4. **Border-first Design**: Clean separation through borders rather than heavy backgrounds
5. **Information Dense**: Efficient layout without clutter, optimized for trading views
6. **Accessibility First**: High contrast ratios, focus indicators, semantic HTML

## Tech Stack

- **Framework**: Next.js 15.5.4 with Turbopack
- **React**: 19.x
- **Styling**: Tailwind CSS v4 with OKLCH color space
- **UI Components**: Custom components (inspired by Radix UI patterns)
- **Fonts**:
  - Inter (body & headings) - clean, modern, professional
  - JetBrains Mono (code/addresses) - technical monospace
- **Icons**: Lucide React or Heroicons
- **Theme**: Dark/light mode with next-themes

## Color Palette

### Brand Colors

**Philosophy**: Blue/Cyan system - conveys trust, technology, and financial stability. Distinct from CATGIRL's pink/purple.

#### Blue/Cyan System
- **Primary Blue**: `oklch(0.55 0.2 240)` light / `oklch(0.65 0.18 240)` dark
  - Used for: Primary CTAs, active states, trading indicators
- **Accent Cyan**: `oklch(0.7 0.15 200)` light / `oklch(0.75 0.13 200)` dark
  - Used for: Secondary accents, highlights, hover states
- **Blue Light**: `oklch(0.92 0.03 240)` light / `oklch(0.25 0.05 240)` dark
  - Used for: Subtle backgrounds, cards with brand color
- **Cyan Light**: `oklch(0.94 0.025 200)` light / `oklch(0.23 0.04 200)` dark
  - Used for: Accent backgrounds, hover surfaces

### Semantic Colors (OKLCH)

#### Light Mode
- **Background**: `oklch(1 0 0)` - Pure white
- **Foreground**: `oklch(0.145 0 0)` - Near black
- **Card**: `oklch(1 0 0)` - White cards
- **Border**: `oklch(0.922 0 0)` - Light gray borders
- **Muted Text**: `oklch(0.556 0 0)` - Medium gray for secondary text
- **Surface**: `oklch(0.985 0 0)` - Slightly off-white for subtle elevation

#### Dark Mode
- **Background**: `oklch(0.145 0 0)` - Deep dark
- **Foreground**: `oklch(0.985 0 0)` - Off white
- **Card**: `oklch(0.205 0 0)` - Dark card background
- **Border**: `oklch(1 0 0 / 10%)` - Transparent white overlay
- **Muted Text**: `oklch(0.708 0 0)` - Light gray for secondary text
- **Surface**: `oklch(0.185 0 0)` - Elevated dark surfaces

#### Status Colors (Both Modes)
- **Success**: `oklch(0.6 0.2 145)` - Green for graduated personas, completed actions
- **Warning**: `oklch(0.7 0.2 85)` - Yellow for pending, ready to graduate
- **Error**: `oklch(0.577 0.245 27.325)` - Red for errors, destructive actions
- **Info**: `oklch(0.6 0.2 230)` - Blue for informational messages

#### Persona-Specific Colors
- **Agent Token**: Blue-violet `oklch(0.6 0.18 280)` - For personas with agent token integration (CATGIRL Protocol)
- **Graduated**: Green `oklch(0.6 0.2 145)` - For personas that have graduated to Uniswap
- **Trending**: Orange `oklch(0.65 0.2 40)` - Hot personas with high trading activity
- **Volume Indicator**: Gradient based on trading volume intensity

## Typography

### Font Stack
```css
--font-body: 'Inter', system-ui, -apple-system, sans-serif;
--font-display: 'Inter', system-ui, -apple-system, sans-serif; /* Same as body for consistency */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
```

**Note**: Using Inter for both body and headings provides a clean, professional, and unified appearance suitable for a trading platform. Differentiation comes from weight and size, not different typefaces.

### Type Scale
- **text-xs**: 0.75rem (12px) - Small labels, badges
- **text-sm**: 0.875rem (14px) - Body text, descriptions
- **text-base**: 1rem (16px) - Default body
- **text-lg**: 1.125rem (18px) - Emphasized text
- **text-xl**: 1.25rem (20px) - Subheadings
- **text-2xl**: 1.5rem (24px) - Section headings
- **text-3xl**: 1.875rem (30px) - Page headings
- **text-4xl**: 2.25rem (36px) - Hero headings
- **text-5xl**: 3rem (48px) - Large display
- **text-6xl**: 3.75rem (60px) - Extra large display

### Font Weights
- **400**: Regular - Body text
- **500**: Medium - Emphasized body, labels
- **600**: Semibold - Subheadings, buttons
- **700**: Bold - Headings

## Layout System

### Containers
- **Max Width**: `max-w-7xl` (1280px) for main content
- **Wide Content**: `max-w-screen-2xl` (1536px) for full-width sections
- **Narrow Content**: `max-w-2xl` (672px) for forms, detailed content

### Spacing Scale
- **Horizontal Padding**: `px-4 md:px-6` responsive
- **Section Spacing**: `py-12 md:py-16` for major sections
- **Component Gaps**:
  - Tight: `gap-2` (0.5rem)
  - Default: `gap-4` (1rem)
  - Loose: `gap-6` (1.5rem)
  - Section: `gap-8` (2rem)

### Grid System
- Mobile-first with breakpoints:
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
  - `2xl`: 1536px

## Component Guidelines

### Navigation
```tsx
- Sticky top bar: `sticky top-0 bg-background/95 backdrop-blur-sm z-40`
- Border: `border-b border-border`
- Padding: `py-2 md:py-3 px-4 md:px-6`
- Logo: Small `h-5 w-5 md:h-6 md:w-6`
- Links: `text-sm` with subtle hover states
- Active state: Gradient background `from-brand-purple-light/30 to-brand-pink-light/30`
- Mobile: Sheet/drawer with hamburger menu
```

### Cards (Persona Cards)
```tsx
- Base: `rounded-lg border border-border bg-card`
- Hover: `hover:shadow-lg transition-shadow`
- Padding: `p-4 md:p-6`
- Aspect ratio: `aspect-[3/4]` for persona cards
- Image overlay: Gradient from-black/80 to transparent
- Glass effect: `backdrop-blur-sm bg-white/5`
```

### Buttons
```tsx
// Primary CTA
className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500
  text-white rounded-lg hover:from-blue-600 hover:to-cyan-600
  transition-all shadow-sm hover:shadow-md"

// Secondary
className="px-6 py-3 border border-border bg-card
  hover:bg-muted rounded-lg transition-colors"

// Ghost
className="px-6 py-3 hover:bg-muted rounded-lg transition-colors"

// Sizes: sm (h-8 px-3), default (h-9 px-4), lg (h-10 px-6)
```

### Forms
```tsx
// Input fields
className="w-full px-4 py-3 bg-card border border-border
  rounded-lg text-foreground placeholder:text-muted-foreground
  focus:outline-none focus:ring-2 focus:ring-ring"

// Labels
className="text-sm font-medium text-foreground mb-2"

// Help text
className="text-xs text-muted-foreground mt-1"
```

### Badges/Pills
```tsx
// Default
className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs"

// Success (Graduated)
className="px-2 py-1 rounded-full bg-success/20 text-success text-xs"

// Warning (Ready)
className="px-2 py-1 rounded-full bg-warning/20 text-warning text-xs"

// Info (Agent - uses CATGIRL Protocol)
className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs"
```

### Persona Grid
```tsx
// Grid container
className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6"

// Card hover effects
- Image scale: `hover:scale-110 transition-transform duration-700`
- Shadow: `hover:shadow-2xl`
- Overlay: `hover:bg-white/5`
```

## Animation Guidelines

### Transitions
- **Standard**: `transition-all duration-300` for most interactions
- **Slow**: `duration-500` for hero animations
- **Fast**: `duration-150` for micro-interactions

### Keyframes
```css
/* Fade in from below */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Hover glow effect - Blue theme */
@keyframes glow {
  0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
  50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.5); }
}
```

### Usage
- Entrance animations: Stagger with delay classes
- Hover states: Subtle scale and shadow changes
- Loading states: Pulse or shimmer effects
- Never use animations longer than 1 second

## Accessibility

### Contrast Ratios
- Normal text: Minimum 4.5:1
- Large text (18px+): Minimum 3:1
- UI components: Minimum 3:1

### Focus Indicators
- Always visible: `focus:ring-2 focus:ring-ring focus:ring-offset-2`
- Skip to main content link for keyboard users
- Proper ARIA labels on interactive elements

### Semantic HTML
- Use proper heading hierarchy (h1 → h6)
- Button elements for actions, links for navigation
- Lists for groups of related items
- Form labels properly associated with inputs

## Performance Targets

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Total Blocking Time**: < 300ms
- **Cumulative Layout Shift**: < 0.1

### Optimization Strategies
- Server components for static content
- Client components only where interactivity needed
- Next.js Image optimization for all images
- Code splitting by route
- Lazy loading for below-the-fold content
- Backdrop blur for depth without heavy images

## Dark Mode Implementation

```tsx
// Use next-themes provider
import { ThemeProvider } from 'next-themes'

// Toggle component
<ThemeProvider attribute="class" defaultTheme="system">
  {children}
</ThemeProvider>

// Always test both themes
// Use semantic color variables (bg-background not bg-white)
```

## Image Guidelines

### Persona Images
- Format: WebP with fallback
- Dimensions: 400x500 (aspect-[3/4])
- Optimization: Next.js Image component
- Loading: Blur placeholder with gradient fallback
- Alt text: "{Persona name} - AI Persona"

### Icons
- Size: Consistent scale (16px, 20px, 24px)
- Stroke width: 1.5-2px
- Color: text-foreground or text-muted-foreground
- Interactive: Hover state with color change

## Responsive Design

### Mobile First
- Design for 375px width minimum
- Touch targets: Minimum 44x44px
- Readable text without zooming
- Proper spacing for fat fingers

### Breakpoint Strategy
```tsx
// Stack on mobile, grid on desktop
<div className="flex flex-col md:grid md:grid-cols-2 gap-4">

// Hide on mobile, show on desktop
<div className="hidden md:block">

// Responsive text sizing
<h1 className="text-3xl md:text-5xl lg:text-6xl">
```

## Maintenance

### Adding New Components
1. Use semantic color variables
2. Test in both light and dark themes
3. Ensure proper contrast ratios
4. Add hover states for interactive elements
5. Include focus indicators
6. Document props and usage

### Design Tokens
- Never hardcode colors (use CSS variables)
- Use spacing scale consistently
- Follow typography scale
- Maintain border radius consistency

## Examples

See `/src/app/components/` for reference implementations:
- `PersonaCard.tsx` - Card component with hover effects
- `HeroSection.tsx` - Hero banner with gradients
- `PersonaGrid.tsx` - Responsive grid layout
- `/components/Layout.tsx` - Navigation and layout structure
