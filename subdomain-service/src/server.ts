import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { GraphQLClient } from 'graphql-request';
import cors from 'cors';
import dotenv from 'dotenv';
import { GET_PERSONA_BY_DOMAIN } from './graphql';
import { PersonasResponse } from './types';
import { parseSubdomain, getAmicaVersion, buildAmicaConfig, injectConfig, log } from './utils';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://squid.subsquid.io/amica-personas/graphql';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '42161', 10);

// GraphQL client
const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));

/**
 * Landing page for root domain
 */
function renderLandingPage(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Amica - AI Personas on the Blockchain</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            text-align: center;
          }
          h1 {
            font-size: 4em;
            margin-bottom: 0.3em;
            font-weight: 700;
            letter-spacing: -0.02em;
          }
          p {
            font-size: 1.5em;
            opacity: 0.95;
            margin-bottom: 1em;
            line-height: 1.6;
          }
          a {
            color: white;
            text-decoration: none;
            border-bottom: 2px solid rgba(255, 255, 255, 0.5);
            transition: border-color 0.2s;
          }
          a:hover {
            border-bottom-color: white;
          }
          .cta {
            display: inline-block;
            margin-top: 2em;
            padding: 1em 2.5em;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid white;
            border-radius: 50px;
            font-size: 1.2em;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s;
            backdrop-filter: blur(10px);
          }
          .cta:hover {
            background: white;
            color: #667eea;
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Amica</h1>
          <p>Create and interact with AI personas on the blockchain</p>
          <p>Each persona gets its own subdomain and can be customized with unique AI models, voices, and personalities.</p>
          <a href="https://amica.bot" class="cta">Create Your Persona</a>
        </div>
      </body>
    </html>
  `;
}

/**
 * 404 page for non-existent personas
 */
function render404Page(subdomain: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Persona Not Found - Amica</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            text-align: center;
          }
          .error-code {
            font-size: 8em;
            font-weight: 700;
            opacity: 0.3;
            line-height: 1;
            margin-bottom: 0.2em;
          }
          h1 {
            font-size: 2.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
          }
          p {
            font-size: 1.2em;
            opacity: 0.9;
            margin-bottom: 1em;
            line-height: 1.6;
          }
          .subdomain {
            font-family: 'Monaco', 'Courier New', monospace;
            background: rgba(255, 255, 255, 0.2);
            padding: 0.3em 0.6em;
            border-radius: 5px;
            font-weight: 600;
          }
          .cta {
            display: inline-block;
            margin-top: 2em;
            padding: 1em 2em;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid white;
            border-radius: 50px;
            color: white;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
            backdrop-filter: blur(10px);
          }
          .cta:hover {
            background: white;
            color: #f5576c;
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-code">404</div>
          <h1>Persona Not Found</h1>
          <p>The persona <span class="subdomain">${subdomain}</span> doesn't exist on Arbitrum One.</p>
          <p>It may not have been created yet, or it could be on a different chain.</p>
          <a href="https://amica.bot" class="cta">← Back to Amica</a>
        </div>
      </body>
    </html>
  `;
}

/**
 * Error page for server errors
 */
function renderErrorPage(error: Error): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - Amica</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            color: #333;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            background: white;
            padding: 3em;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }
          h1 {
            font-size: 2em;
            margin-bottom: 0.5em;
            color: #e53e3e;
          }
          p {
            font-size: 1.1em;
            color: #718096;
            margin-bottom: 1.5em;
            line-height: 1.6;
          }
          pre {
            background: #f7fafc;
            padding: 1em;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 0.9em;
            color: #2d3748;
          }
          .cta {
            display: inline-block;
            margin-top: 1.5em;
            padding: 0.8em 1.8em;
            background: #667eea;
            border-radius: 50px;
            color: white;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
          }
          .cta:hover {
            background: #5568d3;
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Oops! Something went wrong</h1>
          <p>We encountered an error while loading this persona. Please try again later.</p>
          <pre>${error.message}</pre>
          <a href="https://amica.bot" class="cta">← Back to Amica</a>
        </div>
      </body>
    </html>
  `;
}

/**
 * Version not available page
 */
function renderVersionNotAvailablePage(version: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Version Not Available - Amica</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            text-align: center;
          }
          h1 {
            font-size: 2.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
          }
          p {
            font-size: 1.2em;
            opacity: 0.9;
            margin-bottom: 1em;
            line-height: 1.6;
          }
          .version {
            font-family: 'Monaco', 'Courier New', monospace;
            background: rgba(255, 255, 255, 0.2);
            padding: 0.3em 0.6em;
            border-radius: 5px;
            font-weight: 600;
          }
          .cta {
            display: inline-block;
            margin-top: 2em;
            padding: 1em 2em;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid white;
            border-radius: 50px;
            color: white;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
            backdrop-filter: blur(10px);
          }
          .cta:hover {
            background: white;
            color: #a6c1ee;
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Version Not Available</h1>
          <p>Amica version <span class="version">v${version}</span> is not available on this server.</p>
          <p>Please contact the persona creator to update to a supported version.</p>
          <a href="https://amica.bot" class="cta">← Back to Amica</a>
        </div>
      </body>
    </html>
  `;
}

// Main request handler
app.get('*', async (req: Request, res: Response, next: NextFunction) => {
  const hostname = req.hostname;
  const subdomain = parseSubdomain(hostname);

  log(`Request: ${hostname}${req.path}`);

  // If no subdomain or root domain, serve landing page
  if (!subdomain || subdomain === 'www') {
    return res.send(renderLandingPage());
  }

  try {
    // Query GraphQL for persona
    log(`Looking up persona: ${subdomain}`);

    const data = await graphqlClient.request<PersonasResponse>(GET_PERSONA_BY_DOMAIN, {
      domain: subdomain,
      chainId: CHAIN_ID,
    });

    if (!data.personas || data.personas.length === 0) {
      log(`Persona not found: ${subdomain}`);
      return res.status(404).send(render404Page(subdomain));
    }

    const persona = data.personas[0];
    const version = getAmicaVersion(persona.metadata);
    const buildsDir = path.join(__dirname, '..', 'builds', `amica_v${version}`);

    log(`Persona found: ${persona.name} (version ${version})`);

    // Check if the build directory exists
    if (!fs.existsSync(buildsDir)) {
      log(`Build not found: amica_v${version}`);
      return res.status(500).send(renderVersionNotAvailablePage(version));
    }

    // Build config object
    const config = buildAmicaConfig(persona);

    // If requesting the root, serve index.html with injected config
    if (req.path === '/' || req.path === '/index.html') {
      const indexPath = path.join(buildsDir, 'index.html');

      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = injectConfig(html, config);
        return res.send(html);
      }
    }

    // Serve other static files normally
    express.static(buildsDir)(req, res, next);

  } catch (error) {
    log('Error:', error);
    return res.status(500).send(renderErrorPage(error as Error));
  }
});

app.listen(PORT, () => {
  log(`Amica Subdomain Service running on port ${PORT}`);
  log(`GraphQL endpoint: ${GRAPHQL_ENDPOINT}`);
  log(`Chain ID: ${CHAIN_ID}`);
});
