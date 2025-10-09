import { Persona, PersonaMetadata, AmicaConfig } from './types';
import { isValidConfigKey, AMICA_LOCALSTORAGE_PREFIX } from './amica-config-keys';

/**
 * Parse subdomain from hostname
 * @param hostname - Request hostname (e.g., "cool-agent.amica.bot")
 * @returns Subdomain or null if invalid
 */
export function parseSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');

  // Check if it's a subdomain (at least 3 parts: subdomain.amica.bot)
  if (parts.length < 3) {
    return null;
  }

  const subdomain = parts[0];

  // Validate subdomain format: alphanumeric and hyphens only, 1-63 chars
  // Must start and end with alphanumeric character
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

  if (!subdomainRegex.test(subdomain)) {
    return null;
  }

  // Return the validated subdomain
  return subdomain;
}

/**
 * Get Amica version from persona metadata
 * @param metadata - Persona metadata array
 * @returns Version string (e.g., "1", "2")
 */
export function getAmicaVersion(metadata?: PersonaMetadata[]): string {
  if (!metadata || !Array.isArray(metadata)) {
    return '1'; // default version
  }

  const versionMeta = metadata.find(m => m.key === 'amica_version');
  return versionMeta?.value || '1';
}

/**
 * Build configuration object to inject into Amica
 * @param persona - Persona data from GraphQL
 * @returns Configuration object
 */
export function buildAmicaConfig(persona: Persona): AmicaConfig {
  // Convert metadata array to object
  const metadataObj: Record<string, string> = {};
  if (persona.metadata && Array.isArray(persona.metadata)) {
    persona.metadata.forEach(m => {
      metadataObj[m.key] = m.value;
    });
  }

  return {
    personaName: persona.name,
    personaSymbol: persona.symbol,
    chainId: persona.chainId,
    tokenId: persona.tokenId,
    domain: persona.domain,
    erc20Token: persona.erc20Token,
    creator: persona.creator,
    owner: persona.owner,
    isGraduated: persona.pairCreated,
    metadata: metadataObj,
  };
}


/**
 * HTML escape function to prevent XSS
 * @param unsafe - Unsafe string that may contain HTML
 * @returns Escaped string safe for HTML
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Inject a script tag into HTML
 *
 * Utility function for injecting JavaScript into HTML before serving.
 * Can be used for:
 * - Backwards compatibility patches for older Amica versions
 * - Feature flags or A/B testing
 * - Analytics or monitoring code
 * - Version-specific bug fixes
 * - Security enhancements
 *
 * @param html - Original HTML string
 * @param scriptContent - JavaScript code to inject (without <script> tags)
 * @param position - Where to inject: 'head' (before </head>), 'body' (after <body>), or 'start' (beginning of HTML)
 * @returns Modified HTML with injected script
 *
 * @example
 * ```typescript
 * // Inject polyfill for older versions
 * const patched = injectScript(html, 'if (!window.fetch) { /* polyfill *\/ }', 'head');
 *
 * // Inject feature flag
 * const withFlag = injectScript(html, 'window.__FEATURE_FLAGS__ = { newUI: true };', 'head');
 * ```
 */
export function injectScript(html: string, scriptContent: string, position: 'head' | 'body' | 'start' = 'head'): string {
  const script = `<script>\n${scriptContent}\n</script>`;

  switch (position) {
    case 'head':
      if (html.includes('</head>')) {
        return html.replace('</head>', `${script}\n</head>`);
      }
      // Fallthrough to body if no </head>
    case 'body':
      if (html.includes('<body>')) {
        return html.replace('<body>', `<body>\n${script}`);
      }
      // Fallthrough to start if no <body>
    case 'start':
      return script + html;
    default:
      return html;
  }
}

/**
 * Build localStorage initialization script for Amica config
 *
 * NOTE: This is maintained for backwards compatibility but not currently used.
 * Modern Amica versions use the /config endpoint instead.
 *
 * Generates JavaScript to set localStorage items from persona config.
 * Could be useful for:
 * - Supporting older Amica versions that used localStorage
 * - Pre-populating config for faster initial load
 * - Testing or development environments
 *
 * @param config - AmicaConfig object
 * @returns JavaScript code (without <script> tags) that sets localStorage
 */
export function buildConfigScript(config: AmicaConfig): string {
  const scriptLines: string[] = [];

  // Store full persona config in window.__AMICA_PERSONA__
  scriptLines.push(`window.__AMICA_PERSONA__ = ${JSON.stringify(config, null, 2)};`);

  // Set persona name in localStorage
  scriptLines.push(`localStorage.setItem('${AMICA_LOCALSTORAGE_PREFIX}name', ${JSON.stringify(config.personaName)});`);

  // Set valid metadata keys in localStorage
  if (config.metadata) {
    Object.entries(config.metadata).forEach(([key, value]) => {
      if (isValidConfigKey(key)) {
        scriptLines.push(`localStorage.setItem('${AMICA_LOCALSTORAGE_PREFIX}${key}', ${JSON.stringify(value)});`);
      }
    });
  }

  return scriptLines.join('\n');
}

/**
 * @deprecated Use injectScript and buildConfigScript instead
 * Kept for backwards compatibility with existing tests
 */
export function injectConfig(html: string, config: AmicaConfig): string {
  return injectScript(html, buildConfigScript(config), 'head');
}

/**
 * Log with timestamp
 */
export function log(message: string, ...args: any[]): void {
  console.log(`[${new Date().toISOString()}]`, message, ...args);
}
