import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import toml from 'toml';

/**
 * Vite plugin to serve /config endpoint from amica.toml in development
 *
 * In production, the subdomain service provides this endpoint.
 * In development, this plugin reads from amica.toml (if present) or returns 404.
 */
export function configServerPlugin(): Plugin {
  return {
    name: 'amica-config-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Only handle /config and /config.json
        if (req.url !== '/config' && req.url !== '/config.json') {
          return next();
        }

        const configPath = path.join(process.cwd(), 'amica.toml');

        // If no amica.toml file, return 404
        if (!fs.existsSync(configPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'No configuration file found',
            message: 'Create an amica.toml file in the project root to configure Amica locally'
          }));
          return;
        }

        try {
          // Read and parse TOML file
          const tomlContent = fs.readFileSync(configPath, 'utf-8');
          const config = toml.parse(tomlContent);

          // Return config as JSON
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(config, null, 2));
        } catch (error) {
          // Handle TOML parsing errors
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Failed to parse amica.toml',
            message: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      });
    }
  };
}
