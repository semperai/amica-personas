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
 * Inject config script into HTML
 * Sets localStorage values that Amica's config system will read
 * @param html - Original HTML content
 * @param config - Configuration to inject
 * @returns Modified HTML with injected config
 */
export function injectConfig(html: string, config: AmicaConfig): string {
  // Start with persona name
  const amicaConfigOverrides: Record<string, string> = {
    name: config.personaName,
  };

  // Dynamically inject any metadata that matches valid Amica config keys
  // This allows new config keys to be added to Amica without updating this server
  Object.entries(config.metadata).forEach(([key, value]) => {
    if (isValidConfigKey(key)) {
      amicaConfigOverrides[key] = value;
    }
  });

  // Build localStorage setter script
  const configScript = `
    <script>
      // Store full persona config for potential future use
      window.__AMICA_PERSONA__ = ${JSON.stringify(config, null, 2)};

      // Set localStorage values that Amica's config system reads
      ${Object.entries(amicaConfigOverrides)
        .map(([key, value]) =>
          `localStorage.setItem('${AMICA_LOCALSTORAGE_PREFIX}${key}', ${JSON.stringify(value)});`
        )
        .join('\n      ')}
    </script>
  `;

  // Inject before closing </head> tag, or at the beginning of <body> if no </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `${configScript}\n  </head>`);
  } else if (html.includes('<body>')) {
    return html.replace('<body>', `<body>${configScript}\n`);
  } else {
    // Fallback: prepend to the HTML (trim the script to remove leading whitespace)
    return configScript.trim() + '\n' + html;
  }
}

/**
 * Log with timestamp
 */
export function log(message: string, ...args: any[]): void {
  console.log(`[${new Date().toISOString()}]`, message, ...args);
}
