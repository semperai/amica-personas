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

  // Return the first part as the subdomain
  return parts[0];
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
 * Inject configuration into HTML
 * @param html - Original HTML content
 * @param config - Amica configuration to inject
 * @returns HTML with injected configuration script
 */
export function injectConfig(html: string, config: AmicaConfig): string {
  // Build localStorage injection script for valid config keys
  const localStorageLines: string[] = [];

  // Inject persona name
  localStorageLines.push(
    `localStorage.setItem('${AMICA_LOCALSTORAGE_PREFIX}name', ${JSON.stringify(config.personaName)});`
  );

  // Inject metadata as localStorage for valid keys
  for (const [key, value] of Object.entries(config.metadata)) {
    if (isValidConfigKey(key)) {
      localStorageLines.push(
        `localStorage.setItem('${AMICA_LOCALSTORAGE_PREFIX}${key}', ${JSON.stringify(value)});`
      );
    }
  }

  // Build the full script tag with persona config and localStorage
  const script = `<script>
window.__AMICA_PERSONA__ = ${JSON.stringify(config, null, 2)};
${localStorageLines.join('\n')}
</script>`;

  // Try to inject before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `${script}\n</head>`);
  }

  // If no </head>, inject at beginning of <body>
  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>\n${script}`);
  }

  // If no standard tags, inject at the beginning
  return script + html;
}

/**
 * Log with timestamp
 */
export function log(message: string, ...args: any[]): void {
  console.log(`[${new Date().toISOString()}]`, message, ...args);
}
