import { Persona, PersonaMetadata, AmicaConfig } from './types';

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
 * Log with timestamp
 */
export function log(message: string, ...args: any[]): void {
  console.log(`[${new Date().toISOString()}]`, message, ...args);
}
